import re


# Greetings to exclude
_GREETINGS = {"你好", "谢谢", "再见", "好的", "嗯", "对", "是的", "没问题", "可以", "ok", "hello", "hi", "bye", "thanks"}

# Patterns that START a question (anchored to beginning)
_STARTER_WORDS = [
    "什么", "怎么", "如何", "为什么", "为何", "哪些", "哪个", "哪种",
    "能不能", "能否", "可不可以",
    "有没有", "是不是", "是否",
    "what", "how", "why", "when", "where", "which",
    "can you", "could you", "tell me", "describe", "explain",
    "walk me through", "do you", "have you",
]

# Patterns that can appear ANYWHERE in the text (not just start)
_QUESTION_KEYWORDS = [
    "请介绍", "请说说", "请谈谈", "请描述", "请解释", "请讲",
    "请用", "请举", "请分享", "请列举", "请说明", "请分析",
    "谈谈", "说说", "介绍一下", "描述一下", "解释一下", "讲一下", "聊一聊", "聊聊",
    "举个例子", "举例说明",
    "你觉得", "你认为", "你怎么看", "你的看法",
    "概括", "总结", "归纳",
    "对比", "比较", "区别",
    "优缺点", "优势", "劣势",
    "你了解", "你熟悉", "你知道",
    "遇到过", "碰到过", "处理过",
]

_STARTER_PATTERN = re.compile(
    r"^(" + "|".join(re.escape(s) for s in _STARTER_WORDS) + r")",
    re.IGNORECASE,
)

_KEYWORD_PATTERN = re.compile(
    r"(" + "|".join(re.escape(s) for s in _QUESTION_KEYWORDS) + r")",
    re.IGNORECASE,
)

# Short filler phrases to ignore
_FILLERS = {"嗯嗯", "哦", "啊", "呃", "那个", "就是", "然后", "对对对", "好好好", "嗯好"}


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
        if len(text) < 4:
            return False

        # Skip candidate's own speech
        if speaker == "candidate":
            return False

        # Skip greetings and fillers
        cleaned = text.lower().strip("，。！？,.!? ")
        if cleaned in _GREETINGS or cleaned in _FILLERS:
            return False

        # Has question mark — strong signal
        if "？" in text or "?" in text:
            return True

        # Starts with question word
        if _STARTER_PATTERN.search(text):
            return True

        # Contains question keyword ANYWHERE in text
        if _KEYWORD_PATTERN.search(text):
            return True

        return False
