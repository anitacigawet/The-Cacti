@echo off
REM ============================================================================
REM  The Cacti — emergency stopper
REM
REM  Normally you just close the start.bat console window and that's enough.
REM  But if the window crashed without cleaning up (or you started the server
REM  some other way), run this to forcibly kill any process listening on
REM  ports 3002-3020 that looks like our dev server.
REM ============================================================================

setlocal EnableDelayedExpansion

echo.
echo  ===========================================
echo   The Cacti — stopping dev server
echo  ===========================================
echo.

set KILLED=0

for /L %%P in (3002,1,3020) do (
    for /f "tokens=5" %%X in ('netstat -ano ^| findstr /R /C:":%%P  *.*LISTENING"') do (
        echo  Killing PID %%X on port %%P
        taskkill /F /PID %%X >nul 2>&1
        if not errorlevel 1 set /A KILLED+=1
    )
)

echo.
if "!KILLED!"=="0" (
    echo  Nothing was running on ports 3002-3020.
) else (
    echo  Killed !KILLED! process(es). Server is stopped.
)
echo.
pause
