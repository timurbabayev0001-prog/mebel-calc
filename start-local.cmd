@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS from https://nodejs.org/ first.
 pause
 exit /b 1
)
powershell -NoProfile -Command "$env:PRICE_FILE=(Resolve-Path '..\private\prices.json').Path; if (-not $env:PRICE_FILE) { exit 1 }; do { $env:OWNER_PASSWORD=[System.Net.NetworkCredential]::new('',(Read-Host 'Owner password (at least 16 characters)' -AsSecureString)).Password } while ($env:OWNER_PASSWORD.Length -lt 16); $env:LOCAL_HTTP='1'; Start-Process 'http://localhost:8080/kitchen/'; node server/server.cjs"
pause
