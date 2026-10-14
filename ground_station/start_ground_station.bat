@echo off
REM ============================================================
REM  Rasid ground station - double-click to start
REM  Loads the model and waits. Missions are started from the
REM  website (team leader presses "بدء مهمة الدرون").
REM  Close this window to shut the ground station down.
REM ============================================================
cd /d "%~dp0"
title Rasid Ground Station
echo.
echo  Rasid ground station is starting...
echo  (loading the model takes about 20 seconds)
echo.
echo  When you see "Model ready", open the report page in the browser.
echo  Keep this window open while the drone mission is running.
echo.
python server.py
echo.
echo  The ground station has stopped.
pause