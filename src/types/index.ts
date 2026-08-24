export interface DailyUsageLimitSettings {
  enabled: boolean;
  limit: number;
  limitType: 'requests' | 'credits';
  timezone?: string; // default "Asia/Kolkata"
  warningThresholdPercent?: number; // default 80
}

export interface UserUsageStatus {
  userId: string;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  used: number;
  limit: number;
  remaining: number;
  enabled: boolean;
  limitType: 'requests' | 'credits';
  isOverride: boolean;
  overrideLimit?: number | null;
  isAdmin: boolean;
  isNearLimit: boolean; // >= 80% of limit
  isLimitReached: boolean;
  resetsAt: number; // Unix timestamp for next midnight reset
  timezone: string;
}

export interface AdminUsageAnalytics {
  totalRequestsToday: number;
  activeUsersToday: number;
  usersNearLimitCount: number;
  usersLimitReachedCount: number;
  globalSettings: DailyUsageLimitSettings;
  userBreakdown: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role: string;
    plan: string;
    usedToday: number;
    effectiveLimit: number;
    isOverride: boolean;
    overrideLimit?: number | null;
    isLimitReached: boolean;
    isNearLimit: boolean;
    lastActive?: number;
  }[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  images?: string[]; // base64 or URLs for Vision analysis
  isDeepResearch?: boolean;
  thinkingProcess?: string;
  memoryExtracted?: string[];
  status?: 'sending' | 'streaming' | 'completed' | 'error';
  modelUsed?: string;
}

export interface ChatSession {
  id: string;
  userId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  pinned?: boolean;
  model?: string;
  systemPromptOverride?: string;
}

export interface UserProfile {
  uid: string;
  googleId?: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAnonymous?: boolean;
  role?: 'admin' | 'user';
  credits?: number;
  plan?: 'free' | 'pro' | 'ultra' | 'premium';
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: number;
  phone?: string;
  createdAt?: number;
  lastLoginAt?: number;
  lastActive?: number;
  chatCount?: number;
  dailyMessageLimitOverride?: number | null;
  dailyMessageCount?: number;
  dailyChatLimit?: number;
  dailyChatsUsed?: number;
  dailyUsage?: {
    date: string;
    count: number;
    limit: number;
  };
}

export interface MemoMemoryItem {
  id: string;
  userId: string;
  text: string;
  category: 'preference' | 'fact' | 'project' | 'general';
  createdAt: number;
  confidence?: number;
}

export interface AIConfig {
  aiCreditsBaseUrl: string;
  aiCreditsApiKey?: string;
  aiCreditsModel?: string;
  freeTokeninModels?: string[];
  hasAiCreditsKey?: boolean;
  tokeninBaseUrl: string;
  tokeninApiKey?: string;
  tokeninModel?: string;
  hasTokeninKey?: boolean;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  memoApiKey: string;
  memoApiUrl: string;
  enableDeepResearch: boolean;
  enableVision: boolean;
  enableMemory: boolean;
  fallbackToGemini: boolean;
  dailyMessageLimit: number;
  dailyLimitSettings?: DailyUsageLimitSettings;
  aiProvider?: 'aicredits' | 'tokenin';
  enableProviderFallback?: boolean;
  mongoDbConfigured: boolean;
  firebaseConfigured: boolean;
}

export interface PricingPlan {
  id: 'free' | 'pro' | 'ultra';
  name: string;
  price: number;
  durationDays: number;
  dailyChatLimit: number;
  features: string[];
}

export interface PaymentOrder {
  orderId: string;
  paymentSessionId: string;
  orderAmount: number;
  orderCurrency: string;
  planId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: number;
}

export interface SystemStats {
  totalChats: number;
  totalMessages: number;
  totalVisionQueries: number;
  totalMemories: number;
  activeUsersCount: number;
  estimatedTokens: number;
  serverUptime: number;
}

export interface AIModelDefinition {
  id: string;
  name: string;
  company: string;
  category: 'text' | 'vision' | 'reasoning' | 'coding';
  description: string;
  badges: string[];
  iconKey: string;
  provider: 'aicredits' | 'tokenin' | 'gemini';
  isNew?: boolean;
  tier?: 'cheap' | 'quality' | 'standard';
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  totalCostPer1M?: number;
  isDefault?: boolean;
  contextLength?: number;
}

export interface DynamicModelsResponse {
  models: AIModelDefinition[];
  cheapCandidates: AIModelDefinition[];
  qualityCandidates: AIModelDefinition[];
  defaultModel: string;
  fallbackChain: string[];
  lastUpdated: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Writing' | 'Coding' | 'Research' | 'Productivity' | 'Creative';
  prompt: string;
  icon: string;
  isVisionPrompt?: boolean;
}
