from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.knowledge_base import KnowledgeBaseService

router = APIRouter()
_kb_service: KnowledgeBaseService | None = None


def get_kb_service() -> KnowledgeBaseService:
    global _kb_service
    if _kb_service is None:
        _kb_service = KnowledgeBaseService()
    return _kb_service


# ── Request / Response schemas ──────────────────────────────────────

class EntryCreateRequest(BaseModel):
    question_pattern: str
    answer: str
    tags: list[str] = []
    priority: int = 0


class EntryUpdateRequest(BaseModel):
    question_pattern: str | None = None
    answer: str | None = None
    tags: list[str] | None = None
    priority: int | None = None


class MatchRequest(BaseModel):
    question: str


class EntryResponse(BaseModel):
    id: str
    question_pattern: str
    answer: str
    tags: list[str]
    priority: int
    created_at: str | None = None
    updated_at: str | None = None


class ImportEntryItem(BaseModel):
    question_pattern: str
    answer: str
    tags: list[str] = []


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("/", response_model=list[EntryResponse])
async def list_entries():
    kb = get_kb_service()
    return await kb.list_entries()


@router.post("/", response_model=EntryResponse, status_code=201)
async def create_entry(req: EntryCreateRequest):
    kb = get_kb_service()
    entry_id = await kb.add_entry(
        question_pattern=req.question_pattern,
        answer=req.answer,
        tags=req.tags,
        priority=req.priority,
    )
    # Fetch the newly created entry to return full data
    entries = await kb.list_entries()
    for entry in entries:
        if entry["id"] == entry_id:
            return entry
    raise HTTPException(status_code=500, detail="Failed to retrieve created entry")


@router.put("/{entry_id}", response_model=EntryResponse)
async def update_entry(entry_id: str, req: EntryUpdateRequest):
    kb = get_kb_service()
    updates = req.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    success = await kb.update_entry(entry_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")

    entries = await kb.list_entries()
    for entry in entries:
        if entry["id"] == entry_id:
            return entry
    raise HTTPException(status_code=404, detail="Entry not found after update")


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str):
    kb = get_kb_service()
    success = await kb.delete_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


@router.post("/import", status_code=201)
async def bulk_import(items: list[ImportEntryItem]):
    kb = get_kb_service()
    created_ids: list[str] = []
    for item in items:
        entry_id = await kb.add_entry(
            question_pattern=item.question_pattern,
            answer=item.answer,
            tags=item.tags,
            priority=0,
        )
        created_ids.append(entry_id)
    return {"imported": len(created_ids), "ids": created_ids}


@router.post("/match")
async def match_question(req: MatchRequest):
    kb = get_kb_service()
    result = await kb.match(req.question)
    return result
