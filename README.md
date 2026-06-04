# اردو PDF Converter — Setup Guide

## Zaroorat ki cheezein
- Node.js (v18+)
- Python 3 + `pip install pypdf` (page count ke liye)
- Google Cloud Console account (free hai)

---

## Step 1: Google Cloud Console Setup (15 minute)

### 1.1 — Project banao
1. https://console.cloud.google.com/ par jao
2. Top par **"New Project"** click karo
3. Name do: `urdu-pdf-converter`

### 1.2 — APIs Enable karo
1. **APIs & Services → Library** mein jao
2. Yeh 2 APIs enable karo:
   - ✅ **Google Drive API**
   - ✅ **Google Docs API** (optional but helpful)
   - ✅ **People API** (user info ke liye)

### 1.3 — OAuth Consent Screen
1. **APIs & Services → OAuth consent screen**
2. **External** select karo
3. App name: `Urdu PDF Converter`
4. Support email: apni email dalo
5. **Test users** mein apna email add karo (jab tak publish nahi kiya)
6. Save karo

### 1.4 — OAuth Credentials banao
1. **APIs & Services → Credentials**
2. **Create Credentials → OAuth Client ID**
3. Type: **Web Application**
4. Name: `Urdu Converter Web Client`
5. Authorized redirect URIs mein add karo:
   ```
   http://localhost:5000/auth/google/callback
   ```
   (production ke liye apna domain bhi add karo)
6. **Create** karo
7. **Client ID** aur **Client Secret** copy karo

---

## Step 2: Backend Setup

```bash
cd backend

# .env file banao
cp .env.example .env
```

**.env file mein yeh fill karo:**
```
GOOGLE_CLIENT_ID=paste_karo_yahan
GOOGLE_CLIENT_SECRET=paste_karo_yahan
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
SESSION_SECRET=koi_bhi_random_string_likho
FRONTEND_URL=http://localhost:3000
PORT=5000
```

```bash
# Dependencies install karo
npm install

# Server start karo
npm start
```

---

## Step 3: Frontend Setup

```bash
cd frontend

npm install

npm start
```

Browser mein `http://localhost:3000` khulega.

---

## Step 4: Python Install (ek baar)

```bash
pip install pypdf
```

---

## Kaise use karo

1. `http://localhost:3000` kholo
2. **"Google se Login Karo"** click karo
3. Apna Google account select karo
4. PDF upload karo
5. **"Convert Karo"** click karo
6. Wait karo (200-300 pages = 5-10 minute)
7. Word file download karo ✅

---

## Production Deploy karna ho to

**Backend → Railway.app**
1. railway.app par account banao
2. GitHub se connect karo
3. `/backend` folder deploy karo
4. Environment variables add karo

**Frontend → Netlify / Vercel**
1. `/frontend` folder deploy karo
2. `REACT_APP_API_URL` env variable mein backend URL dalo

**Google Console mein:**
- Redirect URI mein apna production backend URL add karo
- OAuth consent screen mein apna domain verify karo

---

## Kya kaam karta hai

✅ Word se bani PDF → Bahut acha text nikalta hai
✅ InPage se bani PDF (decent quality) → OCR kaam karta hai
✅ Scanned Urdu PDF → OCR kaam karta hai lekin accuracy medium

## OCR Accuracy

| PDF Type | Accuracy |
|----------|----------|
| Word → PDF | 95%+ |
| InPage (clear font) | 70-80% |
| Scanned (clean) | 60-75% |
| Scanned (blurry) | 40-60% |

---

## Problems aaye to

**"Login nahi ho raha"**
→ Google Console mein redirect URI check karo
→ Test users mein apna email add karo

**"Conversion fail ho rahi hai"**
→ `pip install pypdf` run karo
→ `npm install` backend mein dobara run karo

**"File download nahi ho rahi"**
→ Browser ka popup blocker check karo
