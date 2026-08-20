import { AIConfig, ChatSession, MemoMemoryItem, Message, SystemStats, UserProfile } from '../types';

const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

let adminAuthToken = localStorage.getItem('leo_admin_token') || '';

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
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    isDeepResearch?: boolean;
    hasVision?: boolean;
  }> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Chat request failed' }));
      throw new Error(err.error || 'Failed to communicate with Leo AI');
    }
    return res.json();
  },

  async adminLogin(password: string): Promise<{ success: boolean; token: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid admin password');
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
    if (!res.ok) throw new Error('Unauthorized or failed to load config');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to save configuration');
    return res.json();
  },

  async getAdminStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json();
  },

  async getAdminUsers(): Promise<{ users: UserProfile[] }> {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminAuthToken}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load users');
    return res.json();
  },

  async getMemories(userId = 'default-user'): Promise<MemoMemoryItem[]> {
    const res = await fetch(`${API_BASE}/api/memory?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.memories || [];
  },

  async addMemory(memory: { userId?: string; text: string; category?: string }): Promise<MemoMemoryItem> {
    const res = await fetch(`${API_BASE}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    if (!res.ok) throw new Error('Failed to save memory');
    const data = await res.json();
    return data.memory;
  },

  async deleteMemory(id: string, userId = 'default-user'): Promise<void> {
    await fetch(`${API_BASE}/api/memory/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },

  async getChats(userId = 'default-user'): Promise<ChatSession[]> {
    const res = await fetch(`${API_BASE}/api/chats?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.chats || [];
  },

  async saveChat(chat: Partial<ChatSession> & { id: string }): Promise<void> {
    await fetch(`${API_BASE}/api/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chat),
    });
  },

  async deleteChat(id: string): Promise<void> {
    await fetch(`${API_BASE}/api/chats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
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
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to send OTP to email');
    }
    return data;
  },

  async verifyEmailOtp(params: {
    email: string;
    otp: string;
    userProfile?: Partial<UserProfile>;
  }): Promise<{ success: boolean; message: string; user: UserProfile; customToken?: string; token?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid or expired OTP');
    }
    return data;
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },
};
