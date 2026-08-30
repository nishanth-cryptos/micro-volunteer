# Hey Padosi Multi-Window Startup Script for PowerShell
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   Hey Padosi: Multi-Window Service Automation" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Start Firebase Emulators in separate window
Write-Host "`n[1/3] Launching Firebase Emulators in a new window..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList '/k "title Hey Padosi - Firebase Emulators && npm run emulators"'

# 2. Wait for emulators to boot
Write-Host "`n[2/3] Waiting 10 seconds for emulators to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# 3. Seed data
Write-Host "`nSeeding all test accounts..." -ForegroundColor Green
node scripts/seed-all.js

# 4. Start Vite in separate window
Write-Host "`n[3/3] Launching Vite Dev Server in a new window..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList '/k "title Hey Padosi - Vite Frontend && npm run dev"'

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "  All services launched in separate windows!" -ForegroundColor Green
Write-Host "  - Frontend App:   http://localhost:5173" -ForegroundColor White
Write-Host "  - Firebase UI:    http://localhost:4000" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Green
