import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.db.database import get_db
from app.models import (
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
    EdgeCreate,
    EdgeResponse,
    EdgeUpdate,
    GraphResponse,
    HierarchyItem,
    NodeCreate,
    NodeResponse,
    NodeUpdate,
    PlayerNoteCreate,
    PlayerNoteResponse,
    PlayerNoteUpdate,
)

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _node_from_row(row) -> NodeResponse:
    data_json = {}
    if row["data_json"]:
        try:
            data_json = json.loads(row["data_json"])
        except Exception:
            data_json = {}
    
    tags = []
    if row["tags"]:
        try:
            tags = json.loads(row["tags"])
        except Exception:
            tags = []

    return NodeResponse(
        id=row["id"],
        campaign_id=row["campaign_id"],
        type=row["type"],
        title=row["title"],
        subtitle=row["subtitle"] or "",
        summary=row["summary"] or "",
        content_markdown=row["content_markdown"] or "",
        data_json=data_json,
        revealed_to_players=bool(row["revealed_to_players"]),
        is_canon=bool(row["is_canon"]) if "is_canon" in row.keys() else True,
        tags=tags,
        sort_order=row["sort_order"] or 0,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

def _edge_from_row(row) -> EdgeResponse:
    metadata_json = {}
    if row["metadata_json"]:
        try:
            metadata_json = json.loads(row["metadata_json"])
        except Exception:
            metadata_json = {}

    return EdgeResponse(
        id=row["id"],
        campaign_id=row["campaign_id"],
        source_id=row["source_id"],
        target_id=row["target_id"],
        relation_type=row["relation_type"],
        label=row["label"] or "",
        metadata_json=metadata_json,
        revealed_to_players=bool(row["revealed_to_players"]),
        is_canon=bool(row["is_canon"]) if "is_canon" in row.keys() else True,
        created_at=row["created_at"],
    )

# --- Campaigns ---
def list_campaigns() -> List[CampaignResponse]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM campaigns ORDER BY updated_at DESC")
        return [
            CampaignResponse(
                id=r["id"],
                name=r["name"],
                description=r["description"] or "",
                setting=r["setting"] or "",
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in cursor.fetchall()
        ]

def get_campaign(campaign_id: str) -> Optional[CampaignResponse]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return CampaignResponse(
            id=row["id"],
            name=row["name"],
            description=row["description"] or "",
            setting=row["setting"] or "",
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

def create_campaign(data: CampaignCreate) -> CampaignResponse:
    cid = str(uuid.uuid4())
    now = _utc_now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO campaigns (id, name, description, setting, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (cid, data.name, data.description or "", data.setting or "Forgotten Realms", now, now),
        )
    return get_campaign(cid)

def update_campaign(campaign_id: str, data: CampaignUpdate) -> Optional[CampaignResponse]:
    now = _utc_now()
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name)
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.setting is not None:
        updates.append("setting = ?")
        params.append(data.setting)
    
    if not updates:
        return get_campaign(campaign_id)
        
    updates.append("updated_at = ?")
    params.append(now)
    params.append(campaign_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE campaigns SET {', '.join(updates)} WHERE id = ?", params)
    return get_campaign(campaign_id)

def delete_campaign(campaign_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))
        return cursor.rowcount > 0

# --- Nodes ---
def create_node(data: NodeCreate, default_campaign_id: str) -> NodeResponse:
    nid = str(uuid.uuid4())
    cid = data.campaign_id or default_campaign_id
    now = _utc_now()
    data_json_str = json.dumps(data.data_json or {})
    tags_str = json.dumps(data.tags or [])
    revealed = 1 if data.revealed_to_players else 0
    canon = 1 if (data.is_canon is None or data.is_canon) else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO nodes (
                id, campaign_id, type, title, subtitle, summary, content_markdown,
                data_json, revealed_to_players, is_canon, tags, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                nid,
                cid,
                data.type,
                data.title,
                data.subtitle or "",
                data.summary or "",
                data.content_markdown or "",
                data_json_str,
                revealed,
                canon,
                tags_str,
                data.sort_order or 0,
                now,
                now,
            ),
        )
    return get_node(nid)

def get_node(node_id: str) -> Optional[NodeResponse]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM nodes WHERE id = ?", (node_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _node_from_row(row)

def list_nodes(
    campaign_id: str,
    node_type: Optional[str] = None,
    revealed_only: bool = False,
    tag: Optional[str] = None,
) -> List[NodeResponse]:
    query = "SELECT * FROM nodes WHERE campaign_id = ?"
    params: List[Any] = [campaign_id]

    if node_type:
        query += " AND type = ?"
        params.append(node_type)
    if revealed_only:
        query += " AND revealed_to_players = 1"
    if tag:
        query += " AND tags LIKE ?"
        params.append(f'%"{tag}"%')

    query += " ORDER BY sort_order ASC, created_at ASC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [_node_from_row(r) for r in cursor.fetchall()]

def update_node(node_id: str, data: NodeUpdate) -> Optional[NodeResponse]:
    now = _utc_now()
    updates = []
    params: List[Any] = []

    if data.type is not None:
        updates.append("type = ?")
        params.append(data.type)
    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)
    if data.subtitle is not None:
        updates.append("subtitle = ?")
        params.append(data.subtitle)
    if data.summary is not None:
        updates.append("summary = ?")
        params.append(data.summary)
    if data.content_markdown is not None:
        updates.append("content_markdown = ?")
        params.append(data.content_markdown)
    if data.data_json is not None:
        updates.append("data_json = ?")
        params.append(json.dumps(data.data_json))
    if data.revealed_to_players is not None:
        updates.append("revealed_to_players = ?")
        params.append(1 if data.revealed_to_players else 0)
    if data.is_canon is not None:
        updates.append("is_canon = ?")
        params.append(1 if data.is_canon else 0)
    if data.tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(data.tags))
    if data.sort_order is not None:
        updates.append("sort_order = ?")
        params.append(data.sort_order)

    if not updates:
        return get_node(node_id)

    updates.append("updated_at = ?")
    params.append(now)
    params.append(node_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE nodes SET {', '.join(updates)} WHERE id = ?", params)
    return get_node(node_id)

def delete_node(node_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
        return cursor.rowcount > 0

# --- Edges ---
def create_edge(data: EdgeCreate, default_campaign_id: str) -> EdgeResponse:
    eid = str(uuid.uuid4())
    cid = data.campaign_id or default_campaign_id
    now = _utc_now()
    metadata_json_str = json.dumps(data.metadata_json or {})
    revealed = 1 if data.revealed_to_players else 0
    canon = 1 if (data.is_canon is None or data.is_canon) else 0

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO edges (
                id, campaign_id, source_id, target_id, relation_type,
                label, metadata_json, revealed_to_players, is_canon, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                eid,
                cid,
                data.source_id,
                data.target_id,
                data.relation_type,
                data.label or "",
                metadata_json_str,
                revealed,
                canon,
                now,
            ),
        )
    return get_edge(eid)

def get_edge(edge_id: str) -> Optional[EdgeResponse]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM edges WHERE id = ?", (edge_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _edge_from_row(row)

def list_edges(
    campaign_id: str,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    relation_type: Optional[str] = None,
    revealed_only: bool = False,
) -> List[EdgeResponse]:
    query = "SELECT * FROM edges WHERE campaign_id = ?"
    params: List[Any] = [campaign_id]

    if source_id:
        query += " AND source_id = ?"
        params.append(source_id)
    if target_id:
        query += " AND target_id = ?"
        params.append(target_id)
    if relation_type:
        query += " AND relation_type = ?"
        params.append(relation_type)
    if revealed_only:
        query += " AND revealed_to_players = 1"

    query += " ORDER BY created_at ASC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [_edge_from_row(r) for r in cursor.fetchall()]

def update_edge(edge_id: str, data: EdgeUpdate) -> Optional[EdgeResponse]:
    updates = []
    params: List[Any] = []

    if data.relation_type is not None:
        updates.append("relation_type = ?")
        params.append(data.relation_type)
    if data.label is not None:
        updates.append("label = ?")
        params.append(data.label)
    if data.metadata_json is not None:
        updates.append("metadata_json = ?")
        params.append(json.dumps(data.metadata_json))
    if data.revealed_to_players is not None:
        updates.append("revealed_to_players = ?")
        params.append(1 if data.revealed_to_players else 0)
    if data.is_canon is not None:
        updates.append("is_canon = ?")
        params.append(1 if data.is_canon else 0)

    if not updates:
        return get_edge(edge_id)

    params.append(edge_id)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE edges SET {', '.join(updates)} WHERE id = ?", params)
    return get_edge(edge_id)

def toggle_node_canon(node_id: str, is_canon: Optional[bool] = None) -> Optional[NodeResponse]:
    node = get_node(node_id)
    if not node:
        return None
    target_canon = (not node.is_canon) if is_canon is None else is_canon
    return update_node(node_id, NodeUpdate(is_canon=target_canon))

def toggle_edge_canon(edge_id: str, is_canon: Optional[bool] = None) -> Optional[EdgeResponse]:
    edge = get_edge(edge_id)
    if not edge:
        return None
    target_canon = (not edge.is_canon) if is_canon is None else is_canon
    return update_edge(edge_id, EdgeUpdate(is_canon=target_canon))

def delete_edge(edge_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM edges WHERE id = ?", (edge_id,))
        return cursor.rowcount > 0

# --- Graph Assembly & Progressive Revelation ---
def get_graph(campaign_id: str, player_mode: bool = False) -> GraphResponse:
    nodes = list_nodes(campaign_id, revealed_only=player_mode)
    node_ids = {n.id for n in nodes}

    all_edges = list_edges(campaign_id, revealed_only=player_mode)
    # Only keep edges where both source and target are in visible node_ids
    visible_edges = [e for e in all_edges if e.source_id in node_ids and e.target_id in node_ids]

    return GraphResponse(nodes=nodes, edges=visible_edges)

def _natural_sort_key(node: NodeResponse):
    """
    Computes a robust sort tuple for hierarchy nodes:
    1. sort_order (explicit manual ordering, default 0)
    2. Has session/act/arc number extracted from title (e.g. Session 1 < Session 2 < Session 10)
    3. Created date as tie-breaker
    """
    title = (node.title or "").strip()
    match_seq = re.search(r"(?:session|arc|act|part|quest|chapter|episode)\s*(\d+)", title, re.IGNORECASE)
    if match_seq:
        num_key = (0, int(match_seq.group(1)))
    else:
        match_any_num = re.search(r"\b(\d+)\b", title)
        if match_any_num:
            num_key = (1, int(match_any_num.group(1)))
        else:
            num_key = (2, 999999)

    return (node.sort_order, num_key, node.created_at, title.lower())

# --- Hierarchy Tree (Campaign -> Arc -> Quest -> Session -> Encounter) ---
def get_hierarchy_tree(campaign_id: str, player_mode: bool = False) -> List[HierarchyItem]:
    """
    Builds a tree structure for the planning hierarchy.
    Supported hierarchical flow:
    Arc -> Quest -> Session -> Encounter
    Connected via 'contains', 'parent_of', or 'precedes' edges.
    """
    nodes = list_nodes(campaign_id, revealed_only=player_mode)
    node_map = {n.id: n for n in nodes}

    # Find edges that denote hierarchy
    edges = list_edges(campaign_id, revealed_only=player_mode)
    hierarchy_relations = {"contains", "parent_of"}
    child_map: Dict[str, List[str]] = {}
    parent_map: Dict[str, str] = {}

    for e in edges:
        if e.relation_type in hierarchy_relations:
            if e.source_id in node_map and e.target_id in node_map:
                child_map.setdefault(e.source_id, []).append(e.target_id)
                parent_map[e.target_id] = e.source_id

    # Hierarchical node types
    hierarchy_types = {"arc", "quest", "session", "encounter"}
    
    # Root nodes are arc nodes or nodes without parents in hierarchy_types
    def build_item(nid: str) -> Optional[HierarchyItem]:
        node = node_map.get(nid)
        if not node:
            return None
        child_ids = child_map.get(nid, [])
        # Sort children by explicit sort_order and natural numbering
        valid_children_nodes = [node_map[cid] for cid in child_ids if cid in node_map]
        valid_children_nodes.sort(key=_natural_sort_key)
        
        children_items = []
        for c_node in valid_children_nodes:
            child_item = build_item(c_node.id)
            if child_item:
                children_items.append(child_item)
        return HierarchyItem(node=node, children=children_items)

    root_items = []
    # 1. First pick 'arc' nodes with no parents
    root_arcs = [n for n in nodes if n.type == "arc" and n.id not in parent_map]
    root_arcs.sort(key=_natural_sort_key)
    for n in root_arcs:
        item = build_item(n.id)
        if item:
            root_items.append(item)

    # 2. Pick orphan quests / sessions / encounters that have no parents
    orphan_roots = [n for n in nodes if n.type in hierarchy_types and n.type != "arc" and n.id not in parent_map]
    orphan_roots.sort(key=_natural_sort_key)
    for n in orphan_roots:
        item = build_item(n.id)
        if item:
            root_items.append(item)

    return root_items

# --- FTS5 Search ---
def search_nodes(campaign_id: str, query_str: str, player_mode: bool = False) -> List[NodeResponse]:
    if not query_str.strip():
        return list_nodes(campaign_id, revealed_only=player_mode)

    # Sanitize query for FTS5 prefix match
    terms = [f'"{term.replace('"', '""')}*"' for term in query_str.split() if term.strip()]
    fts_query = " ".join(terms) if terms else query_str

    with get_db() as conn:
        cursor = conn.cursor()
        sql = """
            SELECT n.* FROM nodes n
            JOIN fts_nodes f ON n.id = f.id
            WHERE n.campaign_id = ?
            AND fts_nodes MATCH ?
        """
        params = [campaign_id, fts_query]
        if player_mode:
            sql += " AND n.revealed_to_players = 1"
        sql += " ORDER BY rank LIMIT 50"

        try:
            cursor.execute(sql, params)
            return [_node_from_row(r) for r in cursor.fetchall()]
        except Exception:
            # Fallback to LIKE if FTS expression is unusual
            like_sql = """
                SELECT * FROM nodes
                WHERE campaign_id = ?
                AND (title LIKE ? OR summary LIKE ? OR content_markdown LIKE ?)
            """
            like_term = f"%{query_str}%"
            like_params = [campaign_id, like_term, like_term, like_term]
            if player_mode:
                like_sql += " AND revealed_to_players = 1"
            cursor.execute(like_sql, like_params)
            return [_node_from_row(r) for r in cursor.fetchall()]

# --- Player Notes ---
def create_player_note(data: PlayerNoteCreate, default_campaign_id: str) -> PlayerNoteResponse:
    pid = str(uuid.uuid4())
    cid = data.campaign_id or default_campaign_id
    now = _utc_now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO player_notes (id, campaign_id, node_id, author_name, title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (pid, cid, data.node_id, data.author_name, data.title, data.content, now, now),
        )
    return get_player_note(pid)

def get_player_note(note_id: str) -> Optional[PlayerNoteResponse]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM player_notes WHERE id = ?", (note_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return PlayerNoteResponse(
            id=row["id"],
            campaign_id=row["campaign_id"],
            node_id=row["node_id"],
            author_name=row["author_name"],
            title=row["title"],
            content=row["content"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

def list_player_notes(campaign_id: str, node_id: Optional[str] = None) -> List[PlayerNoteResponse]:
    query = "SELECT * FROM player_notes WHERE campaign_id = ?"
    params: List[Any] = [campaign_id]
    if node_id:
        query += " AND node_id = ?"
        params.append(node_id)
    query += " ORDER BY updated_at DESC"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [
            PlayerNoteResponse(
                id=r["id"],
                campaign_id=r["campaign_id"],
                node_id=r["node_id"],
                author_name=r["author_name"],
                title=r["title"],
                content=r["content"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in cursor.fetchall()
        ]

def update_player_note(note_id: str, data: PlayerNoteUpdate) -> Optional[PlayerNoteResponse]:
    now = _utc_now()
    updates = []
    params: List[Any] = []
    if data.node_id is not None:
        updates.append("node_id = ?")
        params.append(data.node_id)
    if data.author_name is not None:
        updates.append("author_name = ?")
        params.append(data.author_name)
    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)
    if data.content is not None:
        updates.append("content = ?")
        params.append(data.content)

    if not updates:
        return get_player_note(note_id)

    updates.append("updated_at = ?")
    params.append(now)
    params.append(note_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE player_notes SET {', '.join(updates)} WHERE id = ?", params)
    return get_player_note(note_id)

def delete_player_note(note_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM player_notes WHERE id = ?", (note_id,))
        return cursor.rowcount > 0

# --- Settings ---
def get_setting(key: str, default: str = "") -> str:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default

def set_setting(key: str, value: str):
    now = _utc_now()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now),
        )

# ---------------------------------------------------------------------------
# Composite / agentic operations
# ---------------------------------------------------------------------------

def find_nodes_by_title(campaign_id: str, title_fragment: str) -> List[NodeResponse]:
    """
    Case-insensitive substring search on title.
    Used by the agent to locate nodes by approximate name before acting on them.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM nodes WHERE campaign_id = ? AND LOWER(title) LIKE LOWER(?) ORDER BY type, title",
            (campaign_id, f"%{title_fragment}%"),
        )
        return [_node_from_row(r) for r in cursor.fetchall()]


def merge_nodes(
    campaign_id: str,
    primary_id: str,
    duplicate_ids: List[str],
    merged_title: Optional[str] = None,
    merged_summary: Optional[str] = None,
    merged_content: Optional[str] = None,
    merged_data_json: Optional[Dict] = None,
) -> Optional[NodeResponse]:
    """
    Merges one or more duplicate nodes into a primary node.

    Steps:
    1. Re-point all edges from each duplicate to primary_id (avoiding self-loops or exact dupe edges).
    2. Optionally update the primary node's title/summary/content/data_json.
    3. Delete the duplicate nodes and all their remaining edges.

    Returns the updated primary node.
    """
    if not duplicate_ids:
        return get_node(primary_id)

    with get_db() as conn:
        cursor = conn.cursor()

        for dup_id in duplicate_ids:
            if dup_id == primary_id:
                continue

            # Re-point outgoing edges from dup → primary (where target != primary to avoid self-loop)
            cursor.execute(
                """
                UPDATE edges
                SET source_id = ?
                WHERE campaign_id = ? AND source_id = ? AND target_id != ?
                """,
                (primary_id, campaign_id, dup_id, primary_id),
            )

            # Re-point incoming edges into dup → primary (where source != primary to avoid self-loop)
            cursor.execute(
                """
                UPDATE edges
                SET target_id = ?
                WHERE campaign_id = ? AND target_id = ? AND source_id != ?
                """,
                (primary_id, campaign_id, dup_id, primary_id),
            )

            # Remove any exact duplicate edges that would now exist (same source+target+relation)
            cursor.execute(
                """
                DELETE FROM edges
                WHERE id NOT IN (
                    SELECT MIN(id) FROM edges
                    GROUP BY campaign_id, source_id, target_id, relation_type
                )
                """,
            )

            # Delete the duplicate node itself
            cursor.execute("DELETE FROM nodes WHERE id = ?", (dup_id,))

    # Update the primary node if new merged content was provided
    if any(v is not None for v in [merged_title, merged_summary, merged_content, merged_data_json]):
        update_data = NodeUpdate(
            title=merged_title,
            summary=merged_summary,
            content_markdown=merged_content,
            data_json=merged_data_json,
        )
        return update_node(primary_id, update_data)

    return get_node(primary_id)


def bulk_delete_nodes(campaign_id: str, node_ids: List[str], force_canon: bool = False) -> Dict[str, Any]:
    """
    Deletes a list of nodes and all edges that reference them.
    Protects canon nodes unless force_canon=True.
    Returns counts of deleted nodes, deleted edges, and protected canon nodes.
    """
    if not node_ids:
        return {"nodes_deleted": 0, "edges_deleted": 0, "canon_protected_count": 0}

    deleted_nodes = 0
    deleted_edges = 0
    canon_protected_nodes = []

    with get_db() as conn:
        cursor = conn.cursor()
        for nid in node_ids:
            cursor.execute("SELECT id, title, is_canon FROM nodes WHERE id = ? AND campaign_id = ?", (nid, campaign_id))
            row = cursor.fetchone()
            if not row:
                continue
            if bool(row["is_canon"]) and not force_canon:
                canon_protected_nodes.append(row["title"])
                continue

            # Delete all edges touching this node
            cursor.execute(
                "DELETE FROM edges WHERE campaign_id = ? AND (source_id = ? OR target_id = ?)",
                (campaign_id, nid, nid),
            )
            deleted_edges += cursor.rowcount
            # Delete the node
            cursor.execute("DELETE FROM nodes WHERE id = ? AND campaign_id = ?", (nid, campaign_id))
            deleted_nodes += cursor.rowcount

    return {
        "nodes_deleted": deleted_nodes,
        "edges_deleted": deleted_edges,
        "canon_protected_count": len(canon_protected_nodes),
        "canon_protected_titles": canon_protected_nodes,
    }


def list_edges_for_node(campaign_id: str, node_id: str) -> List[Dict[str, Any]]:
    """
    Returns all edges where the node is source or target, enriched with titles.
    """
    nodes = list_nodes(campaign_id)
    id_to_title = {n.id: n.title for n in nodes}

    edges = list_edges(campaign_id)
    result = []
    for e in edges:
        if e.source_id == node_id or e.target_id == node_id:
            result.append({
                "id": e.id,
                "source_id": e.source_id,
                "source_title": id_to_title.get(e.source_id, "Unknown"),
                "target_id": e.target_id,
                "target_title": id_to_title.get(e.target_id, "Unknown"),
                "relation_type": e.relation_type,
                "label": e.label,
            })
    return result


def update_node_status(node_id: str, status: str) -> Optional[NodeResponse]:
    """
    Convenience function — sets 'status' inside data_json without touching other fields.
    """
    node = get_node(node_id)
    if not node:
        return None
    data = dict(node.data_json or {})
    data["status"] = status
    return update_node(node_id, NodeUpdate(data_json=data))


def find_duplicate_nodes(campaign_id: str) -> List[Dict[str, Any]]:
    """
    Finds clusters of duplicate nodes in a campaign based on normalized title and type.
    Returns detailed cluster records including node details and edge counts.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT lower(trim(title)) as norm_title, type, count(*) as c, group_concat(id) as ids
            FROM nodes
            WHERE campaign_id = ?
            GROUP BY lower(trim(title)), type
            HAVING c > 1
            """,
            (campaign_id,),
        )
        dups = cursor.fetchall()

    clusters = []
    edges = list_edges(campaign_id)
    edge_counts: Dict[str, int] = {}
    for e in edges:
        edge_counts[e.source_id] = edge_counts.get(e.source_id, 0) + 1
        edge_counts[e.target_id] = edge_counts.get(e.target_id, 0) + 1

    for norm_title, ntype, count, ids_str in dups:
        id_list = ids_str.split(",")
        cluster_nodes = []
        for nid in id_list:
            node = get_node(nid)
            if node:
                cluster_nodes.append({
                    "id": node.id,
                    "title": node.title,
                    "subtitle": node.subtitle,
                    "summary": node.summary,
                    "content_length": len(node.content_markdown or ""),
                    "content_markdown": node.content_markdown,
                    "edge_count": edge_counts.get(node.id, 0),
                    "data_json": node.data_json,
                })

        if len(cluster_nodes) > 1:
            clusters.append({
                "type": ntype,
                "title": cluster_nodes[0]["title"],
                "count": len(cluster_nodes),
                "nodes": cluster_nodes,
            })

    return clusters


def deduplicate_campaign(campaign_id: str, auto_merge: bool = True) -> Dict[str, Any]:
    """
    Scans the campaign for duplicate nodes, chooses the canonical/richest node
    in each duplicate cluster, re-points all relationships, combines lore/notes,
    and removes duplicate nodes from the SQLite database.
    """
    clusters = find_duplicate_nodes(campaign_id)
    if not clusters:
        return {
            "success": True,
            "clusters_merged": 0,
            "duplicates_removed": 0,
            "details": [],
            "message": "No duplicate nodes found in campaign. The database is already clean!",
        }

    merged_details = []
    total_duplicates_removed = 0

    for cluster in clusters:
        nodes = cluster["nodes"]
        # Score each node: edge_count * 10 + content_length + summary length
        def score_node(n):
            return (n["edge_count"] * 10) + n["content_length"] + len(n.get("summary") or "")

        nodes_sorted = sorted(nodes, key=score_node, reverse=True)
        primary = nodes_sorted[0]
        duplicates = nodes_sorted[1:]
        duplicate_ids = [d["id"] for d in duplicates]

        # Combine summaries if primary is empty or duplicate has richer text
        combined_summary = primary.get("summary") or ""
        for d in duplicates:
            d_summary = d.get("summary") or ""
            if d_summary and (not combined_summary or len(d_summary) > len(combined_summary)):
                combined_summary = d_summary

        # Combine markdown content / notes if duplicates have unique info
        combined_content = primary.get("content_markdown") or ""
        for d in duplicates:
            d_content = d.get("content_markdown") or ""
            if d_content and d_content not in combined_content:
                if combined_content:
                    combined_content += f"\n\n---\n**Additional Notes (Merged from duplicate):**\n{d_content}"
                else:
                    combined_content = d_content

        # Merge data_json if needed
        merged_data = dict(primary.get("data_json") or {})
        for d in duplicates:
            d_data = d.get("data_json") or {}
            for k, v in d_data.items():
                if k not in merged_data or not merged_data[k]:
                    merged_data[k] = v

        # Execute merge
        merged_node = merge_nodes(
            campaign_id=campaign_id,
            primary_id=primary["id"],
            duplicate_ids=duplicate_ids,
            merged_title=primary["title"],
            merged_summary=combined_summary,
            merged_content=combined_content,
            merged_data_json=merged_data,
        )

        total_duplicates_removed += len(duplicate_ids)
        merged_details.append({
            "type": cluster["type"],
            "title": primary["title"],
            "primary_id": primary["id"],
            "duplicates_removed_count": len(duplicate_ids),
            "duplicate_ids": duplicate_ids,
        })

    return {
        "success": True,
        "clusters_merged": len(merged_details),
        "duplicates_removed": total_duplicates_removed,
        "details": merged_details,
        "message": f"Successfully cleaned {len(merged_details)} duplicate sets and deleted {total_duplicates_removed} redundant nodes from the campaign.",
    }


