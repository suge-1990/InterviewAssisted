import asyncio
import logging
import os
import subprocess
import tempfile
import time
import wave
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
    """Decode WebM/Opus audio bytes to 16kHz mono float32 numpy array using ffmpeg."""
    tmp_in = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(webm_bytes)
            tmp_in = f.name

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
            stderr = result.stderr.decode().strip()
            if stderr:
                logger.error("ffmpeg error: %s", stderr)
            return None

        if len(result.stdout) < 320:
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
        # All chunks since recording started — WebM needs continuous buffer
        self._full_buffer: bytes = b""
        # Position of last transcribed audio
        self._last_transcribed_len: int = 0
        self._chunk_count: int = 0
        self._start_time: float = time.time()
        self._whisper_model = None
        self._initialized = False

        self._try_init_model()

    def _try_init_model(self):
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

        logger.warning("No ASR model available. Use manual input.")

    async def process_chunk(self, audio_bytes: bytes) -> list[TranscriptResult]:
        """Process an audio chunk. Accumulates all chunks and transcribes periodically."""
        self._full_buffer += audio_bytes
        self._chunk_count += 1

        # Every 6 chunks (~3 seconds at 500ms per chunk), run transcription
        if self._chunk_count % 6 != 0:
            return []

        return await self._transcribe()

    async def _transcribe(self) -> list[TranscriptResult]:
        if not self._initialized or not self._full_buffer:
            return []

        if self._whisper_model is not None:
            return await self._transcribe_whisper()

        return []

    async def _transcribe_whisper(self) -> list[TranscriptResult]:
        try:
            # Decode the FULL buffer (WebM needs header from the beginning)
            audio_data = await asyncio.to_thread(_decode_webm_to_pcm, self._full_buffer)
            if audio_data is None or len(audio_data) < 1600:
                logger.warning("Failed to decode audio or too short (%d bytes buffer)",
                             len(self._full_buffer))
                return []

            # Only transcribe audio we haven't processed yet
            # Convert last_transcribed_len from PCM sample count
            new_start = self._last_transcribed_len
            if new_start >= len(audio_data):
                return []

            new_audio = audio_data[new_start:]
            if len(new_audio) < 8000:  # Less than 0.5s of new audio
                return []

            logger.info("Transcribing %d new samples (%.1fs), total buffer %.1fs",
                       len(new_audio), len(new_audio) / 16000,
                       len(audio_data) / 16000)

            # Write new audio segment to temp wav
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
                with wave.open(tmp, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes((new_audio * 32768).astype(np.int16).tobytes())

            # Run whisper transcription
            segments, _info = await asyncio.to_thread(
                self._whisper_model.transcribe,
                tmp_path,
                language="zh",
                beam_size=3,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=300,
                    speech_pad_ms=200,
                    threshold=0.3,
                ),
            )

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

            # Update position
            self._last_transcribed_len = len(audio_data)
            self._start_time = time.time()

            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            if transcripts:
                logger.info("Transcribed: %s", [t.text for t in transcripts])

            # Prevent buffer from growing too large (keep last 30s max)
            max_samples = 16000 * 30
            if len(audio_data) > max_samples:
                # Can't trim WebM buffer, but we track position via _last_transcribed_len
                pass

            return transcripts
        except Exception as e:
            logger.error("Whisper transcription error: %s", e)
            return []

    def reset(self):
        self._full_buffer = b""
        self._last_transcribed_len = 0
        self._chunk_count = 0
        self._start_time = time.time()
