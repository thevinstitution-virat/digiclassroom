@echo off
REM ============================================================================
REM  DigiClassroom Pro - stop the dev dependency/microservice containers.
REM  (The host Next.js app + audio-worker windows: close them / Ctrl+C.)
REM ============================================================================
echo Stopping DigiClassroom Pro containers...
docker compose stop mysql qdrant redis minio sarvagya tts-service
echo Done. Data volumes are preserved. Use "docker compose down" to remove containers.
