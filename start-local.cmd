@echo off
cd /d "%~dp0"
echo Starting local demo at http://localhost:3000
echo Keep this window open while using the demo.
call npm start
pause
