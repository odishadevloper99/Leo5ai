import { executeToolRouter, CENTRALIZED_TOOLS, ALLOWED_TOOLS } from './toolRouter';

export interface AgentStep {
  tool: string;
  input: any;
  output: string;
  success: boolean;
  durationMs: number;
  sources?: { title: string; url: string }[];
}

export type AgentEvent =
  | { type: 'thinking'; message: string; data?: string }
  | { type: 'planning'; message: string }
  | { type: 'tool_start'; tool: string; message: string; input: any }
  | { type: 'tool_result'; tool: string; message: string; success: boolean; durationMs: number; sources?: { title: string; url: string }[] }
  | { type: 'analyzing'; message: string }
  | { type: 'generating'; message: string }
  | { type: 'chunk'; chunk: string }
  | { type: 'complete'; message: string; data?: any }
  | { type: 'error'; message: string };

export const AVAILABLE_TOOLS = CENTRALIZED_TOOLS;

// ----------------------------------------------------------------------
// Loop safety defaults. All overridable per-call via runAgentLoop options,
// and in turn overridable server-wide via env vars in server.ts.
// ----------------------------------------------------------------------
export const MAX_AGENT_ITERATIONS = 8;
export const MAX_MALFORMED_RETRIES = 2;
export const AGENT_WALL_CLOCK_TIMEOUT_MS = 110000; // overall loop ceiling, independent of iteration count
export const MAX_CONTEXT_MESSAGE_CHARS = 60000; // total chars kept across working messages before we start trimming old tool results

/**
 * Normalizes and extracts tool calls from model output supporting:
 * 1. Native provider tool_calls (MODE A)
 * 2. <tool_call>...</tool_call> XML block (MODE B)
 * 3. ```json fenced code block containing {"name": "...", "arguments": {...}}
 * 4. Raw JSON object matching tool call schema
 *
 * Returns the parsed calls. Use `hadMalformedAttempt` (see below) to detect
 * a tool call that LOOKED like a tool call but failed to parse — that case
 * must never be silently treated as a final answer.
 */
export function extractStructuredToolCalls(toolCallsRaw: any, contentRaw: string): any[] {
  // 1. Native tool calls if provided
  if (Array.isArray(toolCallsRaw) && toolCallsRaw.length > 0) {
    return toolCallsRaw.map(tc => ({
      id: tc.id || 'call_' + Math.random().toString(36).substring(2, 9),
      name: tc.function?.name || tc.name,
      args: typeof tc.function?.arguments === 'string'
        ? safeJsonParse(tc.function.arguments) ?? {}
        : (tc.function?.arguments || tc.args || {})
    }));
  }

  if (!contentRaw || typeof contentRaw !== 'string') return [];

  const results: any[] = [];

  // 2. Search for <tool_call>...</tool_call> blocks
  const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = xmlRegex.exec(contentRaw)) !== null) {
    const parsed = safeJsonParse(match[1].trim());
    if (parsed && (parsed.name || parsed.tool)) {
      results.push({
        id: 'call_' + Math.random().toString(36).substring(2, 9),
        name: parsed.name || parsed.tool,
        args: parsed.arguments || parsed.args || parsed.input || {}
      });
    }
  }

  if (results.length > 0) return results;

  // 3. Search for JSON code blocks or raw JSON containing tool call structure
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  while ((match = jsonBlockRegex.exec(contentRaw)) !== null) {
    const parsed = safeJsonParse(match[1].trim());
    if (parsed && (parsed.name || parsed.tool) && (parsed.arguments || parsed.args || parsed.input)) {
      results.push({
        id: 'call_' + Math.random().toString(36).substring(2, 9),
        name: parsed.name || parsed.tool,
        args: parsed.arguments || parsed.args || parsed.input || {}
      });
    }
  }

  if (results.length > 0) return results;

  // 4. Fallback: check if the entire content or partial content is a direct JSON object
  const trimmed = contentRaw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const parsed = safeJsonParse(trimmed);
    if (parsed && (parsed.name || parsed.tool)) {
      results.push({
        id: 'call_' + Math.random().toString(36).substring(2, 9),
        name: parsed.name || parsed.tool,
        args: parsed.arguments || parsed.args || parsed.input || {}
      });
    }
  }

  return results;
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Detects a tool-call ATTEMPT that failed to parse into a usable call —
 * e.g. the model opened a <tool_call> tag but emitted invalid JSON inside
 * it. Used to distinguish "genuinely no tool needed" from "tried and
 * botched the syntax", so the broken markup is never shown to the user
 * as a final answer.
 */
function looksLikeMalformedToolAttempt(contentRaw: string): boolean {
  if (!contentRaw) return false;
  if (/<tool_call>/i.test(contentRaw)) return true;
  if (/```json/i.test(contentRaw) && /"(name|tool)"\s*:/i.test(contentRaw)) return true;
  return false;
}

function estimateMessagesSize(messages: any[]): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') total += m.content.length;
    else if (m.content) total += JSON.stringify(m.content).length;
  }
  return total;
}

/**
 * Keeps the working message list under MAX_CONTEXT_MESSAGE_CHARS by
 * collapsing the oldest tool result messages (never the system prompt or
 * the most recent turn) once the running total gets too large. This is a
 * blunt but safe guard against unbounded context growth across many
 * agent iterations.
 */
function trimContextIfNeeded(messages: any[], maxChars: number): void {
  let size = estimateMessagesSize(messages);
  if (size <= maxChars) return;

  for (let i = 1; i < messages.length - 2 && size > maxChars; i++) {
    const m = messages[i];
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > 500) {
      const original = m.content.length;
      m.content = m.content.slice(0, 400) + '\n[...older tool output trimmed to preserve context space...]';
      size -= (original - m.content.length);
    }
  }
}

export async function runAgentLoop(options: {
  model: string;
  systemPrompt: string;
  initialMessages?: { role: string; content: string }[];
  messages?: { role: string; content: string }[];
  maxIterations?: number;
  userId?: string;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
  callProvider: (messages: any[], tools?: any[]) => Promise<any>;
  executeWebSearch?: (query: string) => Promise<{ success: boolean; formattedOutput: string; sources: { title: string; url: string }[] }>;
  executeSafeCommand?: (command: string) => Promise<{ success: boolean; exitCode: number; output: string }>;
  extractToolCalls?: (toolCallsRaw: any, contentRaw: string) => any[];
  /** Polled between steps; return true to stop the loop early (e.g. client disconnected). */
  isCancelled?: () => boolean;
  /** Overall wall-clock ceiling for the whole loop, regardless of iteration count. */
  wallClockTimeoutMs?: number;
}): Promise<{
  content: string;
  thinkingProcess: string;
  steps: AgentStep[];
  searched: boolean;
  searchQueries: string[];
  searchSources: { title: string; url: string }[];
  model: string;
  iterations: number;
  cancelled?: boolean;
  timedOut?: boolean;
}> {
  const {
    model,
    systemPrompt,
    initialMessages = options.messages || [],
    maxIterations = MAX_AGENT_ITERATIONS,
    onEvent = async () => {},
    callProvider,
    extractToolCalls = extractStructuredToolCalls,
    isCancelled = () => false,
    wallClockTimeoutMs = AGENT_WALL_CLOCK_TIMEOUT_MS,
  } = options;

  const loopStartedAt = Date.now();
  const deadlineExceeded = () => Date.now() - loopStartedAt > wallClockTimeoutMs;

  const agentSteps: AgentStep[] = [];
  const searchQueries: string[] = [];
  const searchSources: { title: string; url: string }[] = [];
  const seenUrls = new Set<string>();

  const emitEvent = async (ev: AgentEvent) => {
    try {
      await onEvent(ev);
    } catch {}
  };

  const protocolInstructions = `
You are Leo AI, a powerful, model-agnostic autonomous agent controller.
You have access to 3 centralized tools:
1. web_search(query): Search the live web via Tavily.
2. read_webpage(url): Read and extract clean markdown text from a webpage via Jina.
3. code_execution(code, language): Execute code or shell commands inside an isolated Daytona sandbox.

When a user request requires external search, webpage reading, or code execution, you MUST output a tool call using this exact structured format:
<tool_call>
{
  "name": "web_search",
  "arguments": {
    "query": "search query here"
  }
}
</tool_call>
Do not execute tools directly. Output the <tool_call> block, and the backend agent controller will execute it and provide you with <tool_result>.
Only use the 3 tools listed above — any other tool name will be rejected.
If your previous tool call could not be parsed, re-emit it with STRICT valid JSON inside the <tool_call> tags and nothing else inside them.
`.trim();

  const workingMessages: any[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n${protocolInstructions}`.trim()
    }
  ];

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
  let malformedRetries = 0;
  let cancelled = false;
  let timedOut = false;

  while (iterations < maxIterations) {
    if (isCancelled()) { cancelled = true; break; }
    if (deadlineExceeded()) { timedOut = true; break; }

    iterations++;
    trimContextIfNeeded(workingMessages, MAX_CONTEXT_MESSAGE_CHARS);

    const response = await callProvider(workingMessages, AVAILABLE_TOOLS);

    if (!response.ok) {
      if (agentSteps.length > 0) {
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

    const rawContent = response.content || '';
    const toolCalls = extractToolCalls(response.tool_calls, rawContent);

    if (toolCalls.length === 0) {
      // Guard against a botched tool-call attempt being shown to the user
      // as if it were a real final answer.
      if (looksLikeMalformedToolAttempt(rawContent) && malformedRetries < MAX_MALFORMED_RETRIES) {
        malformedRetries++;
        workingMessages.push({ role: 'assistant', content: rawContent });
        workingMessages.push({
          role: 'user',
          content: 'Your previous tool call could not be parsed as valid JSON. Re-emit ONLY a corrected <tool_call>{...}</tool_call> block with strictly valid JSON, or answer directly if no tool is actually needed.'
        });
        await emitEvent({ type: 'planning', message: 'Recovering from a malformed tool call…' });
        continue;
      }

      finalContent = rawContent;
      await emitEvent({
        type: 'generating',
        message: 'Writing response…'
      });

      if (finalContent) {
        const chunks = finalContent.match(/[\s\S]{1,16}/g) || [finalContent];
        for (const piece of chunks) {
          if (isCancelled()) { cancelled = true; break; }
          await emitEvent({
            type: 'chunk',
            chunk: piece
          });
          await new Promise((r) => setTimeout(r, 8));
        }
      }
      break;
    }

    await emitEvent({
      type: 'planning',
      message: 'Planning next steps…'
    });

    workingMessages.push({
      role: 'assistant',
      content: rawContent || null,
      tool_calls: response.tool_calls || toolCalls.map(tc => ({
        id: tc.id || 'call_' + Math.random().toString(36).substring(2, 9),
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args)
        }
      }))
    });

    for (const toolCall of toolCalls) {
      if (isCancelled()) { cancelled = true; break; }
      if (deadlineExceeded()) { timedOut = true; break; }

      const stepStartTime = Date.now();
      let toolOutput = '';
      let stepSuccess = false;
      let toolSources: { title: string; url: string }[] | undefined = undefined;

      const cleanName = String(toolCall.name || '').trim().toLowerCase();
      const toolDisplayName = ALLOWED_TOOLS.has(cleanName) ? cleanName : (toolCall.name || 'unknown_tool');
      const statusMsg = cleanName === 'web_search'
        ? 'Searching the web…'
        : cleanName === 'read_webpage'
        ? 'Reading webpage content…'
        : cleanName === 'code_execution'
        ? 'Running code in Daytona sandbox…'
        : 'Rejecting unrecognized tool call…';

      await emitEvent({
        type: 'tool_start',
        tool: toolDisplayName,
        message: statusMsg,
        input: toolCall.args
      });

      // executeToolRouter itself whitelists names, validates arguments, and
      // enforces per-tool timeouts — the agent loop trusts its verdict
      // rather than the model's claim about what it called.
      const toolRes = await executeToolRouter(toolCall.name, toolCall.args);
      stepSuccess = toolRes.success;
      toolOutput = typeof toolRes.result === 'string' ? toolRes.result : JSON.stringify(toolRes.result);
      if (toolRes.error && !stepSuccess) {
        toolOutput = `Error: ${toolRes.error}`;
      }
      toolSources = toolRes.sources;

      if (toolSources) {
        for (const s of toolSources) {
          if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            searchSources.push(s);
          }
        }
      }

      const durationMs = Date.now() - stepStartTime;
      await emitEvent({
        type: 'tool_result',
        tool: toolDisplayName,
        message: stepSuccess ? 'Tool executed successfully' : 'Tool execution failed',
        success: stepSuccess,
        durationMs,
        sources: toolSources
      });

      agentSteps.push({
        tool: toolDisplayName,
        input: toolCall.args,
        output: toolOutput,
        success: stepSuccess,
        durationMs,
        sources: toolSources
      });

      workingMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id || 'call_' + Math.random().toString(36).substring(2, 9),
        name: toolCall.name,
        content: `<tool_result>\n${toolOutput}\n</tool_result>`
      });
    }

    if (cancelled || timedOut) break;

    await emitEvent({
      type: 'analyzing',
      message: 'Analyzing results…'
    });
  }

  if (cancelled) {
    if (agentSteps.length > 0 && !finalContent) {
      finalContent = `Stopped early (client disconnected) after gathering:\n\n` +
        agentSteps.map(s => `**Tool \`${s.tool}\`**:\n${s.output}`).join('\n\n');
    }
  } else if (timedOut && !finalContent) {
    await emitEvent({ type: 'generating', message: 'Time limit reached — summarizing findings so far…' });
    if (agentSteps.length > 0) {
      finalContent = `I ran out of time for further tool calls, but here is what I found so far:\n\n` +
        agentSteps.map(s => `**Tool \`${s.tool}\`**:\n${s.output}`).join('\n\n');
    } else {
      finalContent = 'The request took too long to process and was stopped for safety. Please try a narrower question.';
    }
  } else if (!finalContent && iterations >= maxIterations) {
    await emitEvent({
      type: 'generating',
      message: 'Preparing the final answer…'
    });

    workingMessages.push({
      role: 'user',
      content: 'Please summarize your findings from the above tool executions and provide the final answer now.'
    });

    const finalRes = await callProvider(workingMessages);
    finalContent = finalRes.content || 'Agent completed multi-step execution.';
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

  if (!finalThinking && agentSteps.length > 0) {
    finalThinking = `Executed ${agentSteps.length} autonomous tool actions: ` +
      agentSteps.map(s => `${s.tool}(${JSON.stringify(s.input)})`).join(', ') +
      `. Synthesized verified results.`;
  }

  return {
    content: finalContent,
    thinkingProcess: finalThinking,
    steps: agentSteps,
    searched: searchSources.length > 0 || searchQueries.length > 0,
    searchQueries,
    searchSources,
    model,
    iterations,
    cancelled,
    timedOut
  };
}
