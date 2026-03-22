from dataclasses import asdict

from fastapi import APIRouter, Query

from services.question_bank import QuestionBankService

router = APIRouter()

_service = QuestionBankService()


@router.get("/search")
def search_questions(
    q: str = Query("", description="搜索关键词"),
    category: str | None = Query(None, description="分类筛选"),
    position: str | None = Query(None, description="岗位筛选"),
    industry: str | None = Query(None, description="行业筛选"),
):
    results = _service.search(q, category, position, industry)
    return [asdict(r) for r in results]


@router.get("/random")
def random_questions(
    category: str | None = Query(None, description="分类筛选"),
    count: int = Query(5, description="数量"),
):
    results = _service.get_random(category, None, count)
    return [asdict(r) for r in results]


@router.get("/{question_id}")
def get_question(question_id: str):
    result = _service.get_by_id(question_id)
    if result is None:
        return {"error": "Question not found"}
    return asdict(result)
