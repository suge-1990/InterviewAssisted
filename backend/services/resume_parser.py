import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings
from models.resume import (
    Education,
    ParsedResume,
    Project,
    WorkExperience,
)

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"


class ResumeParser:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
        )
        self.system_prompt = (PROMPT_DIR / "resume_parse.txt").read_text(encoding="utf-8")

    async def parse(self, raw_text: str) -> ParsedResume:
        """Parse raw resume text into a structured ParsedResume using LLM."""
        user_prompt = self.system_prompt.replace("{resume_text}", raw_text)

        try:
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": "你是一个专业的简历解析助手，请严格按照要求输出JSON格式。"},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=0.1,
            )

            content = response.choices[0].message.content or ""
            parsed_data = self._extract_json(content)
            return self._build_parsed_resume(parsed_data, raw_text)

        except Exception as e:
            logger.error("Resume parsing failed: %s", e)
            return ParsedResume(raw_text=raw_text)

    def _extract_json(self, content: str) -> dict:
        """Extract JSON from LLM response, handling markdown code blocks."""
        content = content.strip()
        if content.startswith("```"):
            # Remove markdown code block markers
            lines = content.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(lines)
        return json.loads(content)

    def _build_parsed_resume(self, data: dict, raw_text: str) -> ParsedResume:
        """Build a ParsedResume dataclass from parsed JSON data."""
        try:
            return ParsedResume(
                raw_text=raw_text,
                name=data.get("name", ""),
                phone=data.get("phone"),
                email=data.get("email"),
                target_position=data.get("target_position"),
                summary=data.get("summary", ""),
                skills=data.get("skills", []),
                work_experiences=[
                    WorkExperience(**w) for w in data.get("work_experiences", [])
                ],
                projects=[Project(**p) for p in data.get("projects", [])],
                education=[Education(**e) for e in data.get("education", [])],
                languages=data.get("languages", []),
                certifications=data.get("certifications", []),
            )
        except Exception as e:
            logger.error("Failed to build ParsedResume from data: %s", e)
            return ParsedResume(raw_text=raw_text)
