@echo off
REM ============================================================================
REM  The Cacti — local dev launcher
REM
REM  Double-click this file (or run it from cmd) to start the dev server.
REM  Close the console window to stop it.
REM
REM  Behavior:
REM    - Tries port 3002 first (the canonical port — matches the Google OAuth
REM      redirect URI in your local .env, so sign-in works).
REM    - If 3002 is busy, scans 3003..3020 and uses the first free port.
REM      (Note: Google sign-in is configured for 3002 only. If we fall back,
REM      sign-in will fail with "redirect_uri_mismatch" until you stop the
REM      other process on 3002. The app itself still loads anonymously.)
REM    - When you close this window, Windows sends a close event to pnpm
REM      and the dev server stops automatically. No taskkill needed.
REM ============================================================================

setlocal EnableDelayedExpansion

REM Always cd to the directory this script lives in, so double-click works
REM regardless of the user's current working directory.
cd /d "%~dp0"

title The Cacti — dev server

echo.
echo  ===========================================
echo   The Cacti — starting local dev server
echo  ===========================================
echo.

REM ---- Find the first available port in [3002, 3020] -------------------------
set CACTI_PORT=
for /L %%P in (3002,1,3020) do (
    if not defined CACTI_PORT (
        netstat -ano | findstr /R /C:":%%P  *LISTENING" >nul 2>&1
        if errorlevel 1 (
            set CACTI_PORT=%%P
        )
    )
)

if not defined CACTI_PORT (
    echo  [error] No free port found in 3002-3020. Free one up and try again.
    echo.
    pause
    exit /b 1
)

if not "%CACTI_PORT%"=="3002" (
    echo  [warn] Port 3002 is in use. Falling back to port %CACTI_PORT%.
    echo         Google sign-in only works on 3002 — you'll get a
    echo         redirect_uri_mismatch error if you try to sign in on
    echo         a different port. The rest of the app will still work.
    echo.
)

echo  Starting server on http://localhost:%CACTI_PORT%/
echo  Press Ctrl+C, or close this window, to stop.
echo.

set PORT=%CACTI_PORT%
call pnpm dev

REM If pnpm exits on its own (crash, Ctrl+C, etc.) hold the window open so
REM the user can read any error message before it disappears.
echo.
echo  Server stopped.
pause
