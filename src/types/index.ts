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
  plan?: 'free' | 'pro' | 'ultra';
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: number;
  phone?: string;
  createdAt?: number;
  lastLoginAt?: number;
  lastActive?: number;
  chatCount?: number;
  dailyMessageLimitOverride?: number;
  dailyMessageCount?: number;
}

export interface AIConfig {
  aiCreditsBaseUrl: string;
  aiCreditsModel?: string;
  hasAiCreditsKey?: boolean;
  tokeninBaseUrl: string;
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
  mongoDbConfigured: boolean;
  firebaseConfigured: boolean;
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

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Writing' | 'Coding' | 'Research' | 'Productivity' | 'Creative';
  prompt: string;
  icon: string;
  isVisionPrompt?: boolean;
}
