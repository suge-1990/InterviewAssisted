from dataclasses import dataclass, field


@dataclass
class InterviewQuestion:
    id: str = ""
    question: str = ""
    category: str = ""       # "技术" | "行为" | "情景" | "系统设计" | "算法"
    industry: str = "通用"    # "互联网" | "金融" | "咨询" | "通用"
    position: str = "通用"    # "前端" | "后端" | "产品经理" | "通用"
    difficulty: str = "中级"  # "初级" | "中级" | "高级"
    tags: list[str] = field(default_factory=list)
    reference_answer: str = ""
    follow_up_questions: list[str] = field(default_factory=list)
    source: str = ""
