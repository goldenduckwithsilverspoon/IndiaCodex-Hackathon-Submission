# GitHub Repository Setup Script
# For IndiaCodex Hackathon Submission

Write-Host "🚀 CardanoStream - GitHub Repository Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
Write-Host "Checking Git installation..." -ForegroundColor Yellow
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git installed: $gitVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Git not found. Please install Git first." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if already initialized
if (Test-Path .git) {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
}

Write-Host ""

# Check current remote
Write-Host "Checking Git remote..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Remote already configured: $remoteUrl" -ForegroundColor Green
    $changeRemote = Read-Host "Do you want to change the remote URL? (y/n)"
    if ($changeRemote -eq "y") {
        git remote remove origin
        git remote add origin https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
        Write-Host "✅ Remote URL updated" -ForegroundColor Green
    }
} else {
    Write-Host "Adding remote origin..." -ForegroundColor Yellow
    git remote add origin https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
    Write-Host "✅ Remote added" -ForegroundColor Green
}

Write-Host ""

# Check for changes
Write-Host "Checking for changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "📝 Found changes to commit" -ForegroundColor Yellow
    
    # Add all files
    Write-Host "Adding files..." -ForegroundColor Yellow
    git add .
    Write-Host "✅ Files staged" -ForegroundColor Green
    
    # Create commit
    Write-Host ""
    Write-Host "Creating commit..." -ForegroundColor Yellow
    git commit -m "IndiaCodex Hackathon Submission - CardanoStream

- Complete monorepo structure with 4 packages
- 3 Aiken smart contracts (storage, bandwidth, node registry)
- Content-addressed storage with erasure coding
- HTTP CDN API (Express.js)
- P2P network integration (stub for Phase 1)
- Cardano SDK (stub for Phase 1)
- Comprehensive documentation (3000+ lines)
- Docker deployment configuration
- Railway/Render deployment ready
- GitHub Actions CI/CD pipeline

Built for IndiaCodex Hackathon 2025 - Masumi Network Track"
    
    Write-Host "✅ Commit created" -ForegroundColor Green
} else {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
}

Write-Host ""

# Push to GitHub
Write-Host "Ready to push to GitHub!" -ForegroundColor Cyan
Write-Host "Repository: https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission" -ForegroundColor Yellow
Write-Host ""
$push = Read-Host "Push to GitHub now? (y/n)"

if ($push -eq "y") {
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    
    # Set main branch
    git branch -M main
    
    # Push with upstream
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Next Steps:" -ForegroundColor Cyan
        Write-Host "1. Verify at: https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission" -ForegroundColor Yellow
        Write-Host "2. Deploy to Railway or Render (see DEPLOYMENT-GUIDE.md)" -ForegroundColor Yellow
        Write-Host "3. Update HACKATHON-README.md with live URL" -ForegroundColor Yellow
        Write-Host "4. Record video demo (see SUBMISSION-CHECKLIST.md)" -ForegroundColor Yellow
        Write-Host "5. Submit to IndiaCodex hackathon!" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Push failed. Common issues:" -ForegroundColor Red
        Write-Host "1. Repository doesn't exist - create it on GitHub first" -ForegroundColor Yellow
        Write-Host "2. Authentication failed - configure Git credentials" -ForegroundColor Yellow
        Write-Host "3. Network issues - check internet connection" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Manual push command:" -ForegroundColor Cyan
        Write-Host "git push -u origin main" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "Skipped push. To push manually later:" -ForegroundColor Yellow
    Write-Host "git push -u origin main" -ForegroundColor White
}

Write-Host ""
Write-Host "🎯 Repository Status:" -ForegroundColor Cyan
git status
