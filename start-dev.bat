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

REM Build shared types first (with proper package.json)
echo Building shared types...
cd shared-types
call npm install
call npm run build
cd ..

REM Start the development environment with Docker Compose watch
echo Starting Docker Compose services with file watching...
echo Note: API service will automatically set up the database with Prisma
docker-compose -f docker-compose.dev.yml watch

echo Development environment started with live reloading!
echo Dashboard: http://localhost:4200
echo API: http://localhost:3000
echo Bot: http://localhost:3001
echo Database: localhost:5432
echo Redis: localhost:6379

pause
