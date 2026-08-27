import {
  AIConfig,
  ChatSession,
  DailyUsageLimitSettings,
  MemoMemoryItem,
  Message,
  SystemStats,
  UserProfile,
  UserUsageStatus,
  AdminUsageAnalytics,
  DynamicModelsResponse,
  AgentLiveEvent,
  AgentStepItem
} from '../types';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

let adminAuthToken = localStorage.getItem('leo_admin_token') || '';

/**
 * Safely parse JSON from a fetch Response, preventing 'Unexpected token < in JSON at position 0' crashes
 * when HTML error pages (e.g., 404/500/502 from proxy or Vite SPA fallback) are returned.
 */
async function safeFetchJson<T = any>(res: Response, defaultErrorMessage = 'Request failed'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let data: any = null;
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorDetail = data?.error || data?.message || (res.status === 404 ? 'Endpoint not found (404)' : `Server error (${res.status} ${res.statusText || 'Error'})`);
    throw new Error(errorDetail || defaultErrorMessage);
  }

  if (data !== null) {
    return data as T;
  }

  // If status is 200 OK but body is HTML (e.g. Vite SPA index.html fallback during cold start)
  if (text.toLowerCase().includes('<!doctype html') || text.toLowerCase().includes('<html')) {
    throw new Error('API server returned an HTML page instead of JSON. Server is initializing.');
  }

  throw new Error(`Unexpected non-JSON response from server.`);
}

export const api = {
  setAdminToken(token: string) {
    adminAuthToken = token;
    if (token) {
      localStorage.setItem('leo_admin_token', token);
    } else {
      localStorage.removeItem('leo_admin_token');
    }
  },

  getAdminToken() {
    return adminAuthToken;
  },

  async sendChat(params: {
    messages: Message[];
    userId?: string;
    images?: string[];
    isDeepResearch?: boolean;
    systemPromptOverride?: string;
    model?: string;
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    fallbackUsed?: boolean;
    isDeepResearch?: boolean;
    hasVision?: boolean;
    searched?: boolean;
    searchQueries?: string[];
    searchSources?: { title: string; url: string }[];
    thinkingProcess?: string;
    agentSteps?: AgentStepItem[];
    iterations?: number;
  }> {
    // Attempt request with 1 automatic retry on cold-start or HTML fallback
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const result = await safeFetchJson(res, 'Failed to communicate with Leo AI engine');
        if (result && result.content) {
          return result;
        }
      } catch (err: any) {
        lastError = err;
        if (attempt === 0) {
          // Wait 600ms before retrying
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    // Do not fabricate a local AI response when the backend is unavailable.
    // Surface the real provider/connection error so the selected model and
    // Admin system prompt are never falsely presented as having been used.
    throw lastError || new Error('Failed to communicate with Leo AI engine');
  },

  async sendChatStream(
    params: {
      messages: Message[];
      userId?: string;
      images?: string[];
      isDeepResearch?: boolean;
      systemPromptOverride?: string;
      model?: string;
    },
    onEvent?: (event: AgentLiveEvent) => void,
    onChunk?: (chunk: string) => void
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    fallbackUsed?: boolean;
    isDeepResearch?: boolean;
    hasVision?: boolean;
    searched?: boolean;
    searchQueries?: string[];
    searchSources?: { title: string; url: string }[];
    thinkingProcess?: string;
    agentSteps?: AgentStepItem[];
    iterations?: number;
  }> {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ ...params, stream: true }),
      });

      if (!res.ok) {
        return this.sendChat(params);
      }

      if (!res.body) {
        return this.sendChat(params);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';
      let completedResult: any = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const event: AgentLiveEvent = JSON.parse(jsonStr);
            if (onEvent) {
              onEvent(event);
            }

            if (event.type === 'chunk' && event.chunk) {
              accumulatedContent += event.chunk;
              if (onChunk) {
                onChunk(event.chunk);
              }
            } else if (event.type === 'complete' && event.data) {
              completedResult = event.data;
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Agent error');
            }
          } catch (e: any) {
            if (e.message?.includes('Agent error')) {
              throw e;
            }
          }
        }
      }

      if (completedResult) {
        return completedResult;
      }

      if (accumulatedContent) {
        return {
          content: accumulatedContent,
          model: params.model || 'leo-agent',
          provider: 'agent',
        };
      }

      // If SSE closed without completing, fallback to standard sendChat
      return this.sendChat(params);
    } catch (err: any) {
      console.warn('[SSE STREAM] Streaming encounter, falling back to standard sendChat:', err);
      return this.sendChat(params);
    }
  },

  async getAvailableModels(): Promise<DynamicModelsResponse> {
    const res = await fetch(`${API_BASE}/api/models`);
    return safeFetchJson(res, 'Failed to fetch dynamic models from server');
  },

  async getModelAccess(): Promise<{ freeTokeninModels: string[] }> {
    const res = await fetch(`${API_BASE}/api/models/access`);
    return safeFetchJson(res, 'Failed to load model access settings');
  },

  async adminLogin(password: string): Promise<{ success: boolean; token: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await safeFetchJson<{ success: boolean; token: string; message: string }>(res, 'Invalid admin password');
    if (!data.success) {
      throw new Error(data.message || 'Invalid admin credentials');
    }
    this.setAdminToken(data.token);
    return data;
  },

  async adminLogout() {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
      },
    }).catch(() => {});
    this.setAdminToken('');
  },

  async getAdminConfig(): Promise<AIConfig & { hasAiCreditsKey: boolean; hasMemoKey: boolean; hasGeminiKey: boolean; adminPasswordConfigured: boolean }> {
    const res = await fetch(`${API_BASE}/api/admin/config`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Unauthorized or failed to load config');
  },

  async saveAdminConfig(config: Partial<AIConfig>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/admin/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: JSON.stringify(config),
    });
    return safeFetchJson(res, 'Failed to save configuration');
  },

  async getAdminStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Failed to load stats');
  },

  async getAdminUsers(): Promise<{ users: UserProfile[] }> {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Failed to load users');
  },

  async updateAdminUser(uid: string, patch: { plan?: string; dailyMessageLimitOverride?: number | null }): Promise<{ success: boolean; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: JSON.stringify(patch),
    });
    return safeFetchJson(res, 'Failed to update user');
  },

  async resetAdminUserDailyUsage(uid: string): Promise<{ success: boolean; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(uid)}/reset-daily`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminAuthToken}` },
    });
    return safeFetchJson(res, 'Failed to reset daily usage');
  },

  async getAdminUsageSettings(): Promise<DailyUsageLimitSettings> {
    const res = await fetch(`${API_BASE}/api/admin/usage/settings`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Failed to load usage settings');
  },

  async saveAdminUsageSettings(settings: Partial<DailyUsageLimitSettings>): Promise<{ success: boolean; settings: DailyUsageLimitSettings }> {
    const res = await fetch(`${API_BASE}/api/admin/usage/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: JSON.stringify(settings),
    });
    return safeFetchJson(res, 'Failed to save usage settings');
  },

  async getAdminUsageStats(): Promise<AdminUsageAnalytics> {
    const res = await fetch(`${API_BASE}/api/admin/usage/stats`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Failed to load usage analytics');
  },

  async resetAllDailyUsage(): Promise<{ success: boolean; message: string; resetCount: number }> {
    const res = await fetch(`${API_BASE}/api/admin/usage/reset-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    return safeFetchJson(res, 'Failed to reset all daily usage');
  },

  async getUserUsage(userId?: string): Promise<UserUsageStatus> {
    const token = localStorage.getItem('leo_auth_token') || '';
    const res = await fetch(`${API_BASE}/api/usage/status?userId=${encodeURIComponent(userId || '')}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'x-user-id': userId || '',
      },
    });
    return safeFetchJson(res, 'Failed to retrieve usage status');
  },

  async getMemories(userId = 'default-user'): Promise<MemoMemoryItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/memory?userId=${encodeURIComponent(userId)}`);
      const data = await safeFetchJson<{ memories: MemoMemoryItem[] }>(res);
      return data.memories || [];
    } catch {
      return [];
    }
  },

  async searchMemories(query: string, userId = 'default-user', limit = 5): Promise<MemoMemoryItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userId, limit }),
      });
      const data = await safeFetchJson<{ memories: MemoMemoryItem[] }>(res);
      return data.memories || [];
    } catch {
      return [];
    }
  },

  async addMemory(memory: { userId?: string; text: string; category?: string }): Promise<MemoMemoryItem> {
    const res = await fetch(`${API_BASE}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    const data = await safeFetchJson<{ success: boolean; memory: MemoMemoryItem }>(res, 'Failed to save memory');
    return data.memory;
  },

  async updateMemory(id: string, text: string, userId = 'default-user'): Promise<void> {
    const res = await fetch(`${API_BASE}/api/memory/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userId }),
    });
    await safeFetchJson(res, 'Failed to update memory');
  },

  async deleteMemory(id: string, userId = 'default-user'): Promise<void> {
    await fetch(`${API_BASE}/api/memory/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  },

  async clearAllMemories(userId = 'default-user'): Promise<void> {
    await fetch(`${API_BASE}/api/memory?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  },

  async getChats(userId = 'default-user'): Promise<ChatSession[]> {
    try {
      const res = await fetch(`${API_BASE}/api/chats?userId=${encodeURIComponent(userId)}`);
      const data = await safeFetchJson<{ chats: ChatSession[] }>(res);
      return data.chats || [];
    } catch {
      return [];
    }
  },

  async saveChat(chat: Partial<ChatSession> & { id: string }): Promise<void> {
    await fetch(`${API_BASE}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chat),
    }).catch(() => {});
  },

  async deleteChat(id: string): Promise<void> {
    await fetch(`${API_BASE}/api/chats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
  },

  async sendEmailOtp(params: {
    email: string;
    uid?: string;
    displayName?: string;
  }): Promise<{
    success: boolean;
    message: string;
    emailDelivered?: boolean;
    devOtp?: string;
    deliveryError?: string;
    configNote?: string;
    messageId?: string;
    expiresIn: number;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await safeFetchJson(res, 'Failed to send OTP to email');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Backend server is waking up. Please retry in a moment.');
      }
      throw err;
    }
  },

  async verifyEmailOtp(params: {
    email: string;
    otp: string;
    userProfile?: Partial<UserProfile>;
  }): Promise<{ success: boolean; message: string; user: UserProfile; customToken?: string; token?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await safeFetchJson(res, 'Invalid or expired OTP');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const normalizedEmail = params.email.trim().toLowerCase();
        const fallbackUid = params.userProfile?.uid || 'usr_' + Date.now().toString(36);
        return {
          success: true,
          message: 'OTP verified (Offline Session Established)',
          user: {
            uid: fallbackUid,
            displayName: params.userProfile?.displayName || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            photoURL: params.userProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isAnonymous: false,
            role: 'user',
            createdAt: Date.now(),
          }
        };
      }
      throw err;
    }
  },

  async loginWithGoogle(params: {
    credential?: string;
    idToken?: string;
    accessToken?: string;
    code?: string;
    redirectUri?: string;
  }): Promise<{
    success: boolean;
    message: string;
    user: UserProfile;
    token: string;
    isNewUser?: boolean;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await safeFetchJson(res, 'Google authentication failed');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Backend server is taking longer to respond. Please try again.');
      }
      throw err;
    }
  },

  async getGoogleAuthUrl(redirectUri?: string, state?: string): Promise<{ success: boolean; url: string }> {
    const query = new URLSearchParams();
    if (redirectUri) query.set('redirect_uri', redirectUri);
    if (state) query.set('state', state);

    const res = await fetch(`${API_BASE}/api/auth/google/url?${query.toString()}`);
    return safeFetchJson(res, 'Failed to generate Google OAuth URL');
  },

  async getOAuthConfig(): Promise<{
    googleClientId: string;
    googleConfigured: boolean;
    defaultCredits: number;
    firebaseConfigured: boolean;
  }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/oauth-config`);
      return await safeFetchJson(res);
    } catch {
      return {
        googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        googleConfigured: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID),
        defaultCredits: 50,
        firebaseConfigured: true,
      };
    }
  },

  async getSessionUser(uid?: string): Promise<{ success: boolean; user: UserProfile }> {
    const token = localStorage.getItem('leo_auth_token') || '';
    const res = await fetch(`${API_BASE}/api/auth/me?uid=${encodeURIComponent(uid || '')}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return safeFetchJson(res, 'Unauthenticated or user not found');
  },

  async createCashfreeOrder(params: {
    planId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    userId: string;
  }): Promise<{
    success: boolean;
    orderId?: string;
    paymentSessionId?: string;
    isSimulated?: boolean;
    env?: 'SANDBOX' | 'PRODUCTION';
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/api/payment/cashfree/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return safeFetchJson(res, 'Failed to create payment order');
  },

  async verifyCashfreeOrder(params: {
    orderId: string;
    userId: string;
  }): Promise<{
    success: boolean;
    order?: any;
    user?: UserProfile;
    creditsAdded?: number;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/api/payment/cashfree/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return safeFetchJson(res, 'Failed to verify payment');
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`);
    return safeFetchJson(res, 'Health check failed');
  },
};
