@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Public URL
echo ================================================
echo  Flowboard - แสดง Public URL (trycloudflare)
echo ================================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker
  pause
  exit /b 1
)

if exist "%~dp0trycloudflare-url.txt" (
  echo จากไฟล์ trycloudflare-url.txt:
  type "%~dp0trycloudflare-url.txt"
  echo.
)

echo จาก log cloudflared:
echo ------------------------------------------------
docker compose -p flowboard-trycloudflare -f docker\docker-compose.trycloudflare.yml logs cloudflared --no-color 2>nul | findstr /i "trycloudflare.com"
docker compose -p docker -f docker\docker-compose.trycloudflare.yml logs cloudflared --no-color 2>nul | findstr /i "trycloudflare.com"
echo ------------------------------------------------
echo.
echo ถ้าไม่เจอ URL: รัน start-trycloudflare.bat ใหม่
echo.
pause
exit /b 0
