@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Stop Cloudflare Tunnel Only
echo ================================================
echo  Flowboard - หยุดเฉพาะ Cloudflare tunnel
echo  (web / api / nats / edge ยังรันต่อ)
echo ================================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker ใน PATH
  pause
  exit /b 1
)

set "COMPOSE_FILE=%CD%\docker\docker-compose.trycloudflare.yml"
set "PROJECT=flowboard-trycloudflare"
set "LOCAL_PORT=%FLOWBOARD_LOCAL_PORT%"
if "%LOCAL_PORT%"=="" set "LOCAL_PORT=3080"

if not exist "%COMPOSE_FILE%" (
  echo [ERROR] ไม่พบไฟล์: %COMPOSE_FILE%
  pause
  exit /b 1
)

echo กำลังหยุดเฉพาะ service: cloudflared
docker compose -p "%PROJECT%" -f "%COMPOSE_FILE%" stop cloudflared
if errorlevel 1 (
  echo [ERROR] หยุด tunnel ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo [OK] ปิด public trycloudflare แล้ว
echo.
echo ใช้งานต่อในเครื่อง / LAN:
echo   http://127.0.0.1:%LOCAL_PORT%
echo.
echo แนะนำ: ติดตั้ง / บุ๊กมาร์กจาก LOCAL URL นี้
echo         อย่า Install จากลิงก์ *.trycloudflare.com
echo.
echo หยุดทั้ง stack: stop-trycloudflare.bat
echo.
pause
exit /b 0
