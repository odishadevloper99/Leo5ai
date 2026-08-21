/**
 * Dedicated Memo API / Long-Term Memory Service
 * Production-ready implementation with fallback caching and security guardrails.
 */

export interface MemoItem {
  id: string;
  userId: string;
  text: string;
  category: 'preference' | 'fact' | 'project' | 'general';
  createdAt: number;
  confidence?: number;
}

export class MemoService {
  private apiKey: string;
  private apiUrl: string;
  private isEnabled: boolean;
  private localFallbackStore: Map<string, MemoItem[]>;

  constructor() {
    this.apiKey = (process.env.MEMO_API_KEY || '').trim();
    this.apiUrl = (process.env.MEMO_API_URL || 'https://api.mem0.ai/v1').replace(/\/+$/, '');
    this.isEnabled = true;
    this.localFallbackStore = new Map();

    // Pre-seed some default demo preferences for default-user
    this.localFallbackStore.set('default-user', [
      {
        id: 'mem-1',
        userId: 'default-user',
        text: 'Prefers clean, modern UI designs with high contrast and readable typography.',
        category: 'preference',
        createdAt: Date.now() - 86400000 * 2,
        confidence: 0.98,
      },
      {
        id: 'mem-2',
        userId: 'default-user',
        text: 'Currently developing Leo AI full-stack application.',
        category: 'project',
        createdAt: Date.now() - 86400000,
        confidence: 0.95,
      },
    ]);
  }

  /**
   * Update configuration dynamically from runtime/admin panel
   */
  public updateConfig(config: { apiKey?: string; apiUrl?: string; isEnabled?: boolean }) {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey.trim();
    if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    if (config.isEnabled !== undefined) this.isEnabled = Boolean(config.isEnabled);
  }

  public getStatus() {
    return {
      hasApiKey: Boolean(this.apiKey && this.apiKey.length > 0),
      apiUrl: this.apiUrl,
      isEnabled: this.isEnabled,
      totalLocalUsers: this.localFallbackStore.size,
    };
  }

  /**
   * Helper to make authorized requests to Memo / Mem0 API with timeout
   */
  private async requestMemoApi(path: string, options: RequestInit = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('MEMO_API_KEY not configured');
    }

    const url = `${this.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s max timeout to prevent blocking

    try {
      const authHeader = this.apiKey.startsWith('Token ') || this.apiKey.startsWith('Bearer ')
        ? this.apiKey
        : `Token ${this.apiKey}`;

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          ...(options.headers || {}),
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Memo API HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Retrieve all memories for a user
   */
  public async getMemories(userId: string): Promise<MemoItem[]> {
    if (!userId) return [];

    // If Memo API is configured, try remote first
    if (this.apiKey) {
      try {
        const data = await this.requestMemoApi(`/memories/?user_id=${encodeURIComponent(userId)}`, {
          method: 'GET',
        });

        // Normalize response from Mem0 API: array of objects or { results: [...] }
        const rawList = Array.isArray(data) ? data : data?.results || [];
        if (Array.isArray(rawList)) {
          const formatted: MemoItem[] = rawList.map((item: any) => ({
            id: item.id || `mem-${Math.random().toString(36).substring(2, 9)}`,
            userId,
            text: item.memory || item.text || item.content || JSON.stringify(item),
            category: (item.metadata?.category as any) || 'general',
            createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            confidence: item.score || 0.95,
          }));

          // Synchronize local fallback cache
          this.localFallbackStore.set(userId, formatted);
          return formatted;
        }
      } catch (err: any) {
        console.warn(`[MemoService] Remote fetch failed (${err.message}). Using local fallback store.`);
      }
    }

    // Fallback to local memory cache
    return this.localFallbackStore.get(userId) || [];
  }

  /**
   * Search relevant memories for a user query
   */
  public async searchRelevantMemories(userId: string, query: string, limit: number = 5): Promise<MemoItem[]> {
    if (!this.isEnabled || !userId || !query.trim()) {
      return [];
    }

    // Try remote vector search via Memo API
    if (this.apiKey) {
      try {
        const data = await this.requestMemoApi(`/memories/search/`, {
          method: 'POST',
          body: JSON.stringify({
            query: query.trim(),
            user_id: userId,
            limit,
          }),
        });

        const rawList = Array.isArray(data) ? data : data?.results || [];
        if (Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map((item: any) => ({
            id: item.id || `mem-${Math.random().toString(36).substring(2, 9)}`,
            userId,
            text: item.memory || item.text || item.content || '',
            category: (item.metadata?.category as any) || 'preference',
            createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
            confidence: item.score || 0.9,
          })).filter(m => Boolean(m.text));
        }
      } catch (err: any) {
        console.warn(`[MemoService] Remote search failed (${err.message}). Falling back to local semantic match.`);
      }
    }

    // Local semantic keyword matching
    const all = this.localFallbackStore.get(userId) || [];
    const queryTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    if (queryTokens.length === 0) {
      return all.slice(0, limit);
    }

    const scored = all.map(mem => {
      const textLower = mem.text.toLowerCase();
      let score = 0;
      for (const token of queryTokens) {
        if (textLower.includes(token)) score += 1;
      }
      return { mem, score };
    });

    // Return matched or most recent memories if general
    const matches = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.mem);
    if (matches.length > 0) {
      return matches.slice(0, limit);
    }

    return all.slice(0, limit);
  }

  /**
   * Add a new explicit memory item
   */
  public async addMemory(
    userId: string,
    text: string,
    category: 'preference' | 'fact' | 'project' | 'general' = 'preference'
  ): Promise<MemoItem> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Memory text cannot be empty');
    }

    // Check for sensitive credential data
    if (this.containsSensitiveData(cleanText)) {
      throw new Error('Security policy: API keys, passwords, and sensitive credentials cannot be stored in memory.');
    }

    let createdId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (this.apiKey) {
      try {
        const data = await this.requestMemoApi(`/memories/`, {
          method: 'POST',
          body: JSON.stringify({
            messages: [{ role: 'user', content: cleanText }],
            user_id: userId,
            metadata: { category },
          }),
        });

        if (data?.id) createdId = data.id;
        else if (Array.isArray(data) && data[0]?.id) createdId = data[0].id;
        else if (data?.results?.[0]?.id) createdId = data.results[0].id;
      } catch (err: any) {
        console.warn(`[MemoService] Remote add failed (${err.message}). Storing in local cache.`);
      }
    }

    const newItem: MemoItem = {
      id: createdId,
      userId,
      text: cleanText,
      category,
      createdAt: Date.now(),
      confidence: 0.99,
    };

    const existing = this.localFallbackStore.get(userId) || [];
    // Deduplicate
    const isDuplicate = existing.some(
      m => m.text.toLowerCase() === cleanText.toLowerCase()
    );
    if (!isDuplicate) {
      existing.unshift(newItem);
      this.localFallbackStore.set(userId, existing);
    }

    return newItem;
  }

  /**
   * Update an existing memory
   */
  public async updateMemory(memoryId: string, text: string, userId?: string): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;

    if (this.containsSensitiveData(cleanText)) {
      throw new Error('Security policy: Sensitive credentials cannot be stored in memory.');
    }

    if (this.apiKey) {
      try {
        await this.requestMemoApi(`/memories/${encodeURIComponent(memoryId)}/`, {
          method: 'PUT',
          body: JSON.stringify({ text: cleanText }),
        });
      } catch (err: any) {
        console.warn(`[MemoService] Remote update failed: ${err.message}`);
      }
    }

    // Update in local cache
    for (const [uid, list] of this.localFallbackStore.entries()) {
      if (userId && uid !== userId) continue;
      const target = list.find(m => m.id === memoryId);
      if (target) {
        target.text = cleanText;
        return true;
      }
    }

    return true;
  }

  /**
   * Delete a specific memory item
   */
  public async deleteMemory(memoryId: string, userId?: string): Promise<boolean> {
    if (!memoryId) return false;

    if (this.apiKey) {
      try {
        await this.requestMemoApi(`/memories/${encodeURIComponent(memoryId)}/`, {
          method: 'DELETE',
        });
      } catch (err: any) {
        console.warn(`[MemoService] Remote delete failed: ${err.message}`);
      }
    }

    // Remove from local cache
    for (const [uid, list] of this.localFallbackStore.entries()) {
      if (userId && uid !== userId) continue;
      const filtered = list.filter(m => m.id !== memoryId);
      this.localFallbackStore.set(uid, filtered);
    }

    return true;
  }

  /**
   * Delete all memories for a given user
   */
  public async deleteAllMemories(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (this.apiKey) {
      try {
        await this.requestMemoApi(`/memories/?user_id=${encodeURIComponent(userId)}`, {
          method: 'DELETE',
        });
      } catch (err: any) {
        console.warn(`[MemoService] Remote clear failed: ${err.message}`);
      }
    }

    this.localFallbackStore.delete(userId);
    return true;
  }

  /**
   * Automatically extract and save useful long-term information asynchronously
   */
  public async extractAndSaveMemoryFromChat(userId: string, userMsg: string, aiReply: string): Promise<void> {
    if (!this.isEnabled || !userId || !userMsg) return;

    // Check for sensitive credentials
    if (this.containsSensitiveData(userMsg)) {
      return;
    }

    // Filter out temporary questions, one-time commands, greetings, simple math
    const isTemporary = /^(hi|hello|hey|what is|how are you|calculate|what time|translate|who is|solve|summarize this)/i.test(
      userMsg.trim()
    );

    // Extraction patterns for long-term user facts
    const patterns = [
      { regex: /(?:my name is|i am|call me)\s+([A-Za-z0-9_\-\s]{2,30})/i, category: 'fact' as const, prefix: 'User name is' },
      { regex: /(?:i prefer|i like|i love|my preferred|always use)\s+([^.,\n]{3,80})/i, category: 'preference' as const, prefix: 'User prefers' },
      { regex: /(?:i do not like|i hate|don't use|avoid)\s+([^.,\n]{3,80})/i, category: 'preference' as const, prefix: 'User dislikes' },
      { regex: /(?:i am working on|i'm building|my project is|our stack is)\s+([^.,\n]{3,80})/i, category: 'project' as const, prefix: 'User is working on' },
      { regex: /(?:i live in|i am from|my timezone is)\s+([^.,\n]{3,60})/i, category: 'fact' as const, prefix: 'User location/timezone is' },
    ];

    for (const pat of patterns) {
      const match = userMsg.match(pat.regex);
      if (match && match[1]) {
        const capturedValue = match[1].trim();
        const memoryFact = `${pat.prefix} "${capturedValue}".`;
        
        // Double check not sensitive
        if (!this.containsSensitiveData(memoryFact)) {
          try {
            await this.addMemory(userId, memoryFact, pat.category);
          } catch (e) {
            // Non-blocking
          }
        }
        break;
      }
    }
  }

  /**
   * Helper to check if string contains sensitive credentials
   */
  private containsSensitiveData(text: string): boolean {
    const sensitivePatterns = [
      /AIza[0-9A-Za-z-_]{35}/, // Google API key
      /sk-[a-zA-Z0-9]{20,}/, // OpenAI key
      /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i, // Bearer token
      /ghp_[a-zA-Z0-9]{20,}/, // GitHub token
      /password\s*[:=]\s*\S+/i, // Password string
      /private_key|client_secret|database_url|mongodb\+srv/i, // Secrets
    ];

    return sensitivePatterns.some(p => p.test(text));
  }

  /**
   * Format relevant memories into a clean prompt section
   */
  public async buildMemoryPromptContext(userId: string, currentMessage: string): Promise<string> {
    if (!this.isEnabled || !userId) return '';

    try {
      const relevant = await this.searchRelevantMemories(userId, currentMessage, 4);
      if (!relevant || relevant.length === 0) {
        return '';
      }

      const memoryLines = relevant.map(m => `- [${m.category.toUpperCase()}] ${m.text}`).join('\n');
      return `\n\n[RELEVANT USER LONG-TERM MEMORIES]:
${memoryLines}
(Note: Use these persistent preferences and context items to personalize your responses naturally. Do not explicitly cite this memory store unless requested by the user.)`;
    } catch (err) {
      return '';
    }
  }
}

// Export singleton instance
export const memoService = new MemoService();
