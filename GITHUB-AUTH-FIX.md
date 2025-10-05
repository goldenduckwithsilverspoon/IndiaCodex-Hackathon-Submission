# 🔑 GitHub Authentication Fix

You need to authenticate with the correct GitHub account. Here are the options:

## Option 1: Use GitHub CLI (Recommended)

```powershell
# Install GitHub CLI if not already installed
winget install --id GitHub.cli

# Login with correct account
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Yes (authenticate Git with your GitHub credentials)
# - Login with a web browser

# Then push again
git push -u origin main
```

## Option 2: Use Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all)
4. Generate token and copy it

Then push with token:
```powershell
git remote set-url origin https://YOUR_TOKEN@github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
git push -u origin main
```

## Option 3: Use SSH (Best for Long-term)

```powershell
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub:
# Go to https://github.com/settings/ssh/new
# Paste the key and save

# Change remote to SSH
git remote set-url origin git@github.com:goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
git push -u origin main
```

## Option 4: Push from Correct Account

If you're logged in as "Dhanush1111" but need to push to "goldenduckwithsilverspoon":

```powershell
# Clear Git credentials
git credential-manager delete https://github.com

# Push again (will prompt for authentication)
git push -u origin main
```

## Quick Fix (Right Now)

**Easiest method:**

1. Make sure the repository exists at:
   https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission

2. If it doesn't exist, create it:
   - Go to https://github.com/new
   - Repository name: `IndiaCodex-Hackathon-Submission`
   - Make it public
   - Don't initialize with README
   - Create repository

3. Then run:
```powershell
git push -u origin main
```

When prompted, enter your GitHub credentials for the "goldenduckwithsilverspoon" account.

---

## After Authentication Works

Once you've authenticated correctly, the push should succeed and you'll see:

```
Enumerating objects: 51, done.
Counting objects: 100% (51/51), done.
Writing objects: 100% (51/51), done.
To https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
 * [new branch]      main -> main
```

Then verify at:
https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission

---

## Troubleshooting

**Error: Repository not found**
- Create the repository on GitHub first

**Error: Permission denied**
- You're authenticated as wrong user
- Clear credentials and re-authenticate

**Error: 403 Forbidden**
- Check if repository exists
- Verify you have write access
- Try personal access token method
