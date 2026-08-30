@echo off
title Hey Padosi - Multi-Window Launcher
echo ====================================================
echo    Hey Padosi: Multi-Window Service Automation
echo ====================================================
echo.

:: 1. Launch Firebase Emulators in a dedicated window
echo [1/3] Launching Firebase Emulators in a new window...
start "Hey Padosi - Firebase Emulators (Port 4000/8080/9099)" cmd /k "npm run emulators"

:: 2. Wait for emulators to boot up
echo.
echo [2/3] Waiting 10 seconds for emulators to initialize...
timeout /t 10 /nobreak >nul

:: 3. Seed test data
echo.
echo Seeding test accounts (Admin, Volunteers, Customers, Dual-Role)...
node scripts\seed-all.js

:: 4. Launch Vite Dev Server in a dedicated window
echo.
echo [3/3] Launching Vite Frontend Dev Server in a new window...
start "Hey Padosi - Vite Frontend (http://localhost:5173)" cmd /k "npm run dev"

echo.
echo ====================================================
echo  All services are running in their own windows!
echo  - Frontend App:   http://localhost:5173
echo  - Firebase UI:    http://localhost:4000
echo ====================================================
echo.
pause
