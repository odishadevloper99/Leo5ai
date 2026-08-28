import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Share2,
  Brain,
  Terminal,
  Globe,
  ExternalLink,
  Volume2,
  Download,
  Loader2,
  Sparkles,
  Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, AgentStepItem } from '../types';

// ----------------------------------------------------------
// 1. ReasoningBox — collapsed by default, real content only
// ----------------------------------------------------------
export interface ReasoningBoxProps {
  label?: string;
  text?: string;
  isLive?: boolean;
  isStreaming?: boolean;
  defaultOpen?: boolean;
}

export function ReasoningBox({
  label = 'Reasoning',
  text,
  isLive = false,
  isStreaming = false,
  defaultOpen = false
}: ReasoningBoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  const live = isLive || isStreaming;
  if (!text || !text.trim()) return null;
  return (
    <div className="mb-2.5 w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[13px] text-[#8e918f] hover:text-white transition-colors cursor-pointer select-none"
      >
        <Brain size={14} className={live ? 'animate-pulse text-[#c4eed0]' : ''} />
        <span>{live ? 'Thinking…' : label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l-2 border-[#333538] text-[13px] leading-relaxed text-[#8e918f] whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------
// 2. ToolCallPill — shimmer while active, static once resolved
// ----------------------------------------------------------
export interface ToolCallPillProps {
  query: string;
  status?: 'active' | 'done' | 'failed' | string;
  toolName?: string;
}

export function ToolCallPill({ query, status = 'done' }: ToolCallPillProps) {
  return (
    <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-[#333538] bg-[#1e1f20] px-3.5 py-2 text-[13px] text-[#e3e3e3] max-w-full">
      <Search size={14} className={`shrink-0 ${status === 'active' ? 'text-white' : 'text-[#8e918f]'}`} />
      <span className={`truncate ${status === 'active' ? 'shimmer-text' : ''}`}>{query}</span>
      {status === 'done' && <Check size={13} className="shrink-0 text-emerald-500" />}
      <style>{`
        .shimmer-text {
          background: linear-gradient(90deg, #8e918f 0%, #8e918f 35%, #ffffff 50%, #8e918f 65%, #8e918f 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 1.6s linear infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------------
// 3. StreamingCursor — the blinking block at the end of live text
// ----------------------------------------------------------
export function StreamingCursor() {
  return <span className="inline-block w-2 h-3.5 ml-1 bg-white animate-pulse align-middle" />;
}

// ----------------------------------------------------------
// 4. Markdown renderers — match exact reference classNames
// ----------------------------------------------------------
export const markdownComponents = {
  h1({ children }: any) {
    return (
      <>
        <hr className="border-t border-[#28292c] mt-6 mb-5" />
        <h1 className="text-2xl md:text-[28px] font-bold text-white leading-tight mb-3">{children}</h1>
      </>
    );
  },
  h2({ children }: any) {
    return (
      <>
        <hr className="border-t border-[#28292c] mt-6 mb-5" />
        <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-3">{children}</h2>
      </>
    );
  },
  h3({ children }: any) {
    return <h3 className="text-lg md:text-xl font-semibold text-white leading-snug mt-5 mb-2">{children}</h3>;
  },
  p({ children }: any) {
    return <p className="mb-3 text-[15px] md:text-base leading-relaxed text-[#e3e3e3] last:mb-0">{children}</p>;
  },
  strong({ children }: any) {
    return <strong className="font-semibold text-white">{children}</strong>;
  },
  ul({ children }: any) {
    return <ul className="list-disc list-outside pl-5 mb-3 space-y-2 text-[15px] md:text-base text-[#e3e3e3]">{children}</ul>;
  },
  ol({ children }: any) {
    return <ol className="list-decimal list-outside pl-5 mb-3 space-y-2 text-[15px] md:text-base text-[#e3e3e3]">{children}</ol>;
  },
  li({ children }: any) {
    return <li className="text-[15px] md:text-base text-[#e3e3e3] leading-relaxed">{children}</li>;
  },
  a({ href, children }: any) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#8ab4f8] hover:text-[#a8c7fa] underline-offset-2 hover:underline break-words"
      >
        {children}
      </a>
    );
  },
  code({ className, children, ...props }: any) {
    const isBlock = /language-(\w+)/.exec(className || '');
    if (!isBlock) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-[#28292c] text-white font-mono text-[13px] border border-[#383a3e]" {...props}>
          {children}
        </code>
      );
    }
    return (
      <pre className="p-3.5 my-2.5 overflow-x-auto rounded-xl bg-[#1e1f20] border border-[#333538] text-[13px] font-mono leading-relaxed text-[#e3e3e3]">
        <code>{children}</code>
      </pre>
    );
  },
  table({ children }: any) {
    return (
      <div className="my-3 rounded-xl overflow-hidden border border-[#333538] bg-[#1e1f20] shadow-md w-full max-w-full">
        <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 bg-[#28292c] border-b border-[#333538]">
          <button className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer" title="Download CSV">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer" title="Copy table">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm border-collapse">{children}</table>
        </div>
      </div>
    );
  },
  th({ children }: any) {
    return <th className="bg-[#28292c] px-3.5 py-2 text-white font-semibold border-b border-[#333538] text-xs md:text-sm">{children}</th>;
  },
  td({ children }: any) {
    return <td className="px-3.5 py-2.5 border-b border-[#333538] text-[#e3e3e3] text-xs md:text-sm">{children}</td>;
  },
};

// ----------------------------------------------------------
// 5. MarkdownLite — wrapper around ReactMarkdown with custom components
// ----------------------------------------------------------
export interface MarkdownLiteProps {
  text: string;
  isStreaming?: boolean;
  copiedCodeBlock?: string | null;
  onCopyCode?: (code: string) => void;
  copiedTableId?: string | null;
  onCopyTable?: (tableText: string, id: string) => void;
  downloadedTableId?: string | null;
  onDownloadTableCsv?: (tableText: string, id: string) => void;
}

export const MarkdownLite: React.FC<MarkdownLiteProps> = ({
  text,
  isStreaming = false,
  copiedCodeBlock,
  onCopyCode,
  copiedTableId,
  onCopyTable,
  downloadedTableId,
  onDownloadTableCsv
}) => {
  const [downloadedCodeId, setDownloadedCodeId] = useState<string | null>(null);

  const handleDownloadCode = (codeString: string, lang: string) => {
    try {
      const ext =
        lang === 'python'
          ? 'py'
          : lang === 'javascript'
          ? 'js'
          : lang === 'typescript'
          ? 'ts'
          : lang === 'bash' || lang === 'sh'
          ? 'sh'
          : lang === 'html'
          ? 'html'
          : lang === 'css'
          ? 'css'
          : lang === 'json'
          ? 'json'
          : 'txt';
      const blob = new Blob([codeString], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `snippet.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadedCodeId(codeString);
      setTimeout(() => setDownloadedCodeId(null), 1500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full min-w-0 max-w-none break-words text-[#e3e3e3]">
      {text ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            ...markdownComponents,
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : 'text';
              const codeString = String(children).replace(/\n$/, '');

              if (!inline && (match || String(children).includes('\n'))) {
                const isCopied = copiedCodeBlock === codeString;
                const isDownloaded = downloadedCodeId === codeString;
                return (
                  <div className="relative my-2.5 rounded-xl overflow-hidden bg-[#1e1f20] border border-[#333538] text-[#e3e3e3] shadow-md w-full min-w-0 max-w-full">
                    <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#28292c] border-b border-[#333538] text-xs text-[#e3e3e3] w-full min-w-0 select-none">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#8e918f] font-semibold truncate pr-2 shrink-0">
                        {language}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadCode(codeString, language);
                          }}
                          title="Download Code"
                          className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer"
                        >
                          {isDownloaded ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onCopyCode) onCopyCode(codeString);
                          }}
                          title="Copy Code"
                          className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer"
                        >
                          {isCopied ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="p-3.5 overflow-x-auto text-[13px] font-mono leading-relaxed bg-[#1e1f20] max-w-full text-[#e3e3e3]">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                );
              }

              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-[#28292c] text-white font-mono text-[13px] border border-[#383a3e]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            table({ node, children }: any) {
              const tableId = `tbl-${Math.random().toString(36).substring(2, 7)}`;
              return (
                <div className="my-3 rounded-xl overflow-hidden border border-[#333538] bg-[#1e1f20] shadow-md w-full max-w-full">
                  <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 bg-[#28292c] border-b border-[#333538] select-none">
                    <button
                      type="button"
                      onClick={() => {
                        const raw = node?.position ? text.slice(node.position.start.offset, node.position.end.offset) : '';
                        if (onDownloadTableCsv) onDownloadTableCsv(raw || text, tableId);
                      }}
                      title="Download CSV"
                      className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer"
                    >
                      {downloadedTableId === tableId ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const raw = node?.position ? text.slice(node.position.start.offset, node.position.end.offset) : '';
                        if (onCopyTable) onCopyTable(raw || text, tableId);
                      }}
                      title="Copy Table"
                      className="p-1 hover:bg-[#333538] rounded text-[#e3e3e3] hover:text-white transition cursor-pointer"
                    >
                      {copiedTableId === tableId ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left text-xs md:text-sm border-collapse">{children}</table>
                  </div>
                </div>
              );
            }
          }}
        >
          {text}
        </ReactMarkdown>
      ) : isStreaming ? (
        <div className="flex items-center gap-2 text-zinc-500 py-1 text-xs font-mono">
          <Loader2 size={13} className="animate-spin text-zinc-400" />
          <span>Generating response…</span>
        </div>
      ) : null}

      {/* Streaming cursor */}
      {isStreaming && text && <StreamingCursor />}
    </div>
  );
};

// ----------------------------------------------------------
// 6. ActionBar — exact icon order from the reference:
//    Copy → Like → Dislike → Retry → Share → (Read aloud) → Sources (right)
// ----------------------------------------------------------
export interface ActionBarProps {
  messageId?: string;
  fullText: string;
  onRetry?: () => void;
  onToggleSpeech?: (msgId: string, text: string) => void;
  isSpeaking?: boolean;
  sources?: { title: string; url: string }[];
  searchSources?: { title: string; url: string }[];
  onToggleSources?: (msgId: string) => void;
  showSources?: boolean;
}

export function ActionBar({
  messageId = '',
  fullText,
  onRetry,
  onToggleSpeech,
  isSpeaking = false,
  sources = [],
  searchSources = [],
  onToggleSources,
  showSources = false
}: ActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [internalShowSources, setInternalShowSources] = useState(false);

  const effectiveSources = sources.length > 0 ? sources : searchSources;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const btn = 'p-1 hover:text-white hover:bg-[#28292c] rounded-md transition cursor-pointer text-[#8e918f]';

  return (
    <div className="w-full flex items-center justify-between pt-2">
      <div className="flex items-center gap-1.5">
        <button onClick={copy} className={btn} title="Copy">
          {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
          className={`${btn} ${vote === 'up' ? 'text-white' : ''}`}
          title="Good response"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
          className={`${btn} ${vote === 'down' ? 'text-white' : ''}`}
          title="Bad response"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
        {onRetry && (
          <button onClick={onRetry} className={btn} title="Retry">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          className={btn}
          title="Share"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ text: fullText.slice(0, 500) });
              } catch {}
            } else {
              copy();
            }
          }}
        >
          <Share2 className="w-4 h-4" />
        </button>
        {onToggleSpeech && messageId && (
          <button
            onClick={() => onToggleSpeech(messageId, fullText)}
            className={`${btn} ${isSpeaking ? 'text-white bg-[#28292c]' : ''}`}
            title="Read aloud"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {effectiveSources.length > 0 && (
        <button
          onClick={() => {
            setInternalShowSources((s) => !s);
            if (onToggleSources && messageId) onToggleSources(messageId);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e1f20] hover:bg-[#28292c] border border-[#333538] text-white text-xs transition cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Sources</span>
          <span className="text-[10px] bg-[#333538] px-1 py-0.2 rounded text-white">{effectiveSources.length}</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// 7) AgentStepItemCard — visual step for Tool Execution
// ---------------------------------------------------------
interface AgentStepCardProps {
  step: AgentStepItem;
  stepIndex: number;
  isStreaming?: boolean;
}

const AgentStepCard: React.FC<AgentStepCardProps> = ({ step, stepIndex, isStreaming }) => {
  const [open, setOpen] = useState(false);

  const getToolIcon = (toolName: string) => {
    const t = toolName.toLowerCase();
    if (t.includes('search') || t.includes('tavily')) {
      return <Search size={13} className="text-blue-400 shrink-0" />;
    }
    if (t.includes('code') || t.includes('eval') || t.includes('python')) {
      return <Cpu size={13} className="text-emerald-400 shrink-0" />;
    }
    if (t.includes('analysis') || t.includes('synthes')) {
      return <Brain size={13} className="text-purple-400 shrink-0" />;
    }
    return <Terminal size={13} className="text-amber-400 shrink-0" />;
  };

  const toolDisplayQuery =
    step.input?.query ||
    step.input?.command ||
    step.input?.url ||
    step.input?.prompt ||
    (typeof step.input === 'string' ? step.input : JSON.stringify(step.input));

  return (
    <div className="w-full rounded-xl border border-[#333538] bg-[#1e1f20] overflow-hidden text-xs font-mono transition-all">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-3 py-2 bg-[#28292c] hover:bg-[#333538] cursor-pointer select-none text-[#e3e3e3]"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {getToolIcon(step.tool)}
          <span className="font-semibold text-white truncate">
            Step {stepIndex + 1}: {step.tool}
          </span>
          {toolDisplayQuery && (
            <span className="text-[#8e918f] truncate max-w-[200px] text-[11px]">
              {String(toolDisplayQuery)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step.durationMs ? (
            <span className="text-[10px] text-[#8e918f]">{step.durationMs}ms</span>
          ) : isStreaming ? (
            <Loader2 size={11} className="animate-spin text-blue-400" />
          ) : null}
          {step.success !== false ? (
            <Check size={12} className="text-emerald-500" />
          ) : (
            <span className="text-[10px] text-red-400">failed</span>
          )}
          <ChevronRight
            size={13}
            className={`text-[#8e918f] transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {open && (
        <div className="p-3 border-t border-[#333538] space-y-2 bg-[#1e1f20] text-[11px] leading-relaxed">
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <div className="text-[#8e918f] mb-0.5">Parameters:</div>
              <pre className="p-2 rounded bg-[#28292c] border border-[#333538] text-[#e3e3e3] max-h-28 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output && (
            <div>
              <div className="text-[#8e918f] mb-0.5">Execution Output:</div>
              <pre className="p-2 rounded bg-[#28292c] border border-[#333538] text-[#e3e3e3] max-h-40 overflow-y-auto whitespace-pre-wrap">
                {step.output}
              </pre>
            </div>
          )}
          {step.sources && step.sources.length > 0 && (
            <div className="pt-1">
              <div className="text-[#8e918f] mb-1">Sources retrieved:</div>
              <div className="space-y-1">
                {step.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#8ab4f8] hover:underline truncate"
                  >
                    <ExternalLink size={11} className="shrink-0" />
                    <span className="truncate">{src.title || src.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 8) AgentMessage — Unified Component mapping Thinking, Tool Execution, and Analysis
// ---------------------------------------------------------
export interface AgentMessageProps {
  message: Message;
  isStreaming?: boolean;
  displayContent?: string;
  copiedCodeBlock?: string | null;
  onCopyCode?: (code: string) => void;
  copiedTableId?: string | null;
  onCopyTable?: (tableText: string, id: string) => void;
  downloadedTableId?: string | null;
  onDownloadTableCsv?: (tableText: string, id: string) => void;
  onRetry?: () => void;
  onToggleSpeech?: (msgId: string, text: string) => void;
  isSpeaking?: boolean;
  onToggleSources?: (msgId: string) => void;
  showSources?: boolean;
}

export const AgentMessage: React.FC<AgentMessageProps> = ({
  message,
  isStreaming = false,
  displayContent,
  copiedCodeBlock = null,
  onCopyCode,
  copiedTableId = null,
  onCopyTable,
  downloadedTableId = null,
  onDownloadTableCsv,
  onRetry,
  onToggleSpeech,
  isSpeaking = false,
  onToggleSources,
  showSources = false
}) => {
  const [expandedAgentSteps, setExpandedAgentSteps] = useState(false);

  const rawContent = displayContent !== undefined ? displayContent : message.content;
  const agentSteps = message.agentSteps || [];
  const searchQueries = message.searchQueries || [];
  const hasThinking = Boolean(message.thinkingProcess && message.thinkingProcess.trim().length > 0);
  const currentAction = message.currentAgentAction;

  return (
    <div className="w-full max-w-[650px] flex flex-col items-start space-y-2">
      {/* --------------------------------------------------- */}
      {/* LIVE ACTION STATUS PILL (e.g. Thinking..., Searching...) */}
      {/* --------------------------------------------------- */}
      {isStreaming && currentAction && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e1f20] border border-[#333538] text-xs text-[#e3e3e3] font-medium">
          <Sparkles size={13} className="text-purple-400 animate-spin" />
          <span>{currentAction}</span>
        </div>
      )}

      {/* --------------------------------------------------- */}
      {/* STAGE 1: THINKING STAGE (ReasoningBox)              */}
      {/* --------------------------------------------------- */}
      {hasThinking && (
        <ReasoningBox
          label="Reasoning"
          text={message.thinkingProcess}
          isLive={isStreaming}
          defaultOpen={false}
        />
      )}

      {/* --------------------------------------------------- */}
      {/* STAGE 2: TOOL EXECUTION STAGE                       */}
      {/* (ToolCallPills & AgentSteps mapping)                */}
      {/* --------------------------------------------------- */}
      {searchQueries.length > 0 && (
        <div className="w-full space-y-1.5">
          {searchQueries.map((query, qIdx) => (
            <ToolCallPill
              key={qIdx}
              query={query}
              status={isStreaming && qIdx === searchQueries.length - 1 ? 'active' : 'done'}
            />
          ))}
        </div>
      )}

      {/* Live Tool Execution Agent Steps (Detailed mapping) */}
      {agentSteps.length > 0 && (
        <div className="w-full space-y-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => setExpandedAgentSteps((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#333538] text-[#e3e3e3] hover:text-white text-xs font-mono transition cursor-pointer active:scale-[0.99]"
          >
            <Terminal size={14} className="text-[#8e918f] shrink-0" />
            <span>
              Agent Execution: {agentSteps.length} tool {agentSteps.length === 1 ? 'action' : 'actions'}
            </span>
            <ChevronRight
              size={14}
              className={`text-[#8e918f] transition-transform ${
                expandedAgentSteps ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedAgentSteps && (
            <div className="w-full border border-[#333538] rounded-xl bg-[#1e1f20] p-2.5 space-y-2">
              {agentSteps.map((step, sIdx) => (
                <AgentStepCard
                  key={sIdx}
                  step={step}
                  stepIndex={sIdx}
                  isStreaming={isStreaming && sIdx === agentSteps.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------- */}
      {/* STAGE 3: ANALYSIS & SYNTHESIS STAGE (MarkdownLite)  */}
      {/* --------------------------------------------------- */}
      {rawContent && rawContent.length > 0 ? (
        <MarkdownLite
          text={rawContent}
          isStreaming={isStreaming}
          copiedCodeBlock={copiedCodeBlock}
          onCopyCode={onCopyCode}
          copiedTableId={copiedTableId}
          onCopyTable={onCopyTable}
          downloadedTableId={downloadedTableId}
          onDownloadTableCsv={onDownloadTableCsv}
        />
      ) : isStreaming && !hasThinking && searchQueries.length === 0 && !currentAction ? (
        <div className="flex items-center gap-2 text-[#8e918f] py-1 text-xs font-mono">
          <Loader2 size={13} className="animate-spin text-[#8e918f]" />
          <span>Generating response…</span>
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* SOURCES CARDS (if toggled)                          */}
      {/* --------------------------------------------------- */}
      {showSources && message.searchSources && message.searchSources.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {message.searchSources.map((src, srcIdx) => (
            <a
              key={srcIdx}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-2.5 rounded-xl bg-[#1e1f20] hover:bg-[#28292c] border border-[#333538] text-[#e3e3e3] transition text-xs group"
            >
              <Globe size={14} className="text-[#8e918f] shrink-0 mt-0.5 group-hover:text-white" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#e3e3e3] truncate group-hover:text-white">
                  {src.title}
                </div>
                <div className="text-[11px] text-[#8e918f] truncate">{src.url}</div>
              </div>
              <ExternalLink size={12} className="text-[#8e918f] group-hover:text-white shrink-0" />
            </a>
          ))}
        </div>
      )}

      {/* --------------------------------------------------- */}
      {/* ACTION BAR — copy, vote, retry, share, speech, etc. */}
      {/* --------------------------------------------------- */}
      {!isStreaming && rawContent && rawContent.length > 0 && (
        <ActionBar
          messageId={message.id}
          fullText={message.content}
          onRetry={onRetry}
          onToggleSpeech={onToggleSpeech}
          isSpeaking={isSpeaking}
          searchSources={message.searchSources}
          onToggleSources={onToggleSources}
          showSources={showSources}
        />
      )}
    </div>
  );
};

export default AgentMessage;

