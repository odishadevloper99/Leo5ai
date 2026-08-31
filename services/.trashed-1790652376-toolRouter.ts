import { executeTavilySearch } from './tavilyService';
import { executeJinaReader } from './jinaService';
import { executeDaytonaCommand, executeDaytonaCode } from './daytonaService';

export interface ToolResult {
  success: boolean;
  tool: string;
  result?: any;
  error?: string;
  durationMs: number;
  sources?: { title: string; url: string }[];
}

export const CENTRALIZED_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the live web for up-to-date information, news, documentation, or facts using Tavily.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_webpage',
      description: 'Extract and read clean markdown text content from a specific URL using Jina Reader.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The target webpage URL to read' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'code_execution',
      description: 'Execute code or shell commands securely inside an isolated Daytona sandbox.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The code or shell command string to execute' },
          language: { type: 'string', description: 'Programming language: python, typescript, javascript, or bash' }
        },
        required: ['code']
      }
    }
  }
];

export async function executeToolRouter(name: string, args: any): Promise<ToolResult> {
  const startTime = Date.now();
  const cleanName = (name || '').trim().toLowerCase();

  try {
    if (cleanName === 'web_search') {
      const query = String(args?.query || args?.q || '').trim();
      if (!query) {
        return { success: false, tool: name, error: 'Missing search query', durationMs: Date.now() - startTime };
      }
      const res = await executeTavilySearch(query, 5);
      const durationMs = Date.now() - startTime;
      const sources = (res.results || []).map(r => ({ title: r.title, url: r.url }));
      const formattedOutput = res.success
        ? `Search Answer: ${res.answer || 'Found results'}\n\n` + res.results.map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n')
        : `Search failed: ${res.error || 'Unknown error'}`;

      return {
        success: res.success,
        tool: 'web_search',
        result: formattedOutput,
        error: res.error,
        durationMs,
        sources
      };
    }

    if (cleanName === 'read_webpage') {
      const url = String(args?.url || args?.link || '').trim();
      if (!url) {
        return { success: false, tool: name, error: 'Missing webpage URL', durationMs: Date.now() - startTime };
      }
      const res = await executeJinaReader(url);
      const durationMs = Date.now() - startTime;
      return {
        success: res.success,
        tool: 'read_webpage',
        result: res.success ? res.content : `Failed to read webpage: ${res.error}`,
        error: res.error,
        durationMs,
        sources: [{ title: url, url }]
      };
    }

    if (cleanName === 'code_execution' || cleanName === 'run_command') {
      const code = String(args?.code || args?.command || args?.cmd || '').trim();
      const language = String(args?.language || 'python').trim().toLowerCase();
      if (!code) {
        return { success: false, tool: name, error: 'Missing code or command to execute', durationMs: Date.now() - startTime };
      }

      let res;
      if (language === 'bash' || cleanName === 'run_command') {
        res = await executeDaytonaCommand(code, 60);
      } else {
        const lang = language === 'typescript' ? 'typescript' : language === 'javascript' ? 'javascript' : 'python';
        res = await executeDaytonaCode(code, lang, 60);
      }

      const durationMs = Date.now() - startTime;
      const output = `Exit Code: ${res.exitCode}\nOutput:\n${res.output}`;
      return {
        success: res.success,
        tool: 'code_execution',
        result: output,
        error: res.success ? undefined : res.output,
        durationMs
      };
    }

    return {
      success: false,
      tool: name,
      error: `Unrecognized tool name: "${name}". Allowed tools: web_search, read_webpage, code_execution.`,
      durationMs: Date.now() - startTime
    };
  } catch (err: any) {
    return {
      success: false,
      tool: name,
      error: err?.message || String(err),
      durationMs: Date.now() - startTime
    };
  }
}
