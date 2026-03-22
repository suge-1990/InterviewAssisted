import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"


class ReportService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
        )
        self.prompt_template = (PROMPT_DIR / "report_generate.txt").read_text(encoding="utf-8")

    async def generate_report(self, record_data: dict) -> dict:
        """Call LLM to analyze interview transcript and generate a structured report."""
        company = record_data.get("company", "未知公司")
        position = record_data.get("position", "未知职位")
        duration = record_data.get("duration_minutes", 0)
        transcript = record_data.get("transcript", "[]")
        questions = record_data.get("questions", "[]")

        # Parse questions list to count total
        try:
            questions_list = json.loads(questions) if isinstance(questions, str) else questions
        except (json.JSONDecodeError, TypeError):
            questions_list = []

        total_questions = len(questions_list)

        prompt = self.prompt_template.format(
            company=company,
            position=position,
            duration=duration,
            total_questions=total_questions,
            transcript=transcript,
        )

        try:
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": "你是一位专业的面试分析师，请严格按照JSON格式输出分析报告。"},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=0.3,
            )

            content = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3].strip()

            report = json.loads(content)
            return report

        except Exception as e:
            logger.error("Report generation failed: %s", e)
            return self._fallback_report(company, position, duration, total_questions)

    @staticmethod
    def _fallback_report(company: str, position: str, duration: int, total_questions: int) -> dict:
        """Return a basic report when LLM generation fails."""
        return {
            "summary": f"本次面试为{company}的{position}岗位面试，共进行{duration}分钟，涉及{total_questions}个问题。由于分析服务暂时不可用，详细报告稍后生成。",
            "duration": duration,
            "total_questions": total_questions,
            "question_categories": {},
            "strengths": [],
            "improvements": [],
            "question_analysis": [],
            "recommended_practice": [],
        }
