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
  echo Error: Invalid build target '%BUILD_TARGET%'
  echo Usage: %~nx0 [dev^|prod]
  exit /b 1
)

set REGISTRY_HOST=%REGISTRY_HOST%
if "%REGISTRY_HOST%"=="" set REGISTRY_HOST=localhost:5000
set REGISTRY_PORT=%REGISTRY_PORT%
if "%REGISTRY_PORT%"=="" set REGISTRY_PORT=5000
set REGISTRY_URL=http://localhost:%REGISTRY_PORT%

echo Building for: %BUILD_TARGET%

echo Starting Docker registry...
docker-compose up -d registry || exit /b 1

echo Waiting for registry to be ready...
:wait_registry
curl -f "%REGISTRY_URL%/v2/" >nul 2>&1
if errorlevel 1 (
  echo   Waiting for registry...
  timeout /t 2 /nobreak >nul
  goto wait_registry
)
echo Registry is ready!

echo Building and pushing base images...
REM Build and push base images first (they're needed by application images)
docker-compose -f docker-compose.build.yml build shared-base || exit /b 1
docker push %REGISTRY_HOST%/shared-base:latest || exit /b 1

docker-compose -f docker-compose.build.yml build services-base || exit /b 1
docker push %REGISTRY_HOST%/services-base:latest || exit /b 1

echo Building application images (target: %BUILD_TARGET%)...
REM Build application images (they will pull base images from registry)
set "BUILD_TARGET=%BUILD_TARGET%"
docker-compose -f docker-compose.build.yml build cluster-manager bot-cluster || exit /b 1

echo Pushing application images to registry...
REM Push application images
docker push %REGISTRY_HOST%/cluster-manager:latest || exit /b 1
docker push %REGISTRY_HOST%/bot:latest || exit /b 1

echo Images pushed to registry!
echo.
echo Starting all services...
if "%BUILD_TARGET%"=="dev" (
  docker-compose -f docker-compose.dev.yml up -d --build || exit /b 1
) else (
  docker-compose -f docker-compose.yml up -d --build || exit /b 1
)

echo.
echo All services started!
echo.
echo Registry: %REGISTRY_URL%
echo Cluster Manager metrics: http://localhost:3001/metrics
echo Grafana: http://localhost:3002
echo Prometheus: http://localhost:9090

endlocal

