import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from app.db.database import get_db
from app.services import pdf_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def _init_uploads_table_if_needed():
    """Ensure uploaded_documents table exists."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_documents (
                id TEXT PRIMARY KEY,
                campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
                filename TEXT NOT NULL UNIQUE,
                original_name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                file_size INTEGER NOT NULL DEFAULT 0,
                page_count INTEGER DEFAULT 0,
                file_hash TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_uploads_campaign ON uploaded_documents(campaign_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_uploads_category ON uploaded_documents(category);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_uploads_original_name ON uploaded_documents(campaign_id, original_name);")

# Initialize table on import
_init_uploads_table_if_needed()

@router.get("")
def list_uploaded_documents(
    campaign_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """List all uploaded documents with metadata, filtered by campaign and category."""
    _init_uploads_table_if_needed()
    with get_db() as conn:
        query = "SELECT * FROM uploaded_documents WHERE 1=1"
        params = []

        if campaign_id:
            query += " AND (campaign_id = ? OR campaign_id IS NULL OR campaign_id = '')"
            params.append(campaign_id)
        if category and category != 'all':
            query += " AND category = ?"
            params.append(category)
        if search:
            query += " AND (original_name LIKE ? OR filename LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term])

        query += " ORDER BY created_at DESC"
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            meta = {}
            try:
                meta = json.loads(r["metadata_json"] or "{}")
            except Exception:
                pass
            results.append({
                "id": r["id"],
                "campaign_id": r["campaign_id"],
                "filename": r["filename"],
                "original_name": r["original_name"],
                "category": r["category"],
                "file_size": r["file_size"],
                "page_count": r["page_count"],
                "file_hash": r["file_hash"],
                "metadata": meta,
                "url": f"/api/uploads/{r['filename']}",
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })
        return results

@router.get("/check-duplicate")
def check_duplicate_upload(
    filename: str = Query(...),
    campaign_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """
    Checks if a document with the same original filename already exists in this campaign/category.
    Returns existing file metadata if found.
    """
    _init_uploads_table_if_needed()
    with get_db() as conn:
        query = "SELECT * FROM uploaded_documents WHERE original_name = ?"
        params = [filename]

        if campaign_id:
            query += " AND (campaign_id = ? OR campaign_id IS NULL OR campaign_id = '')"
            params.append(campaign_id)
        if category and category != 'all':
            query += " AND category = ?"
            params.append(category)

        query += " ORDER BY updated_at DESC LIMIT 1"
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()

        if row:
            meta = {}
            try:
                meta = json.loads(row["metadata_json"] or "{}")
            except Exception:
                pass
            return {
                "exists": True,
                "existing_file": {
                    "id": row["id"],
                    "filename": row["filename"],
                    "original_name": row["original_name"],
                    "category": row["category"],
                    "file_size": row["file_size"],
                    "page_count": row["page_count"],
                    "file_hash": row["file_hash"],
                    "metadata": meta,
                    "url": f"/api/uploads/{row['filename']}",
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            }
        return {"exists": False, "existing_file": None}

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: Optional[str] = Form("general"), # "pdf", "statblock", "pc", "transcript", "map", "general"
    campaign_id: Optional[str] = Form(None),
    replace: Optional[bool] = Form(False)
):
    """
    Uploads a document. If replace=True and an existing document with the same original_name exists,
    it replaces the file and updates the record. Otherwise, creates a new record.
    """
    _init_uploads_table_if_needed()
    now = datetime.now(timezone.utc).isoformat()
    content = await file.read()
    file_size = len(content)
    file_hash = hashlib.sha256(content).hexdigest()

    ext = Path(file.filename).suffix.lower()
    page_count = 0

    with get_db() as conn:
        cursor = conn.cursor()

        # Check if replacing an existing document
        existing_doc = None
        if replace:
            cursor.execute(
                """
                SELECT * FROM uploaded_documents 
                WHERE original_name = ? AND (campaign_id = ? OR campaign_id IS NULL OR campaign_id = '')
                ORDER BY updated_at DESC LIMIT 1
                """,
                (file.filename, campaign_id or '')
            )
            existing_doc = cursor.fetchone()

        if existing_doc:
            # Replace existing file
            stored_filename = existing_doc["filename"]
            save_path = UPLOAD_DIR / stored_filename
            with open(save_path, "wb") as f:
                f.write(content)

            if ext == ".pdf":
                try:
                    pdf_info = pdf_service.parse_pdf(str(save_path), max_pages=100)
                    page_count = pdf_info.get("total_pages", 0)
                except Exception:
                    page_count = existing_doc["page_count"] or 0

            cursor.execute(
                """
                UPDATE uploaded_documents 
                SET file_size = ?, page_count = ?, file_hash = ?, category = ?, updated_at = ?
                WHERE id = ?
                """,
                (file_size, page_count, file_hash, category, now, existing_doc["id"])
            )

            return {
                "id": existing_doc["id"],
                "filename": stored_filename,
                "original_name": file.filename,
                "category": category,
                "url": f"/api/uploads/{stored_filename}",
                "size": file_size,
                "page_count": page_count,
                "is_replacement": True,
                "created_at": existing_doc["created_at"],
                "updated_at": now
            }
        else:
            # Create new unique upload
            unique_name = f"{uuid.uuid4().hex[:12]}_{file.filename}"
            save_path = UPLOAD_DIR / unique_name
            with open(save_path, "wb") as f:
                f.write(content)

            if ext == ".pdf":
                try:
                    pdf_info = pdf_service.parse_pdf(str(save_path), max_pages=100)
                    page_count = pdf_info.get("total_pages", 0)
                except Exception:
                    page_count = 0

            doc_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO uploaded_documents (
                    id, campaign_id, filename, original_name, category, 
                    file_size, page_count, file_hash, metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    doc_id, campaign_id, unique_name, file.filename, category,
                    file_size, page_count, file_hash, "{}", now, now
                )
            )

            return {
                "id": doc_id,
                "filename": unique_name,
                "original_name": file.filename,
                "category": category,
                "url": f"/api/uploads/{unique_name}",
                "size": file_size,
                "page_count": page_count,
                "is_replacement": False,
                "created_at": now,
                "updated_at": now
            }

@router.delete("/{filename}")
def delete_uploaded_file(filename: str):
    """Deletes an uploaded file from disk and database."""
    _init_uploads_table_if_needed()
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM uploaded_documents WHERE filename = ?", (filename,))

    return {"success": True, "message": f"Document '{filename}' deleted."}

@router.get("/{filename}")
def get_uploaded_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@router.post("/parse-pdf")
def parse_pdf_document(
    filename: str = Form(...),
    max_pages: Optional[int] = Form(30)
):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        data = pdf_service.parse_pdf(str(file_path), max_pages=max_pages)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {e}")
