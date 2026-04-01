@echo off
echo.
echo  ======================================
echo   আমার এলাকা - Admin Dashboard
echo   Starting server on port 3000...
echo  ======================================
echo.

REM Kill any process using port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  Server: http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo.

npx serve "c:\Amar Elaka\admin_dashboard" --no-clipboard -p 3000

pause
