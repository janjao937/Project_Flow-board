@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Access URLs
echo ================================================
echo  Flowboard - แสดง Public / Local URL
echo ================================================
echo.

set "LOCAL_PORT=%FLOWBOARD_LOCAL_PORT%"
if "%LOCAL_PORT%"=="" set "LOCAL_PORT=3080"

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker
  pause
  exit /b 1
)

echo LOCAL ^(ใช้ได้แม้ปิด Cloudflare ถ้า stack ยังรัน^):
echo   http://127.0.0.1:%LOCAL_PORT%
echo.

if exist "%~dp0trycloudflare-url.txt" (
  echo จากไฟล์ trycloudflare-url.txt:
  echo ------------------------------------------------
  type "%~dp0trycloudflare-url.txt"
  echo ------------------------------------------------
  echo.
) else (
  echo [WARN] ยังไม่มี trycloudflare-url.txt
  echo        รัน start-trycloudflare.bat แล้วรอจนได้ PUBLIC URL
  echo.
)

echo จาก log cloudflared ล่าสุด:
echo ------------------------------------------------
docker compose -p flowboard-trycloudflare -f docker\docker-compose.trycloudflare.yml logs cloudflared --no-color --tail 80 2>nul | findstr /i "trycloudflare.com"
echo ------------------------------------------------
echo.
echo ถ้าเคย Install จาก *.trycloudflare.com — ลบไอคอนนั้น แล้ว Install ใหม่จาก LOCAL URL
echo ปิดเฉพาะ tunnel: stop-trycloudflare-tunnel.bat
echo.
pause
exit /b 0
