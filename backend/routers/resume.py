import json
import logging
import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from models.resume import ParsedResume, ResumeRecord
from services.resume_parser import ResumeParser

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store kept for backward compatibility
_resume_store: dict[str, dict] = {}

_resume_parser = ResumeParser()


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

    # Keep in-memory store for backward compatibility
    _resume_store[resume_id] = {
        "file_name": file.filename,
        "full_text": full_text,
    }

    # Parse resume via LLM and persist to database
    parsed_resume = await _resume_parser.parse(full_text)

    async with AsyncSessionLocal() as session:
        record = ResumeRecord(
            id=resume_id,
            file_name=file.filename,
            raw_text=full_text,
            parsed_data=parsed_resume.to_json(),
        )
        session.add(record)
        await session.commit()
        logger.info("Resume %s saved to database", resume_id)

    return {
        "resume_id": resume_id,
        "file_name": file.filename,
        "text_preview": full_text[:200],
        "full_text": full_text,
    }


@router.get("/{resume_id}")
async def get_resume(resume_id: str):
    # Try in-memory store first, then fall back to database
    if resume_id in _resume_store:
        data = _resume_store[resume_id]
        return {
            "resume_id": resume_id,
            "file_name": data["file_name"],
            "text_preview": data["full_text"][:200],
            "full_text": data["full_text"],
        }

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ResumeRecord).where(ResumeRecord.id == resume_id)
        )
        record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(404, "Resume not found")

    return {
        "resume_id": resume_id,
        "file_name": record.file_name,
        "text_preview": (record.raw_text or "")[:200],
        "full_text": record.raw_text or "",
    }


@router.get("/{resume_id}/parsed")
async def get_parsed_resume(resume_id: str):
    """Return structured parsed resume data."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ResumeRecord).where(ResumeRecord.id == resume_id)
        )
        record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(404, "Resume not found")

    if not record.parsed_data:
        raise HTTPException(404, "Parsed data not available for this resume")

    try:
        parsed = ParsedResume.from_json(record.parsed_data)
    except Exception as e:
        logger.error("Failed to deserialize parsed data for %s: %s", resume_id, e)
        raise HTTPException(500, "Failed to load parsed resume data")

    parsed_dict = json.loads(parsed.to_json())
    # Remove raw_text from parsed response to keep it concise
    parsed_dict.pop("raw_text", None)

    return {
        "resume_id": resume_id,
        "file_name": record.file_name,
        "parsed": parsed_dict,
    }
