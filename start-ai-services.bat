@echo off
REM ============================================================================
REM  DigiClassroom Pro - optional AI microservices (Sarvagya RAG + Kokoro TTS)
REM ----------------------------------------------------------------------------
REM  These are NOT required for the core app to run. They build large Python
REM  images (PyTorch CPU build, transformers, spaCy, Playwright/Chromium) - the
REM  FIRST build can take 10+ minutes and a few GB of disk. After that they're
REM  cached and start fast.
REM
REM  Sarvagya  -> http://localhost:8000  (document research / SurfSense API)
REM  TTS       -> http://localhost:8002  (spoken explanations; ARCH_TTS_AUDIO_LESSONS)
REM ============================================================================
echo ===================================================
echo   Building + starting AI microservices
echo   (first run is slow - grab a chai)
echo ===================================================
echo.

docker compose up -d --build sarvagya tts-service
if errorlevel 1 (
  echo.
  echo [!] AI services failed to build/start. The core app is unaffected.
  echo     See logs: docker compose logs sarvagya  /  docker compose logs tts-service
  pause
  exit /b 1
)

echo.
echo Done. Verify:
echo   curl http://localhost:8000/        ^(Sarvagya^)
echo   curl http://localhost:8002/health  ^(TTS^)
