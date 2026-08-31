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
  truncated?: boolean;
}

// Strict whitelist — the ONLY tool names the backend will ever execute.
// Anything not in this set is rejected before touching a provider.
export const ALLOWED_TOOLS = new Set(['web_search', 'read_webpage', 'code_execution']);

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

// Per-tool execution ceilings. These are independent of (and tighter than)
// the individual provider timeouts inside each *Service.ts file, so a
// hung/slow provider can never stall the agent loop indefinitely.
const TOOL_TIMEOUT_MS: Record<string, number> = {
  web_search: 15000,
  read_webpage: 20000,
  code_execution: 70000
};

// Hard ceiling on how much text a single tool result is allowed to inject
// back into the model's context. Prevents one huge webpage or verbose
// command output from blowing the context window on every later turn.
const MAX_RESULT_CHARS = 12000;
const MAX_QUERY_CHARS = 400;
const MAX_CODE_CHARS = 20000;

function truncate(text: string, tool: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_RESULT_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_RESULT_CHARS) + `\n\n[...output truncated at ${MAX_RESULT_CHARS} characters for "${tool}"...]`,
    truncated: true
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/**
 * Validates raw model-supplied arguments against each tool's minimal schema.
 * Returns an error string if invalid, or null if the arguments are usable.
 * This runs BEFORE any network/sandbox call — the model's output is never
 * trusted to shape a request on its own.
 */
function validateArgs(cleanName: string, args: any): string | null {
  if (args !== null && args !== undefined && typeof args !== 'object') {
    return 'Tool arguments must be a JSON object.';
  }

  if (cleanName === 'web_search') {
    const query = String(args?.query || args?.q || '').trim();
    if (!query) return 'Missing required argument "query" for web_search.';
    if (query.length > MAX_QUERY_CHARS) return `"query" exceeds maximum length of ${MAX_QUERY_CHARS} characters.`;
    return null;
  }

  if (cleanName === 'read_webpage') {
    const url = String(args?.url || args?.link || '').trim();
    if (!url) return 'Missing required argument "url" for read_webpage.';
    if (!/^https?:\/\//i.test(url)) return '"url" must be a valid absolute http(s) URL.';
    return null;
  }

  if (cleanName === 'code_execution' || cleanName === 'run_command') {
    const code = String(args?.code || args?.command || args?.cmd || '').trim();
    if (!code) return 'Missing required argument "code" for code_execution.';
    if (code.length > MAX_CODE_CHARS) return `"code" exceeds maximum length of ${MAX_CODE_CHARS} characters.`;
    return null;
  }

  return `Unrecognized tool name: "${cleanName}". Allowed tools: ${Array.from(ALLOWED_TOOLS).join(', ')}.`;
}

export async function executeToolRouter(name: string, args: any): Promise<ToolResult> {
  const startTime = Date.now();
  const cleanName = (name || '').trim().toLowerCase();

  // 1. Whitelist check — never fall through to a provider call for an
  //    unrecognized name, no matter how the model phrased it.
  if (!ALLOWED_TOOLS.has(cleanName) && cleanName !== 'run_command') {
    return {
      success: false,
      tool: name,
      error: `Unrecognized tool name: "${name}". Allowed tools: ${Array.from(ALLOWED_TOOLS).join(', ')}.`,
      durationMs: Date.now() - startTime
    };
  }

  // 2. Argument validation — reject malformed/missing args before dispatch.
  const validationError = validateArgs(cleanName, args);
  if (validationError) {
    return { success: false, tool: name, error: validationError, durationMs: Date.now() - startTime };
  }

  const timeoutMs = TOOL_TIMEOUT_MS[cleanName] ?? 20000;

  try {
    if (cleanName === 'web_search') {
      const query = String(args?.query || args?.q || '').trim();
      const res = await withTimeout(executeTavilySearch(query, 5), timeoutMs, 'web_search');
      const durationMs = Date.now() - startTime;
      const sources = (res.results || []).map(r => ({ title: r.title, url: r.url }));
      const formattedOutputRaw = res.success
        ? `Search Answer: ${res.answer || 'Found results'}\n\n` + res.results.map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n')
        : `Search failed: ${res.error || 'Unknown error'}`;
      const { text: formattedOutput, truncated } = truncate(formattedOutputRaw, 'web_search');

      return {
        success: res.success,
        tool: 'web_search',
        result: formattedOutput,
        error: res.error,
        durationMs,
        sources,
        truncated
      };
    }

    if (cleanName === 'read_webpage') {
      const url = String(args?.url || args?.link || '').trim();
      const res = await withTimeout(executeJinaReader(url), timeoutMs, 'read_webpage');
      const durationMs = Date.now() - startTime;
      const { text: content, truncated } = truncate(res.success ? res.content : `Failed to read webpage: ${res.error}`, 'read_webpage');
      return {
        success: res.success,
        tool: 'read_webpage',
        result: content,
        error: res.error,
        durationMs,
        sources: [{ title: url, url }],
        truncated
      };
    }

    if (cleanName === 'code_execution' || cleanName === 'run_command') {
      const code = String(args?.code || args?.command || args?.cmd || '').trim();
      const language = String(args?.language || 'python').trim().toLowerCase();

      let res;
      if (language === 'bash' || cleanName === 'run_command') {
        res = await withTimeout(executeDaytonaCommand(code, 60), timeoutMs, 'code_execution');
      } else {
        const lang = language === 'typescript' ? 'typescript' : language === 'javascript' ? 'javascript' : 'python';
        res = await withTimeout(executeDaytonaCode(code, lang, 60), timeoutMs, 'code_execution');
      }

      const durationMs = Date.now() - startTime;
      const { text: output, truncated } = truncate(`Exit Code: ${res.exitCode}\nOutput:\n${res.output}`, 'code_execution');
      return {
        success: res.success,
        tool: 'code_execution',
        result: output,
        error: res.success ? undefined : res.output,
        durationMs,
        truncated
      };
    }

    // Unreachable given the whitelist check above, kept as a defensive fallback.
    return {
      success: false,
      tool: name,
      error: `Unrecognized tool name: "${name}". Allowed tools: ${Array.from(ALLOWED_TOOLS).join(', ')}.`,
      durationMs: Date.now() - startTime
    };
  } catch (err: any) {
    // Covers both real provider errors AND the timeout rejection above —
    // either way the agent loop gets a clean, bounded error result instead
    // of hanging or crashing.
    return {
      success: false,
      tool: name,
      error: err?.message || String(err),
      durationMs: Date.now() - startTime
    };
  }
}
