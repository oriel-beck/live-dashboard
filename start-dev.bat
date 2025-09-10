@echo off
REM Development startup script for Discord Bot Management Platform (Windows Batch)

echo Starting Discord Bot Management Platform Development Environment...

REM Check if .env file exists
if not exist ".env" (
    echo .env file not found. Please copy env.example to .env and configure your environment variables.
    echo copy env.example .env
    echo Then edit .env with your actual values.
    pause
    exit /b 1
)

REM Check if sharding is disabled
if "%USE_SHARDING%"=="false" (
    echo Starting in SINGLE INSTANCE mode (sharding disabled)
    echo To enable sharding (default), set USE_SHARDING=true or remove the variable
) else (
    echo Starting with SHARDING enabled (auto-scaling)
)

REM Start the development environment with Docker Compose watch
echo Starting Docker Compose services with file watching...
echo Note: API service will automatically set up the database with Prisma
docker-compose -f docker-compose.dev.yml watch

pause
