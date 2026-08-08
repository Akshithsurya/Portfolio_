@echo off
title Portfolio Dev Server
echo ============================================
echo   Starting Portfolio Dev Server...
echo ============================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting Next.js dev server on http://localhost:3000
echo.
echo Opening browser in 5 seconds...
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
call npm run dev
