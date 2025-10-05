# Quick Test Guide

## Server is Running! 🚀

Your CardanoStream CDN node is live at: **http://localhost:3000**

## Test in 3 Steps:

### 1. Open a NEW PowerShell terminal (don't close the server!)

### 2. Navigate to project folder:
```powershell
cd C:\Users\dhwin\Project-Revolutionary
```

### 3. Run these commands:

#### Upload a file:
```powershell
$upload = Invoke-RestMethod -Uri "http://localhost:3000/api/upload" -Method POST -Form @{
    file = Get-Item "test.txt"
}
Write-Host "✅ Uploaded! CID: $($upload.cid)"
$cid = $upload.cid
```

#### Download the file:
```powershell
$content = Invoke-RestMethod -Uri "http://localhost:3000/content/$cid"
Write-Host "✅ Retrieved: $content"
```

#### Check node stats:
```powershell
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/stats"
Write-Host "📊 Requests: $($stats.requestCount)"
Write-Host "📊 Bandwidth: $($stats.bandwidthGB) GB"
```

## Expected Results:

```
✅ Uploaded! CID: bafkreiabcd1234...
✅ Retrieved: Hello CardanoStream! This is a test file for the distributed CDN.
📊 Requests: 1
📊 Bandwidth: 0.0001 GB
```

## What's Happening:

1. Your file is **content-addressed** (same content = same CID)
2. Stored in `apps/cdn-node/data/content/`
3. Metadata indexed in LevelDB at `apps/cdn-node/data/metadata/`
4. All operations logged to the server terminal

## Try More:

- Upload an image: `file = Get-Item "photo.jpg"`
- Upload any file type
- Same content always gives same CID (deduplication!)

---

**Need help?** Check `DEPLOYMENT.md` for full documentation.
