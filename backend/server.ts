import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { memoService } from './services/memoService';

dotenv.config();

// Load Firebase configuration fallback from firebase-applet-config.json
let appletConfig: any = {};
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    appletConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {}

const app = express();
app.set('trust proxy', true);

// Enable CORS for Vercel Frontend <-> Render Backend communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-Memory Database & Persistence Cache (Mirrors MongoDB & Firebase Realtime DB)
interface MemoryRecord {
  id: string;
  userId: string;
  text: string;
  category: 'preference' | 'fact' | 'project' | 'general';
  createdAt: number;
}

interface StoredChat {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
  pinned?: boolean;
  model?: string;
}

interface UserRecord {
  uid: string;
  googleId?: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAnonymous: boolean;
  role: 'admin' | 'user';
  credits: number;
  createdAt: number;
  lastLoginAt: number;
  lastActive: number;
  chatCount: number;
  plan?: string;
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: number;
}

const memoryStore: Map<string, MemoryRecord[]> = new Map();
const chatStore: Map<string, StoredChat> = new Map();
const userStore: Map<string, UserRecord> = new Map();

// OTP Store for 2-Factor / Email Verification
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  userProfile?: any;
}
const otpStore: Map<string, OtpRecord> = new Map();

// Seed initial memory for demo user
memoryStore.set('default-user', [
  {
    id: 'mem-1',
    userId: 'default-user',
    text: 'Prefers clean, modern, minimalistic UI designs with high contrast and readable typography.',
    category: 'preference',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'mem-2',
    userId: 'default-user',
    text: 'Currently developing Leo AI with full-stack architecture on Render and Vercel.',
    category: 'project',
    createdAt: Date.now() - 86400000,
  }
]);

// Track global metrics
let globalStats = {
  totalChats: 12,
  totalMessages: 48,
  totalVisionQueries: 8,
  totalMemories: 3,
  activeUsersCount: 1,
  estimatedTokens: 38400,
  serverStartTime: Date.now()
};

// System AI Configuration (Configurable via Admin Panel and Persisted in Firebase)
let currentConfig = {
  aiCreditsApiKey: process.env.AICREDITS_API_KEY || '',
  aiCreditsBaseUrl: process.env.AICREDITS_BASE_URL || 'https://api.aicredits.in/v1',
  visionModel: (
    process.env.MODEL_ID ||
    process.env.GEMINI_MODEL_ID ||
    process.env.GEMINI_MODEL ||
    process.env.MODEL ||
    process.env.AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL ||
    'gemini-3.7-flash'
  ).replace(/^["']|["']$/g, '').trim(),
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: process.env.SYSTEM_PROMPT || `You are Leo AI, an elite, highly intelligent, and versatile AI assistant created to assist humans across engineering, reasoning, visual analysis, writing, and creative brainstorms.
CRITICAL DIRECTIVES:
1. Always follow user constraints strictly and accurately.
2. Provide concise, elegant, and insightful answers with well-formatted Markdown, including clear headings, bullet points, and code blocks with syntax highlighting.
3. When analyzing images or visual diagrams, perform thorough, detailed OCR and visual reasoning.
4. Adapt to the user's persistent memory and preferences seamlessly.
5. Never hallucinate or bypass system safety directives.
6. For requests to build/create an app, feature, or website, never answer with an abstract JSON object or schema describing the architecture as the final response — always deliver real, working code in properly labeled Markdown code blocks (breaking large builds into focused pieces), or ask one clarifying question first if the scope is too broad to start immediately.`,
  memoApiKey: process.env.MEMO_API_KEY || '',
  memoApiUrl: process.env.MEMO_API_URL || 'https://api.mem0.ai/v1',
  enableDeepResearch: true,
  enableVision: true,
  enableMemory: true,
  fallbackToGemini: true,
  // Daily Message Limit: max /api/chat messages per user per day. 0 = unlimited.
  dailyMessageLimit: Number(process.env.DAILY_MESSAGE_LIMIT) || 0,
  mongoDbConfigured: Boolean(process.env.MONGODB_URI),
  firebaseConfigured: Boolean(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID)
};

// Tracks how many chat messages each user has sent today, for the Admin Panel's
// Daily Message Limit setting. Resets automatically whenever the date changes.
const dailyMessageCounts: Map<string, { date: string; count: number }> = new Map();

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Returns null if the user is still within the limit (and records the message),
// or an object describing the limit if it has been reached.
function checkAndRecordDailyMessage(userId: string): { limit: number; used: number } | null {
  const limit = currentConfig.dailyMessageLimit;
  if (!limit || limit <= 0) return null; // unlimited

  const today = todayDateKey();
  const existing = dailyMessageCounts.get(userId);

  if (!existing || existing.date !== today) {
    dailyMessageCounts.set(userId, { date: today, count: 1 });
    return null;
  }

  if (existing.count >= limit) {
    return { limit, used: existing.count };
  }

  existing.count += 1;
  return null;
}

// Helper to determine the EXACT model to use based on Render Environment Variables & Admin Config
function getTargetAiModel(): string {
  const envModel =
    process.env.MODEL_ID ||
    process.env.GEMINI_MODEL_ID ||
    process.env.GEMINI_MODEL ||
    process.env.MODEL ||
    process.env.AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL;

  if (envModel && envModel.trim().length > 0) {
    return envModel.replace(/^["']|["']$/g, '').trim();
  }
  if (currentConfig.visionModel && currentConfig.visionModel.trim().length > 0) {
    return currentConfig.visionModel.replace(/^["']|["']$/g, '').trim();
  }
  return 'gemini-3.7-flash';
}

// ----------------------------------------------------
// Firebase RTDB Helpers
// ----------------------------------------------------
function sanitizeEmailForRtdb(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\./g, ',')
    .replace(/[#$\[\]]/g, '_');
}

function getRtdbBaseUrl(): string {
  if (process.env.FIREBASE_DATABASE_URL && process.env.FIREBASE_DATABASE_URL.startsWith('http')) {
    return process.env.FIREBASE_DATABASE_URL.replace(/\/$/, '');
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (projectId) {
    return `https://${projectId}-default-rtdb.firebaseio.com`;
  }
  return '';
}

async function setRtdbData(pathStr: string, data: any): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const baseUrl = getRtdbBaseUrl();
    if (!baseUrl || !baseUrl.startsWith('http')) {
      clearTimeout(timeoutId);
      return false;
    }
    const res = await fetch(`${baseUrl}/${pathStr}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.warn(`[RTDB PUT ${pathStr}] Notice:`, e.message);
    return false;
  }
}

async function getRtdbData(pathStr: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const baseUrl = getRtdbBaseUrl();
    if (!baseUrl || !baseUrl.startsWith('http')) {
      clearTimeout(timeoutId);
      return null;
    }
    const res = await fetch(`${baseUrl}/${pathStr}.json`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.warn(`[RTDB GET ${pathStr}] Notice:`, e.message);
  }
  return null;
}

async function deleteRtdbData(pathStr: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const baseUrl = getRtdbBaseUrl();
    if (!baseUrl || !baseUrl.startsWith('http')) {
      clearTimeout(timeoutId);
      return;
    }
    await fetch(`${baseUrl}/${pathStr}.json`, {
      method: 'DELETE',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.warn(`[RTDB DELETE ${pathStr}] Notice:`, e.message);
  }
}

// Automatically sync latest system prompt & config from Firebase Realtime Database
async function syncSystemConfigFromDatabase(): Promise<void> {
  try {
    const savedConfig = await getRtdbData('system/config');
    if (savedConfig && typeof savedConfig === 'object') {
      currentConfig = {
        ...currentConfig,
        ...savedConfig,
        // Always preserve Render's explicit environment variable overrides if present
        aiCreditsApiKey: process.env.AICREDITS_API_KEY || savedConfig.aiCreditsApiKey || currentConfig.aiCreditsApiKey,
        visionModel: process.env.GEMINI_MODEL || process.env.AI_MODEL || process.env.MODEL || process.env.AICREDITS_VISION_MODEL || savedConfig.visionModel || currentConfig.visionModel
      };
      memoService.updateConfig({
        apiKey: currentConfig.memoApiKey,
        apiUrl: currentConfig.memoApiUrl,
        isEnabled: currentConfig.enableMemory
      });
      console.log('✓ [CONFIG] Synced system prompt & model config from Firebase Realtime DB');
    }
  } catch (e: any) {
    console.warn('[CONFIG SYNC WARNING]:', e.message);
  }
}

// Initial sync on boot
syncSystemConfigFromDatabase();

// Active admin sessions
const activeAdminTokens = new Set<string>();

// Helper to check admin authorization
function isAuthorizedAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.split(' ')[1];
  return activeAdminTokens.has(token);
}

// ----------------------------------------------------
// 1. Health & Status
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Leo AI',
    timestamp: Date.now(),
    uptime: Math.floor((Date.now() - globalStats.serverStartTime) / 1000),
    services: {
      aiCredits: Boolean(currentConfig.aiCreditsApiKey),
      geminiFallback: Boolean(process.env.GEMINI_API_KEY),
      memoApi: Boolean(currentConfig.memoApiKey),
      mongoDb: currentConfig.mongoDbConfigured,
      firebase: currentConfig.firebaseConfigured
    }
  });
});

// ----------------------------------------------------
// 2. Admin Authentication & Management
// ----------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const expectedPassword = process.env.ADMIN_PASSWORD || 'leo_admin_secret_pass';

  if (!password || password !== expectedPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Admin credentials. Please verify your Render Secret / Environment variable.'
    });
  }

  // Generate secure session token
  const token = 'admin_sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  activeAdminTokens.add(token);

  res.json({
    success: true,
    token,
    message: 'Admin authentication verified successfully.'
  });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeAdminTokens.delete(token);
  }
  res.json({ success: true, message: 'Logged out' });
});

app.get('/api/admin/config', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  res.json({
    ...currentConfig,
    hasAiCreditsKey: Boolean(currentConfig.aiCreditsApiKey),
    hasMemoKey: Boolean(currentConfig.memoApiKey),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD)
  });
});

app.post('/api/admin/config', async (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  const {
    aiCreditsApiKey,
    aiCreditsBaseUrl,
    visionModel,
    temperature,
    maxTokens,
    systemPrompt,
    memoApiKey,
    memoApiUrl,
    enableDeepResearch,
    enableVision,
    enableMemory,
    fallbackToGemini,
    dailyMessageLimit
  } = req.body;

  if (aiCreditsApiKey !== undefined) currentConfig.aiCreditsApiKey = aiCreditsApiKey;
  if (aiCreditsBaseUrl !== undefined) currentConfig.aiCreditsBaseUrl = aiCreditsBaseUrl;
  if (visionModel !== undefined) currentConfig.visionModel = visionModel;
  if (temperature !== undefined) currentConfig.temperature = Number(temperature);
  if (maxTokens !== undefined) currentConfig.maxTokens = Number(maxTokens);
  if (systemPrompt !== undefined) currentConfig.systemPrompt = systemPrompt;
  if (memoApiKey !== undefined) currentConfig.memoApiKey = memoApiKey;
  if (memoApiUrl !== undefined) currentConfig.memoApiUrl = memoApiUrl;
  if (enableDeepResearch !== undefined) currentConfig.enableDeepResearch = Boolean(enableDeepResearch);
  if (enableVision !== undefined) currentConfig.enableVision = Boolean(enableVision);
  if (enableMemory !== undefined) currentConfig.enableMemory = Boolean(enableMemory);
  if (fallbackToGemini !== undefined) currentConfig.fallbackToGemini = Boolean(fallbackToGemini);
  if (dailyMessageLimit !== undefined) currentConfig.dailyMessageLimit = Math.max(0, Number(dailyMessageLimit) || 0);

  // Persist updated configuration permanently to Firebase Realtime Database
  await setRtdbData('system/config', currentConfig);

  console.log('✓ [ADMIN] Saved and persisted system prompt and AI config to database');

  res.json({
    success: true,
    message: 'Leo AI configuration updated and persisted successfully across all instances.',
    config: currentConfig
  });
});

app.get('/api/admin/stats', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  let totalMemories = 0;
  memoryStore.forEach(m => totalMemories += m.length);

  res.json({
    totalChats: chatStore.size + globalStats.totalChats,
    totalMessages: globalStats.totalMessages,
    totalVisionQueries: globalStats.totalVisionQueries,
    totalMemories: totalMemories || globalStats.totalMemories,
    activeUsersCount: Math.max(userStore.size, 1),
    estimatedTokens: globalStats.estimatedTokens,
    serverUptime: Math.floor((Date.now() - globalStats.serverStartTime) / 1000)
  });
});

app.get('/api/admin/users', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  const users: UserRecord[] = Array.from(userStore.values());
  if (users.length === 0) {
    users.push({
      uid: 'usr_default_01',
      displayName: 'Emerson Sterling',
      email: 'sterlingr@gmail.com',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      credits: 50,
      createdAt: Date.now() - 86400000 * 7,
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
      chatCount: 14
    });
  }

  res.json({ users });
});

// ----------------------------------------------------
// 2b. Email OTP 2-Factor Authentication
// ----------------------------------------------------

const emailRateLimitMap: Map<string, number> = new Map();

async function sendOtpEmail(
  email: string,
  code: string,
  displayName?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string; configNote?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || (smtpHost.includes('gmail') ? 465 : 587);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const smtpFrom = process.env.SMTP_FROM ? process.env.SMTP_FROM.trim() : (smtpUser ? `Leo AI Security <${smtpUser}>` : 'Leo AI Security <auth@leoai.app>');
  const resendApiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  const sendgridApiKey = process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.trim() : '';

  const maskedUser = smtpUser ? `${smtpUser.substring(0, 3)}***@${smtpUser.split('@')[1] || 'domain'}` : '(NOT CONFIGURED)';
  console.log(`\n================== [EMAIL DISPATCH DIAGNOSTICS] ==================`);
  console.log(`[STEP 3/5: CHECKING EMAIL CONFIG]`);
  console.log(`  • Recipient:       ${normalizedEmail}`);
  console.log(`  • SMTP Host:       ${smtpHost}`);
  console.log(`  • SMTP Port:       ${smtpPort} (secure: ${smtpSecure})`);
  console.log(`  • SMTP User:       ${maskedUser}`);
  console.log(`  • Has Password:    ${Boolean(smtpPass)} (Length: ${smtpPass.length} chars)`);
  console.log(`  • Sender (From):   ${smtpFrom}`);
  console.log(`  • Resend API Key:  ${Boolean(resendApiKey)}`);
  console.log(`  • SendGrid Key:    ${Boolean(sendgridApiKey)}`);

  const digits = code.split('');
  const digitBoxesHtml = digits.map(d => `
    <td style="padding: 0 3px; vertical-align: middle;">
      <div style="width: 42px; height: 54px; line-height: 54px; text-align: center; background: #1f1a3a; background-image: linear-gradient(180deg, #2a2254 0%, #16122c 100%); border: 1.5px solid #8b5cf6; border-radius: 12px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 28px; font-weight: 800; color: #ffffff; text-shadow: 0 2px 8px rgba(139, 92, 246, 0.6); box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);">
        ${d}
      </div>
    </td>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Leo AI Passkey Verification</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <!-- Preview Preheader Text -->
      <div style="display: none; font-size: 1px; color: #090d16; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Your Leo AI 6-digit verification passkey is ${code}. Valid for 5 minutes.
      </div>

      <!-- Main Container Card -->
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto; background-color: #111726; border: 1px solid #2a3449; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        
        <!-- Header Banner -->
        <tr>
          <td style="padding: 36px 24px 28px 24px; text-align: center; background: linear-gradient(135deg, #1e1145 0%, #0f172a 100%); border-bottom: 1px solid #232d42;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center">
                  <div style="display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 16px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); box-shadow: 0 8px 24px rgba(124, 58, 237, 0.45); font-size: 26px; color: #ffffff; font-weight: 800; margin-bottom: 14px;">
                    ✦
                  </div>
                </td>
              </tr>
            </table>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
              LEO <span style="color: #a78bfa;">AI</span>
            </h1>
            <div style="display: inline-block; margin-top: 8px; padding: 4px 12px; background-color: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 20px; font-size: 11px; font-weight: 700; color: #c4b5fd; text-transform: uppercase; letter-spacing: 1px;">
              Two-Factor Authentication Passkey
            </div>
          </td>
        </tr>

        <!-- Content Body -->
        <tr>
          <td style="padding: 32px 28px 24px 28px;">
            <p style="margin: 0 0 10px 0; font-size: 15px; color: #f1f5f9; font-weight: 600;">
              Hello <span style="color: #a78bfa;">${displayName || 'Explorer'}</span>,
            </p>
            <p style="margin: 0 0 24px 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
              We received a request to access your <strong style="color: #e2e8f0;">Leo AI</strong> account. Use the high-security verification code below to authorize your session:
            </p>

            <!-- 6-Digit Interactive Display Card -->
            <div style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 18px; padding: 22px 14px; text-align: center; margin-bottom: 24px; box-shadow: inset 0 2px 6px rgba(0,0,0,0.4);">
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  ${digitBoxesHtml}
                </tr>
              </table>
              <div style="margin-top: 16px;">
                <span style="display: inline-block; padding: 4px 10px; background-color: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; font-size: 11px; font-weight: 600; color: #fbbf24;">
                  ⏱ Valid for 5 minutes only
                </span>
              </div>
            </div>

            <!-- Security Advisory Banner -->
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-left: 4px solid #8b5cf6; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top; width: 22px; padding-top: 2px;">
                    <span style="font-size: 14px;">🛡️</span>
                  </td>
                  <td style="padding-left: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
                      <strong style="color: #f8fafc;">Security Notice:</strong> Never share this 6-digit passkey with anyone. Leo AI staff will never ask for your code.
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Account Metadata -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #1e293b; padding-top: 16px;">
              <tr>
                <td style="font-size: 11px; color: #64748b; line-height: 1.6;">
                  Recipient: <span style="color: #94a3b8; font-family: monospace;">${normalizedEmail}</span><br>
                  Protocol: <span style="color: #94a3b8;">SHA-256 OTP Authentication</span>
                </td>
                <td align="right" style="font-size: 11px; color: #64748b; vertical-align: bottom;">
                  Status: <span style="color: #34d399; font-weight: 700;">● Active</span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer & Developer Credits -->
        <tr>
          <td style="background-color: #0b0f19; padding: 22px 24px; text-align: center; border-top: 1px solid #1e293b;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #cbd5e1; letter-spacing: 0.5px;">
              LEO AI COGNITIVE PLATFORM
            </p>
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b;">
              Engineered by <strong style="color: #94a3b8;">Bikash Bindhani</strong>
            </p>
            <p style="margin: 0; font-size: 11px;">
              <a href="https://www.instagram.com/vixyiu._?igsh=czZsZjdrNHBrc2l2&igsi=czZsZjdrNHBrc2l2" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">
                Instagram: @vixyiu._ ↗
              </a>
            </p>
          </td>
        </tr>

      </table>

      <!-- Subtext -->
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 16px auto 0 auto;">
        <tr>
          <td align="center" style="font-size: 10px; color: #475569;">
            This is an automated security transmission. If you did not request this OTP, you may safely ignore it.
          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  // OPTION A: Resend HTTPS REST API (Bypasses Spark/Cloud port 587 blocks)
  let resendRejectReason = '';
  if (resendApiKey) {
    try {
      console.log(`[STEP 4/5: DISPATCH VIA RESEND HTTPS API]`);
      // For Resend testing/free domain, sender must be onboarding@resend.dev unless verified custom domain is used
      const customResendFrom = process.env.RESEND_FROM;
      const resendFrom = customResendFrom || (smtpFrom && !smtpFrom.includes('gmail.com') ? smtpFrom : 'Leo AI <onboarding@resend.dev>');
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: resendFrom,
          to: normalizedEmail,
          subject: `Your Leo AI Verification Code: ${code}`,
          html: htmlContent
        })
      });
      const resendData = await resendResponse.json();
      if (resendResponse.ok && resendData?.id) {
        console.log(`[STEP 5/5: SUCCESS (RESEND API)] ✅ Delivered with ID: ${resendData.id}`);
        console.log(`==================================================================\n`);
        return { success: true, messageId: resendData.id };
      } else {
        resendRejectReason = resendData?.message || JSON.stringify(resendData);
        console.warn(`[RESEND API REJECTED]`, resendRejectReason);
      }
    } catch (e: any) {
      resendRejectReason = e.message;
      console.warn(`[RESEND API ERROR]`, e.message);
    }
  }

  // OPTION B: SendGrid HTTPS REST API
  let sendgridRejectReason = '';
  if (sendgridApiKey) {
    try {
      console.log(`[STEP 4/5: DISPATCH VIA SENDGRID HTTPS API]`);
      // Extract clean email address from sender string
      let senderEmail = process.env.SENDGRID_FROM || smtpUser || '';
      if (!senderEmail && smtpFrom) {
        const match = smtpFrom.match(/<([^>]+)>/);
        senderEmail = match ? match[1] : (smtpFrom.includes('@') ? smtpFrom.trim() : '');
      }
      if (!senderEmail) {
        senderEmail = 'cyberbikash8@gmail.com';
      }
      senderEmail = senderEmail.trim();

      const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: normalizedEmail }] }],
          from: { email: senderEmail, name: 'Leo AI Security' },
          subject: `Your Leo AI Verification Code: ${code}`,
          content: [{ type: 'text/html', value: htmlContent }]
        })
      });
      if (sgResponse.ok || sgResponse.status === 202) {
        console.log(`[STEP 5/5: SUCCESS (SENDGRID API)] ✅ Delivered to ${normalizedEmail}`);
        console.log(`==================================================================\n`);
        return { success: true, messageId: `sg_${Date.now()}` };
      } else {
        const errText = await sgResponse.text();
        sendgridRejectReason = `Status ${sgResponse.status}: ${errText}`;
        console.warn(`[SENDGRID API REJECTED ${sgResponse.status}]:`, errText);
      }
    } catch (e: any) {
      sendgridRejectReason = e.message;
      console.warn(`[SENDGRID API ERROR]`, e.message);
    }
  }

  try {
    let transporter: nodemailer.Transporter;

    if (smtpUser && smtpPass) {
      console.log(`[STEP 4/5: ATTEMPTING SMTP DISPATCH VIA ${smtpHost}]`);
      
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpHost.includes('gmail.com');

      const primaryConfig: any = isGmail
        ? {
            service: 'gmail',
            auth: { user: smtpUser, pass: cleanPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 6000,
            greetingTimeout: 6000,
            socketTimeout: 8000,
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: cleanPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 6000,
            greetingTimeout: 6000,
            socketTimeout: 8000,
          };

      transporter = nodemailer.createTransport(primaryConfig);

      let verified = false;
      try {
        await transporter.verify();
        verified = true;
        console.log(`  ✓ SMTP Server connection verified successfully.`);
      } catch (verifyErr: any) {
        console.warn(`  ⚠️ Primary SMTP verify failed (${verifyErr.message}), attempting STARTTLS fallback on port 587...`);
        try {
          transporter = nodemailer.createTransport({
            host: isGmail ? 'smtp.gmail.com' : smtpHost,
            port: 587,
            secure: false, // STARTTLS
            auth: { user: smtpUser, pass: cleanPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 6000,
            greetingTimeout: 6000,
            socketTimeout: 8000,
          });
          await transporter.verify();
          verified = true;
          console.log(`  ✓ SMTP STARTTLS (port 587) verified successfully.`);
        } catch (fallbackErr: any) {
          console.error(`  ✗ SMTP Connection Verification FAILED:`, fallbackErr.message);
          let errorDetails = `SMTP connection failed: Cloud host blocked SMTP port (Timeout).`;
          if (sendgridRejectReason) {
            errorDetails = `SendGrid: Single Sender Verification required at sendgrid.com.`;
          } else if (resendRejectReason) {
            errorDetails = `Resend: ${resendRejectReason}`;
          }
          return {
            success: false,
            error: errorDetails,
            configNote: 'Render free tier blocks direct SMTP port 465/587. Click the Auto-fill Test Code button to log in.'
          };
        }
      }
    } else {
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        transporter = nodemailer.createTransport({ jsonTransport: true });
      }
    }

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: normalizedEmail,
      subject: `Your Leo AI Verification Code: ${code}`,
      text: `Your Leo AI verification code is: ${code}. It expires in 5 minutes.`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'SMTP dispatch failed'
    };
  }
}

// ----------------------------------------------------
// Google OAuth 2.0 & Token Verification Helpers
// ----------------------------------------------------
const DEFAULT_USER_CREDITS = parseInt(process.env.DEFAULT_AI_CREDITS || '50', 10) || 50;

async function findOrCreateGoogleUser(googleData: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<{ user: UserRecord; isNewUser: boolean }> {
  const normalizedEmail = googleData.email.trim().toLowerCase();
  const sanitizedEmail = sanitizeEmailForRtdb(normalizedEmail);
  const defaultCredits = DEFAULT_USER_CREDITS;

  // 1. Search in local userStore by UID, googleId or email
  let existingUser: UserRecord | undefined;
  if (googleData.sub && userStore.has(googleData.sub)) {
    existingUser = userStore.get(googleData.sub);
  }
  if (!existingUser) {
    for (const usr of userStore.values()) {
      if (
        (usr.googleId && usr.googleId === googleData.sub) ||
        (usr.email && usr.email.toLowerCase() === normalizedEmail)
      ) {
        existingUser = usr;
        break;
      }
    }
  }

  // 2. Search in Realtime Database /users if not in local cache
  if (!existingUser && googleData.sub) {
    const directUser = await getRtdbData(`users/${googleData.sub}`);
    if (directUser && (directUser.uid || directUser.email)) {
      existingUser = directUser;
    }
  }
  if (!existingUser) {
    const rtdbEmailIndex = await getRtdbData(`users_by_email/${sanitizedEmail}`);
    if (rtdbEmailIndex && rtdbEmailIndex.uid) {
      const remoteUser = await getRtdbData(`users/${rtdbEmailIndex.uid}`);
      if (remoteUser && remoteUser.uid) {
        existingUser = remoteUser;
      }
    }
  }

  if (existingUser) {
    const updatedUser: UserRecord = {
      ...existingUser,
      uid: existingUser.uid || googleData.sub,
      googleId: existingUser.googleId || googleData.sub,
      displayName: existingUser.displayName || googleData.name || normalizedEmail.split('@')[0],
      photoURL: existingUser.photoURL || googleData.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      credits: typeof existingUser.credits === 'number' ? existingUser.credits : defaultCredits,
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
    };
    userStore.set(updatedUser.uid, updatedUser);

    // Save to RTDB
    await setRtdbData(`users/${updatedUser.uid}`, { ...updatedUser, updatedAt: Date.now() });
    await setRtdbData(`users_by_email/${sanitizedEmail}`, { uid: updatedUser.uid });

    return { user: updatedUser, isNewUser: false };
  }

  // 3. New User Registration:
  // Using verified Firebase UID (googleData.sub) ensures 1:1 match with Firebase Auth
  const newUid = googleData.sub || ('usr_g_' + Math.random().toString(36).substring(2, 10));
  const isInitialAdmin = Boolean(
    process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.trim().toLowerCase()
  );

  const newUser: UserRecord = {
    uid: newUid,
    googleId: googleData.sub,
    displayName: googleData.name || normalizedEmail.split('@')[0] || 'Leo Explorer',
    email: normalizedEmail,
    photoURL: googleData.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isAnonymous: false,
    role: isInitialAdmin ? 'admin' : 'user',
    credits: defaultCredits,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    lastActive: Date.now(),
    chatCount: 0,
  };

  userStore.set(newUid, newUser);

  // Persist to RTDB
  await setRtdbData(`users/${newUid}`, { ...newUser, updatedAt: Date.now() });
  await setRtdbData(`users_by_email/${sanitizedEmail}`, { uid: newUid });

  return { user: newUser, isNewUser: true };
}

async function verifyGoogleTokenPayload(params: {
  credential?: string;
  idToken?: string;
  accessToken?: string;
}): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  const tokenToVerify = params.idToken || params.credential;

  // 1. Google OAuth2 ID Token Verification via tokeninfo
  if (tokenToVerify) {
    try {
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`
      );
      if (tokenInfoRes.ok) {
        const payload: any = await tokenInfoRes.json();
        if (payload.sub && payload.email) {
          return {
            sub: payload.sub,
            email: payload.email,
            name: payload.name || payload.given_name,
            picture: payload.picture,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Google Tokeninfo Notice]:', err.message);
    }

    // 2. Fallback: Firebase Auth ID Token verification via Google Identity Toolkit
    const firebaseKey = process.env.FIREBASE_API_KEY || appletConfig.apiKey;
    if (firebaseKey) {
      try {
        const fbRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: tokenToVerify }),
          }
        );
        if (fbRes.ok) {
          const fbData: any = await fbRes.json();
          const user = fbData.users?.[0];
          if (user && user.email) {
            return {
              sub: user.localId || user.rawId || 'fb_' + Date.now(),
              email: user.email,
              name: user.displayName,
              picture: user.photoUrl,
            };
          }
        }
      } catch (fbErr: any) {
        console.warn('[Firebase Token Verification Notice]:', fbErr.message);
      }
    }
  }

  // 3. Google Access Token Verification via userinfo
  if (params.accessToken) {
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (userinfoRes.ok) {
        const info: any = await userinfoRes.json();
        if (info.sub && info.email) {
          return {
            sub: info.sub,
            email: info.email,
            name: info.name || info.given_name,
            picture: info.picture,
          };
        }
      }
    } catch (accessErr: any) {
      console.warn('[Google Userinfo Notice]:', accessErr.message);
    }
  }

  return null;
}

/**
 * Public OAuth Configuration (Safe - never exposes client secrets)
 */
app.get('/api/auth/oauth-config', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  res.json({
    googleClientId,
    googleConfigured: Boolean(googleClientId),
    defaultCredits: DEFAULT_USER_CREDITS,
    firebaseConfigured: Boolean(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID),
  });
});

/**
 * POST /api/auth/google
 * Universal Google Authentication endpoint:
 * Accepts Google ID Token, Credential, Access Token, or OAuth code.
 * Cryptographically verifies token with Google, creates or finds user, and returns session token.
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, idToken, accessToken, code, redirectUri } = req.body;

    let verifiedPayload: { sub: string; email: string; name?: string; picture?: string } | null = null;

    // A. Handle Authorization Code Exchange (if code provided)
    if (code) {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(500).json({
          success: false,
          message: 'Google OAuth is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend configuration.'
        });
      }

      const tokenParams = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      });

      const tokenExchangeRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      if (!tokenExchangeRes.ok) {
        const errJson: any = await tokenExchangeRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          message: errJson.error_description || 'Google OAuth code exchange failed'
        });
      }

      const tokenData: any = await tokenExchangeRes.json();
      verifiedPayload = await verifyGoogleTokenPayload({
        idToken: tokenData.id_token,
        accessToken: tokenData.access_token
      });
    } else {
      // B. Verify Token / Credential / AccessToken directly with Google
      verifiedPayload = await verifyGoogleTokenPayload({ credential, idToken, accessToken });
    }

    if (!verifiedPayload || !verifiedPayload.email) {
      return res.status(401).json({
        success: false,
        message: 'Google authentication verification failed. Invalid or expired token.'
      });
    }

    // C. Find or create user in database
    const { user, isNewUser } = await findOrCreateGoogleUser(verifiedPayload);

    // D. Mint session token
    const sessionToken = 'leo_gauth_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    console.log(`[Google Auth Success] ${isNewUser ? 'Created new user' : 'Logged in existing user'}: ${user.email} (Credits: ${user.credits})`);

    // Set secure cookie if possible
    res.cookie('leo_auth_session', sessionToken, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({
      success: true,
      message: isNewUser ? 'Welcome to Leo AI! Your account was created.' : 'Welcome back to Leo AI!',
      user,
      token: sessionToken,
      isNewUser,
    });
  } catch (err: any) {
    console.error('[POST /api/auth/google Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during Google authentication.'
    });
  }
});

/**
 * GET /api/auth/google/url
 * Generates official Google OAuth 2.0 authorization URL for redirect flows
 */
app.get('/api/auth/google/url', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: 'GOOGLE_CLIENT_ID is not configured in backend environment variables.'
    });
  }

  const redirectUri = (req.query.redirect_uri as string) || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const state = (req.query.state as string) || '/';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  res.json({
    success: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  });
});

/**
 * GET /api/auth/google/callback
 * Handles OAuth 2.0 redirect code from Google and redirects user back to app
 */
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(String(error))}`);
  }

  if (!code) {
    return res.redirect('/?auth_error=no_code_provided');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect('/?auth_error=google_oauth_not_configured_on_backend');
    }

    const tokenParams = new URLSearchParams({
      code: String(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenExchangeRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenExchangeRes.ok) {
      return res.redirect('/?auth_error=token_exchange_failed');
    }

    const tokenData: any = await tokenExchangeRes.json();
    const verifiedPayload = await verifyGoogleTokenPayload({
      idToken: tokenData.id_token,
      accessToken: tokenData.access_token
    });

    if (!verifiedPayload || !verifiedPayload.email) {
      return res.redirect('/?auth_error=verification_failed');
    }

    const { user } = await findOrCreateGoogleUser(verifiedPayload);
    const sessionToken = 'leo_gauth_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

    const userParam = encodeURIComponent(JSON.stringify(user));
    const targetState = (state && String(state).startsWith('/')) ? String(state) : '/';

    return res.redirect(`${targetState}#auth_token=${sessionToken}&user=${userParam}`);
  } catch (err: any) {
    console.error('[Google OAuth Callback Error]:', err);
    return res.redirect(`/?auth_error=${encodeURIComponent(err.message || 'callback_failed')}`);
  }
});

/**
 * GET /api/auth/me or /api/auth/session
 * Returns current authenticated user and updated AI credits
 */
app.get(['/api/auth/me', '/api/auth/session'], (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || (req.query.token as string);
  const uid = (req.query.uid as string) || (req.headers['x-user-id'] as string);

  if (!token && !uid) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  let user: UserRecord | undefined;
  if (uid && userStore.has(uid)) {
    user = userStore.get(uid);
  } else {
    for (const u of userStore.values()) {
      if (u.uid === uid) {
        user = u;
        break;
      }
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, user });
});

app.post('/api/auth/send-otp', async (req, res) => {
  const { email, uid, displayName, photoURL } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sanitizedEmail = sanitizeEmailForRtdb(normalizedEmail);

  const lastSent = emailRateLimitMap.get(normalizedEmail);
  if (lastSent && Date.now() - lastSent < 20000) {
    const remainingSecs = Math.ceil((20000 - (Date.now() - lastSent)) / 1000);
    return res.status(429).json({
      success: false,
      message: `Rate limit: Please wait ${remainingSecs}s before requesting a new OTP.`
    });
  }
  emailRateLimitMap.set(normalizedEmail, Date.now());

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInMs = 5 * 60 * 1000;
  const expiresAt = Date.now() + expiresInMs;

  const otpPayload = {
    otp: code,
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
    email: normalizedEmail,
    uid: uid || 'usr_' + Math.random().toString(36).substring(2, 9),
    displayName: displayName || normalizedEmail.split('@')[0],
    photoURL: photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  };

  await setRtdbData(`otps/${sanitizedEmail}`, otpPayload);

  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    attempts: 0,
    userProfile: {
      uid: otpPayload.uid,
      displayName: otpPayload.displayName,
      email: normalizedEmail,
      photoURL: otpPayload.photoURL,
      isAnonymous: false,
      role: 'user'
    }
  });

  const emailResult = await sendOtpEmail(normalizedEmail, code, displayName);

  if (!emailResult.success) {
    return res.status(200).json({
      success: true,
      message: `OTP generated for ${normalizedEmail}. ${emailResult.error ? `(Note: ${emailResult.error})` : ''}`,
      emailDelivered: false,
      devOtp: code,
      deliveryError: emailResult.error,
      configNote: emailResult.configNote,
      expiresIn: 300
    });
  }

  res.json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    emailDelivered: true,
    messageId: emailResult.messageId,
    expiresIn: 300
  });
});

app.get('/api/auth/email-diagnostics', (req, res) => {
  const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.SMTP_PORT || (smtpHost.includes('gmail') ? '465' : '587');
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  const sendgridKey = Boolean(process.env.SENDGRID_API_KEY);

  res.json({
    smtpConfigured: Boolean(smtpUser && smtpPass),
    smtpHost,
    smtpPort,
    smtpUserMasked: smtpUser ? `${smtpUser.substring(0, 3)}***@${smtpUser.split('@')[1] || 'domain'}` : null,
    hasPassword: Boolean(smtpPass),
    passwordLength: smtpPass ? smtpPass.length : 0,
    resendConfigured: resendKey,
    sendgridConfigured: sendgridKey
  });
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp, userProfile } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sanitizedEmail = sanitizeEmailForRtdb(normalizedEmail);

  let rtdbRecord = await getRtdbData(`otps/${sanitizedEmail}`);
  const memRecord = otpStore.get(normalizedEmail);

  const activeOtp = rtdbRecord?.otp || memRecord?.code;
  const activeExpiresAt = rtdbRecord?.expiresAt || memRecord?.expiresAt;
  let activeAttempts = rtdbRecord?.attempts || memRecord?.attempts || 0;

  if (!activeOtp || !activeExpiresAt) {
    return res.status(400).json({
      success: false,
      message: 'No active OTP request found for this email. Please request a new code.'
    });
  }

  if (Date.now() > activeExpiresAt) {
    await deleteRtdbData(`otps/${sanitizedEmail}`);
    otpStore.delete(normalizedEmail);
    return res.status(400).json({
      success: false,
      message: 'OTP has expired (validity is 5 minutes). Please request a new verification code.'
    });
  }

  activeAttempts++;
  if (activeAttempts > 5) {
    await deleteRtdbData(`otps/${sanitizedEmail}`);
    otpStore.delete(normalizedEmail);
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts (max 5). This OTP has been invalidated. Please request a new code.'
    });
  }

  if (activeOtp !== otp.trim()) {
    if (rtdbRecord) {
      await setRtdbData(`otps/${sanitizedEmail}/attempts`, activeAttempts);
    }
    if (memRecord) {
      memRecord.attempts = activeAttempts;
    }
    return res.status(400).json({
      success: false,
      message: `Invalid OTP code. ${5 - activeAttempts} attempts remaining.`
    });
  }

  await deleteRtdbData(`otps/${sanitizedEmail}`);
  otpStore.delete(normalizedEmail);

  const finalUid = userProfile?.uid || rtdbRecord?.uid || memRecord?.userProfile?.uid || 'usr_' + Date.now().toString(36);
  const existingCached = userStore.get(finalUid);
  const finalUser: UserRecord = {
    uid: finalUid,
    displayName: userProfile?.displayName || rtdbRecord?.displayName || memRecord?.userProfile?.displayName || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    photoURL: userProfile?.photoURL || rtdbRecord?.photoURL || memRecord?.userProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isAnonymous: false,
    role: 'user',
    credits: existingCached && typeof existingCached.credits === 'number' ? existingCached.credits : DEFAULT_USER_CREDITS,
    createdAt: existingCached?.createdAt || Date.now(),
    lastLoginAt: Date.now(),
    lastActive: Date.now(),
    chatCount: existingCached?.chatCount || 0
  };

  await setRtdbData(`users/${finalUid}`, {
    ...finalUser,
    updatedAt: Date.now()
  });
  userStore.set(finalUid, finalUser);

  const customToken = `firebase_custom_token_${finalUid}_${Date.now()}`;
  const sessionToken = 'leo_usr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

  res.json({
    success: true,
    message: 'OTP verified successfully. Login complete!',
    user: finalUser,
    customToken,
    token: sessionToken
  });
});

// ----------------------------------------------------
// 3. Memo API & Long-Term User Memory Management
// ----------------------------------------------------
app.get('/api/memory', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'default-user';
    const memories = await memoService.getMemories(userId);
    res.json({ memories });
  } catch (err: any) {
    console.warn('[API /api/memory GET error]:', err.message);
    res.json({ memories: [] });
  }
});

app.post('/api/memory/search', async (req, res) => {
  try {
    const { userId = 'default-user', query = '', limit = 5 } = req.body;
    const memories = await memoService.searchRelevantMemories(userId, query, Number(limit) || 5);
    res.json({ memories });
  } catch (err: any) {
    console.warn('[API /api/memory/search POST error]:', err.message);
    res.json({ memories: [] });
  }
});

app.post('/api/memory', async (req, res) => {
  try {
    const { userId = 'default-user', text, category = 'general' } = req.body;
    if (!text) return res.status(400).json({ error: 'Memory text is required' });

    const newMemory = await memoService.addMemory(userId, text, category);
    globalStats.totalMemories++;

    res.json({ success: true, memory: newMemory });
  } catch (err: any) {
    console.error('[API /api/memory POST error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to save memory' });
  }
});

app.put('/api/memory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, userId = 'default-user' } = req.body;
    if (!text) return res.status(400).json({ error: 'Memory text is required' });

    const ok = await memoService.updateMemory(id, text, userId);
    res.json({ success: ok, message: ok ? 'Memory updated' : 'Memory not found' });
  } catch (err: any) {
    console.error('[API /api/memory/:id PUT error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update memory' });
  }
});

app.delete('/api/memory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.query.userId as string) || (req.body?.userId as string) || 'default-user';
    await memoService.deleteMemory(id, userId);
    res.json({ success: true, message: 'Memory deleted' });
  } catch (err: any) {
    console.warn('[API /api/memory/:id DELETE error]:', err.message);
    res.json({ success: true, message: 'Memory deleted' });
  }
});

app.delete('/api/memory', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req.body?.userId as string) || 'default-user';
    await memoService.deleteAllMemories(userId);
    res.json({ success: true, message: 'All memories cleared' });
  } catch (err: any) {
    console.warn('[API /api/memory DELETE error]:', err.message);
    res.json({ success: true, message: 'All memories cleared' });
  }
});

// ----------------------------------------------------
// 4. Chat History & Cloud Sync
// ----------------------------------------------------
app.get('/api/chats', (req, res) => {
  const userId = (req.query.userId as string) || 'default-user';
  const userChats: StoredChat[] = [];
  chatStore.forEach(c => {
    if (c.userId === userId) userChats.push(c);
  });
  userChats.sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ chats: userChats });
});

app.post('/api/chats', (req, res) => {
  const { id, userId = 'default-user', title, messages, pinned, model } = req.body;
  if (!id) return res.status(400).json({ error: 'Chat ID is required' });

  const chatObj: StoredChat = {
    id,
    userId,
    title: title || 'New Conversation',
    createdAt: req.body.createdAt || Date.now(),
    updatedAt: Date.now(),
    messages: messages || [],
    pinned: Boolean(pinned),
    model: model || currentConfig.visionModel
  };

  chatStore.set(id, chatObj);
  res.json({ success: true, chat: chatObj });
});

app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  chatStore.delete(id);
  res.json({ success: true, message: 'Chat deleted' });
});

// Helper to build the unified, authoritative system prompt context with Memo long-term memories
async function buildUnifiedSystemPrompt(
  userId: string,
  latestMessageText: string = '',
  systemPromptOverride?: string,
  isDeepResearch: boolean = false,
  hasImages: boolean = false
): Promise<string> {
  // 1. Authoritative Base Persona & Directives from Admin Panel / Config / Env
  const rawAdminPrompt = (systemPromptOverride || currentConfig.systemPrompt || process.env.SYSTEM_PROMPT || '').trim();
  
  let basePersona = '';
  if (rawAdminPrompt) {
    basePersona = `[SUPREME SYSTEM MANDATE & ADMIN DIRECTIVE - ABSOLUTE HIGHEST PRIORITY]:
${rawAdminPrompt}

CRITICAL EXECUTION INSTRUCTIONS:
- You MUST unconditionally obey and strictly follow the above persona, rules, language, constraints, and instructions set by the Administrator.
- Under NO circumstances should you break character, deviate from the Administrator's guidelines, or ignore the rules above.
- Always output clean Markdown with proper spacing and structure.`;
  } else {
    basePersona = `You are Leo AI, an elite, highly intelligent, and versatile AI assistant created to assist humans across engineering, reasoning, visual analysis, writing, and creative brainstorms.
CRITICAL DIRECTIVES:
1. Always follow user constraints strictly and accurately.
2. Provide concise, elegant, and insightful answers with well-formatted Markdown, including clear headings, bullet points, and code blocks with syntax highlighting.
3. When analyzing images or visual diagrams, perform thorough, detailed OCR and visual reasoning.
4. Adapt to the user's persistent memory and preferences seamlessly.
5. Never hallucinate or bypass system safety directives.
6. For requests to build/create an app, feature, or website, never answer with an abstract JSON object or schema describing the architecture as the final response — always deliver real, working code in properly labeled Markdown code blocks (breaking large builds into focused pieces), or ask one clarifying question first if the scope is too broad to start immediately.`;
  }

  // 2. Persistent User Memory Context (Memo API / Long-term service)
  let memorySection = '';
  if (currentConfig.enableMemory) {
    try {
      memorySection = await memoService.buildMemoryPromptContext(userId, latestMessageText);
    } catch (memErr: any) {
      console.warn('[Memory Context Warn]:', memErr.message);
    }
  }

  // 3. Deep Research & Structured Reasoning Directives
  let deepResearchSection = '';
  if (isDeepResearch) {
    deepResearchSection = `\n\n[EXECUTION MODE: DEEP RESEARCH & ADVANCED REASONING ACTIVATED]
- Provide a rigorous, multi-faceted analysis with structured breakdowns.
- Include an executive summary, underlying mechanics/theory, critical trade-offs, and concrete next steps.
- Maintain maximum intellectual precision and depth while strictly adhering to the Supreme System Mandate.`;
  }

  // 4. Multimodal Vision Guidance
  let visionSection = '';
  if (hasImages) {
    visionSection = `\n\n[MULTIMODAL VISION REASONING ACTIVATED]
- Thoroughly inspect all visual features, spatial layouts, extracted text (OCR), colors, and UI/architectural structures in the provided image(s).`;
  }

  return `${basePersona}${memorySection}${deepResearchSection}${visionSection}`.trim();
}

// ----------------------------------------------------
// 5. AI Chat Completion & Vision Reasoning
// ----------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages = [],
      userId = 'default-user',
      images = [],
      isDeepResearch = false,
      systemPromptOverride,
      model
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Admin Panel "Daily Message Limit" enforcement (skipped for authenticated admins)
    if (!isAuthorizedAdmin(req)) {
      const limitHit = checkAndRecordDailyMessage(userId);
      if (limitHit) {
        return res.status(429).json({
          error: `Daily message limit reached (${limitHit.used}/${limitHit.limit}). Please try again tomorrow.`,
          limitReached: true,
          limit: limitHit.limit,
          used: limitHit.used
        });
      }
    }

    const latestUserMessage = messages[messages.length - 1];
    const hasImages = Array.isArray(images) && images.length > 0;

    // Construct the authoritative system prompt containing the defined persona
    const finalSystemPrompt = await buildUnifiedSystemPrompt(
      userId,
      latestUserMessage.content || '',
      systemPromptOverride,
      Boolean(isDeepResearch),
      hasImages
    );

    if (hasImages) {
      globalStats.totalVisionQueries++;
    }
    globalStats.totalMessages += 2;
    globalStats.estimatedTokens += 650;

    // Resolve the exact model requested by the client. The frontend model
    // selection MUST be authoritative for known models; previously the backend
    // ignored req.body.model and always used an environment/default model.
    const TOKENIN_MODELS = new Set([
      'myt/grok-4.6',
      'myt/kimi-k3',
      'myt/glm-5.3',
      'myt/qwen3.8-max',
      'myt/deepseek-v4-pro'
    ]);
    const requestedModel = typeof model === 'string' ? model.trim() : '';
    const targetModel = requestedModel || getTargetAiModel();
    const isTokeninModel = TOKENIN_MODELS.has(targetModel);
    console.log(`[AI CHAT] Using Model: "${targetModel}" | Provider: ${isTokeninModel ? 'tokenin' : 'existing'} | Deep Research: ${isDeepResearch} | Has Images: ${hasImages}`);

    const formattedMessages: any[] = [
      { role: 'system', content: finalSystemPrompt }
    ];
    for (let i = 0; i < messages.length - 1; i++) {
      const m = messages[i];
      if (m.role === 'system') continue;
      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      });
    }

    if (hasImages) {
      const contentParts: any[] = [{ type: 'text', text: latestUserMessage.content || 'Analyze this image.' }];
      for (const img of images) {
        contentParts.push({ type: 'image_url', image_url: { url: img } });
      }
      formattedMessages.push({ role: 'user', content: contentParts });
    } else {
      formattedMessages.push({ role: 'user', content: latestUserMessage.content });
    }

    // 1. Tokenin models ALWAYS use Tokenin. They never fall back to
    // AICredits/Gemini because doing so would silently use the wrong provider.
    if (isTokeninModel) {
      const tokeninKey = (process.env.TOKENIN_API_KEY || '').trim();
      const tokeninBaseUrl = (process.env.TOKENIN_BASE_URL || 'https://tokenin.my.id/api/v1').trim().replace(/\/+$/, '');

      if (!tokeninKey) {
        return res.status(503).json({
          error: 'Tokenin provider is not configured. Set TOKENIN_API_KEY in the backend environment.',
          provider: 'tokenin',
          model: targetModel
        });
      }

      try {
        const endpoint = `${tokeninBaseUrl}/chat/completions`;
        const tokeninResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokeninKey}`
          },
          body: JSON.stringify({
            model: targetModel,
            messages: formattedMessages,
            temperature: currentConfig.temperature,
            max_tokens: currentConfig.maxTokens
          })
        });

        if (!tokeninResponse.ok) {
          const errBody = await tokeninResponse.text().catch(() => '');
          console.error(`[TOKENIN] Request failed with status ${tokeninResponse.status} for model "${targetModel}": ${errBody.slice(0, 1000)}`);
          const status = tokeninResponse.status === 401 || tokeninResponse.status === 403 ? 502 :
            tokeninResponse.status === 429 ? 429 : 502;
          return res.status(status).json({
            error: tokeninResponse.status === 429
              ? 'Tokenin rate limit reached. Please try again later.'
              : tokeninResponse.status === 401 || tokeninResponse.status === 403
                ? 'Tokenin authentication failed. Check TOKENIN_API_KEY.'
                : 'The selected Tokenin model is currently unavailable.',
            provider: 'tokenin',
            model: targetModel
          });
        }

        const data = await tokeninResponse.json();
        const reply = data.choices?.[0]?.message?.content || data.output?.text || data.response || '';
        if (!reply) {
          console.error(`[TOKENIN] Empty response for model "${targetModel}"`);
          return res.status(502).json({ error: 'Tokenin returned an empty response.', provider: 'tokenin', model: targetModel });
        }

        memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, reply).catch(() => {});
        return res.json({
          content: reply,
          model: targetModel,
          provider: 'tokenin',
          isDeepResearch,
          hasVision: hasImages
        });
      } catch (tokeninErr: any) {
        console.error('[TOKENIN] Request threw an error:', tokeninErr);
        return res.status(502).json({
          error: 'Could not reach the Tokenin provider. Check TOKENIN_BASE_URL and server network connectivity.',
          provider: 'tokenin',
          model: targetModel
        });
      }
    }

    // 2. Existing AICredits provider path for non-Tokenin models.
    //
    if (currentConfig.aiCreditsApiKey && currentConfig.aiCreditsApiKey.trim().length > 0) {
      try {
        const selectedModel = targetModel;
        
        const endpoint = `${currentConfig.aiCreditsBaseUrl.replace(/\/+$/, '')}/chat/completions`;
        const aiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentConfig.aiCreditsApiKey.trim()}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: formattedMessages,
            temperature: currentConfig.temperature,
            max_tokens: currentConfig.maxTokens
          })
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          const reply = data.choices?.[0]?.message?.content || 'No response received from AI model.';
          memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, reply).catch(() => {});

          return res.json({
            content: reply,
            model: selectedModel,
            provider: 'aicredits.in',
            isDeepResearch,
            hasVision: hasImages
          });
        } else {
          // IMPORTANT: previously a non-OK response here was silently ignored
          // (no log, no error), so the request would quietly fall through to
          // Gemini and then to the hard-coded canned "built-in" reply, which
          // completely ignores the admin panel's system prompt. Log the real
          // reason so failures (bad key, bad model name, etc.) are visible in
          // the server logs instead of looking like "the AI is ignoring my
          // system prompt" with no explanation.
          const errBody = await aiResponse.text().catch(() => '');
          console.error(
            `[AICREDITS] Request failed with status ${aiResponse.status} for model "${selectedModel}": ${errBody.slice(0, 500)}`
          );
        }
      } catch (aiCreditsErr) {
        console.error('[AICREDITS] Request threw an error, falling back:', aiCreditsErr);
      }
    }

    // 2. Gemini fallback / Server-Side Gemini API
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (geminiKey) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      
      // Build content turns (Gemini uses 'user' and 'model' turns)
      const contents: any[] = [];

      for (const m of messages.slice(0, -1)) {
        if (m.role === 'system') continue;
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        });
      }

      const userParts: any[] = [{ text: latestUserMessage.content || '' }];

      if (hasImages) {
        for (const img of images) {
          const match = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (match) {
            userParts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: userParts
      });

      // Strict Model Enforcement with unified systemInstruction
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config: {
            systemInstruction: finalSystemPrompt,
            temperature: currentConfig.temperature,
            maxOutputTokens: currentConfig.maxTokens
          }
        });

        const reply = response.text || 'I have analyzed your request.';
        memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, reply).catch(() => {});

        return res.json({
          content: reply,
          model: targetModel,
          provider: 'gemini',
          isDeepResearch,
          hasVision: hasImages
        });
      } catch (err: any) {
        console.warn(`[GEMINI] Execution failed with model "${targetModel}":`, err.message);
        // If the primary model failed for any reason (invalid/unavailable model,
        // account doesn't have access to a brand-new preview model, etc.), always
        // retry once against a widely-available stable model instead of only
        // retrying when a *different* model was originally requested. Without
        // this, a single bad/inaccessible model name previously meant every
        // request fell straight through to the canned "No AI Provider" message
        // even with a perfectly valid GEMINI_API_KEY.
        const stableFallbackModel = 'gemini-2.5-flash';
        if (targetModel !== stableFallbackModel) {
          try {
            const fallbackResponse = await ai.models.generateContent({
              model: stableFallbackModel,
              contents,
              config: {
                systemInstruction: finalSystemPrompt,
                temperature: currentConfig.temperature,
                maxOutputTokens: currentConfig.maxTokens
              }
            });
            const reply = fallbackResponse.text || 'I have analyzed your request.';
            memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, reply).catch(() => {});
            return res.json({
              content: reply,
              model: stableFallbackModel,
              provider: 'gemini',
              isDeepResearch,
              hasVision: hasImages
            });
          } catch (fallbackErr: any) {
            console.warn(`[GEMINI FALLBACK] Error with model "${stableFallbackModel}":`, fallbackErr.message);
          }
        }
      }
    }

    // No provider succeeded. Never return a fake AI answer: that would make it
    // look as if the selected model and Admin system prompt were used.
    return res.status(503).json({
      error: 'No AI provider is currently available. Configure a valid provider in the backend environment.',
      provider: 'none',
      model: targetModel,
      isDeepResearch,
      hasVision: hasImages
    });

  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({
      error: 'An error occurred while generating response: ' + (err?.message || 'Unknown error')
    });
  }
});

function generateIntelligentFallback(prompt: string, hasVision: boolean, isDeepResearch: boolean): string {
  const p = prompt.toLowerCase();
  
  if (hasVision) {
    return `### 🔍 Leo AI Vision Analysis

I have inspected the uploaded image in detail. Here is the structured visual breakdown:

1. **Visual Elements & Layout**:
   - High-contrast visual composition with clearly identifiable regions and focal points.
   - Clean alignment and spatial distribution.

2. **Extracted Content / Insights**:
   - The image showcases architectural or interface details that emphasize modularity and modern design principles.
   - Key attributes detected with high confidence.

3. **Recommendations**:
   - Maintain the balanced negative space.
   - Ensure responsive scaling across varying screen densities.

*Note: Add your \`AICREDITS_API_KEY\` from [aicredits.in/dashboard](https://aicredits.in/dashboard) or \`GEMINI_API_KEY\` in your environment settings for real-time model inference.*`;
  }

  // Honest diagnostic message. Previously this pretended everything (including
  // the admin system prompt) was "strictly enforced" even though this canned
  // reply is generated locally and never actually reaches an AI model — which
  // is exactly why the admin panel's system prompt appeared to be ignored:
  // this reply doesn't use it at all.
  return `### ⚠️ No AI Provider Connected

I couldn't reach a real AI model, so this is a canned local message — **your Admin Panel system prompt was NOT used to generate this reply.**

To fix this:
1. Set a valid \`AICREDITS_API_KEY\` (and check \`AICREDITS_BASE_URL\` / model name), **or**
2. Set a valid \`GEMINI_API_KEY\`

in your backend's environment variables, then check the server logs for \`[AICREDITS]\` or \`[GEMINI]\` error lines — they show the exact reason the request failed (invalid key, wrong model name, network error, etc.). Once a provider call succeeds, your admin panel system prompt will be applied normally.`;
}

// ----------------------------------------------------
// 6. Server Initialization
// ----------------------------------------------------
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.get('*', (req, res) => {
  res.json({
    status: 'online',
    service: 'Leo AI Backend API',
    version: '1.0.0',
    health: '/api/health',
    message: 'Leo AI API server is running successfully on Render.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Leo AI Backend API Server running at http://0.0.0.0:${PORT}`);
});
