import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db.database import get_db

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

FEEDBACK_UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads" / "feedback"
FEEDBACK_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def init_feedback_table_if_needed():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback_items (
                id TEXT PRIMARY KEY,
                campaign_id TEXT,
                type TEXT NOT NULL, -- 'bug' | 'feature'
                title TEXT NOT NULL,
                category TEXT DEFAULT 'general',
                priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'blocker'
                status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
                description TEXT DEFAULT '',
                images_json TEXT DEFAULT '[]',
                context_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_items(type);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_items(status);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_items(created_at);")


init_feedback_table_if_needed()


class FeedbackCreate(BaseModel):
    campaign_id: Optional[str] = None
    type: str  # 'bug' | 'feature'
    title: str
    category: Optional[str] = "general"
    priority: Optional[str] = "medium"
    status: Optional[str] = "open"
    description: Optional[str] = ""
    images: Optional[List[str]] = []
    context: Optional[Dict[str, Any]] = {}


class FeedbackUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    context: Optional[Dict[str, Any]] = None


@router.get("")
def list_feedback(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
):
    init_feedback_table_if_needed()
    with get_db() as conn:
        query = "SELECT * FROM feedback_items WHERE 1=1"
        params: list = []

        if type and type != "all":
            query += " AND type = ?"
            params.append(type)
        if status and status != "all":
            query += " AND status = ?"
            params.append(status)
        if campaign_id:
            query += " AND (campaign_id = ? OR campaign_id IS NULL OR campaign_id = '')"
            params.append(campaign_id)

        query += " ORDER BY CASE priority WHEN 'blocker' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, created_at DESC"

        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        items = []
        for r in rows:
            items.append({
                "id": r["id"],
                "campaign_id": r["campaign_id"],
                "type": r["type"],
                "title": r["title"],
                "category": r["category"],
                "priority": r["priority"],
                "status": r["status"],
                "description": r["description"],
                "images": json.loads(r["images_json"] or "[]"),
                "context": json.loads(r["context_json"] or "{}"),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return items


@router.post("")
def create_feedback(data: FeedbackCreate):
    init_feedback_table_if_needed()
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be blank")

    now = datetime.now(timezone.utc).isoformat()
    feedback_id = f"fb_{uuid.uuid4().hex[:10]}"

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO feedback_items (
                id, campaign_id, type, title, category, priority, status,
                description, images_json, context_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                feedback_id,
                data.campaign_id,
                data.type,
                data.title.strip(),
                data.category or "general",
                data.priority or "medium",
                data.status or "open",
                data.description or "",
                json.dumps(data.images or []),
                json.dumps(data.context or {}),
                now,
                now,
            ),
        )

    return {
        "id": feedback_id,
        "campaign_id": data.campaign_id,
        "type": data.type,
        "title": data.title.strip(),
        "category": data.category or "general",
        "priority": data.priority or "medium",
        "status": data.status or "open",
        "description": data.description or "",
        "images": data.images or [],
        "context": data.context or {},
        "created_at": now,
        "updated_at": now,
    }


@router.patch("/{feedback_id}")
def update_feedback(feedback_id: str, data: FeedbackUpdate):
    init_feedback_table_if_needed()
    now = datetime.now(timezone.utc).isoformat()
    updates = []
    params = []

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title.strip())
    if data.type is not None:
        updates.append("type = ?")
        params.append(data.type)
    if data.category is not None:
        updates.append("category = ?")
        params.append(data.category)
    if data.priority is not None:
        updates.append("priority = ?")
        params.append(data.priority)
    if data.status is not None:
        updates.append("status = ?")
        params.append(data.status)
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.images is not None:
        updates.append("images_json = ?")
        params.append(json.dumps(data.images))
    if data.context is not None:
        updates.append("context_json = ?")
        params.append(json.dumps(data.context))

    if not updates:
        return {"status": "no_op"}

    updates.append("updated_at = ?")
    params.append(now)
    params.append(feedback_id)

    with get_db() as conn:
        cur = conn.execute(f"UPDATE feedback_items SET {', '.join(updates)} WHERE id = ?", params)
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Feedback item not found")

    return {"status": "updated", "id": feedback_id}


@router.delete("/{feedback_id}")
def delete_feedback(feedback_id: str):
    init_feedback_table_if_needed()
    with get_db() as conn:
        cur = conn.execute("DELETE FROM feedback_items WHERE id = ?", (feedback_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Feedback item not found")
    return {"status": "deleted", "id": feedback_id}


@router.post("/upload-image")
async def upload_feedback_image(file: UploadFile = File(...)):
    """Uploads an image (drag/drop or clipboard paste) and returns a persistent URL."""
    ext = Path(file.filename or "pasted_image.png").suffix or ".png"
    unique_name = f"screenshot_{uuid.uuid4().hex[:12]}{ext}"
    dest = FEEDBACK_UPLOAD_DIR / unique_name

    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "url": f"/static/uploads/feedback/{unique_name}",
        "filename": unique_name,
    }
