from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from typing import Any, Dict, List, Optional
from app.models import (
    AgentChatRequest,
    BoxedTextRequest,
    ChatThreadCreate,
    ChatThreadResponse,
    CoachAdviceRequest,
    DocumentExtractRequest,
    EdgeCreate,
    NodeCreate,
    NodeUpdate,
    WeaveHookRequest,
)
from app.services import ai_agent_service, chat_history_service, graph_service

router = APIRouter(prefix="/api/agent", tags=["agent"])

@router.get("/threads")
def list_threads(campaign_id: str = Query("default-campaign")):
    return chat_history_service.list_threads(campaign_id)

@router.post("/threads")
def create_thread(data: ChatThreadCreate):
    return chat_history_service.create_thread(data.campaign_id, data.title or "New Prep Session")

@router.get("/threads/{thread_id}/messages")
def get_thread_messages(thread_id: str):
    return chat_history_service.get_thread_messages(thread_id)

@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: str):
    chat_history_service.delete_thread(thread_id)
    return {"success": True, "message": "Thread deleted"}

@router.post("/chat")
def chat(request: AgentChatRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    
    # Resolve or create thread
    thread = chat_history_service.get_or_create_thread(cid, request.thread_id)
    thread_id = thread["id"]
    
    # Save the latest user message
    if request.messages and request.messages[-1].role == "user":
        chat_history_service.save_message(
            thread_id=thread_id,
            campaign_id=cid,
            role="user",
            content=request.messages[-1].content
        )
        
    messages = [m.model_dump() for m in request.messages]
    res = ai_agent_service.chat_with_agent(
        messages=messages,
        campaign_id=cid,
        context_node_id=request.context_node_id
    )
    
    # Persist assistant reply with actions_taken
    if res.get("reply"):
        chat_history_service.save_message(
            thread_id=thread_id,
            campaign_id=cid,
            role="assistant",
            content=res["reply"],
            actions_taken=res.get("actions_taken", [])
        )
    
    res["thread_id"] = thread_id
    return res


@router.post("/boxed-text")
def generate_boxed_text(request: BoxedTextRequest):
    return ai_agent_service.generate_boxed_text(
        location_title=request.location_title,
        mood=request.mood or "mysterious, ancient, dangerous",
        sensory_details=request.sensory_details or "damp stone, flickering torchlight",
        dm_notes=request.dm_notes or ""
    )

@router.post("/coach")
def get_coach_advice(request: CoachAdviceRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.get_coach_advice(
        situation=request.situation,
        challenge_type=request.challenge_type,
        campaign_id=cid
    )

@router.post("/weave-hook")
def weave_hook(request: WeaveHookRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.weave_quest_hook(
        pc_name=request.pc_name,
        pc_backstory=request.pc_backstory,
        target_node_id=request.target_node_id,
        campaign_id=cid
    )

@router.post("/extract-entities")
def extract_entities(request: DocumentExtractRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.extract_entities_from_text(
        text_content=request.text_content,
        campaign_id=cid,
        target_arc_id=request.target_arc_id
    )

from app.models import DecomposeAdventureRequest
from app.services import pdf_service
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"

@router.post("/decompose")
def decompose_adventure(request: DecomposeAdventureRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    text_to_analyze = request.text_content or ""

    if request.filename and not text_to_analyze:
        file_path = UPLOAD_DIR / request.filename
        if file_path.exists():
            if file_path.suffix.lower() == ".pdf":
                start_p = request.start_page or 1
                # Default end_page to full document length
                if request.end_page:
                    end_p = request.end_page
                else:
                    import pypdf
                    try:
                        reader = pypdf.PdfReader(str(file_path))
                        end_p = len(reader.pages)
                    except Exception:
                        end_p = 999  # fallback: read all
                text_to_analyze = pdf_service.get_pdf_page_text(str(file_path), start_p, end_p)
            else:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        text_to_analyze = f.read()  # No artificial cap — send full file text
                except Exception:
                    pass

    if not text_to_analyze:
        raise HTTPException(status_code=400, detail="No text content or uploaded file found to analyze.")

    history_dicts = [m.model_dump() for m in request.conversation_history] if request.conversation_history else None

    return ai_agent_service.decompose_adventure_document(
        text_content=text_to_analyze,
        instruction=request.instruction or "",
        decomposition_mode=request.decomposition_mode or "campaign_structure",
        campaign_id=cid,
        current_nodes=request.current_nodes,
        current_edges=request.current_edges,
        conversation_history=history_dicts,
        exhaustive=request.exhaustive if request.exhaustive is not None else True
    )


@router.post("/apply-extracted")
def apply_extracted(data: Dict[str, Any]):
    """
    Commit extracted nodes and edges into the campaign graph with lossless deconfliction.
    Nodes flagged or chosen for 'merge' are merged into existing records, preserving existing
    canon lore while safely appending module notes and filling empty stats.
    Edges are dynamically resolved against both new and existing nodes in SQLite.
    """
    cid = data.get("campaign_id") or graph_service.get_setting("active_campaign_id", "default-campaign")
    created_nodes = []
    merged_nodes = []
    title_to_id: Dict[str, str] = {}

    existing_campaign_nodes = graph_service.list_nodes(cid) if cid else []
    existing_by_id = {n.id: n for n in existing_campaign_nodes}
    existing_by_title_lower = {n.title.lower().strip(): n for n in existing_campaign_nodes}

    # Pre-populate title_to_id with existing campaign nodes so extracted edges can link to existing world elements
    for ex in existing_campaign_nodes:
        title_to_id[ex.id] = ex.id
        title_to_id[ex.title] = ex.id
        title_to_id[ex.title.lower().strip()] = ex.id

    for n in data.get("nodes", []):
        action = n.get("action") or n.get("deconflict_action")
        target_id = n.get("merge_target_id") or n.get("matched_node_id")

        # Automatically merge if action is 'merge' or if exact match was found and not explicitly opted to 'create'
        should_merge = (action == "merge") or (action != "create" and n.get("match_status") == "exact_match" and target_id)

        target_node = None
        if should_merge and target_id:
            target_node = existing_by_id.get(target_id) or graph_service.get_node(target_id)
        elif should_merge and not target_id:
            target_node = existing_by_title_lower.get((n.get("title") or "").lower().strip())

        if should_merge and target_node:
            # 1. Lossless content merge: Preserve canon text, append module notes under a dated header
            existing_content = (target_node.content_markdown or "").strip()
            new_content = (n.get("content_markdown") or "").strip()
            today_str = datetime.now().strftime("%Y-%m-%d")

            if new_content and new_content not in existing_content:
                if existing_content:
                    merged_content = f"{existing_content}\n\n### 📜 Imported Module Notes ({today_str})\n{new_content}".strip()
                else:
                    merged_content = new_content
            else:
                merged_content = existing_content or new_content

            # 2. Summary: Keep existing canon summary; if empty or blank, take new
            merged_summary = target_node.summary or n.get("summary") or ""

            # 3. Subtitle: Keep existing, or use imported if empty
            merged_subtitle = target_node.subtitle or n.get("subtitle") or ""

            # 4. Deep merge data_json (do not overwrite existing non-empty values)
            existing_data = dict(target_node.data_json or {})
            ext_data = n.get("data_json") or {}
            merged_data = dict(existing_data)
            for k, v in ext_data.items():
                if k not in merged_data or merged_data[k] is None or merged_data[k] == "" or merged_data[k] == []:
                    merged_data[k] = v
                elif isinstance(v, dict) and isinstance(merged_data.get(k), dict):
                    sub = dict(merged_data[k])
                    for subk, subv in v.items():
                        if subk not in sub or sub[subk] is None or sub[subk] == "" or sub[subk] == []:
                            sub[subk] = subv
                    merged_data[k] = sub

            updated_node = graph_service.update_node(
                target_node.id,
                NodeUpdate(
                    summary=merged_summary,
                    subtitle=merged_subtitle,
                    content_markdown=merged_content,
                    data_json=merged_data
                )
            )
            merged_nodes.append(updated_node or target_node)

            # Ensure all alias variations map to this node's ID for edge linking
            node_id = target_node.id
            title_to_id[node_id] = node_id
            title_to_id[target_node.title] = node_id
            title_to_id[target_node.title.lower().strip()] = node_id
            if n.get("title"):
                title_to_id[n.get("title")] = node_id
                title_to_id[n.get("title").lower().strip()] = node_id
        else:
            # Create as a brand new node record
            node = graph_service.create_node(
                NodeCreate(
                    campaign_id=cid,
                    type=n.get("type", "quest"),
                    title=n.get("title", "Extracted Node"),
                    subtitle=n.get("subtitle", ""),
                    summary=n.get("summary", ""),
                    content_markdown=n.get("content_markdown", ""),
                    data_json=n.get("data_json", {}),
                    revealed_to_players=n.get("revealed_to_players", False)
                ),
                default_campaign_id=cid
            )
            created_nodes.append(node)
            title_to_id[node.id] = node.id
            title_to_id[node.title] = node.id
            title_to_id[node.title.lower().strip()] = node.id

    created_edges = []
    for e in data.get("edges", []):
        src_raw = (e.get("source_title") or "").strip()
        tgt_raw = (e.get("target_title") or "").strip()
        src_id = e.get("source_id") or title_to_id.get(src_raw) or title_to_id.get(src_raw.lower().strip())
        tgt_id = e.get("target_id") or title_to_id.get(tgt_raw) or title_to_id.get(tgt_raw.lower().strip())

        if src_id and tgt_id and src_id != tgt_id:
            edge = graph_service.create_edge(
                EdgeCreate(
                    campaign_id=cid,
                    source_id=src_id,
                    target_id=tgt_id,
                    relation_type=e.get("relation_type", "located_at"),
                    label=e.get("label", ""),
                    metadata_json=e.get("metadata_json", {})
                ),
                default_campaign_id=cid
            )
            created_edges.append(edge)

    return {
        "status": "applied",
        "nodes_created": len(created_nodes),
        "nodes_merged": len(merged_nodes),
        "edges_created": len(created_edges)
    }

from app.models import ApplySessionAdaptationRequest, SessionAdaptRequest

@router.post("/adapt-session")
def adapt_session(request: SessionAdaptRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    if not request.transcript_text or not request.transcript_text.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required to analyze session fallout.")

    history_dicts = [m.model_dump() for m in request.conversation_history] if request.conversation_history else None

    return ai_agent_service.adapt_campaign_from_transcript(
        transcript_text=request.transcript_text,
        campaign_id=cid,
        session_node_id=request.session_node_id,
        instruction=request.instruction or "",
        generate_player_recap=request.generate_player_recap if request.generate_player_recap is not None else True,
        current_adaptation=request.current_adaptation,
        conversation_history=history_dicts
    )

@router.post("/apply-session-adaptation")
def apply_session_adaptation(request: ApplySessionAdaptationRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.apply_session_adaptation(
        campaign_id=cid,
        status_updates=request.status_updates or [],
        node_updates=request.node_updates or [],
        new_nodes=request.new_nodes or [],
        new_edges=request.new_edges or [],
        next_session_node=request.next_session_node,
        parent_quest_id=request.parent_quest_id,
        player_note=request.player_note
    )

