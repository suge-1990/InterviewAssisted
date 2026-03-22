import re


# Greetings to exclude
_GREETINGS = {"你好", "谢谢", "再见", "好的", "嗯", "对", "是的", "没问题", "可以", "ok", "hello", "hi", "bye", "thanks"}

# Question indicator patterns
_QUESTION_STARTERS = [
    "什么", "怎么", "如何", "为什么", "为何", "哪些", "哪个", "哪种",
    "能不能", "能否", "可不可以", "可以",
    "请介绍", "请说说", "请谈谈", "请描述", "请解释",
    "谈谈", "说说", "介绍", "描述", "解释",
    "有没有", "是不是", "是否",
    "what", "how", "why", "when", "where", "which", "can you", "could you",
    "tell me", "describe", "explain", "walk me through",
]

_STARTER_PATTERN = re.compile(
    r"^(" + "|".join(re.escape(s) for s in _QUESTION_STARTERS) + r")",
    re.IGNORECASE,
)


class QuestionDetector:
    async def is_interview_question(
        self,
        text: str,
        speaker: str = "unknown",
        context: list[str] | None = None,
    ) -> bool:
        """Rule-based interview question detection."""
        text = text.strip()

        # Too short
        if len(text) < 5:
            return False

        # Skip candidate's own speech
        if speaker == "candidate":
            return False

        # Skip greetings
        if text.lower().strip("，。！？,.!? ") in _GREETINGS:
            return False

        # Has question mark
        if "？" in text or "?" in text:
            return True

        # Starts with question indicator
        if _STARTER_PATTERN.search(text):
            return True

        return False
