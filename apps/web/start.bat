@echo off
REM ============================================================================
REM  DigiClassroom Pro - ONE-SHOT START (app + ALL services)
REM ----------------------------------------------------------------------------
REM    App       -> http://localhost:3000
REM    MySQL :3310   Redis :6382   Qdrant :6343   MinIO :9000
REM    Sarvagya  -> http://localhost:8000   (AI document research)
REM    TTS       -> http://localhost:8002   (spoken lessons)
REM
REM  Opens 3 windows: this one runs the Next.js app; one builds/runs the AI
REM  microservices (slow on the FIRST run only); one runs the audio worker.
REM  Stop later: Ctrl+C here for the app, then  stop-dev.bat  for containers.
REM ============================================================================
setlocal
cd /d "%~dp0"

echo ===================================================
echo   DigiClassroom Pro - full stack starting
echo ===================================================

REM --- 0. Docker must be running ---------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo [!] Docker Desktop is not running. Start Docker Desktop, then re-run this.
  pause
  exit /b 1
)

REM --- 1. Core dependency containers (fast) ----------------------------------
echo.
echo [1/4] Starting core containers ^(mysql, qdrant, redis, minio^)...
docker compose up -d mysql qdrant redis minio
if errorlevel 1 (
  echo.
  echo [!] Core containers failed to start ^(port taken? check: docker compose ps^).
  pause
  exit /b 1
)

REM --- 2. AI microservices in their own window (slow FIRST build, non-blocking)
echo.
echo [2/4] Building/starting AI microservices ^(Sarvagya + TTS^) in a new window...
echo       First build can take 10+ minutes; the app does NOT wait for them.
start "DCP AI Services (Sarvagya :8000 / TTS :8002)" cmd /k "cd /d ""%~dp0"" && docker compose up -d --build sarvagya tts-service && echo. && echo AI services up: Sarvagya http://localhost:8000  ^|  TTS http://localhost:8002"

REM --- 3. Background audio worker in its own window --------------------------
echo.
echo [3/4] Starting background audio worker in a new window...
start "DCP Audio Worker" cmd /k "cd /d ""%~dp0"" && npm run worker:audio"

REM --- 4. Next.js app (this window, foreground) ------------------------------
echo.
echo [4/4] Starting the app on http://localhost:3000
echo       ^(Ctrl+C stops the app; containers keep running - use stop-dev.bat^)
echo.
npm run dev

endlocal
