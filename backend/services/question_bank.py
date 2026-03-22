import json
import os
import random
from pathlib import Path

from models.question import InterviewQuestion


class QuestionBankService:
    def __init__(self):
        self._questions: list[InterviewQuestion] = []
        self._load_questions()

    def _load_questions(self):
        data_dir = Path(__file__).parent.parent / "data" / "questions"
        if not data_dir.exists():
            return
        for file_path in data_dir.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                items = json.load(f)
            for item in items:
                q = InterviewQuestion(
                    id=item.get("id", ""),
                    question=item.get("question", ""),
                    category=item.get("category", ""),
                    industry=item.get("industry", "通用"),
                    position=item.get("position", "通用"),
                    difficulty=item.get("difficulty", "中级"),
                    tags=item.get("tags", []),
                    reference_answer=item.get("reference_answer", ""),
                    follow_up_questions=item.get("follow_up_questions", []),
                    source=item.get("source", ""),
                )
                self._questions.append(q)

    def search(
        self,
        query: str,
        category: str | None,
        position: str | None,
        industry: str | None,
        limit: int = 10,
    ) -> list[InterviewQuestion]:
        filtered = self._questions

        if category:
            filtered = [q for q in filtered if q.category == category]
        if position:
            filtered = [q for q in filtered if q.position == position]
        if industry:
            filtered = [q for q in filtered if q.industry == industry]

        if not query.strip():
            return filtered[:limit]

        query_keywords = set(query.lower().split())
        scored: list[tuple[float, InterviewQuestion]] = []

        for q in filtered:
            text_words = set(q.question.lower().split())
            tag_words = set(t.lower() for t in q.tags)
            pool = text_words | tag_words

            overlap = len(query_keywords & pool)
            if overlap > 0:
                scored.append((overlap, q))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [q for _, q in scored[:limit]]

    def get_by_tags(self, tags: list[str]) -> list[InterviewQuestion]:
        tag_set = set(t.lower() for t in tags)
        results = []
        for q in self._questions:
            q_tags = set(t.lower() for t in q.tags)
            if q_tags & tag_set:
                results.append(q)
        return results

    def get_by_id(self, question_id: str) -> InterviewQuestion | None:
        for q in self._questions:
            if q.id == question_id:
                return q
        return None

    def get_random(
        self, category: str | None, position: str | None, count: int = 5
    ) -> list[InterviewQuestion]:
        pool = self._questions
        if category:
            pool = [q for q in pool if q.category == category]
        if position:
            pool = [q for q in pool if q.position == position]
        return random.sample(pool, min(count, len(pool)))
