import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
SYSTEM_PROMPT = (PROMPT_DIR / "answer_system.txt").read_text(encoding="utf-8")


class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
        )

    def _build_messages(
        self,
        question: str,
        conversation_history: list[str] | None = None,
        resume_context: str = "",
    ) -> list[dict]:
        system = SYSTEM_PROMPT
        if resume_context:
            system += f"\n\n## 候选人简历\n{resume_context}"

        messages: list[dict] = [{"role": "system", "content": system}]

        if conversation_history:
            for i, msg in enumerate(conversation_history):
                role = "user" if i % 2 == 0 else "assistant"
                messages.append({"role": role, "content": msg})

        messages.append({"role": "user", "content": f"面试问题：{question}"})
        return messages

    async def generate_answer(
        self,
        question: str,
        conversation_history: list[str] | None = None,
        resume_context: str = "",
    ) -> AsyncGenerator[str, None]:
        messages = self._build_messages(question, conversation_history, resume_context)

        try:
            stream = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=messages,
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=settings.LLM_TEMPERATURE,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            logger.error("LLM generation error: %s", e)
            yield f"\n[Error: LLM service unavailable - {e}]"
