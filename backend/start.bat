@echo off
cd /d "%~dp0backend"
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="status" goto status
goto menu

:menu
echo Chrome Assistant Backend
echo =========================
echo.
echo 1. Start server
echo 2. Stop server
echo 3. Check status
echo 4. Exit
echo.
choice /C 1234 /N /M "Select: "
if errorlevel 4 exit
if errorlevel 3 goto status
if errorlevel 2 goto stop
if errorlevel 1 goto start

:start
echo Starting server...
start "Chrome Assistant Backend" cmd /k "set PORT=8000 && python server.py"
echo Server started on port 8000
goto end

:stop
echo Stopping server...
taskkill /FI "WINDOWTITLE eq Chrome Assistant Backend*" /F >nul 2>&1
taskkill /IM python.exe /FI "WINDOWTITLE eq Chrome Assistant*" /F >nul 2>&1
echo Server stopped
goto end

:status
netstat -ano | findstr ":8000" >nul
if %errorlevel%==0 (
    echo Server is RUNNING on port 8000
) else (
    echo Server is NOT running
)
goto end

:end
pause