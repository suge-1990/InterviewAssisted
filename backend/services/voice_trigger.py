"""
Voice trigger service: detect candidate's trigger phrases in transcripts
to automatically trigger quick answers.
"""

import logging

logger = logging.getLogger(__name__)

DEFAULT_PHRASES = [
    "让我想想",
    "这个问题",
    "稍等一下",
    "嗯让我思考一下",
    "我想一下",
    "容我想想",
    "well let me think",
    "let me think about that",
    "that's a good question",
    "hmm",
]


class VoiceTriggerService:

    def __init__(self):
        self.enabled: bool = False
        self.trigger_phrases: list[str] = list(DEFAULT_PHRASES)

    def check_trigger(self, transcript_text: str, speaker: str) -> bool:
        """Check if candidate's speech contains a trigger phrase."""
        if not self.enabled:
            return False
        if speaker != "candidate":
            return False

        text_lower = transcript_text.lower().strip()
        return any(p.lower() in text_lower for p in self.trigger_phrases)

    def set_phrases(self, phrases: list[str]):
        self.trigger_phrases = [p.strip() for p in phrases if p.strip()]

    def set_enabled(self, enabled: bool):
        self.enabled = enabled

    def get_config(self) -> dict:
        return {
            "enabled": self.enabled,
            "phrases": self.trigger_phrases,
        }
