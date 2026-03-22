import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class Session:
    id: str
    created_at: datetime = field(default_factory=datetime.now)
    clients: dict[WebSocket, str] = field(default_factory=dict)  # ws -> role
    transcript_history: list = field(default_factory=list)
    resume_context: str = ""


class SessionManager:
    """Singleton session manager for multi-client interview sessions."""

    _instance: "SessionManager | None" = None

    def __new__(cls) -> "SessionManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.sessions: dict[str, Session] = {}
        return cls._instance

    def create_session(self) -> str:
        """Create a new session and return its 8-character ID."""
        session_id = uuid.uuid4().hex[:8]
        self.sessions[session_id] = Session(id=session_id)
        logger.info("Session created: %s", session_id)
        return session_id

    def join_session(self, session_id: str, ws: WebSocket, role: str) -> bool:
        """Add a client to an existing session. Role: 'primary' or 'viewer'."""
        session = self.sessions.get(session_id)
        if session is None:
            return False
        session.clients[ws] = role
        logger.info("Client joined session %s as %s (total: %d)", session_id, role, len(session.clients))
        return True

    async def broadcast(self, session_id: str, message: dict):
        """Send a message to all clients in a session."""
        session = self.sessions.get(session_id)
        if session is None:
            return
        disconnected = []
        for ws in session.clients:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            session.clients.pop(ws, None)

    def remove_client(self, session_id: str, ws: WebSocket):
        """Remove a client from a session."""
        session = self.sessions.get(session_id)
        if session is None:
            return
        session.clients.pop(ws, None)
        logger.info("Client removed from session %s (remaining: %d)", session_id, len(session.clients))

    def get_session(self, session_id: str) -> Session | None:
        """Get a session by ID."""
        return self.sessions.get(session_id)


# Module-level singleton instance
session_manager = SessionManager()
