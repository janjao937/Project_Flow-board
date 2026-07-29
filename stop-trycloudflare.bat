@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Stop Try Cloudflare
echo ================================================
echo  Flowboard - หยุด trycloudflare stack
echo ================================================
echo.
echo  Repo: %CD%
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker ใน PATH
  echo         เปิด Docker Desktop แล้วลองใหม่
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Engine ยังไม่พร้อม
  echo         เปิด Docker Desktop รอจน Ready แล้วลองใหม่
  goto :fail
)

set "COMPOSE_FILE=%CD%\docker\docker-compose.trycloudflare.yml"
set "PROJECT=flowboard-trycloudflare"

if not exist "%COMPOSE_FILE%" (
  echo [ERROR] ไม่พบไฟล์:
  echo         %COMPOSE_FILE%
  goto :fail
)

echo กำลังหยุด project: %PROJECT%
echo.

docker compose -p "%PROJECT%" -f "%COMPOSE_FILE%" down --remove-orphans
set "DOWN_EXIT=%ERRORLEVEL%"

REM fallback: ชื่อ project เก่าตอนรันครั้งก่อน (ชื่อโฟลเดอร์ docker)
docker compose -p docker -f "%COMPOSE_FILE%" down --remove-orphans >nul 2>&1

REM fallback: หยุดตามชื่อ container ที่รู้จัก
for %%C in (
  flowboard-trycloudflare-cloudflared-1
  flowboard-trycloudflare-edge-1
  flowboard-trycloudflare-web-1
  flowboard-trycloudflare-api-1
  flowboard-trycloudflare-nats-1
  docker-cloudflared-1
  docker-edge-1
  docker-web-1
  docker-api-1
  docker-nats-1
) do (
  docker rm -f "%%C" >nul 2>&1
)

echo.
echo สถานะหลังหยุด:
docker compose -p "%PROJECT%" -f "%COMPOSE_FILE%" ps -a
echo.

REM ถ้ายังเหลือ container ที่เกี่ยวกับ stack นี้ ให้แจ้ง
docker ps --format "{{.Names}}" | findstr /i "trycloudflare cloudflared docker-api docker-web docker-edge docker-nats flowboard-trycloudflare" >nul 2>&1
if not errorlevel 1 (
  echo [WARN] ยังมี container ที่เกี่ยวข้องรันอยู่ — ลองปิดจาก Docker Desktop
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
  goto :fail
)

if not "%DOWN_EXIT%"=="0" (
  echo [WARN] docker compose down รหัส %DOWN_EXIT% แต่พยายามลบ container ด้วยวิธีสำรองแล้ว
)

echo [OK] หยุด web / api / nats / edge / cloudflared แล้ว
if exist "%CD%\trycloudflare-url.txt" del /f /q "%CD%\trycloudflare-url.txt" >nul 2>&1
pause
exit /b 0

:fail
echo.
pause
exit /b 1
