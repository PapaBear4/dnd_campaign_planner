import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pypdf

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def parse_pdf(file_path: str, max_pages: Optional[int] = 50) -> Dict[str, Any]:
    """
    Extracts text, metadata, and outline from a PDF file using pypdf.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    reader = pypdf.PdfReader(str(path))
    total_pages = len(reader.pages)
    pages_to_read = min(total_pages, max_pages) if max_pages else total_pages

    extracted_pages = []
    full_text_chunks = []

    page_labels = []
    try:
        page_labels = [str(l) for l in (reader.page_labels or [])]
    except Exception:
        page_labels = []

    for i in range(pages_to_read):
        page = reader.pages[i]
        text = page.extract_text() or ""
        doc_label = page_labels[i] if i < len(page_labels) else None
        extracted_pages.append({
            "page_number": i + 1,
            "doc_page": doc_label if doc_label else str(i + 1),
            "text": text,
            "char_count": len(text)
        })
        if text.strip():
            if doc_label and doc_label != str(i + 1):
                full_text_chunks.append(f"--- [Page {i+1} (Document Page {doc_label})] ---\n{text}")
            else:
                full_text_chunks.append(f"--- [Page {i+1}] ---\n{text}")

    outline_titles = []
    try:
        def extract_outline(outlines):
            for item in outlines:
                if isinstance(item, list):
                    extract_outline(item)
                elif hasattr(item, "title"):
                    outline_titles.append(item.title)
        extract_outline(reader.outline)
    except Exception:
        pass

    return {
        "filename": path.name,
        "total_pages": total_pages,
        "processed_pages": pages_to_read,
        "page_labels": page_labels,
        "outlines": outline_titles,
        "pages": extracted_pages,
        "combined_text": "\n\n".join(full_text_chunks)
    }

def get_pdf_page_text(file_path: str, start_page: int, end_page: int) -> str:
    path = Path(file_path)
    reader = pypdf.PdfReader(str(path))
    total_pages = len(reader.pages)
    
    start_idx = max(0, start_page - 1)
    end_idx = min(total_pages, end_page)

    page_labels = []
    try:
        page_labels = [str(l) for l in (reader.page_labels or [])]
    except Exception:
        page_labels = []

    texts = []
    for i in range(start_idx, end_idx):
        t = reader.pages[i].extract_text() or ""
        doc_label = page_labels[i] if i < len(page_labels) else None
        if doc_label and doc_label != str(i + 1):
            texts.append(f"--- [Page {i+1} (Document Page {doc_label})] ---\n{t}")
        else:
            texts.append(f"--- [Page {i+1}] ---\n{t}")
    return "\n\n".join(texts)

def get_pdf_page_cluster_bytes(file_path: str, start_page: int, end_page: int) -> bytes:
    """
    Creates a standalone in-memory PDF containing only the requested page range.
    Can be sent directly as a visual document part to Gemini Vision.
    """
    import io
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    reader = pypdf.PdfReader(str(path))
    total_pages = len(reader.pages)
    start_idx = max(0, start_page - 1)
    end_idx = min(total_pages, end_page)

    writer = pypdf.PdfWriter()
    for i in range(start_idx, end_idx):
        writer.add_page(reader.pages[i])

    out_buf = io.BytesIO()
    writer.write(out_buf)
    return out_buf.getvalue()

def index_document_sections(document_id: str, file_path: str, campaign_id: str = "") -> List[Dict[str, Any]]:
    """
    Parses a PDF into indexed sections (keyed areas, sidebars, chapters)
    and persists them to uploaded_document_sections in SQLite for RAG search and provenance.
    """
    import uuid
    import re
    from datetime import datetime, timezone
    from app.db.database import get_db

    parsed = parse_pdf(file_path, max_pages=None)
    sections: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()
        # Clear existing sections for this document to avoid duplicates on re-index
        cursor.execute("DELETE FROM uploaded_document_sections WHERE document_id = ?", (document_id,))

        for page in parsed["pages"]:
            page_num = page["page_number"]
            page_text = page["text"]
            if not page_text.strip():
                continue

            # Split by common D&D section headings (e.g. "Area 1:", "Chapter 2", "Sidebar:", "Act 1", "Room 4")
            pattern = r"(?=(?:^|\n)(?:(?:Area|Room|Location)\s+\d+[:\.\s]|(?:Chapter|Act|Part|Episode)\s+\d+[:\.\s]|Sidebar[:\.\s]))"
            parts = [p.strip() for p in re.split(pattern, page_text, flags=re.IGNORECASE) if p.strip()]

            if not parts:
                parts = [page_text]

            for chunk_idx, part in enumerate(parts):
                # Extract title guess from first line
                first_line = part.split("\n")[0][:80].strip()
                title = first_line if any(k in first_line.lower() for k in ["area", "room", "chapter", "act", "sidebar", "part"]) else f"Page {page_num} (Section {chunk_idx + 1})"

                sec_id = f"sec-{uuid.uuid4().hex[:12]}"
                cursor.execute("""
                    INSERT INTO uploaded_document_sections (
                        id, document_id, campaign_id, section_title, page_number, raw_text, chunk_index, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (sec_id, document_id, campaign_id, title, page_num, part, chunk_idx, now))

                sections.append({
                    "id": sec_id,
                    "document_id": document_id,
                    "section_title": title,
                    "page_number": page_num,
                    "raw_text": part[:300] + "..." if len(part) > 300 else part,
                    "chunk_index": chunk_idx
                })

    return sections

def search_document_sections(query_str: str, document_id: Optional[str] = None, campaign_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    RAG helper: Full-text search over indexed document sections using SQLite FTS5.
    """
    from app.db.database import get_db

    safe_query = " ".join([w.strip().replace('"', '""') for w in query_str.split() if w.strip()])
    if not safe_query:
        return []

    with get_db() as conn:
        cursor = conn.cursor()
        params: List[Any] = []
        sql = """
            SELECT s.id, s.document_id, s.campaign_id, s.section_title, s.page_number, s.raw_text, s.chunk_index
            FROM uploaded_document_sections s
            JOIN fts_document_sections f ON f.rowid = s.rowid
            WHERE fts_document_sections MATCH ?
        """
        params.append(safe_query)

        if document_id:
            sql += " AND s.document_id = ?"
            params.append(document_id)
        if campaign_id:
            sql += " AND (s.campaign_id = ? OR s.campaign_id IS NULL OR s.campaign_id = '')"
            params.append(campaign_id)

        sql += " ORDER BY rank LIMIT 25"
        try:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        except Exception:
            # Fallback to LIKE if FTS expression has syntax error
            sql_fallback = """
                SELECT id, document_id, campaign_id, section_title, page_number, raw_text, chunk_index
                FROM uploaded_document_sections
                WHERE raw_text LIKE ?
            """
            fallback_params = [f"%{query_str}%"]
            if document_id:
                sql_fallback += " AND document_id = ?"
                fallback_params.append(document_id)
            sql_fallback += " LIMIT 25"
            cursor.execute(sql_fallback, fallback_params)
            return [dict(r) for r in cursor.fetchall()]

def get_document_sections(document_id: str) -> List[Dict[str, Any]]:
    """Retrieve all indexed sections for a document ordered by page and chunk."""
    from app.db.database import get_db
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, document_id, campaign_id, section_title, page_number, raw_text, chunk_index
            FROM uploaded_document_sections
            WHERE document_id = ?
            ORDER BY page_number ASC, chunk_index ASC
        """, (document_id,))
        return [dict(r) for r in cursor.fetchall()]
