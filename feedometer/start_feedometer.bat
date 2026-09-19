@echo off
title FeedOmeter 2.1 — Personal Feed Intelligence
cls
echo ================================================================
echo    Starting FeedOmeter 2.1 Platform...
echo ================================================================
echo.
cd /d "%~dp0"

:: Launch local server and open browser
node server.js

pause
