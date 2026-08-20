# ✦ LEO AI — COMPLETE ZERO-TO-HERO DEPLOYMENT & SETUP GUIDE

```
===================================================================================
      _      ______ ____       ___    ___   ___  _     _____ _____ ____  __  __ 
     | |    |  ____/ __ \     / _ \  |  _ \ / _ \| |   |_   _|_   _/ __ \|  \/  |
     | |    | |__ | |  | |   / /_\ \ | |_) | | | | |     | |   | || |  | | \  / |
     | |    |  __|| |  | |   |  _  | |  _ <| | | | |     | |   | || |  | | |\/| |
     | |____| |___| |__| |   | | | | | |_) | |_| | |___ _| |_  | || |__| | |  | |
     |______|______\____/    \_| |_/ |____/ \___/|_____|_____| |_| \____/|_|  |_|
===================================================================================
```

---

## 👨‍💻 DEVELOPER & CREATOR INFORMATION

* **Developer Name**: **Bikash Bindhani**
* **Official Instagram Profile**: [https://www.instagram.com/vixyiu._](https://www.instagram.com/vixyiu._?igsh=czZsZjdrNHBrc2l2&igsi=czZsZjdrNHBrc2l2)

---

## 📌 Architecture Overview

This platform uses a split architecture:

```
┌───────────────────────────────────────────────────────────┐
│              1. FRONTEND (HOSTED ON VERCEL)               │
│  • React + TypeScript + Tailwind CSS UI                   │
│  • Firebase Authentication Client SDK                     │
│  • Connects directly to Render Backend via API Base URL   │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼ HTTPS Requests (/api/*)
┌───────────────────────────────────────────────────────────┐
│              2. BACKEND (HOSTED ON RENDER)                │
│  • Node.js + Express API Server                           │
│  • AI Credits Engine (Chat, Vision & Deep Reasoning)      │
│  • Realtime OTP Generator & Nodemailer Dispatcher         │
│  • Admin Control Panel (/admin) & Telemetry               │
└─────────────────────────────┬─────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│              3. DATABASE & SERVICES CLOUD                 │
│  • Firebase Realtime Database: User Profiles & OTP Store  │
│  • Gmail SMTP / Resend: Secure 6-Digit Email Delivery     │
│  • AI Credits API Engine: High-speed LLM processing       │
└───────────────────────────────────────────────────────────┘
```

---

## 🔗 Direct Links: Where To Get Every API Key & Account

| Service | What It Is Used For | Exact Link To Get Key |
| :--- | :--- | :--- |
| **AI Credits API** | AI Chat, Vision & Reasoning | [https://aicredits.in/dashboard](https://aicredits.in/dashboard) |
| **Firebase Console** | Realtime Database & Auth | [https://console.firebase.google.com](https://console.firebase.google.com) |
| **Gmail App Password** | Sending OTP codes to inbox | [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |
| **GitHub** | Pushing repository code | [https://github.com/new](https://github.com/new) |
| **Render** | Deploying the Backend API server | [https://dashboard.render.com](https://dashboard.render.com) |
| **Vercel** | Deploying the Frontend React app | [https://vercel.com/new](https://vercel.com/new) |
| **Resend (Optional)** | Alternative HTTPS Email Delivery | [https://resend.com/api-keys](https://resend.com/api-keys) |
| **Mem0 (Optional)** | Persistent AI User Memory | [https://app.mem0.ai](https://app.mem0.ai) |

---

## 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

---

### PART 1: Get Your API Keys (5 Minutes)

#### 1. AI Credits API Key
1. Open [https://aicredits.in/dashboard](https://aicredits.in/dashboard).
2. Sign in or create an account.
3. Go to **API Keys** and generate a new key.
4. Copy the key (it starts with `sk-...` or `aic_...`).

---

#### 2. Gmail App Password (For Real OTP Emails)
1. Go to your Google Account Security: [https://myaccount.google.com/security](https://myaccount.google.com/security).
2. Enable **2-Step Verification** (if not already enabled).
3. Open the App Passwords page: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Type `Leo AI` in the App Name box and click **Create**.
5. Google will show you a **16-letter password** (example: `abcd efgh ijkl mnop`).
6. Copy this password (remove spaces when pasting in config: `abcdefghijklmnop`).

---

#### 3. Firebase Realtime Database Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Under **Build** in the left sidebar, click **Authentication** -> click **Get Started** -> enable **Email/Password** and **Anonymous** sign-in providers.
3. Under **Build**, click **Realtime Database** -> click **Create Database** -> select the default location.
4. Go to the **Rules** tab in Realtime Database and paste these rules:
   ```json
   {
     "rules": {
       "otps": {
         ".read": "auth != null",
         ".write": "auth != null"
       },
       "users": {
         "$uid": {
           ".read": true,
           ".write": "auth != null && auth.uid == $uid"
         }
       },
       "chats": {
         "$uid": {
           ".read": "auth != null && auth.uid == $uid",
           ".write": "auth != null && auth.uid == $uid"
         }
       },
       "memories": {
         "$uid": {
           ".read": "auth != null && auth.uid == $uid",
           ".write": "auth != null && auth.uid == $uid"
         }
       }
     }
   }
   ```
5. Click **Publish**.
6. Go to **Project Settings** (Gear Icon on top left) -> under **Your apps**, click the **Web icon (</>)** to register a web app.
7. Copy your `firebaseConfig` keys (`apiKey`, `authDomain`, `projectId`, `databaseURL`, etc.).

---

### PART 2: Push Project To GitHub

1. Create a new repository on [GitHub](https://github.com/new) named `leo-ai`.
2. Open your project folder in your terminal:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Leo AI platform with Render and Vercel support"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/leo-ai.git
   git push -u origin main
   ```

---

### PART 3: Deploy Backend On Render (`render.com`)

1. Open [https://dashboard.render.com/](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository (`leo-ai`).
3. Fill in the following settings:
   - **Name**: `leo-ai-backend`
   - **Root Directory**: `backend` *(Ab aap `backend` likh sakte hain)*
   - **Environment**: `Node`
   - **Region**: Choose closest to you (e.g., `Singapore` or `Oregon`)
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Instance Type**: `Free`

4. Scroll down to **Environment Variables** and add the following:

   | Key | Value |
   | :--- | :--- |
   | `PORT` | `10000` *(ya default Render port)* |
   | `NODE_ENV` | `production` |
   | `AICREDITS_API_KEY` | `YOUR_AI_CREDITS_KEY` |
   | `AICREDITS_BASE_URL` | `https://api.aicredits.in/v1` |
   | `AICREDITS_VISION_MODEL` | `gemini-1.5-flash` |
   | `ADMIN_PASSWORD` | `YOUR_SECRET_ADMIN_PASSWORD` |
   | `FIREBASE_API_KEY` | `YOUR_FIREBASE_API_KEY` |
   | `FIREBASE_AUTH_DOMAIN` | `YOUR_PROJECT.firebaseapp.com` |
   | `FIREBASE_PROJECT_ID` | `YOUR_FIREBASE_PROJECT_ID` |
   | `FIREBASE_DATABASE_URL` | `https://YOUR_PROJECT-default-rtdb.firebaseio.com` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_SECURE` | `true` |
   | `SMTP_USER` | `your-email@gmail.com` |
   | `SMTP_PASS` | `abcdefghijklmnop` *(16-character Gmail App Password without spaces)* |
   | `SMTP_FROM` | `Leo AI Security <your-email@gmail.com>` |

5. Click **Deploy Web Service**.
6. Once deployed, copy your Render Backend URL (Example: `https://leo-ai-backend.onrender.com`).

---

### PART 4: Deploy Frontend On Vercel (`vercel.com`)

1. Open [https://vercel.com/new](https://vercel.com/new).
2. Import the same GitHub repository (`leo-ai`).
3. In Project Configuration:
   - **Root Directory**: `./` *(Main root folder jahan index.html aur vite.config.ts hain)*
   - **Framework Preset**: **Vite**
4. In **Environment Variables**, add the following:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `VITE_BACKEND_URL` | `https://leo-ai-backend.onrender.com` | *Paste your Render backend URL from Part 3* |
   | `VITE_FIREBASE_API_KEY` | `YOUR_FIREBASE_API_KEY` | *From Firebase settings* |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `YOUR_PROJECT.firebaseapp.com` | *From Firebase settings* |
   | `VITE_FIREBASE_PROJECT_ID` | `YOUR_FIREBASE_PROJECT_ID` | *From Firebase settings* |
   | `VITE_FIREBASE_DATABASE_URL` | `https://YOUR_PROJECT-default-rtdb.firebaseio.com` | *From Firebase settings* |

5. Click **Deploy**.
6. Vercel will give you a live production link (Example: `https://leo-ai.vercel.app`).
7. Open your Vercel URL in your mobile browser or desktop — the app is live.

---

## 🛠 Local Development Setup

To run the full stack locally on your computer:

```bash
# 1. Clone your repository
git clone https://github.com/YOUR_GITHUB_USERNAME/leo-ai.git
cd leo-ai

# 2. Install all dependencies
npm install

# 3. Create .env file from template
cp .env.example .env

# 4. Fill in your keys in .env, then run dev server
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## 🔒 Security Directives & Protection Rules

* **Zero Leaked Keys**: All API requests and credentials remain on the server backend.
* **OTP Rate Limiting**: Max 1 OTP every 30 seconds per email; max 5 incorrect attempts before code is destroyed.
* **Atomic Deletion**: Realtime Database node `/otps/{sanitizedEmail}` is deleted immediately upon successful verification.
* **Executive Admin Protection**: `/admin` is locked behind `ADMIN_PASSWORD` verification with token issuance.

---

## 📱 Executive Admin Panel Access

* **URL**: `https://your-frontend.vercel.app/admin` (Direct secret URL navigation)
* **Default Password**: Configured in your `ADMIN_PASSWORD` environment variable.
* **Features**: Live token metrics, AI model parameters, system prompt editor, user registry, and memory inspector.
