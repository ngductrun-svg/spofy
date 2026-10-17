@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 24.15 tro len truoc khi chay. Xem README.md.
  pause
  exit /b 1
)
if not exist ".env" copy /y ".env.example" ".env" >nul
echo Mo http://127.0.0.1:3000 trong trinh duyet sau khi may chu khoi dong.
echo Giu cua so nay mo. Nhan Ctrl+C de dung.
node --env-file-if-exists=.env server/index.mjs
pause
