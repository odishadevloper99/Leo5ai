import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { memoService } from './services/memoService';
import { runAgentLoop, AVAILABLE_TOOLS, AgentStep, AgentEvent, MAX_AGENT_ITERATIONS } from './services/agentService';
import { executeDaytonaCommand } from './services/daytonaService';

dotenv.config();

// Server-wide override for how many agent tool-call iterations a single
// chat turn may run before being force-summarized. Falls back to the
// agentService default if unset or invalid.
const MAX_AGENT_ITERATIONS_CONFIGURED = (() => {
  const raw = parseInt(process.env.MAX_AGENT_ITERATIONS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : MAX_AGENT_ITERATIONS;
})();

// ----------------------------------------------------------------------
// Model capability heuristic (MODE A vs MODE B selection)
// ----------------------------------------------------------------------
// This is a soft, best-effort classifier used ONLY to decide whether to
// include the OpenAI-style `tools` param on the FIRST attempt for a given
// model. It is never load-bearing for correctness: callOpenAiCompatibleProvider
// already retries automatically without `tools` if a provider rejects the
// param (see its 400/422 handling below), and the agent's structured
// <tool_call> text protocol works identically either way. This heuristic
// just avoids an unnecessary failed round-trip for models that are known
// (by name pattern) to lack native function-calling support — e.g. small
// free/code-focused models frequently used with AICredits.
const NATIVE_TOOL_CALLING_PATTERNS = [
  /gpt-4/i, /gpt-3\.5/i, /gpt-5/i, /o1/i, /o3/i, /o4/i,
  /claude/i, /gemini/i, /grok/i,
  /mixtral-8x22/i, /command-r/i, /qwen2\.5/i, /qwen3/i, /llama-3\.1/i, /llama-3\.3/i,
];
const KNOWN_NO_NATIVE_TOOL_PATTERNS = [
  /deepseek-chat/i, /deepseek-coder/i, /codellama/i, /starcoder/i,
  /wizardcoder/i, /phi-/i, /tinyllama/i, /free/i,
];
function modelLikelySupportsNativeTools(model: string): boolean {
  const m = (model || '').toLowerCase();
  if (KNOWN_NO_NATIVE_TOOL_PATTERNS.some((p) => p.test(m))) return false;
  if (NATIVE_TOOL_CALLING_PATTERNS.some((p) => p.test(m))) return true;
  // Unknown model: default to attempting native tools — the automatic
  // no-tools retry on 400/422 covers the case where this guess is wrong.
  return true;
}

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

// ----------------------------------------------------
// Security Headers Middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
// ----------------------------------------------------
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking protection (allow same origin or parent container embed)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Legacy XSS filter protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Restrict referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict browser features / permissions
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');

  // Enforce HSTS over HTTPS connections
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Robust Content Security Policy allowing required assets and CDNs
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https://sdk.cashfree.com https://*.firebaseapp.com; frame-ancestors 'self' https://*.run.app https://ai.studio https://*.google.com;"
  );

  next();
});

// Cookie Parser Middleware with session secret support
app.use(cookieParser(process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || 'leo_ai_session_cookie_secret_2026'));

// Enable CORS for Vercel Frontend <-> Render Backend communication
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, x-user-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// Rate Limiting Infrastructures
// ----------------------------------------------------
interface LoginRateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}
const loginRateLimitMap = new Map<string, LoginRateLimitEntry>();

function checkLoginRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

  const entry = loginRateLimitMap.get(ip);
  if (!entry) {
    return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Check if currently locked out
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000)
    };
  }

  // Reset window if expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    loginRateLimitMap.delete(ip);
    return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOCKOUT_MS;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000)
    };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.attempts, retryAfterSeconds: 0 };
}

function recordLoginAttempt(ip: string, success: boolean) {
  if (success) {
    loginRateLimitMap.delete(ip);
    return;
  }
  const now = Date.now();
  const entry = loginRateLimitMap.get(ip) || { attempts: 0, firstAttempt: now };
  entry.attempts += 1;
  loginRateLimitMap.set(ip, entry);
}

// AI Endpoint burst rate limiting: Token bucket per user / IP (30 reqs max burst, 0.5 reqs/sec refill)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}
const aiRateLimitMap = new Map<string, TokenBucket>();

function checkAiEndpointRateLimit(key: string): { allowed: boolean; retryAfterMs: number; remaining: number } {
  const now = Date.now();
  const CAPACITY = 30; // Max burst capacity
  const REFILL_RATE = 0.5; // 30 reqs per minute sustained

  let bucket = aiRateLimitMap.get(key);
  if (!bucket) {
    bucket = { tokens: CAPACITY - 1, lastRefill: now };
    aiRateLimitMap.set(key, bucket);
    return { allowed: true, retryAfterMs: 0, remaining: CAPACITY - 1 };
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterMs: 0, remaining: Math.floor(bucket.tokens) };
  }

  const waitSeconds = (1 - bucket.tokens) / REFILL_RATE;
  return { allowed: false, retryAfterMs: Math.ceil(waitSeconds * 1000), remaining: 0 };
}

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
  dailyMessageLimitOverride?: number;
  dailyMessageCount?: number;
  dailyUsage?: {
    date: string;
    count: number;
    limit: number;
  };
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: number;
  premiumUntil?: number;
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

// System AI Configuration (Configurable via Render Environment Variables and Admin Panel)
let currentConfig = {
  // 1. DEFAULT MODEL: Primary model configured via Render environment variables
  defaultAiModel: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    process.env.MODEL_NAME ||
    process.env.MODEL_ID ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),

  // 2. VISION MODEL: Vision model configured via Render environment variables
  visionAiModel: (
    process.env.VISION_AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL ||
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),

  // 3. CODE MODEL: Code model configured via Render environment variables
  codeAiModel: (
    process.env.CODE_AI_MODEL ||
    process.env.AICREDITS_CODE_MODEL ||
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),

  // Legacy / Compatibility aliases
  activeModelId: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    process.env.MODEL_NAME ||
    process.env.MODEL_ID ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  aiCreditsApiKey: process.env.AICREDITS_API_KEY || '',
  aiCreditsBaseUrl: process.env.AICREDITS_BASE_URL || 'https://api.aicredits.in/v1',
  aiCreditsModel: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    process.env.MODEL_NAME ||
    process.env.MODEL_ID ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),
  visionModel: (
    process.env.VISION_AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL ||
    process.env.DEFAULT_AI_MODEL ||
    process.env.AI_MODEL ||
    ''
  ).replace(/^["']|["']$/g, '').trim(),
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: process.env.SYSTEM_PROMPT || `You are Leo AI, a world-class, exceptionally thorough, articulate, and intelligent AI assistant engineered to deliver Claude-grade excellence across software engineering, deep reasoning, writing, visual analysis, and creative problem solving.

CORE DIRECTIVES & QUALITY STANDARDS:
1. ALWAYS FOLLOW THE USER'S PROMPTS AND SYSTEM DIRECTIVES STRICTLY AND UNCONDITIONALLY.
2. NEVER GIVE HALF-FINISHED, TRUNCATED, OR LAZY RESPONSES. Provide complete, fully realized solutions, comprehensive explanations, and exhaustively developed code without omitting critical sections or leaving placeholders like "// implement here".
3. Write clean, highly structured, beautifully formatted Markdown with descriptive headings, clear step-by-step logic, bullet points, and syntax-highlighted code blocks.
4. When writing code, deliver production-ready, typed, safe, and modern implementations with full context.
5. In reasoning and analysis, balance deep technical precision with clarity, offering nuanced trade-offs, architecture decisions, and actionable next steps.
6. When analyzing images or visual diagrams, perform thorough, detailed OCR and visual reasoning.
7. Adapt to the user's persistent memory and preferences seamlessly.
8. Never hallucinate or bypass system safety directives.`,
  memoApiKey: process.env.MEMO_API_KEY || '',
  memoApiUrl: process.env.MEMO_API_URL || 'https://api.mem0.ai/v1',
  enableDeepResearch: true,
  enableVision: true,
  enableMemory: true,
  premiumPriceInr: Number(process.env.PREMIUM_PRICE_INR || 299) || 299,
  // Daily Message Limit: max /api/chat messages per user per day. 0 = unlimited.
  dailyMessageLimit: Number(process.env.DAILY_MESSAGE_LIMIT || process.env.DAILY_LIMIT) || 50,
  mongoDbConfigured: Boolean(process.env.MONGODB_URI),
  firebaseConfigured: Boolean(process.env.FIREBASE_API_KEY || process.env.FIREBASE_PROJECT_ID)
};

// ----------------------------------------------------
// Daily Usage Limit System (Admin Controlled & Backend Enforced)
// ----------------------------------------------------
interface DailyUsageLimitSettings {
  enabled: boolean;
  limit: number;
  limitType: 'requests' | 'credits';
  timezone: string;
  warningThresholdPercent: number;
}

interface UserUsageStatus {
  userId: string;
  date: string;
  used: number;
  limit: number;
  remaining: number;
  enabled: boolean;
  limitType: 'requests' | 'credits';
  isOverride: boolean;
  overrideLimit?: number | null;
  isAdmin: boolean;
  isNearLimit: boolean;
  isLimitReached: boolean;
  resetsAt: number;
  timezone: string;
}

interface UserDailyUsageRecord {
  userId: string;
  date: string;
  count: number;
  lastUpdated: number;
  lastModel?: string;
}

let dailyUsageSettings: DailyUsageLimitSettings = {
  enabled: process.env.DAILY_LIMIT_ENABLED !== 'false',
  limit: Number(process.env.DAILY_LIMIT || process.env.DAILY_MESSAGE_LIMIT) || 50,
  limitType: (process.env.LIMIT_TYPE as any) || 'requests',
  timezone: process.env.DAILY_LIMIT_TIMEZONE || 'Asia/Kolkata',
  warningThresholdPercent: 80
};

// Ensure currentConfig.dailyMessageLimit reflects the initial limit
currentConfig.dailyMessageLimit = dailyUsageSettings.limit;

// In-memory atomic usage registry: `${userId}_${dateKey}` -> record
const userDailyUsageMap: Map<string, UserDailyUsageRecord> = new Map();
// Concurrency serialization lock per user
const userUsageLocks: Map<string, Promise<void>> = new Map();

function getDateKey(tz: string = dailyUsageSettings.timezone || 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); // Outputs YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getNextResetTimestamp(tz: string = dailyUsageSettings.timezone || 'Asia/Kolkata'): number {
  try {
    const now = new Date();
    // Calculate tomorrow's date in target timezone
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(tomorrow);

    // Midnight timestamp of next day
    const nextMidnightUtc = new Date(`${tomorrowStr}T00:00:00.000Z`).getTime();
    return nextMidnightUtc;
  } catch {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow.getTime();
  }
}

function getUserUsageStatus(userId: string, isCallerAdmin = false): UserUsageStatus {
  const date = getDateKey();
  const cacheKey = `${userId}_${date}`;
  const record = userDailyUsageMap.get(cacheKey);
  const used = record ? record.count : 0;

  const user = userStore.get(userId);
  const isAdmin = isCallerAdmin || user?.role === 'admin';
  const hasOverride = typeof user?.dailyMessageLimitOverride === 'number';
  const overrideLimit = hasOverride ? user!.dailyMessageLimitOverride : null;

  let effectiveLimit = dailyUsageSettings.limit;
  if (isAdmin) {
    effectiveLimit = 0; // 0 implies unlimited
  } else if (hasOverride && overrideLimit !== null) {
    effectiveLimit = Math.max(0, overrideLimit);
  } else if (!dailyUsageSettings.enabled) {
    effectiveLimit = 0; // unlimited when global toggle is OFF
  }

  const isUnlimited = isAdmin || !dailyUsageSettings.enabled || effectiveLimit <= 0;
  const remaining = isUnlimited ? 999999 : Math.max(0, effectiveLimit - used);
  const isLimitReached = !isUnlimited && used >= effectiveLimit;
  const warningPct = dailyUsageSettings.warningThresholdPercent || 80;
  const isNearLimit = !isUnlimited && !isLimitReached && (used / effectiveLimit) >= (warningPct / 100);

  return {
    userId,
    date,
    used,
    limit: isUnlimited ? 0 : effectiveLimit,
    remaining,
    enabled: dailyUsageSettings.enabled,
    limitType: dailyUsageSettings.limitType,
    isOverride: hasOverride,
    overrideLimit,
    isAdmin,
    isNearLimit,
    isLimitReached,
    resetsAt: getNextResetTimestamp(),
    timezone: dailyUsageSettings.timezone || 'Asia/Kolkata'
  };
}

async function checkAndIncrementDailyUsage(
  userId: string,
  isCallerAdmin = false,
  cost = 1,
  modelUsed = ''
): Promise<{ allowed: boolean; status: UserUsageStatus }> {
  // Concurrency serialization lock per user to avoid race conditions
  const currentLock = userUsageLocks.get(userId) || Promise.resolve();
  let releaseLock: () => void = () => {};
  const nextLock = new Promise<void>((resolve) => { releaseLock = resolve; });
  userUsageLocks.set(userId, nextLock);

  await currentLock;

  try {
    const statusBefore = getUserUsageStatus(userId, isCallerAdmin);

    // If limit is active and reached, reject request
    if (statusBefore.isLimitReached) {
      return { allowed: false, status: statusBefore };
    }

    // Register increment
    const date = getDateKey();
    const cacheKey = `${userId}_${date}`;
    const existing = userDailyUsageMap.get(cacheKey);
    const newCount = (existing ? existing.count : 0) + cost;
    const now = Date.now();

    const record: UserDailyUsageRecord = {
      userId,
      date,
      count: newCount,
      lastUpdated: now,
      lastModel: modelUsed
    };

    userDailyUsageMap.set(cacheKey, record);

    // Update in-memory user record
    const user = userStore.get(userId);
    if (user) {
      user.dailyMessageCount = newCount;
      user.dailyUsage = {
        date,
        count: newCount,
        limit: statusBefore.limit
      };
      user.lastActive = now;
      userStore.set(userId, user);
    }

    // Asynchronously persist to Firebase RTDB for durable tracking
    setRtdbData(`usage_daily/${date}/${userId}`, record).catch(() => {});
    if (user) {
      setRtdbData(`users/${userId}/dailyUsage`, {
        date,
        count: newCount,
        limit: statusBefore.limit,
        updatedAt: now
      }).catch(() => {});
    }

    const statusAfter = getUserUsageStatus(userId, isCallerAdmin);
    return { allowed: true, status: statusAfter };
  } finally {
    releaseLock();
  }
}

async function resetUserDailyUsage(userId: string): Promise<UserUsageStatus> {
  const date = getDateKey();
  const cacheKey = `${userId}_${date}`;
  userDailyUsageMap.delete(cacheKey);

  const user = userStore.get(userId);
  if (user) {
    user.dailyMessageCount = 0;
    user.dailyUsage = {
      date,
      count: 0,
      limit: effectiveDailyLimit(userId)
    };
    userStore.set(userId, user);
  }

  await deleteRtdbData(`usage_daily/${date}/${userId}`);
  if (user) {
    await setRtdbData(`users/${userId}/dailyUsage`, {
      date,
      count: 0,
      limit: effectiveDailyLimit(userId),
      updatedAt: Date.now()
    });
  }

  return getUserUsageStatus(userId, false);
}

async function resetAllDailyUsage(): Promise<number> {
  const date = getDateKey();
  let count = 0;
  for (const [key, val] of userDailyUsageMap.entries()) {
    if (val.date === date) {
      userDailyUsageMap.delete(key);
      count++;
    }
  }

  for (const [uid, user] of userStore.entries()) {
    user.dailyMessageCount = 0;
    if (user.dailyUsage) {
      user.dailyUsage.count = 0;
    }
    userStore.set(uid, user);
  }

  await deleteRtdbData(`usage_daily/${date}`);
  return count;
}

function effectiveDailyLimit(userId: string): number {
  const user = userStore.get(userId);
  if (typeof user?.dailyMessageLimitOverride === 'number') return Math.max(0, user.dailyMessageLimitOverride);
  return dailyUsageSettings.enabled ? dailyUsageSettings.limit : 0;
}

function userHasActivePremium(userId: string): boolean {
  const user = userStore.get(userId);
  if (!user) return false;
  if (user.role === 'admin') return true;
  const plan = String(user.plan || 'free').toLowerCase();
  const premiumUntil = Number((user as any).premiumUntil || user.subscriptionExpiresAt || 0);
  if (premiumUntil && premiumUntil <= Date.now()) return false;
  return ['admin', 'premium', 'pro', 'ultra'].includes(plan) || user.subscriptionActive === true;
}

interface OpenRouterRawModel {
  id: string;
  name?: string;
  description?: string;
  pricing?: { prompt?: string | number; completion?: string | number };
  context_length?: number;
}

let openRouterFreeModelCache: { ids: Set<string>; models: EnrichedAIModel[]; lastUpdated: number } | null = null;
let isFetchingOpenRouterModels = false;

function isZeroPrice(value: any): boolean {
  if (value === 0) return true;
  if (typeof value === 'string' && value.trim() !== '') return Number(value) === 0;
  return false;
}

async function fetchOpenRouterFreeModels(forceRefresh = false): Promise<{ ids: Set<string>; models: EnrichedAIModel[]; lastUpdated: number }> {
  const now = Date.now();
  if (!forceRefresh && openRouterFreeModelCache && now - openRouterFreeModelCache.lastUpdated < 10 * 60 * 1000) return openRouterFreeModelCache;
  if (isFetchingOpenRouterModels && openRouterFreeModelCache) return openRouterFreeModelCache;
  isFetchingOpenRouterModels = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OpenRouter models API returned HTTP ${res.status}`);
    const data: any = await res.json();
    const rawList: OpenRouterRawModel[] = Array.isArray(data) ? data : (data?.data || []);
    const freeRaw = rawList.filter(m => m?.id && isZeroPrice(m.pricing?.prompt) && isZeroPrice(m.pricing?.completion));
    const models = freeRaw.map((m) => {
      const { company, iconKey } = detectCompanyAndIcon(m.id, m.name || m.id);
      return {
        id: m.id,
        name: m.name || m.id,
        company,
        category: detectCategory(m.id, m.name || m.id),
        description: m.description || `Free OpenRouter model from ${company}.`,
        badges: ['Free'],
        iconKey,
        provider: 'openrouter' as const,
        tier: 'standard' as const,
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        totalCostPer1M: 0,
        contextLength: m.context_length
      };
    });
    openRouterFreeModelCache = { ids: new Set(models.map(m => m.id)), models, lastUpdated: Date.now() };
    return openRouterFreeModelCache;
  } finally {
    isFetchingOpenRouterModels = false;
  }
}

async function validateOpenRouterFreeModel(model: string): Promise<boolean> {
  if (!model || !model.trim()) return false;
  try {
    const data = await fetchOpenRouterFreeModels();
    return data.ids.has(model.trim());
  } catch (err: any) {
    console.warn('[OPENROUTER] Could not validate free model metadata:', err?.message || err);
    return false;
  }
}

// ----------------------------------------------------
// Dynamic AICredits Model Discovery & Cost Optimization Engine
// ----------------------------------------------------
interface AICreditsRawModel {
  id: string;
  name: string;
  description?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cached_input_cost_per_token?: number;
  input_cost_per_1m?: number;
  output_cost_per_1m?: number;
  context_length?: number;
  is_active?: boolean;
  is_free?: boolean;
  short_name?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  tags?: string[];
}

export interface EnrichedAIModel {
  id: string;
  name: string;
  company: string;
  category: 'text' | 'vision' | 'reasoning' | 'coding';
  description: string;
  badges: string[];
  iconKey: string;
  provider: 'aicredits' | 'openrouter' | 'gemini';
  isNew?: boolean;
  tier: 'cheap' | 'quality' | 'standard';
  inputCostPer1M: number;
  outputCostPer1M: number;
  totalCostPer1M: number;
  isDefault?: boolean;
  contextLength?: number;
}

let dynamicModelsCache: {
  models: EnrichedAIModel[];
  cheapCandidates: EnrichedAIModel[];
  qualityCandidates: EnrichedAIModel[];
  defaultModel: string;
  fallbackChain: string[];
  lastUpdated: number;
} | null = null;

let isFetchingDynamicModels = false;

function detectCompanyAndIcon(id: string, name: string): { company: string; iconKey: string } {
  const lowerId = id.toLowerCase();
  const lowerName = name.toLowerCase();

  if (lowerId.startsWith('openai/') || lowerName.includes('openai') || lowerName.includes('gpt-') || lowerName.includes('o1-') || lowerName.includes('o3-')) {
    return { company: 'OpenAI', iconKey: 'openai' };
  }
  if (lowerId.startsWith('deepseek/') || lowerName.includes('deepseek')) {
    return { company: 'DeepSeek', iconKey: 'deepseek' };
  }
  if (lowerId.includes('gemma')) {
    return { company: 'Google', iconKey: 'gemma' };
  }
  if (lowerId.startsWith('google/') || lowerName.includes('gemini') || lowerName.includes('google')) {
    return { company: 'Google', iconKey: 'gemini' };
  }
  if (lowerId.startsWith('anthropic/') || lowerName.includes('claude') || lowerName.includes('anthropic')) {
    return { company: 'Anthropic', iconKey: 'claude' };
  }
  if (lowerId.startsWith('mistral') || lowerName.includes('mistral') || lowerName.includes('codestral') || lowerName.includes('pixtral')) {
    return { company: 'Mistral AI', iconKey: 'mistral' };
  }
  if (lowerId.startsWith('meta/') || lowerId.startsWith('meta-llama/') || lowerName.includes('llama')) {
    return { company: 'Meta', iconKey: 'meta' };
  }
  if (lowerId.startsWith('qwen/') || lowerId.startsWith('alibaba/') || lowerName.includes('qwen')) {
    return { company: 'Alibaba Cloud', iconKey: 'qwen' };
  }
  if (lowerId.startsWith('x-ai/') || lowerName.includes('grok') || lowerName.includes('xai')) {
    return { company: 'xAI', iconKey: 'grok' };
  }
  if (lowerId.startsWith('moonshot/') || lowerName.includes('kimi')) {
    return { company: 'Moonshot AI', iconKey: 'kimi' };
  }
  if (lowerId.includes('perplexity') || lowerName.includes('sonar')) {
    return { company: 'Perplexity AI', iconKey: 'perplexity' };
  }
  if (lowerId.includes('copilot') || lowerId.includes('github/')) {
    return { company: 'GitHub', iconKey: 'copilot' };
  }
  if (lowerId.startsWith('groq/') || lowerName.includes('groq')) {
    return { company: 'Groq', iconKey: 'groq' };
  }
  if (lowerId.startsWith('cohere/') || lowerName.includes('cohere') || lowerName.includes('command-r')) {
    return { company: 'Cohere', iconKey: 'cohere' };
  }
  if (lowerId.includes('sora')) {
    return { company: 'OpenAI', iconKey: 'sora' };
  }
  if (lowerId.includes('dall-e') || lowerName.includes('dalle')) {
    return { company: 'OpenAI', iconKey: 'dalle' };
  }
  if (lowerId.includes('flux') || lowerId.includes('black-forest')) {
    return { company: 'Black Forest Labs', iconKey: 'flux' };
  }
  if (lowerId.includes('huggingface') || lowerId.startsWith('hf/')) {
    return { company: 'Hugging Face', iconKey: 'huggingface' };
  }
  if (lowerId.includes('ollama')) {
    return { company: 'Ollama', iconKey: 'ollama' };
  }
  if (lowerId.includes('midjourney')) {
    return { company: 'Midjourney', iconKey: 'midjourney' };
  }
  if (lowerId.includes('kling')) {
    return { company: 'Kling', iconKey: 'kling' };
  }
  if (lowerId.includes('minimax') || lowerName.includes('abab')) {
    return { company: 'MiniMax', iconKey: 'minimax' };
  }
  if (lowerId.startsWith('yi/') || lowerId.includes('01-ai') || lowerName.includes('yi-')) {
    return { company: '01.AI', iconKey: 'yi' };
  }
  if (lowerId.includes('rwkv')) {
    return { company: 'RWKV', iconKey: 'rwkv' };
  }
  if (lowerId.includes('phind')) {
    return { company: 'Phind', iconKey: 'phind' };
  }
  if (lowerId.includes('elevenlabs') || lowerName.includes('eleven')) {
    return { company: 'ElevenLabs', iconKey: 'elevenlabs' };
  }
  if (lowerId.startsWith('z-ai/') || lowerName.includes('glm') || lowerName.includes('zhipu') || lowerName.includes('chatglm')) {
    return { company: 'Zhipu AI', iconKey: 'glm' };
  }

  const prefix = id.split('/')[0];
  const formattedCompany = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'AI';
  return { company: formattedCompany, iconKey: 'gemini' };
}

function detectCategory(id: string, name: string, inputModalities: string[] = []): 'text' | 'vision' | 'reasoning' | 'coding' {
  const s = (id + ' ' + name).toLowerCase();
  if (s.includes('vision') || s.includes('pixtral') || s.includes('4o') || inputModalities.includes('image')) {
    return 'vision';
  }
  if (s.includes('reason') || s.includes('r1') || s.includes('think') || s.includes('pro') || s.includes('sonnet')) {
    return 'reasoning';
  }
  if (s.includes('code') || s.includes('coder') || s.includes('devstral')) {
    return 'coding';
  }
  return 'text';
}

async function fetchDynamicAiCreditsModels(forceRefresh = false): Promise<{
  models: EnrichedAIModel[];
  cheapCandidates: EnrichedAIModel[];
  qualityCandidates: EnrichedAIModel[];
  defaultModel: string;
  fallbackChain: string[];
  lastUpdated: number;
}> {
  const now = Date.now();
  // Cache for 10 minutes
  if (!forceRefresh && dynamicModelsCache && (now - dynamicModelsCache.lastUpdated < 10 * 60 * 1000)) {
    return dynamicModelsCache;
  }

  if (isFetchingDynamicModels && dynamicModelsCache) {
    return dynamicModelsCache;
  }

  isFetchingDynamicModels = true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://api.aicredits.in/api/models', {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`AICredits models API returned HTTP ${res.status}`);
    }

    const rawData: any = await res.json();
    const rawList: AICreditsRawModel[] = Array.isArray(rawData) ? rawData : (rawData?.data || []);

    // Filter strictly to models returned by the API that are active
    const activeModels = rawList.filter((m) => m && typeof m.id === 'string' && m.is_active !== false);

    // Enrich models with cost calculations
    const enrichedList: EnrichedAIModel[] = activeModels.map((m) => {
      const inputCostPer1M = typeof m.input_cost_per_1m === 'number'
        ? m.input_cost_per_1m
        : typeof m.input_cost_per_token === 'number'
        ? m.input_cost_per_token * 1_000_000
        : 0;

      const outputCostPer1M = typeof m.output_cost_per_1m === 'number'
        ? m.output_cost_per_1m
        : typeof m.output_cost_per_token === 'number'
        ? m.output_cost_per_token * 1_000_000
        : 0;

      const totalCostPer1M = inputCostPer1M + outputCostPer1M;
      const { company, iconKey } = detectCompanyAndIcon(m.id, m.name || m.id);
      const category = detectCategory(m.id, m.name || m.id, m.input_modalities || []);

      const badges: string[] = [];
      if (m.input_modalities?.includes('image') || m.id.includes('vision') || m.id.includes('4o')) {
        badges.push('Vision');
      }
      if (category === 'reasoning') badges.push('Reasoning');
      if (category === 'coding') badges.push('Code');
      if (totalCostPer1M > 0 && totalCostPer1M <= 1.0) badges.push('Budget-Friendly');
      if (totalCostPer1M >= 10.0) badges.push('High-Precision');

      let tier: 'cheap' | 'quality' | 'standard' = 'standard';
      if (totalCostPer1M > 0 && totalCostPer1M <= 1.0) {
        tier = 'cheap';
      } else if (totalCostPer1M >= 10.0) {
        tier = 'quality';
      }

      return {
        id: m.id,
        name: m.short_name || m.name || m.id,
        company,
        category,
        description: m.description || `High-performance multimodal model from ${company}.`,
        badges,
        iconKey,
        provider: 'aicredits',
        tier,
        inputCostPer1M: Math.round(inputCostPer1M * 1000) / 1000,
        outputCostPer1M: Math.round(outputCostPer1M * 1000) / 1000,
        totalCostPer1M: Math.round(totalCostPer1M * 1000) / 1000,
        contextLength: m.context_length
      };
    });

    const configuredDefault = (
      process.env.DEFAULT_AI_MODEL ||
      process.env.AI_MODEL ||
      process.env.MODEL_NAME ||
        process.env.MODEL_ID ||
      process.env.ACTIVE_MODEL_ID ||
      process.env.AICREDITS_MODEL ||
      currentConfig.defaultAiModel ||
      ''
    ).replace(/^["']|["']$/g, '').trim();

    let defaultModel = configuredDefault;
    if (!defaultModel && enrichedList.length > 0) {
      defaultModel = enrichedList[0].id;
    }

    const fallbackChain: string[] = defaultModel ? [defaultModel] : [];

    // Mark isDefault on the chosen default model
    enrichedList.forEach((m) => {
      m.isDefault = m.id === defaultModel;
    });

    dynamicModelsCache = {
      models: enrichedList,
      cheapCandidates: [],
      qualityCandidates: [],
      defaultModel,
      fallbackChain,
      lastUpdated: Date.now()
    };

    console.log(
      `[DYNAMIC MODELS] Loaded ${enrichedList.length} models. ` +
      `Active Model: "${defaultModel || 'None (Awaiting Render Env Var)'}".`
    );

    return dynamicModelsCache;
  } catch (err: any) {
    console.warn('[DYNAMIC MODELS] Could not fetch fresh models:', err.message);
    if (dynamicModelsCache) {
      return dynamicModelsCache;
    }

    const configuredDefault = (
      process.env.DEFAULT_AI_MODEL ||
      process.env.AI_MODEL ||
      process.env.MODEL_NAME ||
        process.env.MODEL_ID ||
      process.env.ACTIVE_MODEL_ID ||
      process.env.AICREDITS_MODEL ||
      currentConfig.defaultAiModel ||
      ''
    ).replace(/^["']|["']$/g, '').trim();

    const fallbackResult = {
      models: configuredDefault ? [
        {
          id: configuredDefault,
          name: configuredDefault,
          company: 'Configured Engine',
          category: 'text' as const,
          description: 'Model configured via Render environment variables.',
          badges: ['Active'],
          iconKey: 'gemini',
          provider: 'aicredits' as const,
          tier: 'standard' as const,
          inputCostPer1M: 0,
          outputCostPer1M: 0,
          totalCostPer1M: 0,
          isDefault: true
        }
      ] : [],
      cheapCandidates: [],
      qualityCandidates: [],
      defaultModel: configuredDefault,
      fallbackChain: configuredDefault ? [configuredDefault] : [],
      lastUpdated: Date.now()
    };
    return fallbackResult;
  } finally {
    isFetchingDynamicModels = false;
  }
}

// Initial fetch on server start
fetchDynamicAiCreditsModels().catch(() => {});

// ============================================================================
// AIModelRouter - Smart AI Model Routing Service
// Enforces intelligent routing across:
// 1. VISION MODEL (Image requests) -> Verified vision-capable model
// 2. CODE MODEL (Programming requests) -> Technical coding/reasoning model
// 3. DEFAULT MODEL (Normal text) -> General conversation & text model
// ============================================================================

export interface AIModelRouterRequest {
  messages: any[];
  images?: any[];
  prompt?: string;
  requestedModel?: string;
}

export interface RoutedAIRequest {
  inputType: 'vision' | 'code' | 'text';
  selectedModel: string;
  configuredModel: string;
  isFallback: boolean;
  fallbackReason?: string;
  candidates: string[];
}

export const AIModelRouter = {
  /**
   * Detects if the request contains image/visual inputs across:
   * - Uploaded images array (base64 or URLs)
   * - Multimodal message content parts (type: 'image_url' or type: 'image')
   * - Inline base64 data URIs (data:image/...)
   * - Direct image URLs
   */
  isImageRequest(req: { messages?: any[]; images?: any[]; prompt?: string }): boolean {
    if (Array.isArray(req.images) && req.images.length > 0) {
      return true;
    }
    if (Array.isArray(req.messages)) {
      for (const m of req.messages) {
        if (Array.isArray(m?.images) && m.images.length > 0) return true;
        if (Array.isArray(m?.content)) {
          for (const part of m.content) {
            if (part?.type === 'image_url' || part?.type === 'image' || part?.image_url) return true;
          }
        } else if (typeof m?.content === 'string') {
          if (m.content.includes('data:image/')) return true;
        }
      }
    }
    if (typeof req.prompt === 'string' && req.prompt.includes('data:image/')) {
      return true;
    }
    return false;
  },

  /**
   * Detects if the request is clearly coding/technical development related.
   * Matches code blocks, programming questions, bug fixes, refactoring, API integration, etc.
   */
  isCodingRequest(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;

    // 1. Markdown code fences or inline backtick blocks
    if (/```[a-zA-Z0-9_-]*[\s\S]*?```/.test(trimmed) || /`[^`\n]{3,}`/.test(trimmed)) {
      return true;
    }

    // 2. Explicit coding intent verbs & phrases
    const codingIntentRegex = /\b(?:write\s+(?:the\s+)?code|debug|fix\s+(?:this\s+)?(?:error|bug|issue|exception|crash)|refactor|explain\s+(?:this\s+|the\s+)?code|create\s+(?:a\s+)?(?:react|flutter|vue|nextjs|svelte|angular|node(?:\.js)?|express|fastapi|django|flask|spring|laravel|tailwind|typescript|python|javascript|sql|html|css|c\+\+|c#|java|rust|go|golang|bash|php)\s+(?:app|component|page|script|server|api|endpoint|service|function|database|table|query|hook|layout)|write\s+(?:a\s+)?(?:script|function|query|algorithm|unit\s+test|regex|dockerfile|makefile|cron\s+job)|implement\s+(?:a\s+)?(?:function|class|method|component|hook|endpoint|interface|schema|algorithm|auth)|code\s+(?:review|generator|snippet|challenge)|programming\s+architecture)\b/i;

    if (codingIntentRegex.test(trimmed)) {
      return true;
    }

    // 3. Technical code syntax tokens & language constructs
    const syntaxTokensRegex = /\b(?:function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|def\s+\w+\s*\(|class\s+\w+|import\s+.*?from\s+['"]|export\s+(?:default\s+)?(?:function|const|class)|public\s+static\s+void|async\s+function|SELECT\s+[\s\S]*?\s+FROM|INSERT\s+INTO|UPDATE\s+[\s\S]*?\s+SET|CREATE\s+TABLE|<\/?(?:div|span|button|input|form|template|script|style|h[1-6]|p)\b|console\.log\(|System\.out\.println\(|print\(|npm\s+install|yarn\s+add|pip\s+install|cargo\s+build|git\s+(?:commit|push|pull|merge|checkout|branch)|docker\s+run)\b/;

    if (syntaxTokensRegex.test(trimmed)) {
      return true;
    }

    // 4. Stack traces & compiler/runtime error signatures
    const stackTraceRegex = /\b(?:SyntaxError|TypeError|ReferenceError|NullPointerException|IndexOutOfBoundsException|Traceback\s+\(most\s+recent\s+call\s+last\)|Uncaught\s+Error|failed\s+to\s+compile|build\s+failed|segmentation\s+fault|npm\s+ERR!|FATAL\s+ERROR)\b/i;

    if (stackTraceRegex.test(trimmed)) {
      return true;
    }

    return false;
  },

  /**
   * Determine overall input type following strict priority:
   * 1. IMAGE -> 'vision'
   * 2. CODING -> 'code'
   * 3. NORMAL -> 'text'
   */
  detectInputType(req: { messages?: any[]; images?: any[]; prompt?: string }): 'vision' | 'code' | 'text' {
    if (this.isImageRequest(req)) {
      return 'vision';
    }

    let latestText = req.prompt || '';
    if (!latestText && Array.isArray(req.messages) && req.messages.length > 0) {
      const last = req.messages[req.messages.length - 1];
      if (typeof last?.content === 'string') {
        latestText = last.content;
      } else if (Array.isArray(last?.content)) {
        latestText = last.content
          .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
          .map((p: any) => p.text)
          .join('\n');
      }
    }

    if (this.isCodingRequest(latestText)) {
      return 'code';
    }

    return 'text';
  },

  /**
   * Returns the configured Default Model (from Render env var or Admin)
   */
  getDefaultModel(): string {
    const configured =
      process.env.DEFAULT_AI_MODEL ||
      process.env.AI_MODEL ||
      process.env.MODEL_NAME ||
        process.env.MODEL_ID ||
      process.env.ACTIVE_MODEL_ID ||
      process.env.AICREDITS_MODEL ||
      (currentConfig.defaultAiModel && currentConfig.defaultAiModel.trim()) ||
      (currentConfig.activeModelId && currentConfig.activeModelId.trim()) ||
      (currentConfig.aiCreditsModel && currentConfig.aiCreditsModel.trim()) ||
      '';
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Returns the configured Vision Model (from Render env var or Admin)
   */
  getVisionModel(): string {
    const configured =
      process.env.VISION_AI_MODEL ||
      process.env.AICREDITS_VISION_MODEL ||
      process.env.VISION_MODEL ||
      (currentConfig.visionAiModel && currentConfig.visionAiModel.trim()) ||
      (currentConfig.visionModel && currentConfig.visionModel.trim()) ||
      this.getDefaultModel();
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Returns the configured Code Model (from Render env var or Admin)
   */
  getCodeModel(): string {
    const configured =
      process.env.CODE_AI_MODEL ||
      process.env.AICREDITS_CODE_MODEL ||
      (currentConfig.codeAiModel && currentConfig.codeAiModel.trim()) ||
      this.getDefaultModel();
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Validates whether a model identifier is configured and available.
   */
  validateModel(
    modelId: string,
    _requiredModality: 'vision' | 'code' | 'text' = 'text',
    _catalog?: EnrichedAIModel[]
  ): { valid: boolean; reason?: string } {
    if (!modelId || typeof modelId !== 'string' || modelId.trim().length === 0) {
      return {
        valid: false,
        reason: 'No model configured. Please set DEFAULT_AI_MODEL or AI_MODEL in Render environment variables.'
      };
    }
    return { valid: true };
  },

  /**
   * Returns configured vision model or empty string if not configured.
   */
  selectVisionFallback(_catalog?: EnrichedAIModel[]): string {
    return this.getVisionModel();
  },

  /**
   * Returns configured code model or empty string if not configured.
   */
  selectCodeFallback(_catalog?: EnrichedAIModel[]): string {
    return this.getCodeModel();
  },

  /**
   * Returns configured default model or empty string if not configured.
   */
  selectDefaultFallback(_catalog?: EnrichedAIModel[]): string {
    return this.getDefaultModel();
  },

  /**
   * Main Router: Evaluates input, determines configured model from environment variables,
   * validates configuration, and returns the selected model and candidates.
   */
  async routeRequest(req: AIModelRouterRequest): Promise<RoutedAIRequest> {
    const inputType = this.detectInputType(req);

    // If client explicitly requested a specific concrete model
    const clientSpecifiedModel = typeof req.requestedModel === 'string' &&
      req.requestedModel.trim().length > 0 &&
      req.requestedModel.trim() !== 'default' &&
      req.requestedModel.trim() !== 'vision' &&
      req.requestedModel.trim() !== 'reasoning' &&
      req.requestedModel.trim() !== 'code'
        ? req.requestedModel.trim()
        : null;

    let configuredModel = '';
    if (inputType === 'vision') {
      configuredModel = clientSpecifiedModel || this.getVisionModel();
    } else if (inputType === 'code') {
      configuredModel = clientSpecifiedModel || this.getCodeModel();
    } else {
      configuredModel = clientSpecifiedModel || this.getDefaultModel();
    }

    const validation = this.validateModel(configuredModel, inputType);
    let selectedModel = '';
    let isFallback = false;
    let fallbackReason: string | undefined = undefined;
    const candidates: string[] = [];

    if (validation.valid && configuredModel) {
      selectedModel = configuredModel;
      candidates.push(selectedModel);
    } else {
      isFallback = true;
      fallbackReason = validation.reason || 'No model configured';
      console.warn(`[AI ROUTER] No model configured for input type "${inputType}" (${validation.reason}).`);
    }

    console.log(`[AI ROUTER] Input type: ${inputType} | Selected model: "${selectedModel}"`);

    return {
      inputType,
      selectedModel,
      configuredModel,
      isFallback,
      fallbackReason,
      candidates
    };
  }
};

// Helper to determine the default active model for admin / system inspection
function getTargetAiModel(): string {
  return AIModelRouter.getDefaultModel();
}

// GET /api/models - Returns dynamically fetched models, role routing information, and active configurations
app.get('/api/models', async (_req, res) => {
  try {
    const data = await fetchDynamicAiCreditsModels();
    const openRouterFree = await fetchOpenRouterFreeModels().catch(() => null);
    const defaultModel = AIModelRouter.getDefaultModel();
    const visionModel = AIModelRouter.getVisionModel();
    const codeModel = AIModelRouter.getCodeModel();
    res.json({
      ...data,
      models: openRouterFree?.models?.length ? openRouterFree.models : data.models,
      activeModelId: defaultModel,
      defaultAiModel: defaultModel,
      visionAiModel: visionModel,
      codeAiModel: codeModel,
      configuredActiveModel: currentConfig.defaultAiModel || currentConfig.activeModelId || currentConfig.aiCreditsModel || ''
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve available models: ' + err.message });
  }
});

// Public model-access list. It exposes only model IDs that the Admin has marked free.
app.get('/api/models/access', (_req, res) => {
  res.json({ freeOpenRouterModels: Array.from(openRouterFreeModelCache?.ids || []) });
});

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
      const savedDefaultModel = typeof savedConfig.defaultAiModel === 'string' && savedConfig.defaultAiModel.trim()
        ? savedConfig.defaultAiModel.trim()
        : typeof savedConfig.activeModelId === 'string' && savedConfig.activeModelId.trim()
        ? savedConfig.activeModelId.trim()
        : typeof savedConfig.aiCreditsModel === 'string' && savedConfig.aiCreditsModel.trim()
        ? savedConfig.aiCreditsModel.trim()
        : '';

      const savedVisionModel = typeof savedConfig.visionAiModel === 'string' && savedConfig.visionAiModel.trim()
        ? savedConfig.visionAiModel.trim()
        : typeof savedConfig.visionModel === 'string' && savedConfig.visionModel.trim()
        ? savedConfig.visionModel.trim()
        : '';

      const savedCodeModel = typeof savedConfig.codeAiModel === 'string' && savedConfig.codeAiModel.trim()
        ? savedConfig.codeAiModel.trim()
        : '';

      currentConfig = {
        ...currentConfig,
        ...savedConfig,
        // Admin-persisted model roles take precedence
        defaultAiModel: savedDefaultModel || currentConfig.defaultAiModel,
        visionAiModel: savedVisionModel || currentConfig.visionAiModel,
        codeAiModel: savedCodeModel || currentConfig.codeAiModel,
        activeModelId: savedDefaultModel || currentConfig.activeModelId,
        aiCreditsModel: savedDefaultModel || savedConfig.aiCreditsModel || currentConfig.aiCreditsModel,
        visionModel: savedVisionModel || savedConfig.visionModel || currentConfig.visionModel,
        // Always preserve Render's explicit environment variable overrides for secrets if present:
        aiCreditsApiKey: process.env.AICREDITS_API_KEY || currentConfig.aiCreditsApiKey,
      };
      if (typeof savedConfig.dailyMessageLimit === 'number') {
        dailyUsageSettings.limit = savedConfig.dailyMessageLimit;
      }
      memoService.updateConfig({
        apiKey: currentConfig.memoApiKey,
        apiUrl: currentConfig.memoApiUrl,
        isEnabled: currentConfig.enableMemory
      });
      console.log(`✓ [CONFIG] Synced model routing config from Firebase Realtime DB. Default: "${currentConfig.defaultAiModel}", Vision: "${currentConfig.visionAiModel}", Code: "${currentConfig.codeAiModel}"`);
    }

    // Sync dedicated Usage Limit settings
    const savedUsageSettings = await getRtdbData('system/usage_settings');
    if (savedUsageSettings && typeof savedUsageSettings === 'object') {
      dailyUsageSettings = {
        ...dailyUsageSettings,
        ...savedUsageSettings
      };
      currentConfig.dailyMessageLimit = dailyUsageSettings.limit;
      console.log('✓ [USAGE SETTINGS] Synced usage limits from Firebase RTDB:', dailyUsageSettings);
    }
  } catch (e: any) {
    console.warn('[CONFIG SYNC WARNING]:', e.message);
  }
}

// Initial sync on boot
syncSystemConfigFromDatabase();

// Active admin sessions & revocation map
const activeAdminTokens = new Set<string>();

// Helper to securely verify Admin Password using bcrypt or fallback environment variable
function verifyAdminPassword(candidatePassword: string): boolean {
  if (!candidatePassword || typeof candidatePassword !== 'string') return false;

  const expectedPassword = (process.env.ADMIN_PANEL_PASSWORD || process.env.ADMIN_PASSWORD || 'leo_admin_secret_pass').trim();
  const expectedHash = (process.env.ADMIN_PASSWORD_HASH || '').trim();

  // 1. Check bcrypt hash environment variable if configured
  if (expectedHash) {
    try {
      if (bcrypt.compareSync(candidatePassword, expectedHash)) return true;
    } catch (e) {}
  }

  // 2. Check if the ADMIN_PASSWORD environment variable itself is a bcrypt hash ($2a$, $2b$, $2y$)
  if (expectedPassword.startsWith('$2a$') || expectedPassword.startsWith('$2b$') || expectedPassword.startsWith('$2y$')) {
    try {
      if (bcrypt.compareSync(candidatePassword, expectedPassword)) return true;
    } catch (e) {}
  }

  // 3. Constant-time / exact string comparison fallback
  return candidatePassword.trim() === expectedPassword;
}

// Helper to check admin authorization via Cookie, Bearer header, or x-admin-token
function isAuthorizedAdmin(req: express.Request): boolean {
  // Check Cookie first (HttpOnly secure session)
  const cookieToken = req.cookies?.leo_admin_token;
  if (cookieToken && activeAdminTokens.has(cookieToken)) {
    return true;
  }

  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (activeAdminTokens.has(token)) return true;
  }

  // Check custom admin header
  const customHeaderToken = req.headers['x-admin-token'] as string;
  if (customHeaderToken && activeAdminTokens.has(customHeaderToken)) {
    return true;
  }

  return false;
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
      openrouter: Boolean(currentConfig.openRouterApiKey),
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
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';

  // 1. Rate Limiting Check (5 attempts per IP per 15 minutes)
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Please try again in ${rateLimitStatus.retryAfterSeconds} seconds.`,
      retryAfterSeconds: rateLimitStatus.retryAfterSeconds
    });
  }

  const { password } = req.body;

  // 2. Password Verification with Bcrypt Support
  if (!password || !verifyAdminPassword(password)) {
    recordLoginAttempt(clientIp, false);
    const updatedStatus = checkLoginRateLimit(clientIp);
    return res.status(401).json({
      success: false,
      message: `Invalid Admin credentials. (${updatedStatus.remaining} attempts remaining before temporary lockout).`,
      remainingAttempts: updatedStatus.remaining
    });
  }

  // Record successful login (clears failed attempts for IP)
  recordLoginAttempt(clientIp, true);

  // 3. Generate secure session token
  const token = 'admin_sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  activeAdminTokens.add(token);

  // 4. Store session in HttpOnly, Secure, SameSite cookie
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('leo_admin_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days session
  });

  res.json({
    success: true,
    token,
    message: 'Admin authentication verified successfully.'
  });
});

app.post('/api/admin/logout', (req, res) => {
  // Invalidate token server-side from Bearer header, custom header, or cookie
  const cookieToken = req.cookies?.leo_admin_token;
  if (cookieToken) {
    activeAdminTokens.delete(cookieToken);
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeAdminTokens.delete(token);
  }

  const customHeaderToken = req.headers['x-admin-token'] as string;
  if (customHeaderToken) {
    activeAdminTokens.delete(customHeaderToken);
  }

  // Clear the HttpOnly session cookie
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('leo_admin_token', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax'
  });

  res.json({ success: true, message: 'Logged out successfully. Server session invalidated.' });
});

app.get('/api/admin/config', (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  // Provider secrets (API keys) are never sent back to the client, even to an
  // authenticated admin — only booleans/model/base-url.
  const { aiCreditsApiKey, openRouterApiKey, ...safeConfig } = currentConfig;
  res.json({
    ...safeConfig,
    hasAiCreditsKey: Boolean(aiCreditsApiKey),
    hasOpenRouterKey: Boolean(openRouterApiKey),
    hasMemoKey: Boolean(currentConfig.memoApiKey),
    adminPasswordConfigured: Boolean(process.env.ADMIN_PANEL_PASSWORD || process.env.ADMIN_PASSWORD)
  });
});

app.post('/api/admin/config', async (req, res) => {
  if (!isAuthorizedAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  }

  const {
    defaultAiModel,
    visionAiModel,
    codeAiModel,
    activeModelId,
    aiCreditsBaseUrl,
    aiCreditsModel,
    visionModel,
    temperature,
    maxTokens,
    systemPrompt,
    memoApiKey,
    memoApiUrl,
    enableDeepResearch,
    enableVision,
    enableMemory,
    dailyMessageLimit
  } = req.body;

  // Provider SECRETS (aiCreditsApiKey / openRouterApiKey) are intentionally NOT
  // accepted here — they are Render-environment-only.
  if (defaultAiModel !== undefined) {
    const sanitizedDefault = String(defaultAiModel).trim();
    currentConfig.defaultAiModel = sanitizedDefault;
    currentConfig.activeModelId = sanitizedDefault;
    currentConfig.aiCreditsModel = sanitizedDefault;
    console.log('[AI ROUTER] Admin set defaultAiModel ID:', sanitizedDefault);
  }
  if (visionAiModel !== undefined) {
    const sanitizedVision = String(visionAiModel).trim();
    currentConfig.visionAiModel = sanitizedVision;
    currentConfig.visionModel = sanitizedVision;
    console.log('[AI ROUTER] Admin set visionAiModel ID:', sanitizedVision);
  }
  if (codeAiModel !== undefined) {
    const sanitizedCode = String(codeAiModel).trim();
    currentConfig.codeAiModel = sanitizedCode;
    console.log('[AI ROUTER] Admin set codeAiModel ID:', sanitizedCode);
  }
  if (activeModelId !== undefined && defaultAiModel === undefined) {
    const sanitizedActiveModel = String(activeModelId).trim();
    currentConfig.defaultAiModel = sanitizedActiveModel;
    currentConfig.activeModelId = sanitizedActiveModel;
    currentConfig.aiCreditsModel = sanitizedActiveModel;
    console.log('[AI ROUTER] Admin set active model ID:', sanitizedActiveModel);
  }
  if (aiCreditsBaseUrl !== undefined) currentConfig.aiCreditsBaseUrl = aiCreditsBaseUrl;
  if (aiCreditsModel !== undefined && activeModelId === undefined && defaultAiModel === undefined) {
    const sanitizedModel = String(aiCreditsModel).trim();
    currentConfig.defaultAiModel = sanitizedModel;
    currentConfig.aiCreditsModel = sanitizedModel;
    currentConfig.activeModelId = sanitizedModel;
    console.log('[AI ROUTER] Admin set aiCreditsModel ID:', sanitizedModel);
  }
  if (visionModel !== undefined) currentConfig.visionModel = visionModel;
  if (temperature !== undefined) currentConfig.temperature = Number(temperature);
  if (maxTokens !== undefined) currentConfig.maxTokens = Number(maxTokens);
  if (systemPrompt !== undefined) currentConfig.systemPrompt = systemPrompt;
  if (memoApiKey !== undefined) currentConfig.memoApiKey = memoApiKey;
  if (memoApiUrl !== undefined) currentConfig.memoApiUrl = memoApiUrl;
  if (enableDeepResearch !== undefined) currentConfig.enableDeepResearch = Boolean(enableDeepResearch);
  if (enableVision !== undefined) currentConfig.enableVision = Boolean(enableVision);
  if (enableMemory !== undefined) currentConfig.enableMemory = Boolean(enableMemory);
  if (dailyMessageLimit !== undefined) currentConfig.dailyMessageLimit = Math.max(0, Number(dailyMessageLimit) || 0);

  memoService.updateConfig({
    apiKey: currentConfig.memoApiKey,
    apiUrl: currentConfig.memoApiUrl,
    isEnabled: currentConfig.enableMemory
  });

  // Persist updated configuration permanently to Firebase Realtime Database —
  // but never the provider secrets themselves.
  const { aiCreditsApiKey: _omitAiCreditsKey, openRouterApiKey: _omitOpenRouterKey, ...configToPersist } = currentConfig;
  await setRtdbData('system/config', configToPersist);

  console.log('✓ [ADMIN] Saved and persisted system prompt and AI config to database');

  res.json({
    success: true,
    message: 'Leo AI configuration updated and persisted successfully across all instances.',
    config: configToPersist
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

app.post('/api/admin/users/:uid', async (req, res) => {
  if (!isAuthorizedAdmin(req)) return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  const uid = String(req.params.uid);
  const user = userStore.get(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { plan, dailyMessageLimitOverride, premiumUntil } = req.body || {};
  if (plan !== undefined) user.plan = String(plan || 'free').toLowerCase();
  if (premiumUntil !== undefined) {
    const ts = Number(premiumUntil) || Date.parse(String(premiumUntil));
    if (Number.isFinite(ts) && ts > 0) { user.premiumUntil = ts; user.subscriptionExpiresAt = ts; }
    else { delete user.premiumUntil; delete user.subscriptionExpiresAt; }
  }
  if (dailyMessageLimitOverride === null || dailyMessageLimitOverride === '' || dailyMessageLimitOverride === undefined) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dailyMessageLimitOverride')) delete user.dailyMessageLimitOverride;
  } else {
    user.dailyMessageLimitOverride = Math.max(0, Number(dailyMessageLimitOverride) || 0);
  }
  user.lastActive = Date.now();
  userStore.set(uid, user);
  await setRtdbData(`users/${uid}`, { ...user, updatedAt: Date.now() });
  res.json({ success: true, user });
});

app.post('/api/admin/users/:uid/reset-daily', async (req, res) => {
  if (!isAuthorizedAdmin(req)) return res.status(403).json({ error: 'Unauthorized. Admin privileges required.' });
  const uid = String(req.params.uid);
  const user = userStore.get(uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await resetUserDailyUsage(uid);
  res.json({ success: true, user: userStore.get(uid) });
});


// ----------------------------------------------------
// 2b. Firebase RTDB + Email OTP 2-Factor Authentication
// ----------------------------------------------------

// Rate limiting cache: email -> lastRequestTimestamp
const emailRateLimitMap: Map<string, number> = new Map();

/**
 * Robust Email Dispatch with Step-by-Step Logging and Validation
 */
async function sendOtpEmail(
  email: string,
  code: string,
  displayName?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string; configNote?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  
  // 1. Inspect Environment Credentials
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
  const digitBoxesHtml = digits.map((d, index) => `
    <td style="padding: 0 4px; vertical-align: middle;">
      <div class="digit-box" style="width: 44px; height: 56px; line-height: 56px; text-align: center; background: #000000; background-image: radial-gradient(circle at 50% 0%, #15102a 0%, #000000 75%); border: 1.5px solid #8b5cf6; border-radius: 14px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 30px; font-weight: 900; color: #ffffff; text-shadow: 0 0 12px rgba(167, 139, 250, 0.9), 0 2px 4px rgba(0,0,0,0.8); box-shadow: 0 0 16px rgba(139, 92, 246, 0.35), inset 0 1px 1px rgba(255,255,255,0.15); animation-delay: ${index * 0.15}s;">
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
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <title>Leo AI Passkey Verification</title>
      <style>
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 25px rgba(139, 92, 246, 0.4), 0 0 50px rgba(79, 70, 229, 0.2);
            border-color: #8b5cf6;
          }
          50% {
            box-shadow: 0 0 35px rgba(167, 139, 250, 0.7), 0 0 70px rgba(139, 92, 246, 0.4);
            border-color: #a78bfa;
          }
        }
        @keyframes digitPulse {
          0%, 100% {
            transform: scale(1);
            border-color: #8b5cf6;
            box-shadow: 0 0 14px rgba(139, 92, 246, 0.35);
          }
          50% {
            transform: scale(1.03);
            border-color: #c084fc;
            box-shadow: 0 0 22px rgba(192, 132, 252, 0.65), inset 0 0 8px rgba(139, 92, 246, 0.3);
          }
        }
        @keyframes liveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.75); }
        }
        @keyframes borderShimmer {
          0% { border-color: rgba(139, 92, 246, 0.3); }
          50% { border-color: rgba(167, 139, 250, 0.8); }
          100% { border-color: rgba(139, 92, 246, 0.3); }
        }
        .main-card {
          animation: borderShimmer 4s infinite ease-in-out;
        }
        .logo-icon {
          animation: pulseGlow 3s infinite ease-in-out;
        }
        .digit-box {
          animation: digitPulse 2.5s infinite ease-in-out;
        }
        .live-dot {
          animation: liveDot 1.5s infinite ease-in-out;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff;">
      
      <!-- Preview Preheader Text -->
      <div style="display: none; font-size: 1px; color: #000000; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Your Leo AI 6-digit verification passkey is ${code}. Valid for 5 minutes.
      </div>

      <!-- Main Container Card (OLED Deep Pitch Black) -->
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" class="main-card" style="max-width: 500px; margin: 0 auto; background-color: #050505; border: 1px solid #1f1a33; border-radius: 26px; overflow: hidden; box-shadow: 0 0 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(124, 58, 237, 0.15);">
        
        <!-- Header Banner (Jet Black with Neon Spark) -->
        <tr>
          <td style="padding: 38px 24px 26px 24px; text-align: center; background: radial-gradient(circle at 50% 0%, #160f2e 0%, #050505 85%); border-bottom: 1px solid #181426;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td align="center">
                  <div class="logo-icon" style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 18px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); box-shadow: 0 0 25px rgba(139, 92, 246, 0.55); font-size: 26px; color: #ffffff; font-weight: 800; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.2);">
                    ✦
                  </div>
                </td>
              </tr>
            </table>
            <h1 style="margin: 0; font-size: 25px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
              LEO <span style="color: #a78bfa; text-shadow: 0 0 15px rgba(167, 139, 250, 0.6);">AI</span>
            </h1>
            <div style="display: inline-block; margin-top: 10px; padding: 5px 14px; background-color: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 20px; font-size: 10.5px; font-weight: 800; color: #c4b5fd; text-transform: uppercase; letter-spacing: 1.2px; box-shadow: 0 0 10px rgba(139, 92, 246, 0.15);">
              Two-Factor Authentication Passkey
            </div>
          </td>
        </tr>

        <!-- Content Body (Pure Deep Black) -->
        <tr>
          <td style="padding: 30px 26px 24px 26px; background-color: #050505;">
            <p style="margin: 0 0 8px 0; font-size: 15px; color: #f8fafc; font-weight: 600;">
              Hello <span style="color: #c084fc; font-weight: 700;">${displayName || 'Explorer'}</span>,
            </p>
            <p style="margin: 0 0 24px 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
              We received a request to access your <strong style="color: #ffffff;">Leo AI</strong> account. Use the high-security verification code below to authorize your session:
            </p>

            <!-- 6-Digit Display Card (Pitch Black OLED with Neon Borders) -->
            <div style="background-color: #000000; border: 1px solid #201a38; border-radius: 20px; padding: 22px 12px; text-align: center; margin-bottom: 24px; box-shadow: inset 0 0 20px rgba(0,0,0,0.9), 0 0 25px rgba(124, 58, 237, 0.08);">
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  ${digitBoxesHtml}
                </tr>
              </table>
              <div style="margin-top: 18px;">
                <span style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 14px; font-size: 11px; font-weight: 700; color: #fbbf24; box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);">
                  <span class="live-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #fbbf24; margin-right: 4px;"></span>
                  Valid for 5 minutes only
                </span>
              </div>
            </div>

            <!-- Security Advisory Banner -->
            <div style="background: #08080c; border: 1px solid #1e1933; border-left: 4px solid #8b5cf6; border-radius: 14px; padding: 14px 16px; margin-bottom: 24px; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: top; width: 22px; padding-top: 2px;">
                    <span style="font-size: 14px;">🛡️</span>
                  </td>
                  <td style="padding-left: 8px;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      <strong style="color: #f8fafc;">Security Notice:</strong> Never share this 6-digit passkey with anyone. Leo AI staff will never ask for your code.
                    </p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Account Metadata -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #141220; padding-top: 16px;">
              <tr>
                <td style="font-size: 11px; color: #64748b; line-height: 1.6;">
                  Recipient: <span style="color: #cbd5e1; font-family: monospace;">${normalizedEmail}</span><br>
                  Protocol: <span style="color: #94a3b8;">SHA-256 OTP Authentication</span>
                </td>
                <td align="right" style="font-size: 11px; color: #64748b; vertical-align: bottom;">
                  Status: <span style="color: #10b981; font-weight: 700; text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);">● Active</span>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer & Developer Credits (Jet Black OLED) -->
        <tr>
          <td style="background-color: #000000; padding: 22px 24px; text-align: center; border-top: 1px solid #141220;">
            <p style="margin: 0 0 6px 0; font-size: 11.5px; font-weight: 800; color: #cbd5e1; letter-spacing: 0.8px;">
              LEO AI COGNITIVE PLATFORM
            </p>
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b;">
              Engineered by <strong style="color: #a78bfa;">Bikash Bindhani</strong>
            </p>
            <p style="margin: 0; font-size: 11px;">
              <a href="https://www.instagram.com/vixyiu._?igsh=czZsZjdrNHBrc2l2&igsi=czZsZjdrNHBrc2l2" style="color: #c084fc; text-decoration: none; font-weight: 600; text-shadow: 0 0 10px rgba(192, 132, 252, 0.4);">
                Instagram: @vixyiu._ ↗
              </a>
            </p>
          </td>
        </tr>

      </table>

      <!-- Subtext -->
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; margin: 16px auto 0 auto;">
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
      const resendData: any = await resendResponse.json();
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

  // OPTION C: Standard SMTP (Gmail, Custom SMTP, or Test Transporter)
  try {
    let transporter: nodemailer.Transporter;

    if (smtpUser && smtpPass) {
      console.log(`[STEP 4/5: ATTEMPTING SMTP DISPATCH VIA ${smtpHost}]`);
      
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpHost.includes('gmail.com');

      // Setup primary transport config
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

      // Verify connection with fallback attempt to port 587 STARTTLS for cloud hosts like Render
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
            configNote: 'Render free tier blocks SMTP port 465/587. Use HTTPS Email API (SendGrid/Resend) for cloud delivery.'
          };
        }
      }
    } else {
      console.warn(`[STEP 4/5: WARNING - NO SMTP CREDENTIALS IN .ENV]`);
      console.warn(`  ⚠️ SMTP_USER and SMTP_PASS are currently empty in .env.`);
      console.warn(`  Creating temporary test transporter (Ethereal Email).`);

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
    console.log(`[STEP 5/5: EMAIL SENT SUCCESSFULLY]`);
    console.log(`  • Message ID:  ${info.messageId}`);
    if (previewUrl) {
      console.log(`  • Ethereal URL: ${previewUrl}`);
    }
    console.log(`==================================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : undefined
    };
  } catch (err: any) {
    console.error(`[STEP 5/5: EMAIL DISPATCH FAILED]`);
    console.error(`  • Error Message: ${err.message}`);
    console.error(`  • Error Code:    ${err.code || 'UNKNOWN'}`);
    console.error(`  • Error Response: ${err.response || 'N/A'}`);
    console.log(`==================================================================\n`);

    return {
      success: false,
      error: err.message || 'SMTP dispatch failed'
    };
  }
}

// ----------------------------------------------------
// Authentication & Session Store
// ----------------------------------------------------
const DEFAULT_USER_CREDITS = parseInt(process.env.DEFAULT_AI_CREDITS || '50', 10) || 50;

// Active User Sessions & Server-Side Invalidation Store
const activeUserSessions = new Map<string, { uid: string; email: string; createdAt: number }>();

/**
 * GET /api/auth/me or /api/auth/session
 * Returns current authenticated user and updated AI credits
 */
app.get(['/api/auth/me', '/api/auth/session'], (req, res) => {
  const cookieToken = req.cookies?.leo_auth_session;
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const token = cookieToken || headerToken || (req.query.token as string);
  const uid = (req.query.uid as string) || (req.headers['x-user-id'] as string);

  if (!token && !uid) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  let user: UserRecord | undefined;
  if (uid && userStore.has(uid)) {
    user = userStore.get(uid);
  } else if (token && activeUserSessions.has(token)) {
    const sess = activeUserSessions.get(token);
    if (sess && sess.uid) {
      user = userStore.get(sess.uid);
    }
  } else {
    // Search userStore
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

/**
 * POST /api/auth/logout
 * Clears user session cookies and invalidates session token server-side
 */
app.post('/api/auth/logout', (req, res) => {
  const cookieToken = req.cookies?.leo_auth_session;
  if (cookieToken) {
    activeUserSessions.delete(cookieToken);
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeUserSessions.delete(token);
  }

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('leo_auth_session', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax'
  });

  res.json({ success: true, message: 'Logged out successfully. Session invalidated server-side.' });
});

/**
 * Step 1: Generate OTP, invalidate old OTP, write to /otps/{sanitizedEmail} in RTDB, and send email
 */
app.post('/api/auth/send-otp', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';

  // 1. IP Rate Limiting Check
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many requests from this IP. Please wait ${rateLimitStatus.retryAfterSeconds}s before retrying.`
    });
  }

  const { email, uid, displayName, photoURL } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sanitizedEmail = sanitizeEmailForRtdb(normalizedEmail);

  console.log(`\n---------------- [AUTH SEND-OTP REQUEST] ----------------`);
  console.log(`[STEP 1/5: GENERATING OTP]`);
  console.log(`  • Email:           ${normalizedEmail}`);
  console.log(`  • Sanitized Key:   ${sanitizedEmail}`);

  // Rate Limiting per email (20s cooldown between new OTP requests)
  const lastSent = emailRateLimitMap.get(normalizedEmail);
  if (lastSent && Date.now() - lastSent < 20000) {
    const remainingSecs = Math.ceil((20000 - (Date.now() - lastSent)) / 1000);
    console.log(`  ✗ Rate limit exceeded: Please wait ${remainingSecs}s.`);
    return res.status(429).json({
      success: false,
      message: `Rate limit: Please wait ${remainingSecs}s before requesting a new OTP.`
    });
  }
  emailRateLimitMap.set(normalizedEmail, Date.now());

  // Generate 6-digit numeric OTP code (expires in 5 minutes)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInMs = 5 * 60 * 1000;
  const expiresAt = Date.now() + expiresInMs;

  console.log(`  • Generated OTP:   ${code}`);
  console.log(`  • Expires At:      ${new Date(expiresAt).toISOString()} (5 mins)`);

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

  // 1. Store in Firebase Realtime Database at /otps/{sanitizedEmail}
  console.log(`[STEP 2/5: WRITING TO FIREBASE RTDB]`);
  console.log(`  • Path: /otps/${sanitizedEmail}`);
  const rtdbOk = await setRtdbData(`otps/${sanitizedEmail}`, otpPayload);
  console.log(`  • RTDB Write Status: ${rtdbOk ? '✓ SUCCESS' : '⚠ NETWORK NOTE (using local redundancy)'}`);

  // 2. Also keep in memory store
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

  // 3. Real Email Dispatch via Nodemailer / SMTP
  const emailResult = await sendOtpEmail(normalizedEmail, code, displayName);

  if (!emailResult.success) {
    console.warn(`[OTP Send Notice] Email was not delivered to mailbox: ${emailResult.error}`);
    // If SMTP credentials are not set or failed, provide clear diagnostic feedback and devOtp for testing
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

/**
 * Diagnostic Endpoint for Email Configuration Status
 */
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
    sendgridConfigured: sendgridKey,
    cloudFunctionsNote: 'On Google Cloud Functions / Spark plan, outbound SMTP connections (port 587/465) require Blaze plan or HTTPS APIs (Resend/SendGrid).'
  });
});


/**
 * Step 2: Read /otps/{sanitizedEmail} from RTDB, verify OTP & expiry, delete node, and mint custom token
 */
app.post('/api/auth/verify-otp', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';

  // 1. IP Rate Limiting Check
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      success: false,
      message: `Too many attempts from this IP. Please retry in ${rateLimitStatus.retryAfterSeconds}s.`
    });
  }

  const { email, otp, userProfile } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sanitizedEmail = sanitizeEmailForRtdb(normalizedEmail);

  // 1. Read from Firebase Realtime Database /otps/{sanitizedEmail}
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

  // Check Expiration (~5 min)
  if (Date.now() > activeExpiresAt) {
    await deleteRtdbData(`otps/${sanitizedEmail}`);
    otpStore.delete(normalizedEmail);
    return res.status(400).json({
      success: false,
      message: 'OTP has expired (validity is 5 minutes). Please request a new verification code.'
    });
  }

  // Rate limit / attempts check
  activeAttempts++;
  if (activeAttempts > 5) {
    recordLoginAttempt(clientIp, false);
    await deleteRtdbData(`otps/${sanitizedEmail}`);
    otpStore.delete(normalizedEmail);
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts (max 5). This OTP has been invalidated. Please request a new code.'
    });
  }

  // Check code match
  if (activeOtp !== otp.trim()) {
    recordLoginAttempt(clientIp, false);
    // Update attempts in RTDB
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

  // 2. Code is VALID: Delete /otps/{sanitizedEmail} node in RTDB & reset rate limits
  recordLoginAttempt(clientIp, true);
  await deleteRtdbData(`otps/${sanitizedEmail}`);
  otpStore.delete(normalizedEmail);

  // 3. Construct user profile & mint custom token
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
    chatCount: existingCached?.chatCount || 0,
    plan: existingCached?.plan || 'free',
    dailyMessageLimitOverride: existingCached?.dailyMessageLimitOverride,
    dailyMessageCount: existingCached?.dailyMessageCount || 0
  };

  // Sync user profile to Realtime Database /users/{uid}
  await setRtdbData(`users/${finalUid}`, {
    ...finalUser,
    updatedAt: Date.now()
  });
  userStore.set(finalUid, finalUser);

  // Mint Firebase Custom Token representation & active session
  const customToken = `firebase_custom_token_${finalUid}_${Date.now()}`;
  const sessionToken = 'leo_usr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

  // Store in server-side session registry
  activeUserSessions.set(sessionToken, {
    uid: finalUid,
    email: normalizedEmail,
    createdAt: Date.now()
  });

  // Set HttpOnly, Secure, SameSite session cookie
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('leo_auth_session', sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  console.log(`[Leo AI Auth] ✅ OTP verified for ${normalizedEmail}. Deleted /otps/${sanitizedEmail} & minted custom token.`);

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
// 4. Chat History & Cloud Sync (MongoDB / Firebase Realtime)
// ----------------------------------------------------
app.get('/api/chats', (req, res) => {
  const userId = (req.query.userId as string) || 'default-user';
  const userChats: StoredChat[] = [];
  chatStore.forEach(c => {
    if (c.userId === userId) userChats.push(c);
  });
  // Sort descending by updatedAt
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

// ----------------------------------------------------
// Tavily Web Search & Autonomous Tool Engine
// ----------------------------------------------------
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface WebSearchExecution {
  needed: boolean;
  queries: string[];
  results: TavilySearchResult[];
  sources: { title: string; url: string }[];
  groundingText: string;
  error?: string;
}

async function executeTavilySearch(query: string, maxResults = 5): Promise<{
  success: boolean;
  query: string;
  results: TavilySearchResult[];
  answer?: string;
  error?: string;
}> {
  const tavilyApiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!tavilyApiKey) {
    return {
      success: false,
      query,
      results: [],
      error: 'Required server-side provider key is not configured.'
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: Math.min(maxResults, 5)
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[TAVILY] HTTP ${response.status}: ${errText.slice(0, 200)}`);
      return { success: false, query, results: [], error: `HTTP ${response.status}` };
    }

    const data: any = await response.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];
    const results: TavilySearchResult[] = rawResults
      .map((r: any) => ({
        title: (r.title || 'Web Resource').trim(),
        url: (r.url || '').trim(),
        content: (r.content || '').trim(),
        score: r.score
      }))
      .filter((r: TavilySearchResult) => r.url && r.content);

    return {
      success: true,
      query,
      results,
      answer: data.answer
    };
  } catch (err: any) {
    console.warn(`[TAVILY] Search query "${query}" failed:`, err.message || err);
    return {
      success: false,
      query,
      results: [],
      error: err.message || 'Search timeout'
    };
  }
}

/**
 * Evaluates whether a prompt strictly needs fresh / real-time / live web search,
 * or if it should be answered directly from internal knowledge.
 */
function evaluateWebSearchNecessity(prompt: string): { shouldSearch: boolean; suggestedQueries: string[] } {
  if (!prompt || typeof prompt !== 'string') return { shouldSearch: false, suggestedQueries: [] };
  const p = prompt.toLowerCase().trim();

  // 1. Definite Non-Search Cases (Programming, Math, Explanations, Greetings, Persona, Creative)
  const isPureExplanation = /^(what is|explain|define|how does|how do|difference between)\s+(javascript|python|recursion|closure|react|html|css|sql|rest api|binary tree|quicksort|oop|polymorphism|async await|promises|pointers|big o|transistor|gravity|photosynthesis|mitochondria|dna|newton'?s (first|second|third) law)\b/i.test(p);
  const isCodeTask = /^(write|generate|create|build|debug|fix|refactor|convert|optimize)\s+(a |an |the )?(python|javascript|typescript|c\+\+|java|rust|go|react|component|function|script|sql query|class|algorithm|regex|css|html|endpoint)/i.test(p);
  const isCasualOrCreative = /^(hi|hello|hey|greetings|good morning|good evening|who are you|what can you do|write a (poem|story|song|essay|joke)|translate|solve this equation)\b/i.test(p);

  if ((isPureExplanation || isCodeTask || isCasualOrCreative) && !/(today|yesterday|current|latest|2025|2026|live|price|score|news|release date|update)/i.test(p)) {
    return { shouldSearch: false, suggestedQueries: [] };
  }

  // 2. High-Confidence Temporal, Entity, Media & Website Triggers
  const hasTemporalKeywords = /\b(yesterday('?s)?|today('?s)?|tomorrow|current|currently|latest|newest|recent|recently|right now|live|this week|this month|this year|in 2025|in 2026|2025|2026)\b/i.test(p);
  const hasLiveEntityKeywords = /\b(who won|match score|cricket match|football match|ipl score|champions league|super bowl|world cup|election results|stock price|share price|crypto price|bitcoin price|ethereum price|weather in|weather today|gold rate|silver rate|dollar rate|exchange rate|who is the current|is .* down|outage|release notes|launch date|released on)\b/i.test(p);
  const hasNewsKeywords = /\b(news|breaking news|headline|what happened (to|in|with)|latest updates? on|announcements? regarding)\b/i.test(p);
  const hasWebsitesOrMediaKeywords = /\b(movie|movies|film|films|cinema|streaming|watch online|download|websites?|sites?|platform|platforms|ott|free model|free models|hackerai|tools?|github|kahan milega|link do|link|links|batao|dhund|dhundho|dhundke)\b/i.test(p);

  if (hasTemporalKeywords || hasLiveEntityKeywords || hasNewsKeywords || hasWebsitesOrMediaKeywords) {
    // Generate clean search query by stripping common conversational prefixes
    let cleanQuery = prompt
      .replace(/^(can you (please )?tell me|please tell me|tell me|who won|what is the|what are the|do you know|search for|find|browse|dhund do|dhund ke do|mujhe batao|batao)\s+/i, '')
      .replace(/[?!.]+$/, '')
      .trim();

    // Multi-step query splitting for comparisons
    if (/\b(compare|vs|versus)\b/i.test(cleanQuery) && hasTemporalKeywords) {
      const parts = cleanQuery.split(/\b(?:vs|versus|and)\b/i).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          shouldSearch: true,
          suggestedQueries: [
            `${parts[0]} latest updates 2025 2026`,
            `${parts[1]} latest updates 2025 2026`
          ]
        };
      }
    }

    if (!cleanQuery) cleanQuery = prompt;
    return {
      shouldSearch: true,
      suggestedQueries: [cleanQuery]
    };
  }

  return { shouldSearch: false, suggestedQueries: [] };
}

async function performAutonomousWebBrowsing(
  prompt: string,
  onStatusUpdate?: (status: { phase: 'searching' | 'reading' | 'generating'; query?: string; sourcesCount?: number }) => void
): Promise<WebSearchExecution> {
  const decision = evaluateWebSearchNecessity(prompt);
  if (!decision.shouldSearch || decision.suggestedQueries.length === 0) {
    return {
      needed: false,
      queries: [],
      results: [],
      sources: [],
      groundingText: ''
    };
  }

  const queries = decision.suggestedQueries.slice(0, 2); // max 2 queries for multi-step
  console.log(`[AUTO BROWSER] Autonomous search triggered for: ${JSON.stringify(queries)}`);

  if (onStatusUpdate) {
    onStatusUpdate({ phase: 'searching', query: queries[0] });
  }

  const allResults: TavilySearchResult[] = [];
  const allSources: { title: string; url: string }[] = [];
  const seenUrls = new Set<string>();

  for (const q of queries) {
    const searchRes = await executeTavilySearch(q, 4);
    if (searchRes.success && searchRes.results.length > 0) {
      for (const item of searchRes.results) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push(item);
          allSources.push({ title: item.title, url: item.url });
        }
      }
    }
  }

  if (allResults.length > 0) {
    if (onStatusUpdate) {
      onStatusUpdate({ phase: 'reading', sourcesCount: allResults.length });
    }

    let groundingText = `\n\n[VERIFIED REAL-TIME WEB SEARCH EVIDENCE VIA TAVILY]:\n`;
    allResults.slice(0, 6).forEach((r, idx) => {
      groundingText += `--- SOURCE ${idx + 1} ---\nTITLE: ${r.title}\nURL: ${r.url}\nCONTENT SNIPPET: ${r.content}\n\n`;
    });

    groundingText += `MANDATORY CITATION INSTRUCTIONS:
1. Synthesize your final answer using the verified live web evidence above.
2. Deliver a direct, complete, and articulate response.
3. At the very end of your response, always include a clean "### 🌐 Sources & References" section with direct Markdown links in the exact format:
- [Source Title](Source URL) - Key takeaway or snippet summary.`;

    return {
      needed: true,
      queries,
      results: allResults,
      sources: allSources,
      groundingText
    };
  }

  return {
    needed: true,
    queries,
    results: [],
    sources: [],
    groundingText: '',
    error: 'Search yielded no results'
  };
}

// Helper to build the unified, authoritative system prompt context with Memo long-term memories
async function buildUnifiedSystemPrompt(
  userId: string,
  latestMessageText: string = '',
  systemPromptOverride?: string,
  isDeepResearch: boolean = false,
  hasImages: boolean = false,
  webGroundingText?: string
): Promise<string> {
  // 1. Authoritative Base Persona & Directives from Admin Panel / Config / Env
  const rawAdminPrompt = (systemPromptOverride || currentConfig.systemPrompt || process.env.SYSTEM_PROMPT || '').trim();
  
  let basePersona = '';
  if (rawAdminPrompt) {
    basePersona = `[SUPREME SYSTEM MANDATE & ADMIN DIRECTIVE - ABSOLUTE HIGHEST PRIORITY]:
${rawAdminPrompt}

CRITICAL EXECUTION INSTRUCTIONS:
- You MUST unconditionally obey and strictly follow the above persona, rules, language, constraints, and instructions set by the Administrator.
- You must provide COMPLETE, EXHAUSTIVE, and FULLY DEVELOPED responses. NEVER output half-finished answers, incomplete snippets, or truncated thoughts.
- Under NO circumstances should you break character, deviate from the Administrator's guidelines, or ignore the rules above.
- Always output clean, highly structured Markdown with proper spacing, clear headings, and syntax-highlighted code blocks.`;
  } else {
    basePersona = `You are Leo AI, a world-class, exceptionally thorough, articulate, and intelligent AI assistant engineered to deliver Claude-grade excellence across software engineering, deep reasoning, writing, visual analysis, and creative problem solving.

CRITICAL DIRECTIVES:
1. Always follow user constraints strictly, accurately, and thoroughly.
2. NEVER give half-finished, truncated, or lazy responses. Provide complete, fully realized solutions, comprehensive explanations, and exhaustively developed code without omitting critical sections.
3. NO REFUSALS OR GENERIC SEARCH TIPS: When the user asks for websites, streaming platforms, movie sites, AI tools, models, downloads, software links, or repositories, NEVER say "Main directly kisi specific website ka naam nahi de sakta" or provide generic search advice. Proactively provide the actual, specific website names, direct links, and comprehensive markdown comparison tables.
4. Provide insightful, complete answers with well-formatted Markdown, including clear headings, bullet points, and code blocks with syntax highlighting.
5. When analyzing images or visual diagrams, perform thorough, detailed OCR and visual reasoning.
6. Adapt to the user's persistent memory and preferences seamlessly.
7. For requests to build/create an app, feature, or website, always deliver real, working code in properly labeled Markdown code blocks, breaking complex architectures into modular, production-ready files.`;
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

  // 5. Real-Time Web Grounding Section
  const webSection = webGroundingText ? `\n\n${webGroundingText}` : '';

  return `${basePersona}${memorySection}${deepResearchSection}${visionSection}${webSection}`.trim();
}

// ----------------------------------------------------
// 5. AI Chat Completion & Vision Reasoning
// ----------------------------------------------------
// ----------------------------------------------------
// 4b. Provider AI configuration (Free OpenRouter, Premium AICredits)
// ----------------------------------------------------
function getAiCreditsDiagnostics() {
  return {
    configured: Boolean(currentConfig.aiCreditsApiKey && currentConfig.aiCreditsApiKey.trim()),
    model: currentConfig.aiCreditsModel || getTargetAiModel(),
    baseUrl: currentConfig.aiCreditsBaseUrl
  };
}

interface ProviderResult {
  ok: boolean;
  content?: string;
  thinkingProcess?: string;
  tool_calls?: any[];
  status?: number;
  error?: string;
}

async function callOpenAiCompatibleProvider(opts: {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: any[];
  tools?: any[];
}): Promise<ProviderResult> {
  const { label, baseUrl, apiKey, model, messages, tools } = opts;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  try {
    const payload: any = {
      model,
      messages,
      temperature: currentConfig.temperature,
      max_tokens: currentConfig.maxTokens
    };

    if (Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    // Guard against slow/free-tier models that hang indefinitely with no
    // response, which previously left the SSE stream stuck on "Generating
    // response..." forever on the frontend. 30s is generous for a single
    // completion call while still failing fast enough for the agent loop's
    // catch block (which already emits a proper `error` SSE event) to run.
    const providerTimeoutController = new AbortController();
    const providerTimeoutTimer = setTimeout(() => providerTimeoutController.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify(payload),
        signal: providerTimeoutController.signal
      });
    } finally {
      clearTimeout(providerTimeoutTimer);
    }

    const raw = await response.text();
    if (!response.ok) {
      // If error might be due to tools parameter not supported by an upstream endpoint, try without tools
      if (Array.isArray(tools) && tools.length > 0 && (response.status === 400 || response.status === 422)) {
        console.warn(`[${label.toUpperCase()}] Provider rejected tools param with status ${response.status}. Retrying with structured prompt fallback...`);
        return callOpenAiCompatibleProvider({ ...opts, tools: undefined });
      }
      console.error(`[${label.toUpperCase()}] Request failed with status ${response.status} for model "${model}": ${raw.slice(0, 500)}`);
      return { ok: false, status: response.status, error: `${label} responded with status ${response.status}` };
    }

    let data: any = null;
    try { data = JSON.parse(raw); } catch {
      console.error(`[${label.toUpperCase()}] Response was not valid JSON.`);
      return { ok: false, status: response.status, error: `${label} returned a non-JSON response.` };
    }

    const msgObj = data?.choices?.[0]?.message;
    let content = msgObj?.content;
    let thinkingProcess = msgObj?.reasoning_content || msgObj?.reasoning || '';
    const tool_calls = msgObj?.tool_calls;

    // Extract <think> or <thought> tags if present in content
    if (typeof content === 'string' && (!thinkingProcess || !thinkingProcess.trim())) {
      const thinkMatch = content.match(/<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/i);
      if (thinkMatch) {
        thinkingProcess = thinkMatch[1].trim();
        content = content.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '').trim();
      }
    }

    if (!content && !thinkingProcess && (!tool_calls || tool_calls.length === 0)) {
      console.error(`[${label.toUpperCase()}] Empty response content for model "${model}".`);
      return { ok: false, status: response.status, error: `${label} returned no response content.` };
    }

    return { ok: true, content: content || '', thinkingProcess, tool_calls, status: response.status };
  } catch (err: any) {
    console.error(`[${label.toUpperCase()}] Request threw an error:`, err?.message || err);
    return { ok: false, error: `Could not reach ${label} (network error).` };
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const {
      messages = [],
      userId = 'default-user',
      images = [],
      isDeepResearch = false,
      systemPromptOverride,
      model: requestedModel,
      stream = false
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const isAdmin = isAuthorizedAdmin(req);

    // 1. AI Endpoint Burst Rate Limiting (Token Bucket: 30 burst, 30/min sustained per IP/User)
    if (!isAdmin) {
      const rateLimitKey = `ai_${userId}_${clientIp}`;
      const aiLimit = checkAiEndpointRateLimit(rateLimitKey);

      res.setHeader('X-RateLimit-Limit', '30');
      res.setHeader('X-RateLimit-Remaining', String(aiLimit.remaining));

      if (!aiLimit.allowed) {
        res.setHeader('Retry-After', String(Math.ceil(aiLimit.retryAfterMs / 1000)));
        return res.status(429).json({
          error: `Too many AI requests. Please slow down and try again in ${Math.ceil(aiLimit.retryAfterMs / 1000)}s.`,
          retryAfterMs: aiLimit.retryAfterMs
        });
      }
    }

    // 2. Admin Panel "Daily Message Limit" enforcement (skipped for authenticated admins)
    if (!isAdmin) {
      const usageResult = await checkAndIncrementDailyUsage(userId, false, 1, requestedModel);
      if (!usageResult.allowed) {
        return res.status(429).json({
          error: `Daily message limit reached (${usageResult.status.used}/${usageResult.status.limit}). Please try again tomorrow.`,
          limitReached: true,
          limit: usageResult.status.limit,
          used: usageResult.status.used
        });
      }
    }

    const latestUserMessage = messages[messages.length - 1];

    // 1. Autonomous Web Browsing & Live Tool Invocation (Tavily Engine)
    const webSearchResult = await performAutonomousWebBrowsing(latestUserMessage?.content || '');

    // 2. Run AIModelRouter to determine the exact model role & modality
    const routeResult = await AIModelRouter.routeRequest({
      messages,
      images,
      prompt: latestUserMessage?.content,
      requestedModel
    });

    const isPremiumUser = userHasActivePremium(userId);
    let targetModel = isPremiumUser ? (process.env.AICREDITS_MODEL || currentConfig.aiCreditsModel || AIModelRouter.getDefaultModel()) : routeResult.selectedModel;
    if (!targetModel || !targetModel.trim()) {
      return res.status(400).json({
        error: 'No AI model configured. Please set OPENROUTER free model or AICREDITS_MODEL in environment variables.',
        configured: false
      });
    }
    const isVisionInput = routeResult.inputType === 'vision' || (Array.isArray(images) && images.length > 0);

    // Construct the authoritative system prompt containing the defined persona, relevant memories & live web grounding
    const finalSystemPrompt = await buildUnifiedSystemPrompt(
      userId,
      latestUserMessage.content || '',
      systemPromptOverride,
      Boolean(isDeepResearch),
      isVisionInput,
      webSearchResult.groundingText
    );

    if (isVisionInput) {
      globalStats.totalVisionQueries++;
    }
    globalStats.totalMessages += 2;
    globalStats.estimatedTokens += 650;

    console.log(`[AI CHAT] Routing: ${routeResult.inputType} | Model: "${targetModel}" | AutoWeb: ${webSearchResult.needed} (${webSearchResult.results.length} sources) | Deep Research: ${isDeepResearch}`);

    if (!isPremiumUser) {
      const freeModelAllowed = await validateOpenRouterFreeModel(targetModel);
      if (!freeModelAllowed) {
        return res.status(403).json({
          error: 'Free users can only use OpenRouter models with zero prompt and completion pricing. Premium ₹' + currentConfig.premiumPriceInr + ' Contact: @MrNewton_2',
          premiumRequired: true,
          contact: '@MrNewton_2'
        });
      }
    }

    const isStream = Boolean(stream) || req.headers.accept === 'text/event-stream' || req.query?.stream === 'true';
    let clientDisconnected = false;
    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      req.on('close', () => {
        clientDisconnected = true;
      });
    }

    const sendEvent = (event: AgentEvent) => {
      if (isStream && !clientDisconnected && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    // 1. Prepare Model Provider Adapter for Autonomous Agent Controller
    const aiCreditsDiag = getAiCreditsDiagnostics();
    const providerDiagnostics: any[] = [];
    let selectedProvider: 'aicredits' | 'openrouter' | null = null;
    let fallbackUsed = routeResult.isFallback;
    let finalModelUsed = targetModel;

    console.log(
      `[PROVIDERS] aicredits.configured=${aiCreditsDiag.configured} activeModel="${targetModel}" (${routeResult.inputType})`
    );

    const callProvider = async (agentMessages: any[], tools?: any[]): Promise<ProviderResult> => {
      if (!isPremiumUser) {
        if (!currentConfig.openRouterApiKey) {
          providerDiagnostics.push({ provider: 'openrouter', ok: false, status: null, error: 'Required server-side provider key is not configured.' });
          return { ok: false, error: 'OpenRouter provider is not configured.' };
        }
        const attachTools = modelLikelySupportsNativeTools(targetModel) ? tools : undefined;
        const result = await callOpenAiCompatibleProvider({ label: 'openrouter', baseUrl: currentConfig.openRouterBaseUrl, apiKey: currentConfig.openRouterApiKey, model: targetModel, messages: agentMessages, tools: attachTools });
        providerDiagnostics.push({ provider: 'openrouter', model: targetModel, ok: result.ok, status: result.status ?? null, error: result.error ?? null });
        if (result.ok && (result.content || result.tool_calls)) { selectedProvider = 'openrouter'; finalModelUsed = targetModel; return result; }
        return { ok: false, error: result.error || 'OpenRouter provider failed.' };
      }

      // AICredits Premium Provider
      if (aiCreditsDiag.configured) {
        const modelCandidates: string[] = [targetModel];
        if (!modelCandidates.includes(targetModel)) {
          modelCandidates.unshift(targetModel);
        }

        for (let i = 0; i < modelCandidates.length; i++) {
          const candidateModel = modelCandidates[i];
          // MODE A vs MODE B: only attach native `tools` on the first try if
          // this model is likely to understand them. Either way the agent's
          // <tool_call> text protocol (embedded in the system prompt) works
          // as the guaranteed fallback, and callOpenAiCompatibleProvider will
          // also auto-retry without `tools` if the provider itself rejects
          // the param with a 400/422.
          const attachTools = modelLikelySupportsNativeTools(candidateModel) ? tools : undefined;
          const result = await callOpenAiCompatibleProvider({
            label: 'aicredits',
            baseUrl: currentConfig.aiCreditsBaseUrl,
            apiKey: currentConfig.aiCreditsApiKey,
            model: candidateModel,
            messages: agentMessages,
            tools: attachTools
          });

          providerDiagnostics.push({
            provider: 'aicredits',
            model: candidateModel,
            ok: result.ok,
            status: result.status ?? null,
            error: result.error ?? null,
            fallbackChainIndex: i
          });

          if (result.ok && (result.content || result.tool_calls)) {
            selectedProvider = 'aicredits';
            finalModelUsed = candidateModel;
            if (i > 0) {
              fallbackUsed = true;
              console.log(`[AICREDITS FALLBACK] Successfully served response with fallback candidate "${candidateModel}" (attempt ${i + 1}/${modelCandidates.length})`);
            }
            return result;
          } else {
            console.warn(`[AICREDITS FALLBACK] Attempt ${i + 1}/${modelCandidates.length} failed with model "${candidateModel}": ${result.error || result.status}`);
          }
        }
      } else {
        providerDiagnostics.push({ provider: 'aicredits', ok: false, status: null, error: 'Required server-side provider key is not configured.' });
      }

      return { ok: false, error: 'AICredits provider failed or is not configured.' };
    };

    // Format initial user and history messages for Agent Loop
    const initialAgentMessages: any[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      const m = messages[i];
      if (m.role === 'system') continue;
      initialAgentMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }

    if (isVisionInput) {
      const contentParts: any[] = [{ type: 'text', text: latestUserMessage.content || 'Analyze this image.' }];
      for (const img of images) contentParts.push({ type: 'image_url', image_url: { url: img } });
      initialAgentMessages.push({ role: 'user', content: contentParts });
    } else {
      initialAgentMessages.push({ role: 'user', content: latestUserMessage.content });
    }

    // 2. Run Autonomous Multi-Step Agent Controller
    const agentResult = await runAgentLoop({
      messages: initialAgentMessages,
      systemPrompt: finalSystemPrompt,
      model: targetModel,
      callProvider,
      executeSafeCommand: executeDaytonaCommand,
      maxIterations: MAX_AGENT_ITERATIONS_CONFIGURED,
      userId,
      onEvent: isStream ? sendEvent : undefined,
      // Ties agent-loop cancellation to the SSE client disconnect listener
      // registered above, so an abandoned stream stops tool execution
      // instead of continuing to burn Tavily/Jina/Daytona calls for no one.
      isCancelled: () => clientDisconnected
    });

    if (!agentResult.content && agentResult.steps.length === 0) {
      console.error('[PROVIDERS] All configured AI providers failed in agent loop:', JSON.stringify(providerDiagnostics));
      if (isStream) {
        sendEvent({
          type: 'error',
          message: 'All configured AI providers failed to generate a response.'
        });
        return res.end();
      }
      return res.status(502).json({
        error: 'All configured AI providers failed to generate a response.',
        providerDiagnostics,
        model: targetModel,
        isDeepResearch,
        hasVision: isVisionInput
      });
    }

    // Save persistent memory asynchronously
    memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, agentResult.content).catch(() => {});

    // Aggregate search sources from initial check and agent tool steps
    const allSearchSources = [...webSearchResult.sources];
    const allSearchQueries = [...webSearchResult.queries];
    for (const src of agentResult.searchSources) {
      if (!allSearchSources.some(s => s.url === src.url)) {
        allSearchSources.push(src);
      }
    }
    for (const q of agentResult.searchQueries) {
      if (!allSearchQueries.includes(q)) {
        allSearchQueries.push(q);
      }
    }

    const hasSearched = allSearchSources.length > 0 || allSearchQueries.length > 0 || webSearchResult.needed;
    const finalThinking = agentResult.thinkingProcess || (hasSearched ? `Synthesized web intelligence and autonomous tool observations to deliver an authoritative answer.` : (isDeepResearch ? `Deconstructed request, evaluated parameters, and structured comprehensive multi-step analysis.` : undefined));

    if (isStream) {
      sendEvent({
        type: 'complete',
        message: 'Completed',
        data: {
          content: agentResult.content,
          thinkingProcess: finalThinking,
          model: finalModelUsed,
          provider: selectedProvider || (isPremiumUser ? 'aicredits' : 'openrouter'),
          fallbackUsed,
          isDeepResearch,
          hasVision: isVisionInput,
          searched: hasSearched,
          searchQueries: allSearchQueries,
          searchSources: allSearchSources,
          agentSteps: agentResult.steps,
          iterations: agentResult.iterations,
          timedOut: Boolean(agentResult.timedOut),
          cancelled: Boolean(agentResult.cancelled)
        }
      });

      return res.end();
    }

    return res.json({
      content: agentResult.content,
      thinkingProcess: finalThinking,
      model: finalModelUsed,
      provider: selectedProvider || (isPremiumUser ? 'aicredits' : 'openrouter'),
      fallbackUsed,
      isDeepResearch,
      hasVision: isVisionInput,
      searched: hasSearched,
      searchQueries: allSearchQueries,
      searchSources: allSearchSources,
      agentSteps: agentResult.steps,
      iterations: agentResult.iterations,
      timedOut: Boolean(agentResult.timedOut),
      cancelled: Boolean(agentResult.cancelled)
    });


  } catch (err: any) {
    console.error('Chat error:', err);
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred: ' + (err?.message || 'Unknown error') })}\n\n`);
        res.end();
      } catch {}
      return;
    }
    res.status(500).json({
      error: 'An error occurred while generating response: ' + (err?.message || 'Unknown error')
    });
  }
});

// Stream endpoint alias for backward compatibility
app.post('/api/chat/stream', async (req, res, next) => {
  req.body = req.body || {};
  req.body.stream = true;
  // Delegate directly to the /api/chat handler logic
  (app._router as any).handle(req, res, next);
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

*Note: Configure the required server-side provider key in your backend environment for real-time model inference.*`;
  }

  if (p.includes('sprint') || p.includes('plan')) {
    return `### 📅 7-Day Sprint Plan: Core Execution Matrix

Here is an actionable, high-velocity roadmap designed for rapid milestones:

#### **Days 1–2: Foundation & Requirements**
- **Architecture Freeze**: Define strict data schemas, API contracts, and core interfaces.
- **Environment Setup**: Configure staging databases, cloud secrets, and authentication keys.

#### **Days 3–4: Core Implementation**
- **Feature Layering**: Implement primary API endpoints and state containers.
- **Integration**: Link real-time event listeners and persistent memory engines.

#### **Days 5–6: Quality Assurance & Edge Cases**
- **Stress Testing**: Verify fallback handlers, rate limits, and network latency resilience.
- **UI Polish**: Verify touch targets (minimum 44px) and cross-device responsive fluidity.

#### **Day 7: Deployment & Telemetry**
- **Production Release**: Deploy frontend to Vercel and backend to Render.
- **Health Monitoring**: Verify system uptime, error logs, and user feedback channels.`;
  }

  if (p.includes('email') || p.includes('stakeholder')) {
    return `### ✉️ Executive Stakeholder Brief

**Subject**: Project Milestone Update: Velocity, Timeline & Next Milestones

Dear Stakeholders,

I am pleased to share an update on our current project sprint. Over the past week, the team has achieved substantial momentum:

- **Key Achievements**: Finalized core full-stack infrastructure, integrated persistent memory via Memo API, and optimized response latency.
- **Upcoming Focus**: Finalizing end-to-end integration tests and deploying production builds across our dual-tier cloud setup.
- **Risk Assessment**: On schedule with zero critical blocking bottlenecks.

Please let me know if you would like a brief 10-minute sync to review our live demonstration.

Warm regards,  
**Leo AI Project Team**`;
  }

  return `### ⚡ Leo AI Intelligence Response

Thank you for reaching out! I am **Leo AI**, your high-performance cognitive assistant.

- **System Prompt**: Strictly enforced for precision, reasoning, and clarity.
- **Vision Models**: Configured for lightweight, cost-efficient image OCR and layout analysis.
- **Persistent Memory**: Powered by Memo API to remember your project preferences across sessions.
- **Full-Stack Separation**: Optimized for seamless Vercel (Frontend) and Render (Backend) hosting.

How would you like to proceed with your request? Feel free to upload an image, activate **Deeper Research**, or explore our curated prompt library!`;
}

// Fallback handler for all unmatched API routes to prevent returning HTML index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    status: 404,
  });
});

// ----------------------------------------------------
// 6. Vite Integration & Static Files
// ----------------------------------------------------
const isProduction = process.env.NODE_ENV === 'production';
// Render (and most PaaS hosts) assign the port dynamically via process.env.PORT.
// Fall back to 3000 for local development where no PORT is set.
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

async function startServer() {
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e: any) {
      console.warn('Vite dev middleware not loaded, serving pure API mode:', e.message);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          res.json({
            status: 'online',
            service: 'Leo AI Backend API',
            version: '1.0.0',
            docs: '/api/health',
            message: 'Leo AI API server is running successfully.'
          });
        }
      });
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Leo AI backend running on ${HOST}:${PORT}`);
  });
}

startServer();
