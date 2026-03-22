import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.session_manager import session_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/viewer")
async def viewer_websocket(ws: WebSocket, session: str = ""):
    """WebSocket endpoint for viewer clients that receive interview events."""
    if not session:
        await ws.close(code=4001, reason="Missing session parameter")
        return

    session_obj = session_manager.get_session(session)
    if session_obj is None:
        await ws.close(code=4004, reason="Session not found")
        return

    await ws.accept()

    if not session_manager.join_session(session, ws, role="viewer"):
        await ws.close(code=4004, reason="Failed to join session")
        return

    logger.info("Viewer connected to session %s", session)

    await ws.send_json({
        "type": "connected",
        "session_id": session,
        "role": "viewer",
    })

    try:
        while True:
            # Viewer only receives; we still need to read to detect disconnect
            message = await ws.receive()
            if message.get("type") == "websocket.disconnect":
                break
            # Viewer can send ping to keep alive
            if "text" in message and message["text"]:
                import json
                try:
                    data = json.loads(message["text"])
                    if data.get("command") == "ping":
                        await ws.send_json({"type": "pong"})
                except (json.JSONDecodeError, TypeError):
                    pass
    except WebSocketDisconnect:
        logger.info("Viewer disconnected from session %s", session)
    except Exception as e:
        logger.error("Viewer WebSocket error: %s", e)
    finally:
        session_manager.remove_client(session, ws)
