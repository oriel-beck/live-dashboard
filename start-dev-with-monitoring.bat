@echo off
setlocal enabledelayedexpansion

REM Discord Bot Platform - Development Stack with Monitoring Startup Script (Windows)
REM This script starts both the development stack and monitoring stack together

title Discord Bot Platform - Development with Monitoring

echo.
echo ==================================================
echo Starting Discord Bot Platform Development Stack with Monitoring...
echo ==================================================
echo.

REM Configuration
set COMPOSE_FILE=docker-compose.dev-with-monitoring.yml

REM Function to check if Docker is running
call :check_docker
if errorlevel 1 exit /b 1

REM Function to check if docker-compose is available
call :check_docker_compose
if errorlevel 1 exit /b 1

REM Function to check if compose file exists
call :check_compose_file
if errorlevel 1 exit /b 1

REM Setup
call :create_directories
call :stop_existing

REM Start services
call :start_services


:check_docker
echo INFO: Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    exit /b 1
)
echo SUCCESS: Docker is running
exit /b 0

:check_docker_compose
echo INFO: Checking docker-compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: docker-compose is not available. Please install Docker Desktop with Compose.
    exit /b 1
)
echo SUCCESS: docker-compose is available
exit /b 0

:check_compose_file
echo INFO: Checking compose file...
if not exist "%COMPOSE_FILE%" (
    echo ERROR: %COMPOSE_FILE% not found in current directory
    exit /b 1
)
echo SUCCESS: %COMPOSE_FILE% found
exit /b 0

:create_directories
echo INFO: Creating monitoring directories...

REM Create directories
if not exist "monitoring" mkdir monitoring
if not exist "monitoring\prometheus" mkdir monitoring\prometheus
if not exist "monitoring\prometheus\rules" mkdir monitoring\prometheus\rules
if not exist "monitoring\grafana" mkdir monitoring\grafana
if not exist "monitoring\grafana\provisioning" mkdir monitoring\grafana\provisioning
if not exist "monitoring\grafana\provisioning\datasources" mkdir monitoring\grafana\provisioning\datasources
if not exist "monitoring\grafana\provisioning\dashboards" mkdir monitoring\grafana\provisioning\dashboards
if not exist "monitoring\grafana\dashboards" mkdir monitoring\grafana\dashboards
if not exist "monitoring\loki" mkdir monitoring\loki
if not exist "monitoring\promtail" mkdir monitoring\promtail
if not exist "monitoring\alertmanager" mkdir monitoring\alertmanager

echo SUCCESS: Directories created successfully
exit /b 0

:stop_existing
echo INFO: Stopping existing containers...
docker-compose -f "%COMPOSE_FILE%" down --remove-orphans >nul 2>&1
echo SUCCESS: Existing containers stopped
exit /b 0

:start_services
echo INFO: Starting development stack with monitoring...

echo INFO: Pulling latest images...
docker-compose -f "%COMPOSE_FILE%" pull

echo INFO: Starting services...
docker-compose -f "%COMPOSE_FILE%" up -d --build

echo SUCCESS: Services started successfully
exit /b 0
