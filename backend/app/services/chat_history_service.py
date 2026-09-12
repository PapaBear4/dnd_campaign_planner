import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.db.database import get_db

logger = logging.getLogger(__name__)

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def list_threads(campaign_id: str) -> List[Dict[str, Any]]:
    """List all chat threads for a campaign, ordered by most recently active."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT 
                t.id, 
                t.campaign_id, 
                t.title, 
                t.created_at, 
                t.updated_at,
                COUNT(m.id) as message_count,
                (
                    SELECT m2.content 
                    FROM chat_messages m2 
                    WHERE m2.thread_id = t.id 
                    ORDER BY m2.created_at DESC 
                    LIMIT 1
                ) as last_message
            FROM chat_threads t
            LEFT JOIN chat_messages m ON t.id = m.thread_id
            WHERE t.campaign_id = ?
            GROUP BY t.id
            ORDER BY t.updated_at DESC
            """,
            (campaign_id,),
        ).fetchall()
        return [dict(r) for r in rows]

def create_thread(campaign_id: str, title: str = "New Prep Session") -> Dict[str, Any]:
    """Create a new chat thread for a campaign."""
    thread_id = str(uuid.uuid4())
    now = _now_iso()
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO chat_threads (id, campaign_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (thread_id, campaign_id, title, now, now),
        )
    return {
        "id": thread_id,
        "campaign_id": campaign_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
        "last_message": None,
    }

def get_or_create_thread(campaign_id: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve an existing thread or create a default one if not found."""
    if thread_id:
        with get_db() as conn:
            row = conn.execute(
                "SELECT id, campaign_id, title, created_at, updated_at FROM chat_threads WHERE id = ?",
                (thread_id,),
            ).fetchone()
            if row:
                return dict(row)

    # Check if there is an existing thread for this campaign
    threads = list_threads(campaign_id)
    if threads:
        return threads[0]

    return create_thread(campaign_id, "New Prep Session")

def get_thread_messages(thread_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a thread in chronological order."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, thread_id, campaign_id, role, content, actions_json, scratchpad, loop_steps_json, created_at
            FROM chat_messages
            WHERE thread_id = ?
            ORDER BY created_at ASC
            """,
            (thread_id,),
        ).fetchall()

        messages = []
        for r in rows:
            d = dict(r)
            actions_json = d.pop("actions_json", "[]")
            loop_steps_json = d.pop("loop_steps_json", "[]")
            try:
                d["actions_taken"] = json.loads(actions_json) if actions_json else []
            except Exception:
                d["actions_taken"] = []
            try:
                d["loop_steps"] = json.loads(loop_steps_json) if loop_steps_json else []
            except Exception:
                d["loop_steps"] = []
            messages.append(d)
        return messages

def save_message(
    thread_id: str,
    campaign_id: str,
    role: str,
    content: str,
    actions_taken: Optional[List[Dict[str, Any]]] = None,
    scratchpad: Optional[str] = None,
    loop_steps: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Append a chat message to a thread and update thread timestamps and title."""
    msg_id = str(uuid.uuid4())
    now = _now_iso()
    actions_json = json.dumps(actions_taken or [])
    loop_steps_json = json.dumps(loop_steps or [])

    with get_db() as conn:
        # Check thread and maybe update title if it's the first user message
        thread = conn.execute(
            "SELECT id, title FROM chat_threads WHERE id = ?", (thread_id,)
        ).fetchone()

        if thread and thread["title"] == "New Prep Session" and role == "user":
            # Auto-title thread from user's first prompt
            clean_title = content.strip().split("\n")[0][:45]
            if len(content.strip().split("\n")[0]) > 45:
                clean_title += "..."
            conn.execute(
                "UPDATE chat_threads SET title = ?, updated_at = ? WHERE id = ?",
                (clean_title, now, thread_id),
            )
        else:
            conn.execute(
                "UPDATE chat_threads SET updated_at = ? WHERE id = ?",
                (now, thread_id),
            )

        conn.execute(
            """
            INSERT INTO chat_messages (id, thread_id, campaign_id, role, content, actions_json, scratchpad, loop_steps_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (msg_id, thread_id, campaign_id, role, content, actions_json, scratchpad, loop_steps_json, now),
        )

    return {
        "id": msg_id,
        "thread_id": thread_id,
        "campaign_id": campaign_id,
        "role": role,
        "content": content,
        "actions_taken": actions_taken or [],
        "scratchpad": scratchpad,
        "loop_steps": loop_steps or [],
        "created_at": now,
    }

def delete_thread(thread_id: str) -> bool:
    """Delete a thread and its cascaded messages."""
    with get_db() as conn:
        conn.execute("DELETE FROM chat_threads WHERE id = ?", (thread_id,))
    return True
