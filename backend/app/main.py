from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from routers import chat, resume, ws_audio

app = FastAPI(title="Interview Copilot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(ws_audio.router, tags=["websocket"])


@app.get("/health")
async def health():
    return {"status": "ok"}
