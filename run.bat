@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" copy /Y ".env.example" ".env" >nul

echo The server URL will be printed below.
node dist\index.js

if errorlevel 1 (
  echo.
  echo The Cacti stopped with an error.
  pause
)
