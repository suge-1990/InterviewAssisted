import json
import logging

from sqlalchemy import select, delete as sa_delete, update as sa_update

from app.database import AsyncSessionLocal
from models.knowledge import KnowledgeEntry

logger = logging.getLogger(__name__)


class KnowledgeBaseService:

    async def add_entry(
        self,
        question_pattern: str,
        answer: str,
        tags: list[str],
        priority: int,
    ) -> str:
        async with AsyncSessionLocal() as session:
            entry = KnowledgeEntry(
                question_pattern=question_pattern,
                answer=answer,
                tags=json.dumps(tags, ensure_ascii=False),
                priority=priority,
            )
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
            return entry.id

    async def update_entry(self, entry_id: str, updates: dict) -> bool:
        async with AsyncSessionLocal() as session:
            # Convert tags list to JSON string if present
            if "tags" in updates and isinstance(updates["tags"], list):
                updates["tags"] = json.dumps(updates["tags"], ensure_ascii=False)

            stmt = (
                sa_update(KnowledgeEntry)
                .where(KnowledgeEntry.id == entry_id)
                .values(**updates)
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    async def delete_entry(self, entry_id: str) -> bool:
        async with AsyncSessionLocal() as session:
            stmt = sa_delete(KnowledgeEntry).where(KnowledgeEntry.id == entry_id)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    async def list_entries(self) -> list[dict]:
        async with AsyncSessionLocal() as session:
            stmt = select(KnowledgeEntry).order_by(KnowledgeEntry.priority.desc())
            result = await session.execute(stmt)
            entries = result.scalars().all()
            return [self._entry_to_dict(e) for e in entries]

    async def match(self, question: str) -> dict | None:
        async with AsyncSessionLocal() as session:
            stmt = select(KnowledgeEntry).order_by(KnowledgeEntry.priority.desc())
            result = await session.execute(stmt)
            entries = result.scalars().all()

        if not entries:
            return None

        question_lower = question.lower()

        # Phase 1: exact substring match on question_pattern
        for entry in entries:
            if entry.question_pattern.lower() in question_lower:
                return self._entry_to_dict(entry)

        # Phase 2: keyword overlap scoring
        question_keywords = set(question_lower.split())
        best_entry = None
        best_score = 0

        for entry in entries:
            pattern_keywords = set(entry.question_pattern.lower().split())
            overlap = len(question_keywords & pattern_keywords)
            # Weight by priority to prefer higher-priority entries
            score = overlap + entry.priority * 0.1
            if overlap > 0 and score > best_score:
                best_score = score
                best_entry = entry

        if best_entry is not None:
            return self._entry_to_dict(best_entry)

        return None

    @staticmethod
    def _entry_to_dict(entry: KnowledgeEntry) -> dict:
        tags = entry.tags
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []

        return {
            "id": entry.id,
            "question_pattern": entry.question_pattern,
            "answer": entry.answer,
            "tags": tags,
            "priority": entry.priority,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        }
