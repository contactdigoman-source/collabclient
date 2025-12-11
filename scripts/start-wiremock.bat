@echo off
REM Start WireMock locally using Docker
REM This script starts WireMock on port 8080 with the mappings from wiremock/mappings

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set WIREMOCK_DIR=%PROJECT_ROOT%\wiremock

echo Starting WireMock...
echo Using mappings from: %WIREMOCK_DIR%\mappings
echo WireMock will be available at: http://localhost:8080
echo.

cd /d "%WIREMOCK_DIR%"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Stop existing WireMock container if running
docker ps -a | findstr "colabclient-wiremock" >nul 2>&1
if not errorlevel 1 (
    echo Stopping existing WireMock container...
    docker stop colabclient-wiremock >nul 2>&1
    docker rm colabclient-wiremock >nul 2>&1
)

REM Start WireMock with Docker Compose
echo Starting WireMock with Docker...
docker-compose up -d

REM Wait a moment for WireMock to start
timeout /t 2 /nobreak >nul

REM Check if WireMock is running
curl -s http://localhost:8080/__admin/health >nul 2>&1
if not errorlevel 1 (
    echo WireMock is running successfully!
    echo.
    echo Admin UI: http://localhost:8080/__admin
    echo API Base URL: http://localhost:8080/api
    echo.
    echo To view logs: cd wiremock ^&^& docker-compose logs -f
    echo To stop: cd wiremock ^&^& docker-compose down
) else (
    echo WireMock may still be starting. Please check logs:
    echo    cd wiremock ^&^& docker-compose logs
)

