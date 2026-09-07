import json
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

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO nodes (
                id, campaign_id, type, title, subtitle, summary, content_markdown,
                data_json, revealed_to_players, tags, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO edges (
                id, campaign_id, source_id, target_id, relation_type,
                label, metadata_json, revealed_to_players, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    if not updates:
        return get_edge(edge_id)

    params.append(edge_id)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE edges SET {', '.join(updates)} WHERE id = ?", params)
    return get_edge(edge_id)

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
        children_items = []
        for cid in child_map.get(nid, []):
            child_item = build_item(cid)
            if child_item:
                children_items.append(child_item)
        return HierarchyItem(node=node, children=children_items)

    root_items = []
    # 1. First pick 'arc' nodes with no parents
    for n in nodes:
        if n.type == "arc" and n.id not in parent_map:
            item = build_item(n.id)
            if item:
                root_items.append(item)

    # 2. Pick orphan quests / sessions / encounters that have no parents
    for n in nodes:
        if n.type in hierarchy_types and n.type != "arc" and n.id not in parent_map:
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
