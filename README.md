# ⚡ LEO AI — Next-Generation Multimodal Intelligence Platform

<div align="center">

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

**An enterprise-grade, full-stack AI platform engineered for high-speed reasoning, vision analysis, deep research, and secure 2-Factor Authentication.**

[![React 19](https://img.shields.io/badge/React-19.0.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.1.14-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-4.21.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Firebase](https://img.shields.io/badge/Firebase-RTDB_&_Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

</div>

---

## 👨‍💻 Creator & Lead Developer

<div align="center">

| **Lead Engineer & Architect** | **Official Social Contact** |
| :--- | :--- |
| **Bikash Bindhani** | [![Instagram Profile](https://img.shields.io/badge/Instagram-@vixyiu._-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/vixyiu._?igsh=czZsZjdrNHBrc2l2&igsi=czZsZjdrNHBrc2l2) |

</div>

---

## 🌟 Key Highlights & Core Capabilities

- 🧠 **Multimodal Reasoning & Vision**: Seamlessly process and inspect high-resolution images, code snippets, architectural diagrams, and complex mathematical queries.
- 🔬 **Deep Research Engine**: Specialized systematic synthesis mode for executive summaries, core mechanism breakdowns, and actionable takeaways.
- 🛡️ **Hardened 2FA OTP Email Delivery**: Secure 6-digit OTP authentication backed by **SendGrid API / Gmail SMTP** with atomic Realtime Database state cleanup and rate limiting.
- 🎛️ **Full Executive Admin Suite (`/admin`)**: Real-time system prompt management, dynamic model switching, telemetry charts, user registry inspector, and memory manager.
- ☁️ **Decoupled Architecture**: High-speed React 19 Frontend (Vercel) + Distributed Node.js / Express Backend (Render) with Zero-Exposed Credentials.
- 💾 **Persistent AI Context & Memory**: Long-term conversational memory synchronization through Firebase Realtime Database.
- 🎨 **Modern Minimalist UI**: Dark & Light mode support, rich Markdown formatting with syntax-highlighted code blocks, prompt library, and chat session export.

---

## 📐 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    1. CLIENT / PRESENTATION                      │
│   • React 19 + TypeScript + Tailwind CSS v4                      │
│   • Motion UI Animations + Lucide Iconography                   │
│   • Firebase Client Authentication & Real-time State Listener     │
│   • Vercel Edge Global CDN Delivery                              │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼ HTTPS (/api/*)
┌──────────────────────────────────────────────────────────────────┐
│                     2. BACKEND API SERVICE                       │
│   • Node.js + Express REST API Server (Render Cloud)             │
│   • Model Router: Gemini 2.5 Flash, 3.7 Flash & AI Credits API   │
│   • SendGrid & Nodemailer Email OTP Engine (30s Rate Limiter)    │
│   • Firebase Realtime Database Gateway (Config Sync & State)     │
│   • Executive Admin Authorization Layer (`/api/admin/*`)         │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                   3. CLOUD SERVICES & STORAGE                    │
│   • Firebase Realtime Database: User Profiles, Config & OTPs     │
│   • AI Model Inference Providers (Gemini / AI Credits)           │
│   • SendGrid / SMTP Gateway: 6-Digit Cryptographic Code Delivery │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 19, TypeScript 5.8, Vite 6 |
| **Styling & UI** | Tailwind CSS v4, Motion (Framer Motion), Lucide React |
| **Markdown & Syntax** | React Markdown, Remark GFM |
| **Backend Framework** | Node.js 22+, Express 4.21, TSX, esbuild |
| **AI SDK & Model Inference**| `@google/genai` (Gemini 2.5 / 3.7), AI Credits V1 REST API |
| **Database & Identity** | Firebase Auth, Firebase Realtime Database (RTDB) |
| **Email & Security** | SendGrid API / Nodemailer (SMTP), Crypto-secure 6-Digit OTP |
| **Hosting & Deployment** | Vercel (Frontend SPA) + Render (Backend Web Service) |

---

## 🔑 External Services & Credential Registry

| Service | Primary Purpose | Dashboard Access |
| :--- | :--- | :--- |
| **AI Credits API** | Primary LLM Provider & Vision API | [aicredits.in/dashboard](https://aicredits.in/dashboard) |
| **Google AI Studio** | Gemini Server-Side API Engine | [aistudio.google.com](https://aistudio.google.com) |
| **Firebase Console** | Realtime DB & User Auth | [console.firebase.google.com](https://console.firebase.google.com) |
| **SendGrid** | High-Deliverability OTP Email Gateway | [app.sendgrid.com](https://app.sendgrid.com) |
| **Google App Passwords** | SMTP OTP Backup Delivery | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |
| **Render** | Backend API Server Host | [dashboard.render.com](https://dashboard.render.com) |
| **Vercel** | Frontend React SPA Host | [vercel.com/new](https://vercel.com/new) |

---

## 🚀 Complete Step-by-Step Deployment

### Step 1: Firebase Database & Authentication

1. Navigate to the [Firebase Console](https://console.firebase.google.com) and create a project.
2. Under **Build > Authentication**, enable **Email/Password** and **Anonymous** sign-in providers.
3. Under **Build > Realtime Database**, create a database and paste the following security rules:
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
       "system": {
         ".read": true,
         ".write": "auth != null"
       }
     }
   }
   ```
4. Copy your Web App configuration keys from **Project Settings > General > Your Apps**.

---

### Step 2: Push Repository to GitHub

```bash
# Initialize git repository
git init
git add .
git commit -m "feat: complete production-ready Leo AI platform"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/leo-ai.git
git push -u origin main
```

---

### Step 3: Deploy Backend on Render

1. Open [Render Dashboard](https://dashboard.render.com) > click **New + > Web Service**.
2. Connect your GitHub repository (`leo-ai`).
3. Set the following build settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: `Free`
4. Add the following **Environment Variables** in Render:

| Environment Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Container Port | `10000` |
| `GEMINI_API_KEY` | Gemini API Secret Key | `AIzaSy...` |
| `GEMINI_MODEL` | Forced Target Model | `gemini-2.5-flash` |
| `AICREDITS_API_KEY` | AI Credits API Key | `sk-...` |
| `AICREDITS_BASE_URL` | AI Credits Endpoint | `https://api.aicredits.in/v1` |
| `ADMIN_PASSWORD` | Access password for `/admin` | `YourSecretAdminPass123!` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | `your-firebase-project-id` |
| `FIREBASE_DATABASE_URL`| Realtime Database URL | `https://your-project-default-rtdb.firebaseio.com` |
| `SENDGRID_API_KEY` | *(Optional)* SendGrid API Key | `SG.xxxxxxxx...` |
| `SENDGRID_FROM_EMAIL` | *(Optional)* Verified Sender | `you@yourdomain.com` |
| `SMTP_HOST` | *(Optional)* Gmail SMTP Host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP SSL Port | `465` |
| `SMTP_SECURE` | SSL Enforcement | `true` |
| `SMTP_USER` | Gmail Address | `your-email@gmail.com` |
| `SMTP_PASS` | 16-character Gmail App Password | `abcdefghijklmnop` |
| `SMTP_FROM` | Outgoing Email Header | `Leo AI <your-email@gmail.com>` |

---

### Step 4: Deploy Frontend on Vercel

1. Open [Vercel Dashboard](https://vercel.com/new) and import your GitHub repository.
2. Select **Framework Preset**: `Vite`.
3. Set **Root Directory**: `./` (Root).
4. Configure the following **Environment Variables**:

| Variable | Value | Notes |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | `https://leo-ai-backend.onrender.com` | Your live Render backend URL |
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` | Firebase Project ID |
| `VITE_FIREBASE_DATABASE_URL` | `https://your-project-default-rtdb.firebaseio.com` | Realtime Database URL |

5. Click **Deploy**. Your Leo AI instance is live and fully functional!

---

## 💻 Local Development Workflow

Run both frontend and backend concurrently in local development:

```bash
# 1. Clone repository
git clone https://github.com/YOUR_GITHUB_USERNAME/leo-ai.git
cd leo-ai

# 2. Install dependencies
npm install

# 3. Setup local environment
cp .env.example .env

# 4. Start full-stack development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 🔒 Security & Privacy Directives

- **Zero Client-Side Secret Leakage**: All generative AI and email dispatch API keys are guarded strictly inside the server environment.
- **Cryptographic OTP Generation**: 6-digit one-time tokens generated with strict time-to-live (5 minutes) and automatic rate-limiting (1 request per 30s per user).
- **Atomic Deletion**: Realtime Database verification records are deleted immediately upon successful token validation.
- **Executive Shield**: The `/admin` portal requires cryptographic token verification issued after server-side password validation.

---

## 📄 License & Attribution

Developed with precision by **Bikash Bindhani**. All rights reserved. Available for personal, educational, and commercial deployments.
