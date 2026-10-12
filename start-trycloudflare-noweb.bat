@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

title Flowboard - Try Cloudflare (API only)
echo ================================================
echo  Flowboard - trycloudflare แบบไม่มีเว็บ (API only)
echo  (api + nats + caddy + tunnel  -  ไม่ build เว็บ)
echo ================================================
echo.
echo  Repo: %CD%
echo.
echo  โหมดนี้เหมาะกับเมื่อ Frontend deploy บน Cloudflare Workers แล้ว
echo  - Stack ให้บริการเฉพาะ API ^(build เร็ว, ไม่ build Dockerfile.web^)
echo  - หน้าเว็บ = ลิงก์ workers.dev ที่ deploy ไว้ด้วย npm run cf:deploy:web
echo  - เข้า LOCAL ได้เฉพาะ API: http://127.0.0.1:3080/api/ready
echo  - container เว็บเก่าถ้ามีจะถูกลบขึ้นเอง (--remove-orphans)
echo  - ต้องการ lint UI ใน LAN จริง ๆ: ใช้ start-trycloudflare.bat ^((โหมดเต็ม)^)
echo.
echo  ทุกครั้งจะ recreate tunnel เพื่อได้ URL ไหม่
echo  ไฟล์ trycloudflare-url.txt จะถูกเขียนทับเมื่อได้ลิงก์
echo  ดูลิงก์ทีหลัง: show-trycloudflare-url.bat
echo  ปิดเฉพาะ tunnel: Ctrl+C หรือ stop-trycloudflare-tunnel.bat
echo  หยุดทั้ง stack: stop-trycloudflare.bat
echo.
echo ------------------------------------------------
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

where node >nul 2>&1
if errorlevel 1 (
  echo [WARN] ไม่พบ Node.js — รัน docker compose โดยตรง
  echo        หา URL จากบรรทัดที่มี trycloudflare.com ใน log
  echo.
  docker compose -f docker\docker-compose.trycloudflare.noweb.yml up --build -d
  set "FALLBACK_EXIT=%ERRORLEVEL%"
  if not "%FALLBACK_EXIT%"=="0" goto :fail
  echo [WARN] รอสักครู่ แล้วรัน show-trycloudflare-url.bat เพื่อหา URL
  echo        ^(โหมด fallback นี้ไม่ทำ publish KV^)
  goto :ok
)

node scripts\start-trycloudflare.mjs --no-web
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [ERROR] Stack จบด้วยรหัส %EXITCODE%
  goto :fail
)

:ok
echo Stack หยุดแล้ว
pause
exit /b 0

:fail
echo.
pause
exit /b 1
