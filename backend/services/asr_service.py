import asyncio
import io
import logging
import tempfile
import time
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class TranscriptResult:
    text: str
    is_final: bool
    speaker: str = "unknown"
    start_time: float = 0.0
    end_time: float = 0.0


def _decode_webm_to_pcm(webm_bytes: bytes) -> np.ndarray | None:
    """Decode WebM/Opus audio bytes to 16kHz mono float32 numpy array using ffmpeg directly."""
    import subprocess
    import tempfile
    import os

    tmp_in = None
    try:
        # Write WebM to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(webm_bytes)
            tmp_in = f.name

        # Use ffmpeg to convert to raw PCM
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", tmp_in,
                "-ar", "16000", "-ac", "1", "-f", "s16le",
                "-loglevel", "error",
                "pipe:1",
            ],
            capture_output=True,
            timeout=10,
        )

        if result.returncode != 0:
            logger.error("ffmpeg error: %s", result.stderr.decode())
            return None

        if len(result.stdout) < 320:  # Less than 10ms of audio
            return None

        samples = np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        return samples
    except Exception as e:
        logger.error("Failed to decode WebM audio: %s", e)
        return None
    finally:
        if tmp_in:
            try:
                os.unlink(tmp_in)
            except OSError:
                pass


class ASRService:
    """ASR service using faster-whisper for speech recognition."""

    def __init__(self, provider: str = "funasr", model: str = "iic/SenseVoiceSmall", device: str = "cpu"):
        self.provider = provider
        self.device = device
        self._buffer: bytes = b""
        self._chunk_count: int = 0
        self._start_time: float = time.time()
        self._whisper_model = None
        self._initialized = False

        self._try_init_model()

    def _try_init_model(self):
        # Try faster-whisper first (always available after install)
        try:
            from faster_whisper import WhisperModel
            compute_type = "int8"
            device = "cpu"
            if self.device.startswith("cuda"):
                device = "cuda"
                compute_type = "float16"

            logger.info("Loading faster-whisper model (base)...")
            self._whisper_model = WhisperModel(
                "base",
                device=device,
                compute_type=compute_type,
            )
            self._initialized = True
            logger.info("faster-whisper model loaded successfully")
            return
        except ImportError:
            logger.warning("faster-whisper not installed")
        except Exception as e:
            logger.warning("Failed to load faster-whisper: %s", e)

        # Try FunASR as fallback
        if self.provider == "funasr":
            try:
                from funasr import AutoModel
                self._asr_model = AutoModel(
                    model="iic/SenseVoiceSmall",
                    vad_model="fsmn-vad",
                    punc_model="ct-punc",
                    device=self.device,
                )
                self._initialized = True
                logger.info("FunASR model loaded successfully")
                return
            except ImportError:
                pass
            except Exception as e:
                logger.warning("Failed to load FunASR: %s", e)

        logger.warning("No ASR model available. Speech recognition disabled. Use manual input.")

    async def process_chunk(self, audio_bytes: bytes) -> list[TranscriptResult]:
        """Process an audio chunk. Accumulates multiple chunks before transcribing."""
        self._buffer += audio_bytes
        self._chunk_count += 1

        # Accumulate ~4 chunks (~2 seconds at 500ms per chunk)
        if self._chunk_count < 4:
            return []

        results = await self._transcribe()
        self._buffer = b""
        self._chunk_count = 0
        return results

    async def _transcribe(self) -> list[TranscriptResult]:
        if not self._initialized or not self._buffer:
            return []

        if self._whisper_model is not None:
            return await self._transcribe_whisper()

        return []

    async def _transcribe_whisper(self) -> list[TranscriptResult]:
        try:
            # Decode WebM to PCM
            audio_data = await asyncio.to_thread(_decode_webm_to_pcm, self._buffer)
            if audio_data is None or len(audio_data) < 1600:  # Less than 0.1s
                return []

            # Write to temp wav file for whisper
            import wave
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
                with wave.open(tmp, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes((audio_data * 32768).astype(np.int16).tobytes())

            # Run whisper transcription in thread
            segments, info = await asyncio.to_thread(
                self._whisper_model.transcribe,
                tmp_path,
                language="zh",
                beam_size=3,
                vad_filter=True,
            )

            # Collect results
            transcripts = []
            for segment in segments:
                text = segment.text.strip()
                if text and len(text) > 1:
                    transcripts.append(TranscriptResult(
                        text=text,
                        is_final=True,
                        speaker="unknown",
                        start_time=self._start_time,
                        end_time=time.time(),
                    ))

            self._start_time = time.time()

            # Clean up temp file
            import os
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            return transcripts
        except Exception as e:
            logger.error("Whisper transcription error: %s", e)
            return []

    def reset(self):
        self._buffer = b""
        self._chunk_count = 0
        self._start_time = time.time()
