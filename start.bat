@echo off
title Bot Trade Arena
color 0A
echo.
echo  +================================================+
echo  ^|         BOT TRADE ARENA -- Launcher             ^|
echo  +================================================+
echo.
echo  Starting backend server...
start "BTA Backend" cmd /k "cd /d %~dp0 && npx tsx src/server.ts"

echo  Starting frontend...
start "BTA Frontend" cmd /k "cd /d %~dp0\web && npx next dev"

echo  Waiting for servers to start...
timeout /t 6 /nobreak >nul

echo  Opening browser...
start http://localhost:3000

echo.
echo  Backend:  http://localhost:8080
echo  Frontend: http://localhost:3000
echo.
echo  Close this window anytime. The servers run in their own windows.
timeout /t 3 /nobreak >nul
