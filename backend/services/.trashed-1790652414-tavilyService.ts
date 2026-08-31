import { executeDaytonaCommand, executeDaytonaCode } from './daytonaService';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export async function executeTavilySearch(query: string, maxResults = 5): Promise<{
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
      error: 'TAVILY_API_KEY is not configured.'
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
      return { success: false, query, results: [], error: `HTTP ${response.status}: ${errText.slice(0, 100)}` };
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
    return {
      success: false,
      query,
      results: [],
      error: err.message || 'Search timeout'
    };
  }
}
