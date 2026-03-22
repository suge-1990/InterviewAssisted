import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.sql import func

from app.database import Base


# --- SQLAlchemy ORM model (database) ---

class ResumeRecord(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    file_name = Column(String(255))
    raw_text = Column(Text)
    parsed_data = Column(Text)  # JSON string of ParsedResume
    created_at = Column(DateTime, default=func.now())


# --- Dataclass models (business logic) ---

@dataclass
class WorkExperience:
    company: str = ""
    title: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""
    key_achievements: list[str] = field(default_factory=list)
    tech_stack: list[str] = field(default_factory=list)
    industry: str = ""


@dataclass
class Project:
    name: str = ""
    role: str = ""
    description: str = ""
    tech_stack: list[str] = field(default_factory=list)
    highlights: list[str] = field(default_factory=list)
    duration: str = ""
    team_size: int | None = None


@dataclass
class Education:
    school: str = ""
    degree: str = ""
    major: str = ""
    graduation_year: str = ""
    gpa: str | None = None
    highlights: list[str] = field(default_factory=list)


@dataclass
class ParsedResume:
    raw_text: str = ""
    name: str = ""
    phone: str | None = None
    email: str | None = None
    target_position: str | None = None
    summary: str = ""
    skills: list[str] = field(default_factory=list)
    work_experiences: list[WorkExperience] = field(default_factory=list)
    projects: list[Project] = field(default_factory=list)
    education: list[Education] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    certifications: list[str] = field(default_factory=list)

    def to_context_string(self) -> str:
        """Generate structured text for LLM context."""
        parts = []
        if self.name:
            parts.append(f"姓名：{self.name}")
        if self.target_position:
            parts.append(f"求职意向：{self.target_position}")
        if self.skills:
            parts.append(f"核心技能：{', '.join(self.skills)}")
        if self.summary:
            parts.append(f"个人简介：{self.summary}")

        if self.work_experiences:
            parts.append("\n工作经历：")
            for exp in self.work_experiences:
                parts.append(f"- {exp.company} | {exp.title} ({exp.start_date} ~ {exp.end_date})")
                if exp.key_achievements:
                    for ach in exp.key_achievements:
                        parts.append(f"  · {ach}")

        if self.projects:
            parts.append("\n项目经历：")
            for proj in self.projects:
                parts.append(f"- {proj.name} | {proj.role}")
                if proj.highlights:
                    for h in proj.highlights:
                        parts.append(f"  · {h}")

        if self.education:
            parts.append("\n教育背景：")
            for edu in self.education:
                parts.append(f"- {edu.school} | {edu.degree} {edu.major} ({edu.graduation_year})")

        return "\n".join(parts)

    def get_relevant_context(self, question: str) -> str:
        """Return most relevant resume snippets for a given question."""
        q_lower = question.lower()
        relevant_parts = []

        # Match work experiences by tech_stack and description keywords
        for exp in self.work_experiences:
            score = sum(1 for t in exp.tech_stack if t.lower() in q_lower)
            if any(kw in q_lower for kw in exp.description.lower().split()):
                score += 1
            if score > 0:
                relevant_parts.append((score, f"{exp.company} | {exp.title}: {exp.description}"))

        # Match projects
        for proj in self.projects:
            score = sum(1 for t in proj.tech_stack if t.lower() in q_lower)
            if proj.name.lower() in q_lower:
                score += 2
            if score > 0:
                relevant_parts.append((score, f"项目 {proj.name}: {proj.description}"))

        relevant_parts.sort(key=lambda x: x[0], reverse=True)

        if relevant_parts:
            return "\n".join(p[1] for p in relevant_parts[:3])
        return self.to_context_string()

    def to_json(self) -> str:
        import dataclasses
        return json.dumps(dataclasses.asdict(self), ensure_ascii=False, default=str)

    @classmethod
    def from_json(cls, json_str: str) -> "ParsedResume":
        data = json.loads(json_str)
        return cls(
            raw_text=data.get("raw_text", ""),
            name=data.get("name", ""),
            phone=data.get("phone"),
            email=data.get("email"),
            target_position=data.get("target_position"),
            summary=data.get("summary", ""),
            skills=data.get("skills", []),
            work_experiences=[WorkExperience(**w) for w in data.get("work_experiences", [])],
            projects=[Project(**p) for p in data.get("projects", [])],
            education=[Education(**e) for e in data.get("education", [])],
            languages=data.get("languages", []),
            certifications=data.get("certifications", []),
        )
