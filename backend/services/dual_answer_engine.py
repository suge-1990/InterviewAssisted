"""
Dual-mode answer engine: Speed + Precise channels running concurrently.

Speed channel: Direct LLM call, no retrieval. Fast first-token (~1s).
Precise channel: Knowledge base + question bank lookup, then LLM. Slower but more accurate.
"""

import asyncio
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from services.llm_service import LLMService
from services.knowledge_base import KnowledgeBaseService
from services.question_bank import QuestionBankService

logger = logging.getLogger(__name__)


@dataclass
class AnswerChunk:
    channel: str   # "speed" | "precise"
    delta: str
    done: bool


class DualAnswerEngine:

    def __init__(self):
        self.llm = LLMService()
        self.knowledge_base = KnowledgeBaseService()
        self.question_bank = QuestionBankService()

    async def generate_dual(
        self,
        question: str,
        resume_context: str = "",
        conversation_history: list[str] | None = None,
    ) -> AsyncGenerator[AnswerChunk, None]:
        """Launch speed and precise channels concurrently, yield interleaved chunks."""
        speed_queue: asyncio.Queue[AnswerChunk | None] = asyncio.Queue()
        precise_queue: asyncio.Queue[AnswerChunk | None] = asyncio.Queue()

        async def run_speed():
            try:
                async for delta in self.llm.generate_answer(
                    question=question,
                    resume_context=resume_context,
                    conversation_history=conversation_history,
                ):
                    await speed_queue.put(AnswerChunk(channel="speed", delta=delta, done=False))
                await speed_queue.put(AnswerChunk(channel="speed", delta="", done=True))
            except Exception as e:
                logger.error("Speed channel error: %s", e)
                await speed_queue.put(AnswerChunk(channel="speed", delta=f"\n[Error: {e}]", done=False))
                await speed_queue.put(AnswerChunk(channel="speed", delta="", done=True))
            finally:
                await speed_queue.put(None)  # sentinel

        async def run_precise():
            try:
                # 1. Knowledge base match (zero-latency if hit)
                kb_match = await self.knowledge_base.match(question)
                if kb_match:
                    await precise_queue.put(
                        AnswerChunk(channel="precise", delta=kb_match["answer"], done=False)
                    )
                    await precise_queue.put(AnswerChunk(channel="precise", delta="", done=True))
                    return

                # 2. Question bank search for context
                bank_results = self.question_bank.search(
                    query=question, category=None, position=None, industry=None, limit=3
                )

                # 3. Build enriched context
                extra_context = ""
                if bank_results:
                    refs = []
                    for q in bank_results:
                        if q.reference_answer:
                            refs.append(f"Q: {q.question}\nA: {q.reference_answer}")
                    if refs:
                        extra_context = "\n\n## 相关题库参考\n" + "\n---\n".join(refs)

                enriched_resume = resume_context + extra_context if resume_context else extra_context

                # 4. LLM with enriched context
                async for delta in self.llm.generate_answer(
                    question=question,
                    resume_context=enriched_resume,
                    conversation_history=conversation_history,
                ):
                    await precise_queue.put(AnswerChunk(channel="precise", delta=delta, done=False))
                await precise_queue.put(AnswerChunk(channel="precise", delta="", done=True))
            except Exception as e:
                logger.error("Precise channel error: %s", e)
                await precise_queue.put(AnswerChunk(channel="precise", delta=f"\n[Error: {e}]", done=False))
                await precise_queue.put(AnswerChunk(channel="precise", delta="", done=True))
            finally:
                await precise_queue.put(None)  # sentinel

        speed_task = asyncio.create_task(run_speed())
        precise_task = asyncio.create_task(run_precise())

        speed_done = False
        precise_done = False

        while not (speed_done and precise_done):
            # Poll both queues with small timeout to interleave
            if not speed_done:
                try:
                    chunk = speed_queue.get_nowait()
                    if chunk is None:
                        speed_done = True
                    else:
                        yield chunk
                except asyncio.QueueEmpty:
                    pass

            if not precise_done:
                try:
                    chunk = precise_queue.get_nowait()
                    if chunk is None:
                        precise_done = True
                    else:
                        yield chunk
                except asyncio.QueueEmpty:
                    pass

            if not (speed_done and precise_done):
                await asyncio.sleep(0.02)

    async def generate_speed_only(
        self,
        question: str,
        resume_context: str = "",
        conversation_history: list[str] | None = None,
    ) -> AsyncGenerator[AnswerChunk, None]:
        """Speed channel only (backward compatible single-mode)."""
        async for delta in self.llm.generate_answer(
            question=question,
            resume_context=resume_context,
            conversation_history=conversation_history,
        ):
            yield AnswerChunk(channel="speed", delta=delta, done=False)
        yield AnswerChunk(channel="speed", delta="", done=True)
