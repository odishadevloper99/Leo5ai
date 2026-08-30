/**
 * Memo Service - Persistent AI User Memory (Mem0 integration wrapper)
 */
class MemoService {
  private apiKey: string = process.env.MEMO_API_KEY || '';
  private apiUrl: string = process.env.MEMO_API_URL || 'https://api.mem0.ai/v1';

  updateConfig(config: { apiKey?: string; apiUrl?: string; isEnabled?: boolean }) {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl;
  }

  async getMemories(userId: string): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.apiUrl}/memories?user_id=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      return Array.isArray(data) ? data : data.memories || [];
    } catch {
      return [];
    }
  }

  async searchRelevantMemories(userId: string, query: string, limit = 5): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.apiUrl}/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({ user_id: userId, query, limit }),
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      return Array.isArray(data) ? data : data.memories || [];
    } catch {
      return [];
    }
  }

  async addMemory(userId: string, text: string, category = 'general'): Promise<any> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.apiUrl}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          user_id: userId,
          metadata: { category },
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async updateMemory(memoryId: string, text: string, userId: string): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.apiUrl}/memories/${memoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({ text, user_id: userId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async deleteMemory(memoryId: string, userId: string): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.apiUrl}/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async deleteAllMemories(userId: string): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${this.apiUrl}/memories?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async buildMemoryPromptContext(userId: string, query: string): Promise<string> {
    const memories = await this.searchRelevantMemories(userId, query, 5);
    if (!memories || memories.length === 0) return '';
    const formatted = memories.map((m: any) => `- ${m.memory || m.text || JSON.stringify(m)}`).join('\n');
    return `\n[User Persistent Memories & Preferences]:\n${formatted}\n`;
  }

  async extractAndSaveMemoryFromChat(userId: string, userText: string, assistantText: string): Promise<void> {
    if (!this.apiKey || !userText) return;
    try {
      await fetch(`${this.apiUrl}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: userText },
            { role: 'assistant', content: assistantText }
          ],
          user_id: userId,
        }),
      });
    } catch {}
  }
}

export const memoService = new MemoService();
