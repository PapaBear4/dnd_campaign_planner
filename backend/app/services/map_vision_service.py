import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from app.models import EdgeCreate, NodeCreate, NodeUpdate
from app.services import graph_service
from app.services.graph_service import get_setting

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"


def resolve_map_image_path(map_url: str) -> Optional[Path]:
    """
    Resolves a map URL to a local filesystem Path.
    Handles:
      - /api/uploads/<filename>
      - uploads/<filename>
      - data/uploads/<filename>
      - absolute paths
    """
    if not map_url:
        return None

    clean_url = map_url.strip().split("?")[0].split("#")[0]

    # Handle /api/uploads/<filename>
    if "/api/uploads/" in clean_url:
        filename = clean_url.split("/api/uploads/")[-1].lstrip("/")
        p = UPLOAD_DIR / filename
        if p.exists():
            return p

    # Handle data/uploads or uploads relative paths
    if "uploads/" in clean_url:
        filename = clean_url.split("uploads/")[-1].lstrip("/")
        p = UPLOAD_DIR / filename
        if p.exists():
            return p

    # Handle direct path on disk
    direct_p = Path(clean_url)
    if direct_p.is_absolute() and direct_p.exists():
        return direct_p

    # Try relative to workspace
    ws_p = Path(__file__).resolve().parent.parent.parent.parent / clean_url.lstrip("/")
    if ws_p.exists():
        return ws_p

    return None


def _load_and_optimize_image(image_path: Path, max_dimension: int = 3072) -> Tuple[Image.Image, int, int]:
    """
    Loads an image with PIL, converts to RGB, and scales down if overly large
    to ensure fast and reliable Gemini vision inference.
    Returns (pil_image, original_width, original_height).
    """
    img = Image.open(str(image_path))
    orig_w, orig_h = img.size

    if img.mode != "RGB":
        img = img.convert("RGB")

    # Resize if overly large
    if max(orig_w, orig_h) > max_dimension:
        ratio = max_dimension / float(max(orig_w, orig_h))
        new_w = int(orig_w * ratio)
        new_h = int(orig_h * ratio)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        logger.info(f"Scaled map image from ({orig_w}x{orig_h}) to ({new_w}x{new_h}) for vision scan")

    return img, orig_w, orig_h


def _find_matching_campaign_node(
    label: str,
    room_number: Optional[str],
    candidate_nodes: List[Any],
) -> Optional[Any]:
    """
    Fuzzy-matches a detected room/label on a map against existing campaign entities.
    Checks:
      1. Room number matching (e.g. '1', 'Area 1', 'Room 1', '1. Ledge')
      2. Direct title match or strong substring containment
    """
    if not candidate_nodes:
        return None

    clean_label = label.lower().strip()
    clean_num = str(room_number).strip().lower() if room_number else ""

    # Priority 1: Match by room number if present
    if clean_num:
        num_patterns = [
            re.compile(rf"\barea\s*{re.escape(clean_num)}\b", re.IGNORECASE),
            re.compile(rf"\broom\s*{re.escape(clean_num)}\b", re.IGNORECASE),
            re.compile(rf"^{re.escape(clean_num)}[\.\:\s\-]", re.IGNORECASE),
            re.compile(rf"\b{re.escape(clean_num)}\b", re.IGNORECASE),
        ]
        for node in candidate_nodes:
            t = node.title.lower()
            # Also check node's data_json room_number
            node_data = node.data_json or {}
            if str(node_data.get("room_number", "")).strip().lower() == clean_num:
                return node
            for pat in num_patterns:
                if pat.search(t):
                    return node

    # Priority 2: Match by exact title or strong token overlap
    for node in candidate_nodes:
        t = node.title.lower().strip()
        if t == clean_label:
            return node
        # Strip common prefixes like 'area 1:' or '1. '
        stripped_t = re.sub(r"^(area|room)?\s*\d+[\.\:\-\s]*", "", t).strip()
        stripped_label = re.sub(r"^(area|room)?\s*\d+[\.\:\-\s]*", "", clean_label).strip()
        if stripped_t and stripped_label and (stripped_t in stripped_label or stripped_label in stripped_t):
            return node

    return None


def scan_map_with_gemini_vision(
    map_id: str,
    campaign_id: str,
    instruction: Optional[str] = "",
    auto_align_existing: bool = True,
    create_missing_nodes: bool = True,
    connect_passages: bool = True,
    apply_changes: bool = False,
) -> Dict[str, Any]:
    """
    Performs multimodal vision inspection of a map image using Gemini.
    Detects keyed numbers, room labels, landmarks, and spatial corridors.
    Aligns with existing campaign nodes (Locations, Encounters, NPCs, etc.),
    generates normalized (x, y) pin coordinates (0-100%), and builds
    hierarchy ('contains') and passage ('leads_to') relationships.
    """
    from app.services.ai_agent_service import _get_configured_gemini_client

    map_node = graph_service.get_node(map_id)
    if not map_node:
        raise ValueError(f"Map node with ID '{map_id}' not found.")

    map_data = map_node.data_json or {}
    map_url = map_data.get("map_url") or ""
    if not map_url:
        raise ValueError(f"Map '{map_node.title}' does not have an uploaded map image ('map_url').")

    image_path = resolve_map_image_path(map_url)
    if not image_path or not image_path.exists():
        raise ValueError(f"Map image file could not be located on disk for URL: {map_url}")

    # Load and optimize image with PIL
    pil_image, orig_w, orig_h = _load_and_optimize_image(image_path)

    # Gather campaign context: existing locations, encounters, NPCs, monsters, clues
    all_campaign_nodes = graph_service.list_nodes(campaign_id)
    existing_locations = [n for n in all_campaign_nodes if n.type == "location"]
    existing_encounters = [n for n in all_campaign_nodes if n.type == "encounter"]
    existing_creatures = [n for n in all_campaign_nodes if n.type in ("npc", "monster")]
    existing_clues = [n for n in all_campaign_nodes if n.type in ("clue", "item")]

    existing_pins = map_data.get("pins") or []

    # Compile candidate list for Gemini matching
    candidates_summary = []
    for loc in existing_locations:
        candidates_summary.append(f"- Location [id: {loc.id}]: \"{loc.title}\" ({loc.summary or 'No summary'})")
    for enc in existing_encounters:
        candidates_summary.append(f"- Encounter [id: {enc.id}]: \"{enc.title}\" ({enc.summary or 'Encounter'})")
    for npc in existing_creatures:
        candidates_summary.append(f"- NPC/Monster [id: {npc.id}]: \"{npc.title}\"")
    for cl in existing_clues:
        candidates_summary.append(f"- Item/Clue [id: {cl.id}]: \"{cl.title}\"")

    candidates_text = "\n".join(candidates_summary[:60]) if candidates_summary else "No existing entities in campaign yet."

    existing_pins_text = ", ".join(f"{p.get('label', 'Pin')} at ({p.get('x')}%, {p.get('y')}%)" for p in existing_pins[:15])
    if not existing_pins_text:
        existing_pins_text = "None placed yet."

    # Gemini client
    model, model_name = _get_configured_gemini_client()
    if not model:
        raise RuntimeError("Gemini API key or model is not configured. Please check App Settings.")

    prompt = f"""You are an expert tabletop RPG cartographer and Dungeon Master co-pilot with superhuman computer vision.
You are analyzing a tactical battle map, dungeon map, or regional adventure handout:
- Map Title: "{map_node.title}"
- Map Summary/Context: {map_node.summary or "Tactical RPG battle map"}
- Existing Pins on this map: {existing_pins_text}
- User Directive: {instruction if instruction else "Perform a thorough scan of all keyed areas, room numbers, and major landmarks."}

EXISTING CAMPAIGN ENTITIES (Match these whenever applicable to avoid duplicate entities):
{candidates_text}

TASK INSTRUCTIONS:
1. Examine the visual map image carefully:
   - Identify all keyed room numbers (e.g. 1, 2, 3, Area 4, B1), chamber names, doors, secret doors, stairs, hazards, and prominent landmarks.
   - For every detected point of interest, calculate its exact coordinates in percentage:
     - `x`: horizontal position from 0.0 (left edge) to 100.0 (right edge).
     - `y`: vertical position from 0.0 (top edge) to 100.0 (bottom edge).
     - Place (x, y) at the exact center of the room label, number marker, or chamber center.
2. Match against existing campaign entities:
   - If a detected room or landmark corresponds to one of the EXISTING CAMPAIGN ENTITIES listed above (by room number or name), set `matched_node_id` to its ID and `matched_node_title` to its title.
   - If no existing entity matches, set `matched_node_id` to null and provide an evocative title (e.g. "Area 5: Pillared Chamber") and 1-sentence summary.
3. Detect room connectivity & passages:
   - Identify which rooms are connected by doors, hallways, stairs, or open passages.
   - Propose `leads_to` connections between adjacent rooms (e.g., Area 1 leads to Area 2).

RESPONSE FORMAT:
You MUST respond with valid JSON ONLY matching the following schema:
```json
{{
  "map_type": "dungeon | tactical_battle | regional | settlement",
  "vision_notes": "1-2 sentences summarizing the visual structure, layout, and theme observed.",
  "detected_pins": [
    {{
      "label": "Area 1: Fortress Entry",
      "room_number": "1",
      "x": 28.5,
      "y": 74.2,
      "matched_node_id": "optional-existing-id-or-null",
      "matched_node_title": "optional-existing-title-or-null",
      "node_type": "location",
      "summary": "Heavy iron-reinforced gates flanked by arrow slits.",
      "revealed_to_players": false
    }}
  ],
  "suggested_connections": [
    {{
      "source_room": "1",
      "target_room": "2",
      "source_label": "Area 1: Fortress Entry",
      "target_label": "Area 2: Guard Post",
      "relation_type": "leads_to",
      "label": "Iron door corridor"
    }}
  ]
}}
```
"""

    logger.info(f"Invoking Gemini vision scan for map '{map_node.title}' (model: {model_name})")
    try:
        response = model.generate_content([prompt, pil_image])
        resp_text = response.text if hasattr(response, "text") else ""
    except Exception as gemini_err:
        logger.error(f"Gemini vision call failed: {gemini_err}", exc_info=True)
        raise RuntimeError(f"Multimodal vision analysis failed: {gemini_err}")

    # Parse JSON from response
    parsed_data = _extract_json_from_response(resp_text)
    if not parsed_data:
        raise ValueError("Failed to parse structured JSON from vision model response.")

    raw_detected_pins = parsed_data.get("detected_pins", [])
    raw_connections = parsed_data.get("suggested_connections", [])
    vision_notes = parsed_data.get("vision_notes", "Vision scan complete.")

    # Process and reconcile pins
    processed_pins: List[Dict[str, Any]] = []
    new_nodes_to_create: List[Dict[str, Any]] = []
    existing_nodes_matched: List[Dict[str, Any]] = []

    # Map from room_number / label to the assigned node ID (for wiring edges)
    room_to_node_id: Dict[str, str] = {}

    all_candidate_nodes = all_campaign_nodes if auto_align_existing else []

    for idx, p in enumerate(raw_detected_pins):
        label = str(p.get("label") or f"Point {idx + 1}").strip()
        room_num = str(p.get("room_number") or "").strip()
        try:
            x_val = round(float(p.get("x", 50.0)), 2)
            y_val = round(float(p.get("y", 50.0)), 2)
        except (ValueError, TypeError):
            x_val, y_val = 50.0, 50.0

        # Bound coordinates to 0 - 100
        x_val = max(0.0, min(100.0, x_val))
        y_val = max(0.0, min(100.0, y_val))

        matched_id = p.get("matched_node_id")
        matched_node = None

        if matched_id:
            matched_node = next((n for n in all_candidate_nodes if n.id == matched_id), None)

        # If model didn't provide a valid match ID, run our heuristic matcher
        if not matched_node and auto_align_existing:
            matched_node = _find_matching_campaign_node(label, room_num, all_candidate_nodes)

        pin_id = f"pin-{uuid.uuid4().hex[:8]}"

        if matched_node:
            node_id = matched_node.id
            existing_nodes_matched.append({
                "pin_id": pin_id,
                "node_id": matched_node.id,
                "node_title": matched_node.title,
                "node_type": matched_node.type,
                "label": label,
                "x": x_val,
                "y": y_val,
            })
            assigned_label = matched_node.title or label
        else:
            # Need a new node
            node_id = f"new-loc-{uuid.uuid4().hex[:8]}"
            node_type = p.get("node_type", "location")
            new_node_obj = {
                "temp_id": node_id,
                "type": node_type,
                "title": label,
                "summary": p.get("summary") or f"Area on {map_node.title}",
                "content_markdown": f"### {label}\n\n*Keyed area on **{map_node.title}**.*\n\n{p.get('summary', '')}",
                "data_json": {
                    "room_number": room_num,
                    "parent_map_id": map_node.id,
                    "map_coordinates": {"x": x_val, "y": y_val},
                    "status": "planned",
                },
                "is_canon": False,  # Project rule: new imports default to Draft!
                "revealed_to_players": bool(p.get("revealed_to_players", False)),
            }
            new_nodes_to_create.append(new_node_obj)
            assigned_label = label

        if room_num:
            room_to_node_id[room_num.lower()] = node_id
        room_to_node_id[label.lower()] = node_id

        processed_pins.append({
            "id": pin_id,
            "nodeId": node_id,
            "label": assigned_label,
            "x": x_val,
            "y": y_val,
            "revealed": bool(p.get("revealed_to_players", False)),
            "room_number": room_num,
            "is_new": matched_node is None,
        })

    # Build suggested connections (leads_to edges)
    suggested_edges: List[Dict[str, Any]] = []
    if connect_passages:
        for conn in raw_connections:
            src_room = str(conn.get("source_room", "")).strip().lower()
            tgt_room = str(conn.get("target_room", "")).strip().lower()
            src_label = str(conn.get("source_label", "")).strip().lower()
            tgt_label = str(conn.get("target_label", "")).strip().lower()

            src_id = room_to_node_id.get(src_room) or room_to_node_id.get(src_label)
            tgt_id = room_to_node_id.get(tgt_room) or room_to_node_id.get(tgt_label)

            if src_id and tgt_id and src_id != tgt_id:
                suggested_edges.append({
                    "source_id": src_id,
                    "target_id": tgt_id,
                    "relation_type": conn.get("relation_type", "leads_to"),
                    "label": conn.get("label", "Passage"),
                    "source_title": conn.get("source_label", "Area"),
                    "target_title": conn.get("target_label", "Area"),
                    "is_canon": False,
                })

    result: Dict[str, Any] = {
        "map_id": map_node.id,
        "map_title": map_node.title,
        "vision_notes": vision_notes,
        "detected_pins": processed_pins,
        "matched_existing_nodes": existing_nodes_matched,
        "new_nodes_to_create": new_nodes_to_create,
        "suggested_connections": suggested_edges,
        "applied": False,
        "summary": (
            f"Vision scanned '{map_node.title}': detected {len(processed_pins)} keyed pins "
            f"({len(existing_nodes_matched)} matched existing entities, {len(new_nodes_to_create)} new draft rooms proposed) "
            f"and {len(suggested_edges)} passageway connections."
        ),
    }

    # If apply_changes is requested, execute immediately
    if apply_changes:
        apply_res = apply_map_scan_results(
            map_id=map_node.id,
            campaign_id=campaign_id,
            pins=processed_pins,
            new_nodes=new_nodes_to_create if create_missing_nodes else [],
            new_edges=suggested_edges if connect_passages else [],
        )
        result["applied"] = True
        result["applied_details"] = apply_res

    return result


def apply_map_scan_results(
    map_id: str,
    campaign_id: str,
    pins: List[Dict[str, Any]],
    new_nodes: Optional[List[Dict[str, Any]]] = None,
    new_edges: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Commits approved pins, newly created draft room nodes, and passageway edges
    into SQLite campaign database.
    """
    map_node = graph_service.get_node(map_id)
    if not map_node:
        raise ValueError(f"Map node '{map_id}' not found.")

    new_nodes = new_nodes or []
    new_edges = new_edges or []

    # 1. Create new draft room nodes in SQLite and map temp_id -> real_id
    temp_to_real_node_id: Dict[str, str] = {}
    created_nodes_count = 0

    for n in new_nodes:
        temp_id = n.get("temp_id") or n.get("id")
        created_node = graph_service.create_node(
            NodeCreate(
                campaign_id=campaign_id,
                type=n.get("type", "location"),
                title=n.get("title", "Keyed Location"),
                summary=n.get("summary", ""),
                content_markdown=n.get("content_markdown", ""),
                data_json=n.get("data_json", {}),
                is_canon=n.get("is_canon", False),
                revealed_to_players=n.get("revealed_to_players", False),
                confidence=0.8,
                lore_status="suspicion",
            ),
            default_campaign_id=campaign_id,
        )
        if temp_id:
            temp_to_real_node_id[temp_id] = created_node.id
        created_nodes_count += 1

        # Auto-create hierarchy edge: map contains this new room location
        graph_service.create_edge(
            EdgeCreate(
                campaign_id=campaign_id,
                source_id=map_node.id,
                target_id=created_node.id,
                relation_type="contains",
                label="Map Area",
                is_canon=False,
            ),
            default_campaign_id=campaign_id,
        )

    # 2. Update pins with real node IDs
    final_pins: List[Dict[str, Any]] = []
    for pin in pins:
        node_id = pin.get("nodeId") or pin.get("node_id") or ""
        real_id = temp_to_real_node_id.get(node_id, node_id)
        final_pins.append({
            "id": pin.get("id") or f"pin-{uuid.uuid4().hex[:8]}",
            "nodeId": real_id,
            "label": pin.get("label", "Pin"),
            "x": float(pin.get("x", 50.0)),
            "y": float(pin.get("y", 50.0)),
            "revealed": bool(pin.get("revealed", True)),
            "targetMapId": pin.get("targetMapId"),
        })

    # Merge with existing pins on the map (avoid duplicating pins at identical x,y coordinates)
    existing_pins = (map_node.data_json or {}).get("pins") or []
    merged_pins = list(existing_pins)

    for p in final_pins:
        # Check if a pin already exists at approximately this spot (+/- 1.5%)
        duplicate = next(
            (ep for ep in merged_pins if abs(ep.get("x", -999) - p["x"]) < 1.5 and abs(ep.get("y", -999) - p["y"]) < 1.5),
            None
        )
        if duplicate:
            duplicate["label"] = p["label"]
            duplicate["nodeId"] = p["nodeId"]
            duplicate["revealed"] = p["revealed"]
        else:
            merged_pins.append(p)

    updated_data = dict(map_node.data_json or {})
    updated_data["pins"] = merged_pins

    graph_service.update_node(map_node.id, NodeUpdate(data_json=updated_data))

    # 3. Create edges (leads_to between adjacent rooms)
    created_edges_count = 0
    for edge in new_edges:
        s_id = temp_to_real_node_id.get(edge.get("source_id", ""), edge.get("source_id", ""))
        t_id = temp_to_real_node_id.get(edge.get("target_id", ""), edge.get("target_id", ""))

        if s_id and t_id and s_id != t_id:
            # Avoid duplicate edges
            existing_edges = graph_service.list_edges_for_node(campaign_id, s_id)
            already_exists = any(
                e.get("source_id") == s_id and e.get("target_id") == t_id and e.get("relation_type") == edge.get("relation_type", "leads_to")
                for e in existing_edges
            )
            if not already_exists:
                graph_service.create_edge(
                    EdgeCreate(
                        campaign_id=campaign_id,
                        source_id=s_id,
                        target_id=t_id,
                        relation_type=edge.get("relation_type", "leads_to"),
                        label=edge.get("label", "Passage"),
                        is_canon=edge.get("is_canon", False),
                    ),
                    default_campaign_id=campaign_id,
                )
                created_edges_count += 1

    return {
        "success": True,
        "map_id": map_node.id,
        "pins_count": len(merged_pins),
        "new_nodes_created": created_nodes_count,
        "new_edges_created": created_edges_count,
        "message": f"Successfully applied {len(final_pins)} pins, created {created_nodes_count} draft room nodes, and {created_edges_count} passage edges.",
    }


def place_single_map_pin(
    map_id: str,
    campaign_id: str,
    label: str,
    x: float,
    y: float,
    node_id: Optional[str] = None,
    revealed: bool = True,
    target_map_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Places or updates a single pin on a map node.
    If node_id is omitted, creates a new draft location node for the pin.
    """
    map_node = graph_service.get_node(map_id)
    if not map_node:
        raise ValueError(f"Map node '{map_id}' not found.")

    clean_label = label.strip() or "Map Pin"
    x_val = round(max(0.0, min(100.0, float(x))), 2)
    y_val = round(max(0.0, min(100.0, float(y))), 2)

    target_node_id = node_id

    # If no node specified, create draft Location node
    if not target_node_id:
        new_loc = graph_service.create_node(
            NodeCreate(
                campaign_id=campaign_id,
                type="location",
                title=clean_label,
                summary=f"Point of interest on {map_node.title}",
                content_markdown=f"### {clean_label}\n\n*Keyed landmark located on **{map_node.title}** at ({x_val}%, {y_val}%).* ",
                data_json={"parent_map_id": map_node.id, "map_coordinates": {"x": x_val, "y": y_val}},
                is_canon=False,
                revealed_to_players=revealed,
            ),
            default_campaign_id=campaign_id,
        )
        target_node_id = new_loc.id

        # Edge: map contains new_loc
        graph_service.create_edge(
            EdgeCreate(
                campaign_id=campaign_id,
                source_id=map_node.id,
                target_id=new_loc.id,
                relation_type="contains",
                label="Map Pin",
                is_canon=False,
            ),
            default_campaign_id=campaign_id,
        )

    current_pins = list((map_node.data_json or {}).get("pins") or [])

    # Check for existing pin for this node or coordinate
    existing_pin = next((p for p in current_pins if p.get("nodeId") == target_node_id), None)
    if existing_pin:
        existing_pin["label"] = clean_label
        existing_pin["x"] = x_val
        existing_pin["y"] = y_val
        existing_pin["revealed"] = revealed
        if target_map_id:
            existing_pin["targetMapId"] = target_map_id
        pin_id = existing_pin["id"]
    else:
        pin_id = f"pin-{uuid.uuid4().hex[:8]}"
        new_pin_data: Dict[str, Any] = {
            "id": pin_id,
            "nodeId": target_node_id,
            "label": clean_label,
            "x": x_val,
            "y": y_val,
            "revealed": revealed,
        }
        if target_map_id:
            new_pin_data["targetMapId"] = target_map_id
        current_pins.append(new_pin_data)

    updated_data = dict(map_node.data_json or {})
    updated_data["pins"] = current_pins
    graph_service.update_node(map_node.id, NodeUpdate(data_json=updated_data))

    return {
        "success": True,
        "pin_id": pin_id,
        "map_id": map_node.id,
        "node_id": target_node_id,
        "label": clean_label,
        "x": x_val,
        "y": y_val,
        "revealed": revealed,
    }


def _extract_json_from_response(text: str) -> Optional[Dict[str, Any]]:
    """Helper to cleanly extract JSON from Gemini text response."""
    if not text:
        return None
    try:
        # If enclosed in markdown code blocks ```json ... ```
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            return json.loads(m.group(1))
        # Otherwise find first { and last }
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            return json.loads(text[first : last + 1])
    except Exception as e:
        logger.warning(f"Error parsing JSON from vision response: {e}")
    return None
