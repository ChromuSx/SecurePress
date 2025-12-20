$btPlugin = "C:\Users\Giovanni Guarino\Documents\Development\BluetoothDeviceConnector\streamdeck-plugin\com.chromusx.bluetooth-connector.streamDeckPlugin"
$spPlugin = "C:\Users\Giovanni Guarino\Documents\Development\SecurePress\streamdeck-plugin\com.securepress.action.streamDeckPlugin"

$tempBT = "C:\Temp\bt-plugin.zip"
$tempSP = "C:\Temp\sp-plugin.zip"

$extractBT = "C:\Temp\bt-extract"
$extractSP = "C:\Temp\sp-extract"

# Extract Bluetooth plugin
Copy-Item $btPlugin $tempBT -Force
Expand-Archive -Path $tempBT -DestinationPath $extractBT -Force

# Extract SecurePress plugin
Copy-Item $spPlugin $tempSP -Force
Expand-Archive -Path $tempSP -DestinationPath $extractSP -Force

Write-Host "=== Bluetooth Plugin Structure ===" -ForegroundColor Green
Get-ChildItem $extractBT -Recurse -Depth 2 | Select-Object FullName -First 20

Write-Host "`n=== SecurePress Plugin Structure ===" -ForegroundColor Yellow
Get-ChildItem $extractSP -Recurse -Depth 2 | Select-Object FullName -First 20

Write-Host "`n=== Comparing root files ===" -ForegroundColor Cyan
Write-Host "Bluetooth root:"
Get-ChildItem $extractBT | Select-Object Name
Write-Host "`nSecurePress root:"
Get-ChildItem $extractSP | Select-Object Name
