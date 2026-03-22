import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.llm_service import LLMService

router = APIRouter()
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


class AskRequest(BaseModel):
    question: str
    resume_context: str | None = None
    conversation_history: list[str] | None = None


@router.post("/ask")
async def ask_question(req: AskRequest):
    llm = get_llm_service()

    async def event_stream():
        async for delta in llm.generate_answer(
            question=req.question,
            conversation_history=req.conversation_history,
            resume_context=req.resume_context or "",
        ):
            data = json.dumps({"delta": delta, "done": False}, ensure_ascii=False)
            yield f"data: {data}\n\n"
        yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
