import asyncio
import logging
import os
import re
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
            return None

        if len(result.stdout) < 320:
            return None

        return np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0
    except Exception as e:
        logger.error("Failed to decode WebM audio: %s", e)
        return None
    finally:
        if tmp_in:
            try:
                os.unlink(tmp_in)
            except OSError:
                pass


# Common Whisper hallucination patterns
_HALLUCINATION_PATTERNS = [
    re.compile(r'(发言人|说话人|讲者|Speaker)\s*[:：]?\s*', re.IGNORECASE),
    re.compile(r'字幕[由by].*', re.IGNORECASE),
    re.compile(r'谢谢观看.*', re.IGNORECASE),
    re.compile(r'请订阅.*', re.IGNORECASE),
    re.compile(r'感谢收看.*', re.IGNORECASE),
    re.compile(r'欢迎订阅.*', re.IGNORECASE),
    re.compile(r'请点赞.*', re.IGNORECASE),
    re.compile(r'Subscribe.*', re.IGNORECASE),
    re.compile(r'Thanks for watching.*', re.IGNORECASE),
    re.compile(r'\[音乐\]|\[掌声\]|BGM.*|片尾曲.*'),
]


def _clean_hallucinations(text: str) -> str:
    for p in _HALLUCINATION_PATTERNS:
        text = p.sub('', text)
    return text.strip()


class _ChannelBuffer:
    """Per-channel (mic or system) audio buffer and state."""

    def __init__(self, speaker: str):
        self.speaker = speaker
        self.buffer: bytes = b""
        self.chunk_count: int = 0
        self.last_sent_text: str = ""
        self.start_time: float = time.time()

    def reset(self):
        self.buffer = b""
        self.chunk_count = 0
        self.last_sent_text = ""
        self.start_time = time.time()


class ASRService:
    """ASR service using faster-whisper with dual-channel support."""

    def __init__(self, provider: str = "funasr", model: str = "iic/SenseVoiceSmall", device: str = "cpu"):
        self.device = device
        self._whisper_model = None
        self._initialized = False

        # Dual channel buffers
        self._channels: dict[str, _ChannelBuffer] = {
            "interviewer": _ChannelBuffer("interviewer"),
            "candidate": _ChannelBuffer("candidate"),
        }
        # Legacy single-channel for backward compat
        self._single_channel = _ChannelBuffer("unknown")

        self._try_init_model()

    def _try_init_model(self):
        try:
            from faster_whisper import WhisperModel
            compute_type = "int8"
            device = "cpu"
            if self.device.startswith("cuda"):
                device = "cuda"
                compute_type = "float16"

            model_size = "small"
            logger.info("Loading faster-whisper model (%s)...", model_size)
            self._whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
            self._initialized = True
            logger.info("faster-whisper model (%s) loaded successfully", model_size)
        except ImportError:
            logger.warning("faster-whisper not installed")
        except Exception as e:
            logger.warning("Failed to load faster-whisper: %s", e)

    @property
    def _chunk_count(self) -> int:
        """Backward compat for logging."""
        return self._single_channel.chunk_count

    async def process_chunk(self, audio_bytes: bytes, speaker: str = "unknown") -> list[TranscriptResult]:
        """Process an audio chunk. speaker: 'interviewer', 'candidate', or 'unknown'."""
        if speaker in self._channels:
            ch = self._channels[speaker]
        else:
            ch = self._single_channel
            ch.speaker = speaker

        ch.buffer += audio_bytes
        ch.chunk_count += 1

        # Trigger every 4 chunks (~2s)
        if ch.chunk_count % 4 != 0:
            return []

        return await self._transcribe_channel(ch)

    async def _transcribe_channel(self, ch: _ChannelBuffer) -> list[TranscriptResult]:
        if not self._initialized or not ch.buffer or self._whisper_model is None:
            return []

        try:
            audio_data = await asyncio.to_thread(_decode_webm_to_pcm, ch.buffer)
            if audio_data is None or len(audio_data) < 1600:
                return []

            # Sliding window: last 8 seconds
            window_samples = 16000 * 8
            window_audio = audio_data[-window_samples:] if len(audio_data) > window_samples else audio_data

            if len(window_audio) < 8000:
                return []

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
                with wave.open(tmp, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(16000)
                    wf.writeframes((window_audio * 32768).astype(np.int16).tobytes())

            segments_iter, _info = await asyncio.to_thread(
                self._whisper_model.transcribe,
                tmp_path,
                language="zh",
                beam_size=5,
                best_of=3,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=300,
                    threshold=0.35,
                ),
                condition_on_previous_text=True,
                no_speech_threshold=0.6,
                initial_prompt="以下是一段面试对话的实时语音转写。",
                without_timestamps=True,
            )

            segments = list(segments_iter)
            full_text = "".join(seg.text.strip() for seg in segments).strip()
            full_text = _clean_hallucinations(full_text)

            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            if not full_text:
                return []

            # Deduplicate
            new_text = self._extract_new_text(ch.last_sent_text, full_text)
            if not new_text:
                return []

            new_text = _clean_hallucinations(new_text)
            if not new_text or len(new_text) < 2:
                return []

            ch.last_sent_text = full_text

            logger.info("[%s] Transcribed: '%s'", ch.speaker, new_text)

            return [TranscriptResult(
                text=new_text,
                is_final=True,
                speaker=ch.speaker,
                start_time=ch.start_time,
                end_time=time.time(),
            )]

        except Exception as e:
            logger.error("Whisper transcription error (%s): %s", ch.speaker, e)
            return []

    @staticmethod
    def _extract_new_text(prev: str, curr: str) -> str:
        """Extract only the new portion of text compared to last sent."""
        if not prev:
            return curr

        # Find longest suffix of prev that is prefix of curr
        best_overlap = 0
        for i in range(1, len(prev) + 1):
            if curr.startswith(prev[-i:]):
                best_overlap = i

        if best_overlap > 0:
            return curr[best_overlap:].strip()

        # Check if prev is substring of curr
        idx = curr.find(prev)
        if idx >= 0:
            return curr[idx + len(prev):].strip()

        return curr

    def reset(self):
        for ch in self._channels.values():
            ch.reset()
        self._single_channel.reset()
