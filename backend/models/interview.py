import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class InterviewRecord(Base):
    __tablename__ = "interview_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    session_id = Column(String(64))
    company = Column(String(255), nullable=True)
    position = Column(String(255), nullable=True)
    start_time = Column(DateTime, default=func.now())
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)
    transcript = Column(Text, default="[]")  # JSON list
    questions = Column(Text, default="[]")   # JSON list of QuestionRecord
    resume_id = Column(String(36), nullable=True)
    report = Column(Text, nullable=True)     # JSON of InterviewReport
    created_at = Column(DateTime, default=func.now())


@dataclass
class QuestionRecord:
    question_id: str = ""
    question_text: str = ""
    detected_at: str = ""
    ai_answer: str = ""
    category: str | None = None
    tags: list[str] = field(default_factory=list)


@dataclass
class InterviewReport:
    summary: str = ""
    duration: int = 0
    total_questions: int = 0
    question_categories: dict[str, int] = field(default_factory=dict)
    strengths: list[str] = field(default_factory=list)
    improvements: list[str] = field(default_factory=list)
    question_analysis: list[dict] = field(default_factory=list)
    recommended_practice: list[str] = field(default_factory=list)
