@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Try Cloudflare
echo ================================================
echo  Flowboard - Full stack + trycloudflare
echo  (web + api + nats + caddy + tunnel)
echo ================================================
echo.
echo  Repo: %CD%
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker ใน PATH
  echo         ติดตั้ง Docker Desktop แล้วเปิดโปรแกรมให้พร้อมก่อน
  goto :fail
)

docker compose version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบ Docker Compose
  echo         อัปเดต Docker Desktop แล้วลองใหม่
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Engine ยังไม่พร้อม
  echo         เปิด Docker Desktop รอจนสถานะ Ready แล้วรันไฟล์นี้อีกครั้ง
  goto :fail
)

echo [OK] Docker พร้อมแล้ว
echo.
echo โหมดนี้ไม่ต้องมีโดเมนขององค์กร
echo Cloudflare จะสุ่ม URL: https://xxxx.trycloudflare.com
echo.
echo กำลัง build/start แบบเงียบ ^(ไม่โชว์ spam /ready ของ API^)
echo - ทุกครั้งจะ recreate tunnel → ได้ URL ใหม่
echo - ไฟล์ trycloudflare-url.txt จะถูกรีเซ็ตแล้วเขียนทับเมื่อได้ลิงก์
echo - รอจนเห็นกล่อง PUBLIC URL
echo - ดูลิงก์ทีหลัง: show-trycloudflare-url.bat
echo - หยุด: Ctrl+C หรือ stop-trycloudflare.bat
echo.
echo ------------------------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [WARN] ไม่พบ Node.js — รัน docker compose โดยตรง
  echo        หา URL จากบรรทัดที่มี trycloudflare.com ใน log
  echo.
  docker compose -f docker\docker-compose.trycloudflare.yml up --build
) else (
  node scripts\start-trycloudflare.mjs
)

set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [ERROR] Stack จบด้วยรหัส %EXITCODE%
  goto :fail
)

echo Stack หยุดแล้ว
pause
exit /b 0

:fail
echo.
pause
exit /b 1
