@echo off
REM DigiClassroom Pro - Development Environment Startup Script (Batch Version)
REM This script starts all required Docker services

echo.
echo ========================================================
echo DigiClassroom Pro - Development Environment Setup
echo ========================================================
echo.

REM Check if Docker is available
echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running!
    echo Please install Docker Desktop and try again.
    pause
    exit /b 1
)
echo [OK] Docker is installed
echo.

REM Check if Node.js is available
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo After installation, restart your terminal and run this script again.
    pause
    exit /b 1
)
echo [OK] Node.js is installed
echo.

REM Check if npm is available
echo Checking npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed!
    echo Please install Node.js (which includes npm) and try again.
    pause
    exit /b 1
)
echo [OK] npm is installed
echo.

REM Start Docker services
echo ========================================================
echo Starting Docker services...
echo This may take a few minutes on first run...
echo ========================================================
echo.

docker-compose -f docker-compose.dev.yml up -d

if errorlevel 1 (
    echo [ERROR] Failed to start Docker services!
    pause
    exit /b 1
)

echo.
echo [OK] Docker services started!
echo.

REM Wait for services to initialize
echo Waiting for services to initialize (15 seconds)...
timeout /t 15 /nobreak >nul

echo.
echo ========================================================
echo Development Environment is Ready!
echo ========================================================
echo.

REM Display service information
echo Service Information:
echo.
echo MySQL Database:
echo   Host: localhost
echo   Port: 3307
echo   Database: virat_gyankosh
echo   User: digiclassroom_user
echo   Password: digiclassroom123
echo.
echo Qdrant Vector Database:
echo   URL: http://localhost:6333
echo   Dashboard: http://localhost:6333/dashboard
echo.
echo Redis Cache:
echo   Host: localhost
echo   Port: 6379
echo   Password: redis123
echo.

echo ========================================================
echo Next Steps:
echo ========================================================
echo.
echo 1. Install dependencies (if needed):
echo    npm install
echo.
echo 2. Start the development server:
echo    npm run dev
echo.
echo 3. Open your browser:
echo    http://localhost:3000
echo.

echo ========================================================
echo Useful Commands:
echo ========================================================
echo.
echo View logs:
echo   docker-compose -f docker-compose.dev.yml logs -f
echo.
echo Stop services:
echo   docker-compose -f docker-compose.dev.yml down
echo.
echo Restart services:
echo   docker-compose -f docker-compose.dev.yml restart
echo.
echo Check container status:
echo   docker ps
echo.

REM Ask if user wants to start the dev server
echo ========================================================
set /p START_DEV="Do you want to start the development server now? (y/N): "

if /i "%START_DEV%"=="y" (
    echo.
    echo Starting development server...
    echo Press Ctrl+C to stop the server
    echo.
    npm run dev
) else (
    echo.
    echo Setup complete! Run 'npm run dev' when you're ready.
    echo.
)

pause

