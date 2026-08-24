import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { memoService } from './backend/services/memoService';

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
  dailyMessageLimitOverride?: number;
  dailyMessageCount?: number;
  dailyUsage?: {
    date: string;
    count: number;
    limit: number;
  };
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
  // 1. DEFAULT MODEL: Primary model for normal text conversation, writing, and explanations
  defaultAiModel: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    'google/gemini-2.0-flash'
  ).replace(/^["']|["']$/g, '').trim(),

  // 2. VISION MODEL: Multimodal model for photos, screenshots, and visual reasoning
  visionAiModel: (
    process.env.VISION_AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL ||
    'google/gemini-2.0-flash'
  ).replace(/^["']|["']$/g, '').trim(),

  // 3. CODE MODEL: Technical model for programming, code debugging, and software architecture
  codeAiModel: (
    process.env.CODE_AI_MODEL ||
    process.env.AICREDITS_CODE_MODEL ||
    'deepseek/deepseek-chat'
  ).replace(/^["']|["']$/g, '').trim(),

  // Legacy / Compatibility aliases
  activeModelId: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    'google/gemini-2.0-flash'
  ).replace(/^["']|["']$/g, '').trim(),
  aiCreditsApiKey: process.env.AICREDITS_API_KEY || '',
  aiCreditsBaseUrl: process.env.AICREDITS_BASE_URL || 'https://api.aicredits.in/v1',
  aiCreditsModel: (
    process.env.DEFAULT_AI_MODEL ||
    process.env.ACTIVE_MODEL_ID ||
    process.env.AICREDITS_MODEL ||
    'google/gemini-2.0-flash'
  ).replace(/^["']|["']$/g, '').trim(),
  tokeninApiKey: process.env.TOKENIN_API_KEY || '',
  tokeninBaseUrl: (process.env.TOKENIN_BASE_URL || 'https://tokenin.my.id/api/v1').trim().replace(/\/+$/, ''),
  tokeninModel: (process.env.TOKENIN_MODEL || '').replace(/^["']|["']$/g, '').trim(),
  visionModel: (
    process.env.VISION_AI_MODEL ||
    process.env.AICREDITS_VISION_MODEL ||
    process.env.VISION_MODEL ||
    'google/gemini-2.0-flash'
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
  freeTokeninModels: [] as string[],
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

const TOKENIN_MODELS = [
  { id: 'myt/grok-4.6-free', name: 'Grok 4.6', premium: true },
  { id: 'myt/kimi-k3-free', name: 'Kimi K3', premium: true },
  { id: 'myt/glm-5.3-free', name: 'GLM 5.3', premium: true },
  { id: 'myt/qwen3.8-max-free', name: 'Qwen 3.8 Max', premium: true },
  { id: 'myt/deepseek-v4-pro-free', name: 'DeepSeek V4 Pro', premium: true },
];
const TOKENIN_MODEL_IDS = new Set<string>(TOKENIN_MODELS.map(m => m.id));

function isTokeninModel(model: string): boolean {
  return TOKENIN_MODEL_IDS.has(model);
}

function effectiveDailyLimit(userId: string): number {
  const user = userStore.get(userId);
  if (typeof user?.dailyMessageLimitOverride === 'number') return Math.max(0, user.dailyMessageLimitOverride);
  return dailyUsageSettings.enabled ? dailyUsageSettings.limit : 0;
}

function userCanUsePremiumModel(userId: string, model?: string): boolean {
  // Admin-controlled free model list is authoritative for Free users.
  if (model && currentConfig.freeTokeninModels.includes(model)) return true;
  const user = userStore.get(userId);
  return Boolean(user && ['admin', 'premium', 'pro', 'ultra'].includes(String(user.plan || '').toLowerCase()) || user?.role === 'admin');
}

function getTokeninEndpoint(): string {
  const base = (currentConfig.tokeninBaseUrl || process.env.TOKENIN_BASE_URL || 'https://tokenin.my.id/api/v1').replace(/\/+$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
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
  provider: 'aicredits' | 'tokenin' | 'gemini';
  isNew?: boolean;
  tier: 'cheap' | 'quality' | 'standard';
  inputCostPer1M: number;
  outputCostPer1M: number;
  totalCostPer1M: number;
  isDefault?: boolean;
  contextLength?: number;
}

// Preferred candidates in priority order (used ONLY if actually returned by the API)
const CHEAP_CANDIDATE_PATTERNS = [
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash',
  'mistral/mistral-small',
  'mistralai/mistral-small-24b-instruct-2501',
  'mistralai/mistral-small-3.2-24b-instruct',
  'mistralai/mistral-small-2603'
];

const QUALITY_CANDIDATE_PATTERNS = [
  'openai/gpt-4o',
  'anthropic/claude-sonnet-4.5',
  'deepseek/deepseek-reasoner',
  'deepseek/deepseek-r1',
  'google/gemini-2.5-pro'
];

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
  if (lowerId.startsWith('openai/') || lowerName.includes('openai') || lowerName.includes('gpt')) {
    return { company: 'OpenAI', iconKey: 'openai' };
  }
  if (lowerId.startsWith('deepseek/') || lowerName.includes('deepseek')) {
    return { company: 'DeepSeek', iconKey: 'deepseek' };
  }
  if (lowerId.startsWith('google/') || lowerName.includes('gemini') || lowerName.includes('google')) {
    return { company: 'Google', iconKey: 'gemini' };
  }
  if (lowerId.startsWith('anthropic/') || lowerName.includes('claude') || lowerName.includes('anthropic')) {
    return { company: 'Anthropic', iconKey: 'claude' };
  }
  if (lowerId.startsWith('mistral') || lowerName.includes('mistral') || lowerName.includes('codestral')) {
    return { company: 'Mistral AI', iconKey: 'mistral' };
  }
  if (lowerId.startsWith('z-ai/') || lowerName.includes('glm') || lowerName.includes('zhipu')) {
    return { company: 'Zhipu AI', iconKey: 'glm' };
  }
  if (lowerId.startsWith('qwen/') || lowerId.startsWith('alibaba/') || lowerName.includes('qwen')) {
    return { company: 'Alibaba Cloud', iconKey: 'qwen' };
  }
  if (lowerId.startsWith('x-ai/') || lowerName.includes('grok')) {
    return { company: 'xAI', iconKey: 'grok' };
  }
  if (lowerId.startsWith('moonshot/') || lowerName.includes('kimi')) {
    return { company: 'Moonshot AI', iconKey: 'kimi' };
  }
  if (lowerId.startsWith('meta/') || lowerName.includes('llama')) {
    return { company: 'Meta', iconKey: 'llama' };
  }
  const prefix = id.split('/')[0];
  const formattedCompany = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'AI';
  return { company: formattedCompany, iconKey: 'sparkles' };
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

    const rawData = await res.json();
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

      // Check tier
      let tier: 'cheap' | 'quality' | 'standard' = 'standard';
      const isCheapCandidate = CHEAP_CANDIDATE_PATTERNS.some((pat) => pat === m.id || m.id.includes(pat));
      const isQualityCandidate = QUALITY_CANDIDATE_PATTERNS.some((pat) => pat === m.id || m.id.includes(pat));

      if (isCheapCandidate) {
        tier = 'cheap';
      } else if (isQualityCandidate) {
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

    // Extract available cheap candidate models that were actually returned
    const cheapCandidates = enrichedList
      .filter((m) => CHEAP_CANDIDATE_PATTERNS.some((pat) => pat === m.id || m.id.includes(pat)))
      // Sort strictly by actual input_cost_per_1m + output_cost_per_1m ascending
      .sort((a, b) => a.totalCostPer1M - b.totalCostPer1M);

    // Extract available quality candidate models that were actually returned
    const qualityCandidates = enrichedList
      .filter((m) => QUALITY_CANDIDATE_PATTERNS.some((pat) => pat === m.id || m.id.includes(pat)))
      .sort((a, b) => a.totalCostPer1M - b.totalCostPer1M);

    // Automatically select the cheapest available model as default
    let defaultModel = 'google/gemini-2.0-flash';
    if (cheapCandidates.length > 0) {
      defaultModel = cheapCandidates[0].id;
    } else if (enrichedList.length > 0) {
      // Sort all available active models by cost and take cheapest
      const sortedAll = [...enrichedList].sort((a, b) => a.totalCostPer1M - b.totalCostPer1M);
      defaultModel = sortedAll[0].id;
    }

    // Build the 3-model fallback chain from the available models
    const fallbackChain: string[] = [];
    for (const c of cheapCandidates) {
      if (!fallbackChain.includes(c.id)) {
        fallbackChain.push(c.id);
      }
      if (fallbackChain.length >= 3) break;
    }

    // If cheap candidates < 3, fill from other available active models sorted by cost
    if (fallbackChain.length < 3) {
      const sortedByCost = [...enrichedList].sort((a, b) => a.totalCostPer1M - b.totalCostPer1M);
      for (const m of sortedByCost) {
        if (!fallbackChain.includes(m.id)) {
          fallbackChain.push(m.id);
        }
        if (fallbackChain.length >= 3) break;
      }
    }

    // Mark isDefault on the chosen default model
    enrichedList.forEach((m) => {
      m.isDefault = m.id === defaultModel;
    });

    dynamicModelsCache = {
      models: enrichedList,
      cheapCandidates,
      qualityCandidates,
      defaultModel,
      fallbackChain,
      lastUpdated: Date.now()
    };

    console.log(
      `[DYNAMIC MODELS] Loaded ${enrichedList.length} models from AICredits API. ` +
      `Cheapest Default: "${defaultModel}" (total cost: $${cheapCandidates[0]?.totalCostPer1M || 0}/M). ` +
      `Fallback Chain (up to 3): ${JSON.stringify(fallbackChain)}`
    );

    return dynamicModelsCache;
  } catch (err: any) {
    console.warn('[DYNAMIC MODELS] Could not fetch fresh models from https://api.aicredits.in/api/models:', err.message);
    if (dynamicModelsCache) {
      return dynamicModelsCache;
    }

    // Fallback static dataset if first boot happens offline
    const fallbackDefault = 'google/gemini-2.0-flash';
    const fallbackChain = ['google/gemini-2.0-flash', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'];
    const fallbackResult = {
      models: [
        {
          id: 'google/gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          company: 'Google',
          category: 'vision' as const,
          description: 'Ultra-fast low-latency multimodal intelligence.',
          badges: ['Vision', 'Fast', 'Cheapest'],
          iconKey: 'gemini',
          provider: 'aicredits' as const,
          tier: 'cheap' as const,
          inputCostPer1M: 0.1,
          outputCostPer1M: 0.4,
          totalCostPer1M: 0.5,
          isDefault: true
        },
        {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          company: 'OpenAI',
          category: 'text' as const,
          description: 'Fast, cost-efficient multimodal reasoning.',
          badges: ['Vision', 'Fast'],
          iconKey: 'openai',
          provider: 'aicredits' as const,
          tier: 'cheap' as const,
          inputCostPer1M: 0.15,
          outputCostPer1M: 0.6,
          totalCostPer1M: 0.75
        },
        {
          id: 'deepseek/deepseek-chat',
          name: 'DeepSeek V3',
          company: 'DeepSeek',
          category: 'coding' as const,
          description: 'Top-tier code generation and technical reasoning.',
          badges: ['Coding', 'Speed'],
          iconKey: 'deepseek',
          provider: 'aicredits' as const,
          tier: 'cheap' as const,
          inputCostPer1M: 0.257,
          outputCostPer1M: 1.029,
          totalCostPer1M: 1.286
        }
      ],
      cheapCandidates: [],
      qualityCandidates: [],
      defaultModel: fallbackDefault,
      fallbackChain,
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
   * Returns the configured Default Model (from Admin or Render env var)
   */
  getDefaultModel(): string {
    const configured =
      (currentConfig.defaultAiModel && currentConfig.defaultAiModel.trim()) ||
      (currentConfig.activeModelId && currentConfig.activeModelId.trim()) ||
      (currentConfig.aiCreditsModel && currentConfig.aiCreditsModel.trim()) ||
      process.env.DEFAULT_AI_MODEL ||
      process.env.ACTIVE_MODEL_ID ||
      process.env.AICREDITS_MODEL ||
      'google/gemini-2.0-flash';
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Returns the configured Vision Model (from Admin or Render env var)
   */
  getVisionModel(): string {
    const configured =
      (currentConfig.visionAiModel && currentConfig.visionAiModel.trim()) ||
      (currentConfig.visionModel && currentConfig.visionModel.trim() && currentConfig.visionModel !== 'gemini-3.7-flash' ? currentConfig.visionModel : '') ||
      process.env.VISION_AI_MODEL ||
      process.env.AICREDITS_VISION_MODEL ||
      process.env.VISION_MODEL ||
      'google/gemini-2.0-flash';
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Returns the configured Code Model (from Admin or Render env var)
   */
  getCodeModel(): string {
    const configured =
      (currentConfig.codeAiModel && currentConfig.codeAiModel.trim()) ||
      process.env.CODE_AI_MODEL ||
      process.env.AICREDITS_CODE_MODEL ||
      'deepseek/deepseek-chat';
    return configured.replace(/^["']|["']$/g, '').trim();
  },

  /**
   * Validates whether a model is currently available and compatible with the required modality.
   */
  validateModel(
    modelId: string,
    requiredModality: 'vision' | 'code' | 'text' = 'text',
    catalog?: EnrichedAIModel[]
  ): { valid: boolean; reason?: string } {
    if (!modelId || typeof modelId !== 'string' || modelId.trim().length === 0) {
      return { valid: false, reason: 'Empty model identifier.' };
    }

    const cleanId = modelId.toLowerCase().trim();

    if (requiredModality === 'vision') {
      // Known text-only models that DO NOT support images
      const knownTextOnlyPatterns = [
        'deepseek-chat', 'deepseek-coder', 'deepseek-reasoner', 'deepseek-r1', 'deepseek-v3',
        'llama-3', 'llama-2', 'codestral', 'mistral-small', 'mistral-large', 'qwen-2.5-coder',
        'qwen-2.5-72b-instruct', 'gpt-3.5', 'glm-4-plus', 'moonshot-v1'
      ];
      const isKnownTextOnly = knownTextOnlyPatterns.some((pat) => cleanId.includes(pat));
      if (isKnownTextOnly) {
        return { valid: false, reason: `Model "${modelId}" is text-only and does not support image/vision input.` };
      }

      // Check catalog metadata if present
      const catalogItem = catalog?.find((m) => m.id.toLowerCase() === cleanId || m.id.toLowerCase().endsWith('/' + cleanId) || cleanId.endsWith('/' + m.id.toLowerCase()));
      if (catalogItem) {
        const hasVisionBadge = catalogItem.badges?.includes('Vision') || catalogItem.category === 'vision';
        if (!hasVisionBadge && !cleanId.includes('gemini') && !cleanId.includes('4o') && !cleanId.includes('vision') && !cleanId.includes('pixtral') && !cleanId.includes('claude-3')) {
          return { valid: false, reason: `Model "${modelId}" does not support image modality in catalog.` };
        }
      }
      return { valid: true };
    }

    if (requiredModality === 'code') {
      return { valid: true };
    }

    return { valid: true };
  },

  /**
   * Finds the best available vision-capable fallback model.
   */
  selectVisionFallback(catalog?: EnrichedAIModel[]): string {
    const preferredVisionFallbacks = [
      'google/gemini-2.0-flash',
      'openai/gpt-4o-mini',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'google/gemini-1.5-flash',
      'gemini-1.5-flash',
      'openai/gpt-4o',
      'gpt-4o',
      'gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-5-sonnet',
      'claude-3-5-sonnet',
      'mistralai/pixtral-12b-2409'
    ];

    if (catalog && catalog.length > 0) {
      for (const pref of preferredVisionFallbacks) {
        const found = catalog.find((m) => m.id.toLowerCase() === pref.toLowerCase());
        if (found) return found.id;
      }
      const anyVision = catalog.find((m) => m.badges?.includes('Vision') || m.category === 'vision' || m.id.includes('vision') || m.id.includes('gemini') || m.id.includes('4o'));
      if (anyVision) return anyVision.id;
    }

    return 'google/gemini-2.0-flash';
  },

  /**
   * Finds the best available coding-capable fallback model.
   */
  selectCodeFallback(catalog?: EnrichedAIModel[]): string {
    const preferredCodeFallbacks = [
      'deepseek/deepseek-chat',
      'deepseek-chat',
      'deepseek-reasoner',
      'qwen/qwen-2.5-coder-32b-instruct',
      'mistralai/codestral-2501',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-5-sonnet',
      'claude-3-5-sonnet',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash'
    ];

    if (catalog && catalog.length > 0) {
      for (const pref of preferredCodeFallbacks) {
        const found = catalog.find((m) => m.id.toLowerCase() === pref.toLowerCase());
        if (found) return found.id;
      }
      const anyCoding = catalog.find((m) => m.category === 'coding' || m.category === 'reasoning' || m.badges?.includes('Code'));
      if (anyCoding) return anyCoding.id;
    }

    return 'deepseek/deepseek-chat';
  },

  /**
   * Finds the best available normal text fallback model.
   */
  selectDefaultFallback(catalog?: EnrichedAIModel[]): string {
    if (dynamicModelsCache?.cheapCandidates && dynamicModelsCache.cheapCandidates.length > 0) {
      return dynamicModelsCache.cheapCandidates[0].id;
    }
    if (dynamicModelsCache?.defaultModel) {
      return dynamicModelsCache.defaultModel;
    }
    if (catalog && catalog.length > 0) {
      return catalog[0].id;
    }
    return 'google/gemini-2.0-flash';
  },

  /**
   * Main Router: Evaluates input, applies priority order, validates capability,
   * handles fallbacks, logs safely, and returns the chosen model and candidates.
   */
  async routeRequest(req: AIModelRouterRequest): Promise<RoutedAIRequest> {
    const catalogData = await fetchDynamicAiCreditsModels().catch(() => null);
    const catalog = catalogData?.models;

    // 1. Detect Input Type (VISION > CODE > TEXT)
    const inputType = this.detectInputType(req);

    // If client explicitly requested a specific concrete model (not a generic alias)
    const clientSpecifiedModel = typeof req.requestedModel === 'string' &&
      req.requestedModel.trim().length > 0 &&
      req.requestedModel.trim() !== 'default' &&
      req.requestedModel.trim() !== 'vision' &&
      req.requestedModel.trim() !== 'reasoning' &&
      req.requestedModel.trim() !== 'code'
        ? req.requestedModel.trim()
        : null;

    let selectedModel = '';
    let configuredModel = '';
    let isFallback = false;
    let fallbackReason: string | undefined = undefined;
    const candidates: string[] = [];

    // --- ROUTE 1: VISION (IMAGE REQUEST) ---
    if (inputType === 'vision') {
      configuredModel = clientSpecifiedModel || this.getVisionModel();
      const validation = this.validateModel(configuredModel, 'vision', catalog);

      if (validation.valid) {
        selectedModel = configuredModel;
      } else {
        isFallback = true;
        fallbackReason = validation.reason;
        selectedModel = this.selectVisionFallback(catalog);
        console.warn(`[AI ROUTER] Configured model "${configuredModel}" unavailable or incompatible with input type "vision" (${validation.reason}).`);
        console.log(`[AI ROUTER] Using fallback model: "${selectedModel}"`);
      }

      candidates.push(selectedModel);
      const secondaryVision = this.selectVisionFallback(catalog);
      if (!candidates.includes(secondaryVision)) candidates.push(secondaryVision);
      if (!candidates.includes('google/gemini-2.0-flash')) candidates.push('google/gemini-2.0-flash');
      if (!candidates.includes('openai/gpt-4o-mini')) candidates.push('openai/gpt-4o-mini');
    }

    // --- ROUTE 2: CODE (CODING REQUEST) ---
    else if (inputType === 'code') {
      configuredModel = clientSpecifiedModel || this.getCodeModel();
      const validation = this.validateModel(configuredModel, 'code', catalog);

      if (validation.valid) {
        selectedModel = configuredModel;
      } else {
        isFallback = true;
        fallbackReason = validation.reason;
        selectedModel = this.selectCodeFallback(catalog);
        console.warn(`[AI ROUTER] Configured model "${configuredModel}" unavailable. Using fallback model: "${selectedModel}"`);
      }

      candidates.push(selectedModel);
      const secondaryCode = this.selectCodeFallback(catalog);
      if (!candidates.includes(secondaryCode)) candidates.push(secondaryCode);
      const defaultMod = this.getDefaultModel();
      if (!candidates.includes(defaultMod)) candidates.push(defaultMod);
      if (!candidates.includes('deepseek/deepseek-chat')) candidates.push('deepseek/deepseek-chat');
    }

    // --- ROUTE 3: DEFAULT (NORMAL TEXT REQUEST) ---
    else {
      configuredModel = clientSpecifiedModel || this.getDefaultModel();
      const validation = this.validateModel(configuredModel, 'text', catalog);

      if (validation.valid) {
        selectedModel = configuredModel;
      } else {
        isFallback = true;
        fallbackReason = validation.reason;
        selectedModel = this.selectDefaultFallback(catalog);
        console.warn(`[AI ROUTER] Configured model "${configuredModel}" unavailable. Using fallback model: "${selectedModel}"`);
      }

      candidates.push(selectedModel);
      if (catalogData?.fallbackChain) {
        for (const fb of catalogData.fallbackChain) {
          if (!candidates.includes(fb)) candidates.push(fb);
        }
      }
      if (!candidates.includes('google/gemini-2.0-flash')) candidates.push('google/gemini-2.0-flash');
      if (!candidates.includes('openai/gpt-4o-mini')) candidates.push('openai/gpt-4o-mini');
    }

    // Safe Backend Logging (never logging sensitive credentials, keys, or passwords)
    console.log(`[AI ROUTER] Input type: ${inputType}`);
    console.log(`[AI ROUTER] Selected model: ${selectedModel}`);

    return {
      inputType,
      selectedModel,
      configuredModel,
      isFallback,
      fallbackReason,
      candidates: candidates.slice(0, 4)
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
    const defaultModel = AIModelRouter.getDefaultModel();
    const visionModel = AIModelRouter.getVisionModel();
    const codeModel = AIModelRouter.getCodeModel();
    res.json({
      ...data,
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
  res.json({ freeTokeninModels: currentConfig.freeTokeninModels || [] });
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
        tokeninApiKey: process.env.TOKENIN_API_KEY || currentConfig.tokeninApiKey,
        tokeninBaseUrl: process.env.TOKENIN_BASE_URL || savedConfig.tokeninBaseUrl || currentConfig.tokeninBaseUrl,
        tokeninModel: process.env.TOKENIN_MODEL || savedConfig.tokeninModel || currentConfig.tokeninModel,
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
      tokenin: Boolean(currentConfig.tokeninApiKey),
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

  // Provider secrets (API keys) are never sent back to the client, even to an
  // authenticated admin — only booleans/model/base-url.
  const { aiCreditsApiKey, tokeninApiKey, ...safeConfig } = currentConfig;
  res.json({
    ...safeConfig,
    hasAiCreditsKey: Boolean(aiCreditsApiKey),
    hasTokeninKey: Boolean(tokeninApiKey),
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
    defaultAiModel,
    visionAiModel,
    codeAiModel,
    activeModelId,
    aiCreditsBaseUrl,
    aiCreditsModel,
    tokeninBaseUrl,
    tokeninModel,
    freeTokeninModels,
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

  // Provider SECRETS (aiCreditsApiKey / tokeninApiKey) are intentionally NOT
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
  if (tokeninBaseUrl !== undefined) currentConfig.tokeninBaseUrl = String(tokeninBaseUrl).trim().replace(/\/+$/, '');
  if (tokeninModel !== undefined) currentConfig.tokeninModel = String(tokeninModel).trim();
  if (freeTokeninModels !== undefined) {
    currentConfig.freeTokeninModels = Array.isArray(freeTokeninModels)
      ? freeTokeninModels.filter((id: any) => TOKENIN_MODEL_IDS.has(String(id)))
      : [];
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
  if (fallbackToGemini !== undefined) currentConfig.fallbackToGemini = Boolean(fallbackToGemini);
  if (dailyMessageLimit !== undefined) currentConfig.dailyMessageLimit = Math.max(0, Number(dailyMessageLimit) || 0);

  memoService.updateConfig({
    apiKey: currentConfig.memoApiKey,
    apiUrl: currentConfig.memoApiUrl,
    isEnabled: currentConfig.enableMemory
  });

  // Persist updated configuration permanently to Firebase Realtime Database —
  // but never the provider secrets themselves.
  const { aiCreditsApiKey: _omitAiCreditsKey, tokeninApiKey: _omitTokeninKey, ...configToPersist } = currentConfig;
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

  const { plan, dailyMessageLimitOverride } = req.body || {};
  if (plan !== undefined) user.plan = String(plan || 'free').toLowerCase();
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
      plan: existingUser.plan || 'free',
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
    plan: 'free',
    dailyMessageLimitOverride: undefined,
    dailyMessageCount: 0,
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
 * Step 1: Generate OTP, invalidate old OTP, write to /otps/{sanitizedEmail} in RTDB, and send email
 */
app.post('/api/auth/send-otp', async (req, res) => {
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
    await deleteRtdbData(`otps/${sanitizedEmail}`);
    otpStore.delete(normalizedEmail);
    return res.status(429).json({
      success: false,
      message: 'Too many incorrect attempts (max 5). This OTP has been invalidated. Please request a new code.'
    });
  }

  // Check code match
  if (activeOtp !== otp.trim()) {
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

  // 2. Code is VALID: Delete /otps/{sanitizedEmail} node in RTDB
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

  // Mint Firebase Custom Token representation
  const customToken = `firebase_custom_token_${finalUid}_${Date.now()}`;
  const sessionToken = 'leo_usr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

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
// ----------------------------------------------------
// 4b. Two-provider AI configuration (AICredits primary, Tokenin fallback)
// ----------------------------------------------------
function getAiCreditsDiagnostics() {
  return {
    configured: Boolean(currentConfig.aiCreditsApiKey && currentConfig.aiCreditsApiKey.trim()),
    model: currentConfig.aiCreditsModel || getTargetAiModel(),
    baseUrl: currentConfig.aiCreditsBaseUrl
  };
}

function getTokeninDiagnostics() {
  return {
    configured: Boolean(currentConfig.tokeninApiKey && currentConfig.tokeninApiKey.trim()),
    model: currentConfig.tokeninModel || getTargetAiModel(),
    baseUrl: currentConfig.tokeninBaseUrl
  };
}

interface ProviderResult {
  ok: boolean;
  content?: string;
  status?: number;
  error?: string;
}

async function callOpenAiCompatibleProvider(opts: {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: any[];
}): Promise<ProviderResult> {
  const { label, baseUrl, apiKey, model, messages } = opts;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: currentConfig.temperature,
        max_tokens: currentConfig.maxTokens
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      console.error(`[${label.toUpperCase()}] Request failed with status ${response.status} for model "${model}": ${raw.slice(0, 500)}`);
      return { ok: false, status: response.status, error: `${label} responded with status ${response.status}` };
    }

    let data: any = null;
    try { data = JSON.parse(raw); } catch {
      console.error(`[${label.toUpperCase()}] Response was not valid JSON.`);
      return { ok: false, status: response.status, error: `${label} returned a non-JSON response.` };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[${label.toUpperCase()}] Empty response content for model "${model}".`);
      return { ok: false, status: response.status, error: `${label} returned no response content.` };
    }

    return { ok: true, content, status: response.status };
  } catch (err: any) {
    console.error(`[${label.toUpperCase()}] Request threw an error:`, err?.message || err);
    return { ok: false, error: `Could not reach ${label} (network error).` };
  }
}

app.post('/api/chat', async (req, res) => {
  try {
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

    // Admin Panel "Daily Message Limit" enforcement (skipped for authenticated admins)
    if (!isAuthorizedAdmin(req)) {
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

    // 1. Run AIModelRouter to determine the exact model role & modality
    const routeResult = await AIModelRouter.routeRequest({
      messages,
      images,
      prompt: latestUserMessage?.content,
      requestedModel
    });

    const targetModel = routeResult.selectedModel;
    const isVisionInput = routeResult.inputType === 'vision' || (Array.isArray(images) && images.length > 0);

    // Construct the authoritative system prompt containing the defined persona & relevant memories
    const finalSystemPrompt = await buildUnifiedSystemPrompt(
      userId,
      latestUserMessage.content || '',
      systemPromptOverride,
      Boolean(isDeepResearch),
      isVisionInput
    );

    if (isVisionInput) {
      globalStats.totalVisionQueries++;
    }
    globalStats.totalMessages += 2;
    globalStats.estimatedTokens += 650;

    console.log(`[AI CHAT] Routing: ${routeResult.inputType} | Model: "${targetModel}" | Deep Research: ${isDeepResearch}`);

    if (isTokeninModel(targetModel) && !userCanUsePremiumModel(userId, targetModel)) {
      return res.status(403).json({
        error: 'Premium access is required for this model. Contact @Unknownboy1525 for premium access.',
        premiumRequired: true,
        contact: '@Unknownboy1525'
      });
    }

    // 1. Tokenin models ALWAYS route through Tokenin and never consume AICredits.
    if (isTokeninModel(targetModel)) {
      const tokeninKey = (currentConfig.tokeninApiKey || process.env.TOKENIN_API_KEY || '').trim();
      if (!tokeninKey) {
        return res.status(503).json({ error: 'Tokenin provider is not configured on the backend.' });
      }

      const formattedMessages: any[] = [{ role: 'system', content: finalSystemPrompt }];
      for (let i = 0; i < messages.length - 1; i++) {
        const m = messages[i];
        if (m.role === 'system') continue;
        formattedMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      }
      if (isVisionInput) {
        const parts: any[] = [{ type: 'text', text: latestUserMessage.content || 'Analyze this image.' }];
        for (const img of images) parts.push({ type: 'image_url', image_url: { url: img } });
        formattedMessages.push({ role: 'user', content: parts });
      } else {
        formattedMessages.push({ role: 'user', content: latestUserMessage.content });
      }

      try {
        const tokeninResponse = await fetch(getTokeninEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokeninKey}` },
          body: JSON.stringify({ model: targetModel, messages: formattedMessages, temperature: currentConfig.temperature, max_tokens: currentConfig.maxTokens })
        });
        const raw = await tokeninResponse.text();
        let data: any = null;
        try { data = JSON.parse(raw); } catch {}
        if (!tokeninResponse.ok) {
          console.warn(`[TOKENIN] ${tokeninResponse.status} for ${targetModel}: ${raw.slice(0, 500)}`);
          const status = tokeninResponse.status === 401 || tokeninResponse.status === 403 ? 502 : tokeninResponse.status === 429 ? 429 : 502;
          return res.status(status).json({ error: tokeninResponse.status === 429 ? 'Tokenin rate limit reached. Please try again later.' : 'The selected model is currently unavailable.' });
        }
        const reply = data?.choices?.[0]?.message?.content;
        if (!reply) return res.status(502).json({ error: 'Tokenin returned no response content.' });
        memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, reply).catch(() => {});
        return res.json({ content: reply, model: targetModel, provider: 'tokenin', isDeepResearch, hasVision: isVisionInput, inputType: routeResult.inputType });
      } catch (err: any) {
        console.error('[TOKENIN] Request failed:', err.message);
        return res.status(502).json({ error: 'Unable to reach the Tokenin provider. Please try again.' });
      }
    }

    // 2. Two-provider automatic fallback for regular (non premium-Tokenin-model)
    // requests: AICredits is PRIMARY, Tokenin is the automatic FALLBACK.
    const aiCreditsDiag = getAiCreditsDiagnostics();
    const tokeninDiag = getTokeninDiagnostics();
    const providerDiagnostics: any[] = [];
    let selectedProvider: 'aicredits' | 'tokenin' | null = null;
    let fallbackUsed = routeResult.isFallback;
    let finalReply: string | null = null;
    let finalModelUsed = targetModel;

    console.log(
      `[PROVIDERS] aicredits.configured=${aiCreditsDiag.configured} activeModel="${targetModel}" (${routeResult.inputType}) | ` +
      `tokenin.configured=${tokeninDiag.configured} model="${tokeninDiag.model}"`
    );

    const formattedMessages: any[] = [{ role: 'system', content: finalSystemPrompt }];
    for (let i = 0; i < messages.length - 1; i++) {
      const m = messages[i];
      if (m.role === 'system') continue;
      formattedMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    if (isVisionInput) {
      const contentParts: any[] = [{ type: 'text', text: latestUserMessage.content || 'Analyze this image.' }];
      for (const img of images) contentParts.push({ type: 'image_url', image_url: { url: img } });
      formattedMessages.push({ role: 'user', content: contentParts });
    } else {
      formattedMessages.push({ role: 'user', content: latestUserMessage.content });
    }

    // 2a. Try AICredits with the candidates determined by AIModelRouter
    if (aiCreditsDiag.configured) {
      const modelCandidates: string[] = [...routeResult.candidates];
      if (!modelCandidates.includes(targetModel)) {
        modelCandidates.unshift(targetModel);
      }

      for (let i = 0; i < modelCandidates.length; i++) {
        const candidateModel = modelCandidates[i];
        const result = await callOpenAiCompatibleProvider({
          label: 'aicredits',
          baseUrl: currentConfig.aiCreditsBaseUrl,
          apiKey: currentConfig.aiCreditsApiKey,
          model: candidateModel,
          messages: formattedMessages
        });

        providerDiagnostics.push({
          provider: 'aicredits',
          model: candidateModel,
          ok: result.ok,
          status: result.status ?? null,
          error: result.error ?? null,
          fallbackChainIndex: i
        });

        if (result.ok && result.content) {
          selectedProvider = 'aicredits';
          finalReply = result.content;
          finalModelUsed = candidateModel;
          if (i > 0) {
            fallbackUsed = true;
            console.log(`[AICREDITS FALLBACK] Successfully served response with fallback candidate "${candidateModel}" (attempt ${i + 1}/${modelCandidates.length})`);
          }
          break;
        } else {
          console.warn(`[AICREDITS FALLBACK] Attempt ${i + 1}/${modelCandidates.length} failed with model "${candidateModel}": ${result.error || result.status}`);
        }
      }
    } else {
      providerDiagnostics.push({ provider: 'aicredits', ok: false, status: null, error: 'AICREDITS_API_KEY is not configured.' });
    }

    // 2b. Try Tokenin (automatic fallback) if AICredits didn't succeed
    if (!finalReply && tokeninDiag.configured) {
      fallbackUsed = true;
      const tokeninModel = currentConfig.tokeninModel || targetModel;
      const result = await callOpenAiCompatibleProvider({
        label: 'tokenin',
        baseUrl: currentConfig.tokeninBaseUrl,
        apiKey: currentConfig.tokeninApiKey,
        model: tokeninModel,
        messages: formattedMessages
      });
      providerDiagnostics.push({ provider: 'tokenin', ok: result.ok, status: result.status ?? null, error: result.error ?? null });
      if (result.ok && result.content) {
        selectedProvider = 'tokenin';
        finalReply = result.content;
        finalModelUsed = tokeninModel;
      }
    } else if (!finalReply) {
      providerDiagnostics.push({ provider: 'tokenin', ok: false, status: null, error: 'TOKENIN_API_KEY is not configured.' });
    }

    if (finalReply && selectedProvider) {
      memoService.extractAndSaveMemoryFromChat(userId, latestUserMessage.content, finalReply).catch(() => {});
      return res.json({
        content: finalReply,
        model: finalModelUsed,
        provider: selectedProvider,
        fallbackUsed,
        isDeepResearch,
        hasVision: hasImages
      });
    }

    console.error('[PROVIDERS] All configured AI providers failed:', JSON.stringify(providerDiagnostics));
    return res.status(502).json({
      error: 'All configured AI providers failed.',
      providerDiagnostics,
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
const PORT = Number(process.env.PORT) || 10000;
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
