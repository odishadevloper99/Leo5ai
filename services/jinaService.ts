export async function executeJinaReader(url: string): Promise<{
  success: boolean;
  url: string;
  content: string;
  error?: string;
}> {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) {
    return { success: false, url, content: '', error: 'URL is required for Jina Reader.' };
  }

  const jinaApiKey = (process.env.JINA_API_KEY || '').trim();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const headers: Record<string, string> = {
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown'
    };

    if (jinaApiKey) {
      headers['Authorization'] = `Bearer ${jinaApiKey}`;
    }

    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(cleanUrl)}`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, url: cleanUrl, content: '', error: `HTTP ${response.status}: ${errText.slice(0, 150)}` };
    }

    const markdown = await response.text();
    return {
      success: true,
      url: cleanUrl,
      content: markdown || 'No content extracted.'
    };
  } catch (err: any) {
    return {
      success: false,
      url: cleanUrl,
      content: '',
      error: err.message || 'Jina reader request failed'
    };
  }
}
