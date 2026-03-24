import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from services.asr_service import ASRService
from services.dual_answer_engine import DualAnswerEngine
from services.question_detector import QuestionDetector
from services.voice_trigger import VoiceTriggerService
from services.session_manager import session_manager

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter()

# Singleton ASR to avoid reloading model per connection
_asr_instance: ASRService | None = None


def get_asr() -> ASRService:
    global _asr_instance
    if _asr_instance is None:
        logger.info("Initializing ASR service (first time)...")
        _asr_instance = ASRService()
        logger.info("ASR service initialized, ready=%s", _asr_instance._initialized)
    return _asr_instance


@router.websocket("/ws/audio")
async def audio_websocket(ws: WebSocket, session: str | None = None):
    await ws.accept()

    asr = get_asr()
    asr.reset()
    detector = QuestionDetector()
    engine = DualAnswerEngine()
    voice_trigger = VoiceTriggerService()

    resume_context = ""
    recent_transcripts: list[str] = []
    active_tasks: dict[str, asyncio.Task] = {}
    answer_mode = settings.DUAL_ANSWER_MODE  # "speed" | "precise" | "dual"

    # Session management
    session_id = session
    if not session_id:
        session_id = session_manager.create_session()
    elif not session_manager.get_session(session_id):
        session_id = session_manager.create_session()

    session_manager.join_session(session_id, ws, role="primary")

    await ws.send_json({
        "type": "ready",
        "message": "Connected. Start speaking.",
        "session_id": session_id,
        "answer_mode": answer_mode,
    })
    logger.info("WebSocket connected, session=%s, ASR initialized=%s", session_id, asr._initialized)

    async def generate_and_stream_dual(question_id: str, question_text: str):
        """Generate answers using dual-mode engine and stream to all clients."""
        try:
            if answer_mode == "dual":
                gen = engine.generate_dual(
                    question=question_text,
                    resume_context=resume_context,
                )
            else:
                gen = engine.generate_speed_only(
                    question=question_text,
                    resume_context=resume_context,
                )

            async for chunk in gen:
                msg_type = f"answer_{chunk.channel}"  # "answer_speed" or "answer_precise"
                msg = {
                    "type": msg_type,
                    "question_id": question_id,
                    "delta": chunk.delta,
                    "done": chunk.done,
                }
                # Send to primary client
                await ws.send_json(msg)
                # Broadcast to viewers
                await session_manager.broadcast_to_viewers(session_id, msg)

        except asyncio.CancelledError:
            logger.info("Answer generation cancelled for %s", question_id)
        except Exception as e:
            logger.error("Answer generation error: %s", e)
            await ws.send_json({"type": "error", "message": str(e)})
        finally:
            active_tasks.pop(question_id, None)

    async def handle_question_detected(question_text: str):
        """Handle a detected question: notify clients and start answer generation."""
        question_id = f"q_{uuid.uuid4().hex[:8]}"
        question_msg = {
            "type": "question",
            "text": question_text,
            "id": question_id,
        }
        await ws.send_json(question_msg)
        await session_manager.broadcast_to_viewers(session_id, question_msg)

        task = asyncio.create_task(
            generate_and_stream_dual(question_id, question_text)
        )
        active_tasks[question_id] = task

    try:
        while True:
            message = await ws.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Binary frame: audio data (first byte = source tag)
            if "bytes" in message and message["bytes"]:
                raw = message["bytes"]
                if len(raw) < 2:
                    continue

                source_tag = raw[0]
                audio_bytes = raw[1:]
                speaker = "interviewer" if source_tag == 0x02 else "candidate"

                logger.info("Received audio chunk: %d bytes, source=%s", len(audio_bytes), speaker)

                results = await asr.process_chunk(audio_bytes, speaker=speaker)

                for result in results:
                    logger.info("Transcript: '%s' (final=%s)", result.text, result.is_final)

                    transcript_msg = {
                        "type": "transcript",
                        "text": result.text,
                        "speaker": result.speaker,
                        "is_final": result.is_final,
                    }
                    await ws.send_json(transcript_msg)
                    await session_manager.broadcast_to_viewers(session_id, transcript_msg)

                    if result.is_final:
                        recent_transcripts.append(result.text)
                        if len(recent_transcripts) > 10:
                            recent_transcripts.pop(0)

                        # Check voice trigger
                        if voice_trigger.check_trigger(result.text, result.speaker):
                            logger.info("Voice trigger detected: '%s'", result.text)
                            last_question = recent_transcripts[-2] if len(recent_transcripts) >= 2 else result.text
                            await handle_question_detected(last_question)
                            continue

                        # Check if it's an interview question
                        is_question = await detector.is_interview_question(
                            text=result.text,
                            speaker=result.speaker,
                            context=recent_transcripts,
                        )

                        if is_question:
                            logger.info("Question detected: '%s'", result.text)
                            await handle_question_detected(result.text)

            # Text frame: JSON command
            elif "text" in message and message["text"]:
                try:
                    cmd = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                command = cmd.get("command")

                if command == "set_resume":
                    resume_context = cmd.get("resume_text", "")
                    session_obj = session_manager.get_session(session_id)
                    if session_obj:
                        session_obj.resume_context = resume_context

                elif command == "stop_answer":
                    qid = cmd.get("question_id", "")
                    if qid in active_tasks:
                        active_tasks[qid].cancel()
                        active_tasks.pop(qid, None)

                elif command == "set_answer_mode":
                    new_mode = cmd.get("mode", "dual")
                    if new_mode in ("speed", "precise", "dual"):
                        answer_mode = new_mode
                        session_manager.set_answer_mode(session_id, new_mode)
                        await ws.send_json({"type": "mode_changed", "mode": new_mode})

                elif command == "set_voice_trigger":
                    voice_trigger.set_enabled(cmd.get("enabled", False))
                    phrases = cmd.get("phrases")
                    if phrases:
                        voice_trigger.set_phrases(phrases)
                    await ws.send_json({
                        "type": "voice_trigger_updated",
                        **voice_trigger.get_config(),
                    })

                elif command == "ping":
                    await ws.send_json({"type": "pong"})

                elif command == "ask":
                    question_text = cmd.get("text", "").strip()
                    if question_text:
                        await handle_question_detected(question_text)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected, session=%s", session_id)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        for task in active_tasks.values():
            task.cancel()
        session_manager.remove_client(session_id, ws)
