import { executeToolRouter, CENTRALIZED_TOOLS } from './toolRouter';

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

/**
 * Normalizes and extracts tool calls from model output supporting:
 * 1. Native provider tool_calls
 * 2. <tool_call>...</tool_call> XML block
 * 3. ```json fenced code block containing {"name": "...", "arguments": {...}}
 * 4. Raw JSON object matching tool call schema
 */
export function extractStructuredToolCalls(toolCallsRaw: any, contentRaw: string): any[] {
  // 1. Native tool calls if provided
  if (Array.isArray(toolCallsRaw) && toolCallsRaw.length > 0) {
    return toolCallsRaw.map(tc => ({
      id: tc.id || 'call_' + Math.random().toString(36).substring(2, 9),
      name: tc.function?.name || tc.name,
      args: typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments || '{}')
        : (tc.function?.arguments || tc.args || {})
    }));
  }

  if (!contentRaw || typeof contentRaw !== 'string') return [];

  const results: any[] = [];

  // 2. Search for <tool_call>...</tool_call> blocks
  const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = xmlRegex.exec(contentRaw)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && (parsed.name || parsed.tool)) {
        results.push({
          id: 'call_' + Math.random().toString(36).substring(2, 9),
          name: parsed.name || parsed.tool,
          args: parsed.arguments || parsed.args || parsed.input || {}
        });
      }
    } catch (e) {
      console.warn('[AGENT PARSER] Failed to parse XML tool_call JSON:', e);
    }
  }

  if (results.length > 0) return results;

  // 3. Search for JSON code blocks or raw JSON containing tool call structure
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  while ((match = jsonBlockRegex.exec(contentRaw)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && (parsed.name || parsed.tool) && (parsed.arguments || parsed.args || parsed.input)) {
        results.push({
          id: 'call_' + Math.random().toString(36).substring(2, 9),
          name: parsed.name || parsed.tool,
          args: parsed.arguments || parsed.args || parsed.input || {}
        });
      }
    } catch (e) {}
  }

  if (results.length > 0) return results;

  // 4. Fallback: check if the entire content or partial content is a direct JSON object
  try {
    const trimmed = contentRaw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed && (parsed.name || parsed.tool)) {
        results.push({
          id: 'call_' + Math.random().toString(36).substring(2, 9),
          name: parsed.name || parsed.tool,
          args: parsed.arguments || parsed.args || parsed.input || {}
        });
      }
    }
  } catch (e) {}

  return results;
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
}): Promise<{
  content: string;
  thinkingProcess: string;
  steps: AgentStep[];
  searched: boolean;
  searchQueries: string[];
  searchSources: { title: string; url: string }[];
  model: string;
  iterations: number;
}> {
  const {
    model,
    systemPrompt,
    initialMessages = options.messages || [],
    maxIterations = 6,
    onEvent = async () => {},
    callProvider,
    extractToolCalls = extractStructuredToolCalls,
  } = options;

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

  while (iterations < maxIterations) {
    iterations++;
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
      finalContent = rawContent;
      await emitEvent({
        type: 'generating',
        message: 'Writing response…'
      });

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
      const stepStartTime = Date.now();
      let toolOutput = '';
      let stepSuccess = false;
      let toolSources: { title: string; url: string }[] | undefined = undefined;

      const toolDisplayName = toolCall.name === 'web_search' ? 'web_search' : toolCall.name === 'read_webpage' ? 'read_webpage' : 'code_execution';
      const statusMsg = toolCall.name === 'web_search'
        ? 'Searching the web…'
        : toolCall.name === 'read_webpage'
        ? 'Reading webpage content…'
        : 'Running code in Daytona sandbox…';

      await emitEvent({
        type: 'tool_start',
        tool: toolDisplayName,
        message: statusMsg,
        input: toolCall.args
      });

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

    await emitEvent({
      type: 'analyzing',
      message: 'Analyzing results…'
    });
  }

  if (!finalContent && iterations >= maxIterations) {
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
    iterations
  };
}
