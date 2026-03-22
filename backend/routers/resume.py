import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings

router = APIRouter()

# In-memory store for MVP
_resume_store: dict[str, dict] = {}


def _extract_text_from_pdf(file_path: str) -> str:
    import fitz  # pymupdf
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def _extract_text_from_docx(file_path: str) -> str:
    import docx
    doc = docx.Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_text(file_path: str, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return _extract_text_from_pdf(file_path)
    elif ext == "docx":
        return _extract_text_from_docx(file_path)
    elif ext == "txt":
        with open(file_path, encoding="utf-8") as f:
            return f.read().strip()
    else:
        raise ValueError(f"Unsupported file type: {ext}")


@router.post("/upload")
async def upload_resume(file: UploadFile):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(400, "Only PDF, DOCX, TXT files are supported")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB}MB")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    resume_id = str(uuid.uuid4())[:8]
    file_path = os.path.join(settings.UPLOAD_DIR, f"{resume_id}.{ext}")

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        full_text = _extract_text(file_path, file.filename)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(500, f"Failed to parse file: {e}")

    _resume_store[resume_id] = {
        "file_name": file.filename,
        "full_text": full_text,
    }

    return {
        "resume_id": resume_id,
        "file_name": file.filename,
        "text_preview": full_text[:200],
        "full_text": full_text,
    }


@router.get("/{resume_id}")
async def get_resume(resume_id: str):
    if resume_id not in _resume_store:
        raise HTTPException(404, "Resume not found")
    data = _resume_store[resume_id]
    return {
        "resume_id": resume_id,
        "file_name": data["file_name"],
        "text_preview": data["full_text"][:200],
        "full_text": data["full_text"],
    }
