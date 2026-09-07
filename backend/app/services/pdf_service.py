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

    for i in range(pages_to_read):
        page = reader.pages[i]
        text = page.extract_text() or ""
        extracted_pages.append({
            "page_number": i + 1,
            "text": text,
            "char_count": len(text)
        })
        if text.strip():
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

    texts = []
    for i in range(start_idx, end_idx):
        t = reader.pages[i].extract_text() or ""
        texts.append(f"--- [Page {i+1}] ---\n{t}")
    return "\n\n".join(texts)
