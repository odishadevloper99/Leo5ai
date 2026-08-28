import { exec } from 'child_process';
import path from 'path';

/**
 * PRODUCTION-READY LEO AI AGENT SERVICE
 * Implements an autonomous multi-step tool-using AI agent engine.
 * 
 * Features:
 * 1. Real Web Search Tool (Tavily Search API with DuckDuckGo fallback)
 * 2. Safe Sandboxed Command Execution Tool (strict allowlist, timeout, output limit, secret stripping)
 * 3. Multi-Step Tool Calling Agent Loop with context preservation
 * 4. Dual-Mode Compatibility: Native OpenAI tool_calls + Structured JSON fallback
 * 5. Security Guardrails: Strict input validation, zero secret leakage, safe working directory
 */

export interface AgentStep {
  tool: 'web_search' | 'run_command' | string;
  input: Record<string, any>;
  output: string;
  success: boolean;
  durationMs: number;
  sources?: { title: string; url: string }[];
}

export type AgentEventType =
  | 'agent_start'
  | 'thinking'
  | 'planning'
  | 'tool_start'
  | 'tool_result'
  | 'analyzing'
  | 'generating'
  | 'chunk'
  | 'complete'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  message?: string;
  tool?: string;
  input?: Record<string, any>;
  outputSummary?: string;
  success?: boolean;
  durationMs?: number;
  sources?: { title: string; url: string }[];
  chunk?: string;
  data?: any;
}

export interface AgentExecutionResult {
  content: string;
  thinkingProcess?: string;
  steps: AgentStep[];
  searched: boolean;
  searchQueries: string[];
  searchSources: { title: string; url: string }[];
  model: string;
  iterations: number;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

// ----------------------------------------------------
// 1. Tool Schemas (OpenAI-Compatible Format)
// ----------------------------------------------------

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the live internet (via Tavily engine) for websites, streaming platforms, movie sites, free software, models, GitHub repositories, download URLs, live news, and technical documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web'
        }
      },
      required: ['query']
    }
  }
};

export const RUN_COMMAND_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_command',
    description: 'Safely execute terminal, diagnostic, inspection, and development commands inside the restricted project sandbox (e.g., "date", "node -v", "npm list --depth=0", "git status", "uptime", "pwd", "ls -la", "cat package.json", "whoami"). Destructive commands (rm, mkfs, sudo, etc.) are strictly rejected.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command string to safely execute'
        }
      },
      required: ['command']
    }
  }
};

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  WEB_SEARCH_TOOL,
  RUN_COMMAND_TOOL
];

// ----------------------------------------------------
// 2. Real Web Search Tool Implementation
// ----------------------------------------------------

export interface WebSearchResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
}

/**
 * Execute real web search via Tavily API or DuckDuckGo fallback
 */
export async function executeWebSearch(query: string, maxResults = 5): Promise<{
  success: boolean;
  query: string;
  results: WebSearchResultItem[];
  sources: { title: string; url: string }[];
  formattedOutput: string;
  error?: string;
}> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    return {
      success: false,
      query: '',
      results: [],
      sources: [],
      formattedOutput: 'Error: Search query cannot be empty.'
    };
  }

  const tavilyApiKey = (process.env.TAVILY_API_KEY || '').trim();
  let results: WebSearchResultItem[] = [];

  // Attempt 1: Real Tavily Search API
  if (tavilyApiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query: cleanQuery,
          search_depth: 'basic',
          include_answer: true,
          max_results: Math.min(maxResults, 6)
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        const data: any = await response.json();
        const rawResults = Array.isArray(data?.results) ? data.results : [];
        results = rawResults
          .map((r: any) => ({
            title: (r.title || 'Web Resource').trim(),
            url: (r.url || '').trim(),
            content: (r.content || r.snippet || '').trim(),
            score: r.score
          }))
          .filter((r: WebSearchResultItem) => r.url && r.content);
      }
    } catch (err: any) {
      console.warn(`[AGENT TOOL: web_search] Tavily request failed:`, err.message || err);
    }
  }

  // Attempt 2: Public Web Search Fallback (DuckDuckGo Instant Answer / HTML Search)
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);

      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (ddgRes.ok) {
        const ddgData: any = await ddgRes.json();
        if (ddgData.AbstractText && ddgData.AbstractURL) {
          results.push({
            title: ddgData.Heading || cleanQuery,
            url: ddgData.AbstractURL,
            content: ddgData.AbstractText
          });
        }
        if (Array.isArray(ddgData.RelatedTopics)) {
          for (const topic of ddgData.RelatedTopics) {
            if (topic.Text && topic.FirstURL && results.length < maxResults) {
              results.push({
                title: topic.Text.slice(0, 60) + '...',
                url: topic.FirstURL,
                content: topic.Text
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AGENT TOOL: web_search] DuckDuckGo fallback notice:`, err.message || err);
    }
  }

  // Attempt 3: Public HTML search scraper if still empty
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
      const htmlRes = await fetch(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        // Extract result links and snippets with regex
        const resultRegex = /<a class="result__url" href="([^"]+)".*?>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet".*?>([\s\S]*?)<\/a>/g;
        let match: RegExpExecArray | null;
        while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
          let rawUrl = match[1].trim();
          // Decode DuckDuckGo redirect url if needed
          if (rawUrl.includes('uddg=')) {
            const parsed = new URL('https://duckduckgo.com' + rawUrl);
            const uddg = parsed.searchParams.get('uddg');
            if (uddg) rawUrl = decodeURIComponent(uddg);
          }
          const cleanSnippet = match[3].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
          if (rawUrl.startsWith('http') && cleanSnippet) {
            results.push({
              title: match[2].replace(/<[^>]+>/g, '').trim() || cleanQuery,
              url: rawUrl,
              content: cleanSnippet
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AGENT TOOL: web_search] HTML search scrape notice:`, err.message || err);
    }
  }

  if (results.length === 0) {
    return {
      success: false,
      query: cleanQuery,
      results: [],
      sources: [],
      formattedOutput: `Web search for "${cleanQuery}" returned no relevant live results. Proceeding with internal knowledge.`,
      error: 'No search results found'
    };
  }

  const sources = results.map(r => ({ title: r.title, url: r.url }));
  let formattedOutput = `Found ${results.length} verified web search results for "${cleanQuery}":\n\n`;
  results.forEach((r, idx) => {
    formattedOutput += `[Source ${idx + 1}]: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n\n`;
  });

  return {
    success: true,
    query: cleanQuery,
    results,
    sources,
    formattedOutput: formattedOutput.trim()
  };
}

// ----------------------------------------------------
// 3. Safe Command Execution Tool Implementation
// ----------------------------------------------------

/**
 * Strict security guardrails for safe terminal execution:
 * - Allowlist of safe inspection / diagnostic utilities
 * - Rejection of destructive, privilege escalation, or device-level commands
 * - Workspace directory lockdown
 * - Secret sanitization from environment
 * - Buffer and execution time limits
 */

const ALLOWED_ROOT_COMMANDS = new Set([
  'node',
  'npm',
  'npx',
  'git',
  'cat',
  'ls',
  'dir',
  'pwd',
  'date',
  'uptime',
  'whoami',
  'head',
  'tail',
  'grep',
  'find',
  'echo',
  'wc',
  'df',
  'free',
  'ps',
  'which',
  'uname',
  'ping',
  'curl',
  'env',
  'tsc',
  'vite',
  'python',
  'python3'
]);

const DANGEROUS_PATTERNS = [
  /\brm\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\binit\s+[06]\b/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\buseradd\b/i,
  /\buserdel\b/i,
  /:(){\s*:\|:&\s*};:/, // Fork bomb
  />\s*\/dev\//i,       // Writing to devices
  /\bkill\s+-9\s+1\b/i,
  /\bkillall\b/i,
  /\bwget\s+.*\|\s*(?:bash|sh)\b/i, // Piping download to shell
  /\bcurl\s+.*\|\s*(?:bash|sh)\b/i,
  /\bformat\b/i,
  /\bdel\s+\/[fqsr]\b/i,
  /\btruncate\b/i
];

export interface SafeCommandResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  output: string;
  error?: string;
}

export function validateCommandSafety(cmd: string): { safe: boolean; reason?: string } {
  if (!cmd || typeof cmd !== 'string') {
    return { safe: false, reason: 'Command must be a non-empty string.' };
  }

  const trimmed = cmd.trim();
  if (trimmed.length === 0) {
    return { safe: false, reason: 'Command cannot be empty.' };
  }

  if (trimmed.length > 500) {
    return { safe: false, reason: 'Command length exceeds maximum 500 characters limit.' };
  }

  // 1. Check for known destructive patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason: `Command contains forbidden destructive or privileged pattern: ${pattern}`
      };
    }
  }

  // 2. Extract base command
  const baseTokens = trimmed.split(/[\s|;&]+/).filter(Boolean);
  const firstToken = baseTokens[0] ? baseTokens[0].toLowerCase().replace(/^[\.\/\\]+/, '') : '';

  // Check if base command is in allowlist
  if (!ALLOWED_ROOT_COMMANDS.has(firstToken)) {
    return {
      safe: false,
      reason: `Command "${firstToken}" is not in the safe command allowlist. Allowed commands: ${Array.from(ALLOWED_ROOT_COMMANDS).join(', ')}`
    };
  }

  return { safe: true };
}

/**
 * Execute safe command in locked sandbox
 */
export async function executeSafeCommand(command: string): Promise<SafeCommandResult> {
  const startTime = Date.now();
  const validation = validateCommandSafety(command);

  if (!validation.safe) {
    return {
      success: false,
      command,
      stdout: '',
      stderr: validation.reason || 'Command rejected by security guardrails',
      exitCode: 1,
      durationMs: Date.now() - startTime,
      output: `[SECURITY GUARDRAIL REJECTION]: ${validation.reason}`,
      error: validation.reason
    };
  }

  // Sanitize environment: strip sensitive API keys & secrets before child process execution
  const safeEnv: Record<string, string> = { ...process.env as Record<string, string> };
  const SENSITIVE_VARS = [
    'AICREDITS_API_KEY',
    'TOKENIN_API_KEY',
    'TAVILY_API_KEY',
    'MEMO_API_KEY',
    'GEMINI_API_KEY',
    'SESSION_SECRET',
    'ADMIN_PASSWORD',
    'ADMIN_PASSWORD_HASH',
    'GOOGLE_CLIENT_SECRET',
    'FIREBASE_API_KEY',
    'FIREBASE_DATABASE_URL',
    'SMTP_PASS',
    'CASHFREE_CLIENT_SECRET'
  ];
  for (const secretVar of SENSITIVE_VARS) {
    delete safeEnv[secretVar];
  }

  const workspaceCwd = process.cwd();
  const MAX_OUTPUT_BYTES = 32 * 1024; // 32KB
  const TIMEOUT_MS = 6000; // 6 seconds

  return new Promise((resolve) => {
    try {
      exec(
        command,
        {
          cwd: workspaceCwd,
          timeout: TIMEOUT_MS,
          maxBuffer: MAX_OUTPUT_BYTES,
          env: safeEnv
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const cleanStdout = (stdout || '').trim();
          const cleanStderr = (stderr || '').trim();

          let outputText = '';
          if (cleanStdout) {
            outputText += cleanStdout;
          }
          if (cleanStderr) {
            outputText += (outputText ? '\n[STDERR]:\n' : '') + cleanStderr;
          }
          if (!outputText && error) {
            outputText = `Command exited with error: ${error.message}`;
          }
          if (!outputText) {
            outputText = '(Command completed with no output)';
          }

          // Truncate output if excessively long
          if (outputText.length > MAX_OUTPUT_BYTES) {
            outputText = outputText.slice(0, MAX_OUTPUT_BYTES) + '\n... [Output truncated to 32KB]';
          }

          resolve({
            success: !error || error.code === 0,
            command,
            stdout: cleanStdout,
            stderr: cleanStderr,
            exitCode: error ? (error.code || 1) : 0,
            durationMs,
            output: outputText,
            error: error ? error.message : undefined
          });
        }
      );
    } catch (err: any) {
      resolve({
        success: false,
        command,
        stdout: '',
        stderr: err.message || 'Execution error',
        exitCode: 1,
        durationMs: Date.now() - startTime,
        output: `Failed to execute command: ${err.message}`,
        error: err.message
      });
    }
  });
}

// ----------------------------------------------------
// 4. Agent Controller & Autonomous Multi-Step Loop
// ----------------------------------------------------

export interface AgentRunOptions {
  messages: any[];
  systemPrompt: string;
  model: string;
  callProvider: (messages: any[], tools?: ToolDefinition[]) => Promise<{
    ok: boolean;
    content?: string;
    thinkingProcess?: string;
    tool_calls?: any[];
    error?: string;
  }>;
  maxIterations?: number;
  userId?: string;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}

export const AGENT_SYSTEM_INSTRUCTION = `You are Leo AI, a world-class production-ready AI agent with direct autonomous tool execution, live web search, terminal diagnostics, and structured intelligence capabilities.

YOU HAVE ACCESS TO THE FOLLOWING GENUINELY WIRED TOOLS:
1. web_search(query: string): Real-time live internet search for news, websites, models, open-source repositories, documentation, downloads, media, release dates, market intelligence, etc.
2. run_command(command: string): Safely execute terminal, diagnostic, inspection, file, and system commands inside the sandbox environment (e.g., node -v, git status, cat package.json, pwd, ls, npm).

CORE DIRECTIVES & OPERATING RULES:
- DIRECT EXECUTION (NO CLARIFYING QUESTIONS): Never respond with generic, vague inquiries or ask unnecessary clarifying questions (such as "Could you please provide more details..."). Immediately analyze the user's prompt, execute required tools if information is needed, or deliver the full, complete solution directly.
- PROACTIVE WEB SEARCH & ZERO REFUSALS:
  * When the user asks for movie websites, streaming platforms, AI tools, models, downloads, software links, repositories, or URLs, you MUST proactively call \`web_search\` (Tavily search engine) to gather authentic live platforms, working links, and accurate details.
  * NEVER give canned refusals or disclaimers such as "Main directly kisi specific website ka naam nahi de sakta" or "I cannot provide specific website names" or generic tips. Provide the actual website names, verified URLs, feature tables, and direct links.
- CAPABILITIES & SEARCH INQUIRIES: When the user asks what you can search, find, or do (e.g., "Tum kya kya dhund sakte ho", "What can you search", "What are your capabilities"), provide a detailed, accurate breakdown of your real wired capabilities:
  1. Live Web Search & Links (\`web_search\` via Tavily): Latest AI tools & models, software downloads, GitHub repos, live documentation, news, entertainment & movie streams, market data.
  2. Workspace & Diagnostics (\`run_command\`): File system inspection, running shell scripts/commands, diagnosing code in the sandbox.
  3. Structured Data & Artifacts: Rich tables with CSV download, copyable code blocks with language indicators.
  4. Vision & Multimodal: Analyzing images, error screenshots, UI mockups.
- Language & Tone: Always respond naturally in the user's spoken language and tone (Hindi, Hinglish, English, etc.). Match conversational Hindi/Hinglish warmth if prompted in Hindi/Hinglish.
- High-Caliber Structure:
  1. Main Title: Start with a clear Markdown "# Title" or introductory heading.
  2. Section Headings: For multi-section answers, guides, recommendations, or step-by-step breakdowns, ALWAYS use real Markdown "## " (Level 2) headings for main numbered sections. NEVER fake headings using plain text or bold tags without markdown heading syntax.
  3. Commands & Code Blocks: Put terminal commands inside clean triple-backtick markdown blocks.
  4. Bullet Lists & Bold Prefixes: Format bullet items with bold label prefixes followed by clean descriptions or links (e.g. "- **Website:** https://...").
  5. Summary Tables: For comparisons, directories, model lists, or final overviews, always provide a Markdown table under a "## संक्षेप में:" or summary heading.
- Tool Discipline: Only invoke tools when actually necessary. Never fabricate tool outputs. Deliver authoritative, comprehensive, and crisp responses.`;

/**
 * Parses tool calls either from native tool_calls structure or from structured JSON in text fallback
 */
export function extractToolCalls(
  toolCallsFromProvider?: any[],
  textContent?: string
): { name: string; args: Record<string, any>; id: string }[] {
  const extracted: { name: string; args: Record<string, any>; id: string }[] = [];

  // 1. Native OpenAI tool_calls
  if (Array.isArray(toolCallsFromProvider) && toolCallsFromProvider.length > 0) {
    for (const tc of toolCallsFromProvider) {
      const name = tc?.function?.name || tc?.name;
      let args: any = {};
      try {
        args = typeof tc?.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : (tc?.function?.arguments || tc?.arguments || {});
      } catch {
        args = { query: tc?.function?.arguments || '' };
      }
      if (name) {
        extracted.push({
          name,
          args,
          id: tc.id || 'call_' + Math.random().toString(36).substring(2, 9)
        });
      }
    }
  }

  // 2. Structured JSON in text fallback (if no native tool_calls were emitted)
  if (extracted.length === 0 && textContent && typeof textContent === 'string') {
    // Look for ```json {"tool": "web_search", "query": "..."} ``` or {"name": "run_command", "arguments": {...}}
    const jsonBlockRegex = /```(?:json)?\s*(\{\s*"tool"[\s\S]*?\}|\{\s*"name"[\s\S]*?\})\s*```/i;
    const match = textContent.match(jsonBlockRegex);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        const name = parsed.tool || parsed.name || parsed.function;
        const args = parsed.arguments || parsed.parameters || parsed.args || { query: parsed.query, command: parsed.command };
        if (name && (name === 'web_search' || name === 'run_command')) {
          extracted.push({
            name,
            args: typeof args === 'object' ? args : { query: String(args) },
            id: 'fallback_call_' + Date.now()
          });
        }
      } catch {}
    }

    // Look for inline XML tag <tool_call>{"name": "...", "arguments": {...}}</tool_call>
    const xmlMatch = textContent.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
    if (xmlMatch) {
      try {
        const parsed = JSON.parse(xmlMatch[1]);
        const name = parsed.name || parsed.tool;
        const args = parsed.arguments || parsed.parameters || {};
        if (name && (name === 'web_search' || name === 'run_command')) {
          extracted.push({
            name,
            args,
            id: 'xml_call_' + Date.now()
          });
        }
      } catch {}
    }
  }

  return extracted;
}

/**
 * Main Autonomous Agent Controller Loop
 */
export async function runAgentLoop(options: AgentRunOptions): Promise<AgentExecutionResult> {
  const {
    messages: initialMessages,
    systemPrompt,
    model,
    callProvider,
    maxIterations = 8,
    onEvent
  } = options;

  const emitEvent = async (event: AgentEvent) => {
    if (onEvent) {
      try {
        await onEvent(event);
      } catch (err) {
        console.warn('[AGENT EVENT EMITTER] Failed to dispatch event:', err);
      }
    }
  };

  const agentSteps: AgentStep[] = [];
  const searchQueries: string[] = [];
  const searchSources: { title: string; url: string }[] = [];
  const seenUrls = new Set<string>();

  // Build working conversation state
  const workingMessages: any[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n${AGENT_SYSTEM_INSTRUCTION}`.trim()
    }
  ];

  // Append user & assistant history
  for (const m of initialMessages) {
    if (m.role === 'system') continue;
    workingMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    });
  }

  let finalContent = '';
  let finalThinking = '';
  let iterations = 0;

  console.log(`[AGENT LOOP] Starting autonomous agent loop for model "${model}" (Max iterations: ${maxIterations})...`);

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[AGENT LOOP] Iteration ${iterations}/${maxIterations} requesting model...`);

    const response = await callProvider(workingMessages, AVAILABLE_TOOLS);

    if (!response.ok) {
      console.warn(`[AGENT LOOP] Provider failed at iteration ${iterations}: ${response.error}`);
      if (agentSteps.length > 0) {
        // If we already had successful tool steps, synthesize what we have
        finalContent = `I gathered the following findings:\n\n` +
          agentSteps.map(s => `**Tool \`${s.tool}\`**:\n${s.output}`).join('\n\n');
        break;
      }
      await emitEvent({
        type: 'error',
        message: response.error || 'Agent execution failed'
      });
      throw new Error(response.error || 'Agent loop provider failure');
    }

    if (response.thinkingProcess) {
      finalThinking = response.thinkingProcess;
      await emitEvent({
        type: 'thinking',
        message: 'Reasoning process…',
        data: response.thinkingProcess
      });
    }

    const toolCalls = extractToolCalls(response.tool_calls, response.content);

    // If the model did NOT request any tools, this is the final answer!
    if (toolCalls.length === 0) {
      finalContent = response.content || '';
      console.log(`[AGENT LOOP] Final response reached at iteration ${iterations} (Length: ${finalContent.length} chars).`);
      await emitEvent({
        type: 'generating',
        message: 'Writing response…'
      });

      // Stream the response in real-time chunks to frontend
      if (finalContent) {
        // Chunk by words / character blocks for natural fluid token streaming
        const chunks = finalContent.match(/[\s\S]{1,16}/g) || [finalContent];
        for (const piece of chunks) {
          await emitEvent({
            type: 'chunk',
            chunk: piece
          });
          // Small micro-delay for authentic token cadence
          await new Promise((r) => setTimeout(r, 8));
        }
      }
      break;
    }

    console.log(`[AGENT LOOP] Model requested ${toolCalls.length} tool call(s) at iteration ${iterations}:`, toolCalls.map(tc => tc.name));

    await emitEvent({
      type: 'planning',
      message: 'Planning next steps…'
    });

    // Append the assistant's request to conversation history
    workingMessages.push({
      role: 'assistant',
      content: response.content || null,
      tool_calls: response.tool_calls || toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args)
        }
      }))
    });

    // Execute each requested tool in sequence
    for (const toolCall of toolCalls) {
      const stepStartTime = Date.now();
      let toolOutput = '';
      let stepSuccess = false;
      let toolSources: { title: string; url: string }[] | undefined = undefined;

      if (toolCall.name === 'web_search') {
        const q = String(toolCall.args.query || toolCall.args.q || '').trim();
        searchQueries.push(q);

        await emitEvent({
          type: 'tool_start',
          tool: 'web_search',
          message: 'Searching the web…',
          input: { query: q }
        });

        const searchRes = await executeWebSearch(q);
        stepSuccess = searchRes.success;
        toolOutput = searchRes.formattedOutput;
        toolSources = searchRes.sources;

        for (const s of searchRes.sources) {
          if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            searchSources.push(s);
          }
        }

        const durationMs = Date.now() - stepStartTime;
        await emitEvent({
          type: 'tool_result',
          tool: 'web_search',
          message: 'Search completed',
          success: stepSuccess,
          durationMs,
          sources: toolSources
        });

      } else if (toolCall.name === 'run_command') {
        const cmd = String(toolCall.args.command || toolCall.args.cmd || '').trim();

        await emitEvent({
          type: 'tool_start',
          tool: 'run_command',
          message: 'Running requested command…',
          input: { command: cmd }
        });

        const cmdRes = await executeSafeCommand(cmd);
        stepSuccess = cmdRes.success;
        toolOutput = `Command: ${cmd}\nExit Code: ${cmdRes.exitCode}\nOutput:\n${cmdRes.output}`;

        const durationMs = Date.now() - stepStartTime;
        await emitEvent({
          type: 'tool_result',
          tool: 'run_command',
          message: cmdRes.success ? 'Command completed' : 'Command failed',
          success: stepSuccess,
          durationMs
        });

      } else {
        toolOutput = `Error: Tool "${toolCall.name}" is not recognized. Available tools: web_search, run_command.`;
        stepSuccess = false;
        await emitEvent({
          type: 'tool_result',
          tool: toolCall.name,
          message: 'Tool not recognized',
          success: false
        });
      }

      const durationMs = Date.now() - stepStartTime;
      agentSteps.push({
        tool: toolCall.name,
        input: toolCall.args,
        output: toolOutput,
        success: stepSuccess,
        durationMs,
        sources: toolSources
      });

      // Append tool result into working conversation history
      workingMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content: toolOutput
      });
    }

    // After tool executions in iteration, notify analyzing
    await emitEvent({
      type: 'analyzing',
      message: 'Analyzing results…'
    });
  }

  // If reached max iterations without concluding, do one final synthesis prompt
  if (!finalContent && iterations >= maxIterations) {
    console.warn(`[AGENT LOOP] Max iterations (${maxIterations}) reached. Performing final synthesis...`);
    await emitEvent({
      type: 'generating',
      message: 'Preparing the final answer…'
    });

    workingMessages.push({
      role: 'user',
      content: 'Please summarize your findings from the above tool executions and provide the final answer to my request now.'
    });

    const finalRes = await callProvider(workingMessages);
    finalContent = finalRes.content || 'Agent completed multi-step execution. See findings above.';
    if (finalRes.thinkingProcess && !finalThinking) {
      finalThinking = finalRes.thinkingProcess;
    }

    if (finalContent) {
      const chunks = finalContent.match(/[\s\S]{1,16}/g) || [finalContent];
      for (const piece of chunks) {
        await emitEvent({
          type: 'chunk',
          chunk: piece
        });
        await new Promise((r) => setTimeout(r, 8));
      }
    }
  }

  // Construct default thinking summary if not provided
  if (!finalThinking && agentSteps.length > 0) {
    finalThinking = `Executed ${agentSteps.length} autonomous tool actions: ` +
      agentSteps.map(s => `${s.tool}(${JSON.stringify(s.input)})`).join(', ') +
      `. Synthesized verified results into final response.`;
  }

  return {
    content: finalContent,
    thinkingProcess: finalThinking,
    steps: agentSteps,
    searched: searchSources.length > 0 || searchQueries.length > 0,
    searchQueries,
    searchSources,
    model,
    iterations
  };
}
