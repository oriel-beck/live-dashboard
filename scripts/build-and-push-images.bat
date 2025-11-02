@echo off
REM Script to build images, push to registry, and start services
REM Usage: scripts\build-and-push-images.bat [dev|prod]
REM Arguments:
REM   dev  - Build for development (uses 'dev' Docker target)
REM   prod - Build for production (uses 'prod' Docker target, default)

setlocal enabledelayedexpansion

REM Parse build target from argument
set BUILD_TARGET=%1
if "%BUILD_TARGET%"=="" set BUILD_TARGET=prod
if not "%BUILD_TARGET%"=="dev" if not "%BUILD_TARGET%"=="prod" (
  echo ❌ Error: Invalid build target '%BUILD_TARGET%'
  echo Usage: %~nx0 [dev^|prod]
  exit /b 1
)

set REGISTRY_HOST=%REGISTRY_HOST%
if "%REGISTRY_HOST%"=="" set REGISTRY_HOST=localhost:5000
set REGISTRY_PORT=%REGISTRY_PORT%
if "%REGISTRY_PORT%"=="" set REGISTRY_PORT=5000
set REGISTRY_URL=http://localhost:%REGISTRY_PORT%

echo 🔧 Building for: %BUILD_TARGET%

echo 🚀 Starting Docker registry...
docker-compose up -d registry

echo ⏳ Waiting for registry to be ready...
:wait_registry
curl -f "%REGISTRY_URL%/v2/" >nul 2>&1
if errorlevel 1 (
  echo   Waiting for registry...
  timeout /t 2 /nobreak >nul
  goto wait_registry
)
echo ✅ Registry is ready!

echo 🏗️  Building images (target: %BUILD_TARGET%)...
set "BUILD_TARGET=%BUILD_TARGET%"
docker-compose -f docker-compose.build.yml build

echo 🏷️  Tagging images for registry...
docker tag cluster-manager:latest %REGISTRY_HOST%/cluster-manager:latest
docker tag bot:latest %REGISTRY_HOST%/bot:latest

echo 📤 Pushing images to registry...
docker push %REGISTRY_HOST%/cluster-manager:latest
docker push %REGISTRY_HOST%/bot:latest

echo ✅ Images pushed to registry!
echo.
echo 🚀 Starting all services...
if "%BUILD_TARGET%"=="dev" (
  docker-compose -f docker-compose.dev.yml up -d
) else (
  docker-compose -f docker-compose.yml up -d
)

echo.
echo ✅ All services started!
echo.
echo Registry: %REGISTRY_URL%
echo Cluster Manager metrics: http://localhost:3001/metrics
echo Grafana: http://localhost:3002
echo Prometheus: http://localhost:9090

endlocal

