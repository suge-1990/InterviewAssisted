from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from routers import chat, interviews, knowledge, questions, resume, session, ws_audio, ws_viewer


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Interview Copilot API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["interviews"])
app.include_router(session.router, prefix="/api/session", tags=["session"])
app.include_router(ws_audio.router, tags=["websocket"])
app.include_router(ws_viewer.router, tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}
