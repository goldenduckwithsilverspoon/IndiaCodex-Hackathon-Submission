# Test CardanoStream CDN Upload and Retrieval

Write-Host "Testing file upload..." -ForegroundColor Cyan

# Upload a test file
$uploadResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/upload" `
    -Method POST `
    -Form @{
        file = Get-Item -Path "test.txt"
    } | ConvertFrom-Json

$cid = $uploadResponse.cid
Write-Host "✅ File uploaded successfully!" -ForegroundColor Green
Write-Host "   CID: $cid" -ForegroundColor Yellow
Write-Host "   Size: $($uploadResponse.size) bytes" -ForegroundColor Yellow

# Retrieve the file
Write-Host "`nTesting file retrieval..." -ForegroundColor Cyan
$content = Invoke-WebRequest -Uri "http://localhost:3000/content/$cid"
Write-Host "✅ File retrieved successfully!" -ForegroundColor Green
Write-Host "   Content: $($content.Content)" -ForegroundColor Yellow

# Get node stats
Write-Host "`nGetting node statistics..." -ForegroundColor Cyan
$stats = Invoke-WebRequest -Uri "http://localhost:3000/api/stats" | ConvertFrom-Json
Write-Host "✅ Node Statistics:" -ForegroundColor Green
Write-Host "   Requests: $($stats.requestCount)" -ForegroundColor Yellow
Write-Host "   Bandwidth Used: $([Math]::Round($stats.bandwidthGB, 4)) GB" -ForegroundColor Yellow
Write-Host "   Uptime: $($stats.uptime) seconds" -ForegroundColor Yellow
