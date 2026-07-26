"""
Kokoro TTS Service — Audio lesson generation for K-12 students.

Port: 8002
No GPU required — runs on CPU for this scale.
Supports English and Hindi voices.

Two language pipelines are lazy-loaded on first request to avoid
model load time on startup.  Each pipeline stays resident for the
process lifetime (persistent Docker service pattern).
"""

import io
import base64
import logging
import os
import numpy as np
import soundfile as sf

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from typing import Literal

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[TTS] %(levelname)s %(message)s")

app = FastAPI(title="DigiClassroom TTS", version="1.0.0")

# ─── Voice Config ─────────────────────────────────────────────────────────────
VOICE_CONFIG = {
    "english": {
        "lang_code": "a",       # American English (supported by kokoro v0.9+)
        "voice":     "af_heart", # Clear, calm female voice — good for educational content
        "speed":     0.85,       # Slightly slower for learning comprehension
    },
    "hindi": {
        "lang_code": "h",        # Hindi
        "voice":     "hf_alpha", # Hindi female voice
        "speed":     0.85,
    },
}

# Character limit — prevents OOM on very large texts and abuse
MAX_TEXT_LENGTH = 3000

# Lazy-loaded pipelines — loaded on first request, resident thereafter
_pipelines: dict = {}


def get_pipeline(language: str):
    """Lazy-load and cache Kokoro pipeline for the given language."""
    if language not in _pipelines:
        try:
            from kokoro import KPipeline  # type: ignore
            config = VOICE_CONFIG[language]
            logger.info(f"Loading {language} pipeline (first request — will take ~3s)...")
            _pipelines[language] = KPipeline(lang_code=config["lang_code"])
            logger.info(f"{language} pipeline loaded and cached.")
        except ImportError:
            raise RuntimeError(
                "kokoro package not installed. Rebuild the Docker image or run: pip install kokoro"
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to load {language} TTS pipeline: {exc}") from exc
    return _pipelines[language]


# ─── Request Model ────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    language: Literal["english", "hindi"] = "english"
    speed: float = 0.85

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("text cannot be empty")
        # Truncate — don't reject; the TypeScript layer already clips but guard here too
        return stripped[:MAX_TEXT_LENGTH] if len(stripped) > MAX_TEXT_LENGTH else stripped

    @field_validator("speed")
    @classmethod
    def clamp_speed(cls, v: float) -> float:
        return max(0.5, min(1.5, v))


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.post("/synthesize")
async def synthesize(request: TTSRequest):
    """
    Generate audio from text.
    Returns a JSON payload with base64-encoded WAV audio.
    """
    config = VOICE_CONFIG.get(request.language, VOICE_CONFIG["english"])

    try:
        pipeline = get_pipeline(request.language)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    try:
        audio_segments = []
        for _, _, audio in pipeline(
            request.text,
            voice=config["voice"],
            speed=request.speed,
        ):
            if audio is not None and len(audio) > 0:
                audio_segments.append(audio)

        if not audio_segments:
            raise HTTPException(status_code=500, detail="TTS pipeline produced no audio output")

        combined = np.concatenate(audio_segments)

        # Write WAV to in-memory buffer — no disk I/O
        buf = io.BytesIO()
        sf.write(buf, combined, samplerate=24000, format="WAV")
        buf.seek(0)

        audio_b64 = base64.b64encode(buf.read()).decode("utf-8")
        duration_s = round(len(combined) / 24000, 2)

        logger.info(
            f"Synthesized {duration_s}s | lang={request.language} | chars={len(request.text)}"
        )

        return JSONResponse({
            "audio_base64":    audio_b64,
            "duration_seconds": duration_s,
            "language":        request.language,
            "format":          "wav",
            "sample_rate":     24000,
        })

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Synthesis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {exc}")


@app.get("/health")
def health():
    return {
        "status":            "ok",
        "service":           "kokoro-tts",
        "loaded_languages":  list(_pipelines.keys()),
        "gpu_required":      False,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")
