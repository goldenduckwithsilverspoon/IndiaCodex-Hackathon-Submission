@echo off
echo ========================================
echo GitHub Push Helper
echo ========================================
echo.

echo Step 1: Checking if repository exists...
echo Please verify the repository exists at:
echo https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission
echo.
pause

echo.
echo Step 2: Clearing old credentials...
git credential-manager delete https://github.com
echo Done!
echo.

echo Step 3: Attempting to push...
echo You will be prompted to login with your GitHub account.
echo Make sure to use the "goldenduckwithsilverspoon" account!
echo.
pause

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Repository pushed to GitHub!
    echo ========================================
    echo.
    echo View your repository at:
    echo https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission
    echo.
) else (
    echo.
    echo ========================================
    echo PUSH FAILED
    echo ========================================
    echo.
    echo Please try one of these methods:
    echo 1. Use Personal Access Token (see GITHUB-AUTH-FIX.md)
    echo 2. Use GitHub CLI: gh auth login
    echo 3. Use SSH keys
    echo.
    echo See GITHUB-AUTH-FIX.md for detailed instructions
)

pause
