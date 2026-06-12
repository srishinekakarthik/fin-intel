# FinIntel Dev Startup Script
# Run this from PowerShell: .\start-dev.ps1
# It launches backend, frontend, and ngrok tunnel in separate windows.

Write-Host "🚀 Starting FinIntel Dev Environment..." -ForegroundColor Cyan

# 1. Backend
Write-Host "  [1/3] Starting Backend (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd d:\fin-intel\fin-intel-backend; npm run dev" -WindowStyle Normal

# 2. Frontend
Write-Host "  [2/3] Starting Frontend (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd d:\fin-intel\fin-intel-frontend; npm run dev" -WindowStyle Normal

# 3. ngrok tunnel (uses your free-tier URL)
Write-Host "  [3/3] Starting ngrok tunnel..." -ForegroundColor Yellow
$env:Path += ";C:\tools\ngrok"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:Path += ';C:\tools\ngrok'; ngrok http 3001" -WindowStyle Normal

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "✅ All services starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor White
Write-Host "  ngrok:     Check the ngrok terminal for your public URL" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  If ngrok gives you a NEW random URL, update the n8n workflow URLs." -ForegroundColor Red
Write-Host "   (With a paid ngrok plan + static domain, this never changes.)" -ForegroundColor DarkGray
