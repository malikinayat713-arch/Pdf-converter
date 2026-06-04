# 🚀 Deployment Guide - Vercel + Railway

## **PART 1: Backend Deployment (Railway)**

### Step 1.1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Urdu PDF Converter"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/urdu-pdf-converter.git
git push -u origin main
```

### Step 1.2: Create Railway Account
1. Go to **https://railway.app**
2. Sign up with GitHub
3. Connect your GitHub account

### Step 1.3: Deploy Backend
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select `urdu-pdf-converter` repo
3. Railway automatically detects `backend/package.json`
4. **Important:** Select `/backend` as the root directory
5. Create project

### Step 1.4: Add Environment Variables to Railway
In Railway dashboard → Variables:

```
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://YOUR_RAILWAY_DOMAIN/auth/google/callback
SESSION_SECRET=generate-random-secret-string-here
FRONTEND_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
PORT=3000
```

**Get Railway Domain:**
- Settings → Domain → Copy the auto-generated domain (e.g., `urdu-pdf-converter-production.up.railway.app`)

### Step 1.5: Update Google Cloud Console
1. Go to **https://console.cloud.google.com**
2. OAuth Credentials → Edit
3. Add Authorized Redirect URI:
   ```
   https://YOUR_RAILWAY_DOMAIN/auth/google/callback
   ```
4. Save

---

## **PART 2: Frontend Deployment (Vercel)**

### Step 2.1: Deploy Frontend
1. Go to **https://vercel.com**
2. Sign up with GitHub
3. Click **"New Project"** → Select `urdu-pdf-converter` repo
4. **Root Directory:** Select `./frontend`
5. **Environment Variables:** Add
   ```
   REACT_APP_API_URL=https://YOUR_RAILWAY_DOMAIN
   ```
6. Deploy

### Step 2.2: Get Vercel Domain
- After deployment, copy your Vercel URL (e.g., `urdu-pdf-converter.vercel.app`)

### Step 2.3: Update Backend FRONTEND_URL
Back to Railway dashboard → Variables → Update:
```
FRONTEND_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
```

---

## **PART 3: Final Google OAuth Setup**

1. **Railway Backend URL:** `https://YOUR_RAILWAY_DOMAIN`
2. **Vercel Frontend URL:** `https://YOUR_VERCEL_DOMAIN.vercel.app`

Update Google Console:
- Authorized Redirect URIs:
  ```
  https://YOUR_RAILWAY_DOMAIN/auth/google/callback
  ```

---

## **VERIFICATION CHECKLIST**

- [ ] Backend deployed on Railway
- [ ] Frontend deployed on Vercel
- [ ] Environment variables set on Railway (Google credentials, URLs)
- [ ] Google Console OAuth URIs updated
- [ ] Can login with Google from Vercel URL
- [ ] Can upload PDF and convert
- [ ] Word file downloads successfully

---

## **TROUBLESHOOTING**

**"Login not working"**
→ Check Railway domain in Google OAuth redirect URI
→ Check `FRONTEND_URL` matches Vercel domain

**"API not responding"**
→ Check `REACT_APP_API_URL` in Vercel matches Railway domain
→ Check Railway environment variables are set

**"File upload fails"**
→ Check `/backend` is root directory in Railway
→ Check `uploads/` folder permissions

---

## **Production Tips**

1. **Change SESSION_SECRET** to a long random string
2. **Move Google credentials** to environment variables only
3. **Set NODE_ENV=production** in Railway
4. **Monitor Railway logs** for errors
5. **Set up Railway alerts** for deployment failures

