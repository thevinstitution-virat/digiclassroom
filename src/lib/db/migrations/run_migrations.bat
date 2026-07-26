@echo off
REM ============================================================================
REM SANCHIKA (संचिका) DATABASE MIGRATION RUNNER - Windows Version
REM ============================================================================
REM Purpose: Automated script to run all Sanchika database migrations on Windows
REM Usage: run_migrations.bat [required|all]
REM 
REM Arguments:
REM   required    Run only required migrations (default)
REM   all         Run all migrations (required + optional)
REM
REM Examples:
REM   run_migrations.bat
REM   run_migrations.bat required
REM   run_migrations.bat all
REM ============================================================================

setlocal enabledelayedexpansion

REM Default configuration
set CONTAINER_NAME=mysql_container
set MYSQL_USER=root
set DATABASE_NAME=virat_gyankosh
set RUN_MODE=required

REM Parse command line arguments
if "%1"=="all" set RUN_MODE=all
if "%1"=="required" set RUN_MODE=required
if "%1"=="--help" goto :show_help
if "%1"=="/?" goto :show_help

REM Print header
echo ============================================================================
echo   SANCHIKA (संचिका) DATABASE MIGRATION RUNNER
echo ============================================================================
echo.
echo Configuration:
echo   Container: %CONTAINER_NAME%
echo   User:      %MYSQL_USER%
echo   Database:  %DATABASE_NAME%
echo   Mode:      %RUN_MODE%
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker is not running or you don't have permission to access it
  echo Please start Docker Desktop and try again
  exit /b 1
)

REM Check if MySQL container is running
docker ps --format "{{.Names}}" | findstr /x "%CONTAINER_NAME%" >nul
if errorlevel 1 (
  echo [ERROR] MySQL container '%CONTAINER_NAME%' is not running
  echo.
  echo Available containers:
  docker ps --format "  - {{.Names}}"
  exit /b 1
)

echo [OK] Docker and MySQL container are running
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0

REM ============================================================================
REM REQUIRED MIGRATIONS
REM ============================================================================
echo ============================================================================
echo   REQUIRED MIGRATIONS
echo ============================================================================
echo.

call :run_migration "%SCRIPT_DIR%create_user_notes_table.sql" "Main notes table (REQUIRED)" "true"
if errorlevel 1 exit /b 1

REM ============================================================================
REM OPTIONAL MIGRATIONS (only if --all flag is set)
REM ============================================================================
if "%RUN_MODE%"=="all" (
  echo ============================================================================
  echo   OPTIONAL MIGRATIONS
  echo ============================================================================
  echo.
  
  call :run_migration "%SCRIPT_DIR%create_note_folders_table.sql" "Folder organization system" "false"
  call :run_migration "%SCRIPT_DIR%create_note_activity_log_table.sql" "Activity log and audit trail" "false"
  call :run_migration "%SCRIPT_DIR%create_note_shares_table.sql" "Note sharing functionality" "false"
  call :run_migration "%SCRIPT_DIR%create_note_templates_table.sql" "Reusable note templates" "false"
)

REM ============================================================================
REM VERIFICATION
REM ============================================================================
echo ============================================================================
echo   MIGRATION SUMMARY
echo ============================================================================
echo.
echo Verifying tables...
echo.

REM Check if user_notes table exists
docker exec %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% -e "SHOW TABLES LIKE 'user_notes';" 2>nul | findstr "user_notes" >nul
if errorlevel 1 (
  echo [ERROR] user_notes table not found
  exit /b 1
) else (
  echo [OK] user_notes table exists
)

if "%RUN_MODE%"=="all" (
  echo Checking optional tables...
  
  docker exec %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% -e "SHOW TABLES LIKE 'note_folders';" 2>nul | findstr "note_folders" >nul
  if errorlevel 1 (
    echo [WARNING] note_folders table not found (optional)
  ) else (
    echo [OK] note_folders table exists
  )
  
  docker exec %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% -e "SHOW TABLES LIKE 'note_activity_log';" 2>nul | findstr "note_activity_log" >nul
  if errorlevel 1 (
    echo [WARNING] note_activity_log table not found (optional)
  ) else (
    echo [OK] note_activity_log table exists
  )
  
  docker exec %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% -e "SHOW TABLES LIKE 'note_shares';" 2>nul | findstr "note_shares" >nul
  if errorlevel 1 (
    echo [WARNING] note_shares table not found (optional)
  ) else (
    echo [OK] note_shares table exists
  )
  
  docker exec %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% -e "SHOW TABLES LIKE 'note_templates';" 2>nul | findstr "note_templates" >nul
  if errorlevel 1 (
    echo [WARNING] note_templates table not found (optional)
  ) else (
    echo [OK] note_templates table exists
  )
)

echo.
echo ============================================================================
echo   MIGRATION COMPLETED SUCCESSFULLY!
echo ============================================================================
echo.
echo Next steps:
echo   1. Restart your Next.js development server
echo   2. Navigate to AI Tutor and create a test note
echo   3. Check 'Sanchika - Notes' from the sidebar
echo.
echo Happy note-taking!
echo.

exit /b 0

REM ============================================================================
REM FUNCTIONS
REM ============================================================================

:run_migration
set MIGRATION_FILE=%~1
set MIGRATION_DESC=%~2
set IS_REQUIRED=%~3

echo ----------------------------------------------------------------------------
echo Running: %MIGRATION_DESC%
echo File:    %MIGRATION_FILE%
if "%IS_REQUIRED%"=="true" (
  echo Status:  REQUIRED
) else (
  echo Status:  OPTIONAL
)
echo.

if not exist "%MIGRATION_FILE%" (
  echo [ERROR] Migration file not found: %MIGRATION_FILE%
  if "%IS_REQUIRED%"=="true" exit /b 1
  exit /b 0
)

REM Run the migration
docker exec -i %CONTAINER_NAME% mysql -u%MYSQL_USER% -p %DATABASE_NAME% < "%MIGRATION_FILE%" 2>&1 | findstr /v "Enter password:"
if errorlevel 1 (
  echo [ERROR] Migration failed!
  echo.
  if "%IS_REQUIRED%"=="true" exit /b 1
  echo [WARNING] Optional migration failed, continuing...
  echo.
  exit /b 0
)

echo [OK] Migration completed successfully!
echo.
exit /b 0

:show_help
echo Usage: run_migrations.bat [required^|all]
echo.
echo Arguments:
echo   required    Run only required migrations (default)
echo   all         Run all migrations (required + optional)
echo.
echo Examples:
echo   run_migrations.bat
echo   run_migrations.bat required
echo   run_migrations.bat all
exit /b 0

