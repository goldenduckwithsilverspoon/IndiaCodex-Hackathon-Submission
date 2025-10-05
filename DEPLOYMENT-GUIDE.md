# 🚀 Deployment Guide - IndiaCodex Hackathon

## Quick Deploy to Railway (Recommended)

Railway offers the easiest deployment for Node.js applications.

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify your email

### Step 2: Deploy from GitHub
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose: `goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission`
4. Railway will auto-detect `railway.json` configuration

### Step 3: Configure Environment Variables
Add these in Railway dashboard:
```env
NODE_VERSION=22.16.0
PORT=3000
DATA_DIR=/app/data
CARDANO_NETWORK=preprod
NODE_ID=railway-cdn-node
BANDWIDTH_LIMIT_MBPS=100
STORAGE_LIMIT_GB=50
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait 3-5 minutes for build
3. Get your live URL: `https://your-app.up.railway.app`

---

## Alternative: Deploy to Render

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Verify your email

### Step 2: New Web Service
1. Click "New +" → "Web Service"
2. Connect GitHub repository
3. Select: `goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission`

### Step 3: Configure Service
- **Name:** cardanostream-cdn
- **Region:** Oregon (or closest to you)
- **Branch:** main
- **Runtime:** Node
- **Build Command:** `pnpm install && pnpm build`
- **Start Command:** `cd apps/cdn-node && node dist/index.js`

### Step 4: Environment Variables
```env
NODE_VERSION=22.16.0
PORT=3000
DATA_DIR=/opt/render/project/data
CARDANO_NETWORK=preprod
NODE_ID=render-cdn-node
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment
3. Get your live URL: `https://cardanostream-cdn.onrender.com`

---

## Docker Deployment (Any Cloud)

### Build Image
```bash
docker build -t cardanostream-cdn .
```

### Run Locally
```bash
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ID=docker-node \
  -v $(pwd)/data:/app/data \
  cardanostream-cdn
```

### Push to Docker Hub
```bash
docker tag cardanostream-cdn yourusername/cardanostream-cdn:latest
docker push yourusername/cardanostream-cdn:latest
```

### Deploy to Any Cloud
Use the Docker image on:
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Instances
- DigitalOcean App Platform

---

## GitHub Repository Setup

### Step 1: Initialize Git (if not done)
```bash
cd C:\Users\dhwin\Project-Revolutionary
git init
```

### Step 2: Add Remote
```bash
git remote add origin https://github.com/goldenduckwithsilverspoon/IndiaCodex-Hackathon-Submission.git
```

### Step 3: Commit Files
```bash
git add .
git commit -m "Initial commit - IndiaCodex Hackathon Submission"
```

### Step 4: Push to GitHub
```bash
git branch -M main
git push -u origin main
```

---

## Post-Deployment Checklist

### ✅ Testing Your Deployment

1. **Check Health**
```bash
curl https://your-app.railway.app/api/stats
```

2. **Upload Test File**
```bash
curl -X POST https://your-app.railway.app/api/upload \
  -F "file=@test.txt"
```

3. **Retrieve Content**
```bash
curl https://your-app.railway.app/content/YOUR_CID
```

### ✅ Update README with Live URL

Replace this in HACKATHON-README.md:
```markdown
**🌐 Deployed Application:** [Coming Soon]
```

With:
```markdown
**🌐 Deployed Application:** https://your-app.railway.app
```

### ✅ Create Video Demo

Record 2-3 minute demo showing:
1. Architecture overview
2. Live upload demo
3. Content retrieval
4. API endpoints
5. Smart contract explanation

Upload to YouTube and add link to README.

### ✅ Prepare Pitch Deck

Create Google Slides with:
1. Problem statement
2. Solution overview
3. Technical architecture
4. Masumi Network integration
5. Business model
6. Roadmap
7. Team

---

## Troubleshooting

### Build Fails
```bash
# Check Node.js version
node --version  # Should be 22.16.0+

# Clear cache and rebuild
pnpm store prune
pnpm install
pnpm build
```

### Port Issues
```bash
# Railway/Render automatically assigns PORT
# Make sure your app reads process.env.PORT
```

### Memory Issues
```bash
# Increase memory in Railway/Render settings
# Or optimize package.json dependencies
```

### Environment Variables Not Working
```bash
# Verify in platform dashboard
# Restart deployment after adding env vars
```

---

## Monitoring Your Deployment

### Railway Dashboard
- View logs in real-time
- Monitor CPU/memory usage
- Set up custom domains
- Configure auto-scaling

### Render Dashboard
- Check deployment status
- View build logs
- Monitor performance metrics
- Set up health checks

### Application Metrics
Visit: `https://your-app.railway.app/api/stats`

```json
{
  "nodeId": "railway-cdn-node",
  "peersConnected": 0,
  "requestCount": 42,
  "bandwidthGB": 0.123,
  "uptime": 3600
}
```

---

## Cost Estimate

### Railway (Free Tier)
- **$5 credit** free per month
- **500 hours** execution time
- **100 GB** bandwidth
- Perfect for hackathon demo

### Render (Free Tier)
- **750 hours** free per month
- **100 GB** bandwidth
- Spins down after inactivity
- Great for demos

### Estimated Cost (Paid)
- **Railway:** ~$5-10/month
- **Render:** ~$7/month
- **DigitalOcean:** ~$5/month (if using droplet)

---

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Update README with live URL
3. ✅ Record video demo
4. ✅ Create pitch deck
5. ✅ Submit hackathon form
6. ✅ Share on social media
7. ✅ Prepare for presentation

---

## Support

If you encounter issues:
1. Check platform documentation (Railway/Render)
2. Review application logs
3. Test locally first
4. Open GitHub issue

---

**Good luck with your submission! 🚀**
