#!/usr/bin/env pwsh
# Install SecurePress plugin locally for testing

$ErrorActionPreference = "Stop"

Write-Host "🔧 Installing SecurePress plugin locally..." -ForegroundColor Cyan
Write-Host ""

# Paths
$pluginPackage = "com.securepress.action.streamDeckPlugin"
$pluginDir = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\com.securepress.action.sdPlugin"
$tempExtract = "temp-extract-install"

# Check if package exists
if (-not (Test-Path $pluginPackage)) {
    Write-Host "❌ Error: $pluginPackage not found" -ForegroundColor Red
    Write-Host "Run 'npm run build:package' first" -ForegroundColor Yellow
    exit 1
}

# Close Stream Deck
Write-Host "🛑 Closing Stream Deck..."
Stop-Process -Name "StreamDeck" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Remove old plugin
if (Test-Path $pluginDir) {
    Write-Host "🗑️  Removing old plugin..."
    Remove-Item -Path $pluginDir -Recurse -Force
}

# Extract package to temp directory
Write-Host "📦 Extracting plugin..."
if (Test-Path $tempExtract) {
    Remove-Item -Path $tempExtract -Recurse -Force
}
Expand-Archive -Path $pluginPackage -DestinationPath $tempExtract -Force

# Move to plugin directory
Write-Host "📁 Installing to Stream Deck..."
Move-Item -Path $tempExtract -Destination $pluginDir -Force

Write-Host ""
Write-Host "✅ Plugin installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Installed to: $pluginDir" -ForegroundColor Gray
Write-Host ""
Write-Host "👉 Now open Stream Deck to use the plugin!" -ForegroundColor Cyan
