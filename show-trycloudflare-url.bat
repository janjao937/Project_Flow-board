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
echo ถ้า URL ในไฟล์เป็น waiting... หรือไม่ตรง log: รอสคริปต์เขียนไฟล์ หรือรัน start ใหม่
echo.
pause
exit /b 0
