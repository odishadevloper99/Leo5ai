import { ChatSession } from '../types';
import { INITIAL_CHAT_SESSIONS } from './prompts';

const SESSIONS_STORAGE_KEY = 'leo_chat_sessions';

/**
 * Strips heavy data URLs from session messages to prevent exceeding localStorage quota (~5MB).
 */
function sanitizeSessionsForStorage(sessions: ChatSession[]): ChatSession[] {
  return sessions.slice(0, 30).map((session) => ({
    ...session,
    messages: (session.messages || []).slice(-50).map((msg) => {
      if (!msg.images || msg.images.length === 0) {
        return msg;
      }
      return {
        ...msg,
        // Keep URLs, but omit massive base64 payloads to save storage
        images: msg.images.map((img) =>
          img.startsWith('data:') && img.length > 2048 ? '[attached_image]' : img
        ),
      };
    }),
  }));
}

/**
 * Safely saves chat sessions to localStorage with quota protection and fallback trimming.
 */
export function saveStoredSessions(sessions: ChatSession[]): void {
  try {
    const sanitized = sanitizeSessionsForStorage(sessions);
    const serialized = JSON.stringify(sanitized);
    localStorage.setItem(SESSIONS_STORAGE_KEY, serialized);
  } catch (err: any) {
    console.warn('[Leo AI Storage] Quota exceeded on normal save, attempting aggressive trim:', err?.message);
    try {
      // Aggressive fallback: keep only last 10 sessions, last 20 messages, strip images completely
      const minimal = sessions.slice(0, 10).map((s) => ({
        ...s,
        messages: (s.messages || []).slice(-20).map((m) => ({
          ...m,
          images: undefined,
        })),
      }));
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(minimal));
    } catch (e) {
      console.warn('[Leo AI Storage] LocalStorage write failed completely, skipping local cache to prevent app crash:', e);
    }
  }
}

/**
 * Safely loads chat sessions from localStorage.
 */
export function getStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return INITIAL_CHAT_SESSIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('[Leo AI Storage] Failed to parse stored sessions:', e);
  }
  return INITIAL_CHAT_SESSIONS;
}

/**
 * Safe wrapper for setting any localStorage key without throwing QuotaExceededError.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Leo AI Storage] Could not set item "${key}":`, e);
    return false;
  }
}

/**
 * Safe wrapper for getting any localStorage key.
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
