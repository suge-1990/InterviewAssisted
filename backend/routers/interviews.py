import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.database import AsyncSessionLocal
from models.interview import InterviewRecord
from services.report_service import ReportService

router = APIRouter()

_report_service: ReportService | None = None


def get_report_service() -> ReportService:
    global _report_service
    if _report_service is None:
        _report_service = ReportService()
    return _report_service


class CreateInterviewRequest(BaseModel):
    session_id: str
    company: str | None = None
    position: str | None = None
    resume_id: str | None = None


@router.get("/")
async def list_interviews():
    """List all interview records."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InterviewRecord).order_by(InterviewRecord.created_at.desc())
        )
        records = result.scalars().all()
        return [_serialize_record(r) for r in records]


@router.get("/{interview_id}")
async def get_interview(interview_id: str):
    """Get a single interview record."""
    async with AsyncSessionLocal() as db:
        record = await db.get(InterviewRecord, interview_id)
        if not record:
            raise HTTPException(status_code=404, detail="Interview not found")
        return _serialize_record(record)


@router.get("/{interview_id}/report")
async def get_interview_report(interview_id: str):
    """Get or generate an interview report."""
    async with AsyncSessionLocal() as db:
        record = await db.get(InterviewRecord, interview_id)
        if not record:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Return existing report if available
        if record.report:
            return json.loads(record.report)

        # Generate report via LLM
        report_service = get_report_service()
        record_data = {
            "company": record.company or "未知公司",
            "position": record.position or "未知职位",
            "duration_minutes": record.duration_minutes,
            "transcript": record.transcript,
            "questions": record.questions,
        }
        report = await report_service.generate_report(record_data)

        # Save report to database
        record.report = json.dumps(report, ensure_ascii=False)
        await db.commit()

        return report


@router.post("/")
async def create_interview(req: CreateInterviewRequest):
    """Create a new interview record."""
    async with AsyncSessionLocal() as db:
        record = InterviewRecord(
            session_id=req.session_id,
            company=req.company,
            position=req.position,
            resume_id=req.resume_id,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return _serialize_record(record)


@router.put("/{interview_id}/end")
async def end_interview(interview_id: str):
    """End an interview and calculate duration."""
    async with AsyncSessionLocal() as db:
        record = await db.get(InterviewRecord, interview_id)
        if not record:
            raise HTTPException(status_code=404, detail="Interview not found")

        now = datetime.now()
        record.end_time = now
        if record.start_time:
            delta = now - record.start_time
            record.duration_minutes = int(delta.total_seconds() / 60)
        await db.commit()
        await db.refresh(record)
        return _serialize_record(record)


def _serialize_record(record: InterviewRecord) -> dict:
    """Convert an InterviewRecord to a dict for JSON response."""
    return {
        "id": record.id,
        "session_id": record.session_id,
        "company": record.company,
        "position": record.position,
        "start_time": record.start_time.isoformat() if record.start_time else None,
        "end_time": record.end_time.isoformat() if record.end_time else None,
        "duration_minutes": record.duration_minutes,
        "transcript": json.loads(record.transcript) if record.transcript else [],
        "questions": json.loads(record.questions) if record.questions else [],
        "resume_id": record.resume_id,
        "report": json.loads(record.report) if record.report else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
