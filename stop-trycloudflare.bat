@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Stop Try Cloudflare
echo ================================================
echo  Flowboard - หยุด trycloudflare stack
echo ================================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker ใน PATH
  pause
  exit /b 1
)

docker compose -f docker\docker-compose.trycloudflare.yml down
if errorlevel 1 (
  echo [ERROR] หยุด stack ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo [OK] หยุด web / api / nats / edge / cloudflared แล้ว
pause
exit /b 0
