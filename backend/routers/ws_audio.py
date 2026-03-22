import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.asr_service import ASRService
from services.llm_service import LLMService
from services.question_detector import QuestionDetector

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
async def audio_websocket(ws: WebSocket, resume_id: str | None = None):
    await ws.accept()

    asr = get_asr()
    asr.reset()
    detector = QuestionDetector()
    llm = LLMService()

    resume_context = ""
    recent_transcripts: list[str] = []
    active_tasks: dict[str, asyncio.Task] = {}

    await ws.send_json({"type": "ready", "message": "Connected. Start speaking."})
    logger.info("WebSocket connected, ASR initialized=%s", asr._initialized)

    async def generate_and_stream(question_id: str, question_text: str):
        try:
            async for delta in llm.generate_answer(
                question=question_text,
                resume_context=resume_context,
            ):
                await ws.send_json({
                    "type": "answer",
                    "question_id": question_id,
                    "delta": delta,
                    "done": False,
                })
            await ws.send_json({
                "type": "answer",
                "question_id": question_id,
                "delta": "",
                "done": True,
            })
        except Exception as e:
            logger.error("Answer generation error: %s", e)
            await ws.send_json({"type": "error", "message": str(e)})
        finally:
            active_tasks.pop(question_id, None)

    try:
        while True:
            message = await ws.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Binary frame: audio data
            if "bytes" in message and message["bytes"]:
                audio_bytes = message["bytes"]
                logger.info("Received audio chunk: %d bytes, buffer chunks: %d",
                           len(audio_bytes), asr._chunk_count + 1)

                results = await asr.process_chunk(audio_bytes)

                if results:
                    logger.info("ASR returned %d results", len(results))

                for result in results:
                    logger.info("Transcript: '%s' (final=%s)", result.text, result.is_final)
                    await ws.send_json({
                        "type": "transcript",
                        "text": result.text,
                        "speaker": result.speaker,
                        "is_final": result.is_final,
                    })

                    if result.is_final:
                        recent_transcripts.append(result.text)
                        if len(recent_transcripts) > 10:
                            recent_transcripts.pop(0)

                        is_question = await detector.is_interview_question(
                            text=result.text,
                            speaker=result.speaker,
                            context=recent_transcripts,
                        )

                        if is_question:
                            logger.info("Question detected: '%s'", result.text)
                            question_id = f"q_{uuid.uuid4().hex[:8]}"
                            await ws.send_json({
                                "type": "question",
                                "text": result.text,
                                "id": question_id,
                            })
                            task = asyncio.create_task(
                                generate_and_stream(question_id, result.text)
                            )
                            active_tasks[question_id] = task

            # Text frame: JSON command
            elif "text" in message and message["text"]:
                try:
                    cmd = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                command = cmd.get("command")

                if command == "set_resume":
                    resume_context = cmd.get("resume_text", "")

                elif command == "stop_answer":
                    qid = cmd.get("question_id", "")
                    if qid in active_tasks:
                        active_tasks[qid].cancel()
                        active_tasks.pop(qid, None)

                elif command == "ping":
                    await ws.send_json({"type": "pong"})

                elif command == "ask":
                    question_text = cmd.get("text", "").strip()
                    if question_text:
                        question_id = f"q_{uuid.uuid4().hex[:8]}"
                        await ws.send_json({
                            "type": "question",
                            "text": question_text,
                            "id": question_id,
                        })
                        task = asyncio.create_task(
                            generate_and_stream(question_id, question_text)
                        )
                        active_tasks[question_id] = task

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        for task in active_tasks.values():
            task.cancel()
