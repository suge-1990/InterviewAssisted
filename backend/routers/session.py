"""Session management routes for dual-device connectivity."""

import logging

from fastapi import APIRouter, HTTPException

from services.session_manager import session_manager

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_lan_ip() -> str:
    """Get LAN IP address for mobile connection."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@router.post("/create")
async def create_session():
    """Create a new interview session and return connection info."""
    session_id = session_manager.create_session()
    lan_ip = _get_lan_ip()

    connect_url = f"http://{lan_ip}:3000/mobile/interview?session={session_id}"

    return {
        "session_id": session_id,
        "lan_ip": lan_ip,
        "connect_url": connect_url,
        "connect_code": session_id,
    }


@router.get("/{session_id}/connect-info")
async def get_connect_info(session_id: str):
    """Get connection info for an existing session."""
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    lan_ip = _get_lan_ip()
    connect_url = f"http://{lan_ip}:3000/mobile/interview?session={session_id}"

    client_count = len(session.clients)

    return {
        "session_id": session_id,
        "lan_ip": lan_ip,
        "connect_url": connect_url,
        "connect_code": session_id,
        "connected_clients": client_count,
        "created_at": session.created_at.isoformat(),
    }


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Destroy a session."""
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Close all client connections
    for ws in list(session.clients.keys()):
        try:
            await ws.close()
        except Exception:
            pass

    session_manager.sessions.pop(session_id, None)
    return {"status": "deleted"}
