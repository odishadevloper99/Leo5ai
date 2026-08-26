import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  BrainCircuit,
  Image as ImageIcon,
  Mic,
  ArrowUp,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Globe,
  ExternalLink
} from 'lucide-react';
import { Message, UserProfile } from '../types';
import { LeoLogoMark } from './LeoLogo';
import { ModelLogo } from './ModelLogo';
import { AI_MODELS, DEFAULT_MODEL_ID } from '../data/models';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string, images?: string[], isDeepResearch?: boolean) => void;
  onRegenerate: () => void;
  user: UserProfile;
  onOpenSavedPrompts: () => void;
  selectedModel?: string;
  onOpenModelSelector?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onRegenerate,
  user,
  onOpenSavedPrompts,
  selectedModel,
  onOpenModelSelector
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [inspectImage, setInspectImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Streaming State Management
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [streamedLength, setStreamedLength] = useState<number>(0);
  const completedStreamIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);
  const activeTimerRef = useRef<any>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserAtBottomRef = useRef<boolean>(true);

  // Resolve active model definition
  const activeModelDef = AI_MODELS.find(
    (m) => m.id === selectedModel || (selectedModel === 'default' && m.id === DEFAULT_MODEL_ID)
  ) || {
    id: selectedModel || DEFAULT_MODEL_ID,
    name: selectedModel ? selectedModel.split('/').pop() || 'Gemini 2.0 Flash' : 'Gemini 2.0 Flash',
    iconKey: 'gemini',
    provider: 'aicredits'
  };

  // Mark all initial messages as already streamed on mount to avoid replaying history
  useEffect(() => {
    if (!initialLoadDoneRef.current && messages.length > 0) {
      messages.forEach((m) => {
        if (m.role === 'assistant') {
          completedStreamIdsRef.current.add(m.id);
        }
      });
      initialLoadDoneRef.current = true;
    }
  }, [messages]);

  // Track if user is at the bottom of the scroll view
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserAtBottomRef.current = distanceToBottom <= threshold;
  }, []);

  // Smart smooth scrolling
  const scrollToBottomIfAppropriate = useCallback((force = false) => {
    if (force || isUserAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Trigger streaming animation for the latest assistant message
  useEffect(() => {
    if (isLoading) {
      scrollToBottomIfAppropriate(true);
      return;
    }

    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.role === 'assistant' &&
      !completedStreamIdsRef.current.has(lastMsg.id)
    ) {
      if (lastMsg.status === 'error' || !lastMsg.content) {
        completedStreamIdsRef.current.add(lastMsg.id);
        scrollToBottomIfAppropriate(true);
        return;
      }

      // Mark message as completed immediately in the ref set so other effects don't start duplicate timers
      completedStreamIdsRef.current.add(lastMsg.id);
      setStreamingMsgId(lastMsg.id);
      setStreamedLength(1);
      scrollToBottomIfAppropriate(true);

      const fullContent = lastMsg.content || '';
      const totalLen = fullContent.length;

      // Clear any previous timer
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
      }

      // Adaptive speed calculation
      const step = Math.max(3, Math.min(30, Math.ceil(totalLen / 60)));
      const intervalDelay = 20;

      let currentLength = 1;
      activeTimerRef.current = setInterval(() => {
        currentLength += step;
        if (currentLength >= totalLen) {
          setStreamedLength(totalLen);
          setStreamingMsgId(null);
          if (activeTimerRef.current) {
            clearInterval(activeTimerRef.current);
            activeTimerRef.current = null;
          }
          scrollToBottomIfAppropriate();
        } else {
          setStreamedLength(currentLength);
          scrollToBottomIfAppropriate();
        }
      }, intervalDelay);
    }
  }, [messages, isLoading, scrollToBottomIfAppropriate]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
      }
    };
  }, []);

  // Resilient Copy to Clipboard (with iframe & mobile fallbacks)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    } catch {
      return false;
    }
  };

  // Copy Message Content
  const handleCopyText = async (id: string, text: string) => {
    await copyToClipboard(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Copy Specific Code
  const handleCopyCode = async (code: string) => {
    await copyToClipboard(code);
    setCopiedCodeBlock(code);
    setTimeout(() => setCopiedCodeBlock(null), 2000);
  };

  // Text-To-Speech
  const handleToggleSpeech = (id: string, text: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMsgId === id) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`_\[\]()]/g, ''));
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      setSpeakingMsgId(id);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Image Upload / Vision
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImages((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && selectedImages.length === 0) return;
    if (isLoading || Boolean(streamingMsgId)) return;

    onSendMessage(inputText, selectedImages, false);
    setInputText('');
    setSelectedImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleReasoning = (id: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      setIsRecording(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#faf9fe]">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Messages Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-3 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6 max-w-4xl mx-auto w-full"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isCurrentlyStreaming = streamingMsgId === message.id;

          // Determine the text slice to render
          const displayContent = isCurrentlyStreaming
            ? (message.content || '').slice(0, streamedLength)
            : message.content;

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 md:gap-4 ${
                isUser ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              {isUser ? (
                <img
                  src={
                    user.photoURL ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-purple-200 flex-shrink-0 mt-1"
                />
              ) : (
                <div className="relative flex-shrink-0 mt-1">
                  {isCurrentlyStreaming && (
                    <div className="absolute -inset-0.5 rounded-full bg-purple-500/30 animate-grok-ring" />
                  )}
                  <LeoLogoMark className="w-8 h-8 relative z-10 drop-shadow-xs" />
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`w-full max-w-[94%] sm:max-w-[88%] md:max-w-[80%] min-w-0 flex flex-col ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                {/* User Name / Mode Badge Header */}
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[11px] font-semibold text-neutral-600">
                    {isUser ? user.displayName || 'You' : 'Leo AI'}
                  </span>
                  {message.isDeepResearch && (
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-0.5">
                      <BrainCircuit className="w-2.5 h-2.5" />
                      Deep Reasoning
                    </span>
                  )}
                </div>

                {/* User Uploaded Images */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {message.images.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setInspectImage(img)}
                        className="relative group rounded-xl overflow-hidden border border-purple-200 shadow-xs cursor-pointer"
                      >
                        <img
                          src={img}
                          alt="Uploaded attachment"
                          className="max-w-[200px] max-h-[160px] object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Main Message Box */}
                <div
                  className={`w-full min-w-0 overflow-hidden rounded-2xl p-3.5 md:p-4.5 text-xs md:text-sm leading-relaxed transition-all duration-150 ${
                    isUser
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-xs shadow-[0_4px_14px_rgba(147,51,234,0.25)]'
                      : 'bg-white border border-purple-100/90 rounded-tl-xs shadow-[0_2px_12px_rgba(0,0,0,0.03)] text-neutral-800'
                  }`}
                >
                  {/* Verified Web Search Sources Badge & Collapsible Links */}
                  {!isUser && message.searched && message.searchSources && message.searchSources.length > 0 && (
                    <div className="mb-3 border border-indigo-100 rounded-xl bg-indigo-50/50 p-2.5 text-xs shadow-2xs">
                      <button
                        type="button"
                        onClick={() => toggleSources(message.id)}
                        className="flex items-center justify-between w-full font-medium text-indigo-950 hover:text-indigo-900 active:scale-[0.99] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-semibold">
                            Browsed {message.searchSources.length} web {message.searchSources.length === 1 ? 'source' : 'sources'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                          <span>{expandedSources[message.id] ? 'Hide' : 'View sources'}</span>
                          {expandedSources[message.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>

                      {expandedSources[message.id] && (
                        <div className="mt-2 pt-2 border-t border-indigo-100/80 flex flex-wrap gap-1.5">
                          {message.searchSources.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200/70 text-indigo-900 hover:text-indigo-600 hover:border-indigo-300 text-[11px] transition shadow-2xs truncate max-w-[240px]"
                              title={source.url}
                            >
                              <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="truncate">{source.title || 'Source'}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assistant Deep Reasoning Collapsible Block (if present) */}
                  {!isUser && message.isDeepResearch && (
                    <div className="mb-3.5 border border-purple-200/80 rounded-xl bg-purple-50/60 p-3 text-xs shadow-2xs">
                      <button
                        onClick={() => toggleReasoning(message.id)}
                        className="flex items-center justify-between w-full font-semibold text-purple-900 active:scale-[0.99] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                          <span>Deep Reasoning & Cognitive Steps</span>
                        </div>
                        {expandedReasoning[message.id] ? (
                          <ChevronUp className="w-4 h-4 text-purple-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-purple-600" />
                        )}
                      </button>

                      {expandedReasoning[message.id] && (
                        <div className="mt-2.5 pt-2.5 border-t border-purple-200/70 text-[11px] text-purple-900/85 space-y-1.5 leading-relaxed font-sans">
                          <p>1. Deconstructed user objective and identified core domain requirements.</p>
                          <p>2. Evaluated systemic constraints, tradeoffs, and production best practices.</p>
                          <p>3. Synthesized structured, multi-dimensional response adhering strictly to directives.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Markdown Content with Streaming Typing Cursor */}
                  <div className={`w-full min-w-0 overflow-hidden prose-sm max-w-none break-words relative ${isUser ? 'text-white' : 'text-neutral-850'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre({ children }: any) {
                          return <div className="my-2.5 w-full min-w-0 max-w-full overflow-hidden">{children}</div>;
                        },
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          const isMultiLine = codeString.includes('\n');
                          const isBlock = Boolean(match) || isMultiLine;

                          if (isBlock) {
                            const language = match ? match[1] : 'code';
                            const isCopied = copiedCodeBlock === codeString;
                            return (
                              <div className="relative my-2 rounded-xl overflow-hidden bg-[#121316] border border-neutral-800 text-neutral-100 shadow-md w-full min-w-0 max-w-full">
                                {/* Header Bar with Language tag & Prominent Copy Button */}
                                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1e2025] border-b border-neutral-800 text-xs text-neutral-300 w-full min-w-0 select-none">
                                  <span className="font-mono text-[11px] uppercase tracking-wider text-purple-300 font-bold truncate pr-2 shrink-0">
                                    {language}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCopyCode(codeString);
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 hover:text-white transition text-xs font-medium active:scale-95 shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span className="text-emerald-400 font-semibold text-[11px]">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                                        <span className="text-neutral-200 text-[11px]">Copy code</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {/* Code content with horizontal scrolling */}
                                <div className="p-3.5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed text-neutral-150 w-full max-w-full">
                                  <pre className="m-0 p-0 font-mono bg-transparent whitespace-pre">
                                    <code>{codeString}</code>
                                  </pre>
                                </div>
                              </div>
                            );
                          }

                          // Clean Inline Code Badge
                          return (
                            <code
                              className={`px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[12px] md:text-[13px] font-semibold inline-block transition ${
                                isUser
                                  ? 'bg-purple-700/80 text-white'
                                  : 'bg-purple-50 text-purple-800 border border-purple-200/80'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p({ children }: any) {
                          return (
                            <p className={`mb-2.5 last:mb-0 leading-relaxed text-xs md:text-sm inline-block w-full ${isUser ? 'text-white' : 'text-neutral-800'}`}>
                              {children}
                              {isCurrentlyStreaming && (
                                <span
                                  aria-hidden="true"
                                  className="inline-block w-1.5 h-3.5 md:h-4 ml-1 -mb-0.5 align-middle bg-gradient-to-b from-purple-500 to-indigo-600 rounded-xs animate-cursor-blink shadow-2xs"
                                />
                              )}
                            </p>
                          );
                        },
                        h1({ children }: any) {
                          return <h1 className="text-base md:text-lg font-bold text-neutral-900 mt-3 mb-2 font-display">{children}</h1>;
                        },
                        h2({ children }: any) {
                          return <h2 className="text-sm md:text-base font-bold text-neutral-900 mt-3 mb-1.5 font-display">{children}</h2>;
                        },
                        h3({ children }: any) {
                          return <h3 className="text-xs md:text-sm font-bold text-neutral-900 mt-2.5 mb-1 font-display">{children}</h3>;
                        },
                        ul({ children }: any) {
                          return <ul className="list-disc pl-5 my-2 space-y-1 text-xs md:text-sm text-neutral-800">{children}</ul>;
                        },
                        ol({ children }: any) {
                          return <ol className="list-decimal pl-5 my-2 space-y-1 text-xs md:text-sm text-neutral-800">{children}</ol>;
                        },
                        li({ children }: any) {
                          return <li className="leading-relaxed">{children}</li>;
                        },
                        blockquote({ children }: any) {
                          return <blockquote className="border-l-4 border-purple-400 pl-3 my-2.5 italic text-neutral-600 text-xs md:text-sm">{children}</blockquote>;
                        },
                        table({ children }: any) {
                          return (
                            <div className="overflow-x-auto my-3 rounded-xl border border-purple-100 shadow-2xs">
                              <table className="min-w-full text-xs text-left divide-y divide-purple-100">
                                {children}
                              </table>
                            </div>
                          );
                        },
                        th({ children }: any) {
                          return <th className="px-3.5 py-2.5 bg-purple-50/90 font-semibold text-purple-900">{children}</th>;
                        },
                        td({ children }: any) {
                          return <td className="px-3.5 py-2 border-t border-purple-50 text-neutral-700">{children}</td>;
                        }
                      }}
                    >
                      {displayContent}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Assistant Message Actions Toolbar (fades in when generation completes) */}
                {!isUser && !isCurrentlyStreaming && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-1 text-neutral-400 text-xs animate-in fade-in duration-200">
                    <button
                      onClick={() => handleCopyText(message.id, message.content)}
                      title="Copy response"
                      className="p-1 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition cursor-pointer"
                    >
                      {copiedMsgId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleToggleSpeech(message.id, message.content)}
                      title="Read aloud"
                      className={`p-1 rounded-md transition cursor-pointer ${
                        speakingMsgId === message.id
                          ? 'text-purple-600 bg-purple-50'
                          : 'hover:text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={onRegenerate}
                      title="Regenerate answer"
                      className="p-1 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-3 w-[1px] bg-neutral-200 mx-0.5" />

                    <button
                      title="Helpful"
                      className="p-1 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Not helpful"
                      className="p-1 hover:text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Premium Grok-Style Thinking State (Active before response arrives) */}
        {isLoading && (
          <div className="flex items-start gap-3 md:gap-4 animate-in fade-in duration-200">
            {/* Pulsing Luminous Avatar */}
            <div className="relative w-8 h-8 flex-shrink-0 mt-1 flex items-center justify-center">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-500 via-indigo-400 to-pink-400 opacity-60 blur-xs animate-grok-ring" />
              <LeoLogoMark className="w-8 h-8 relative z-10 drop-shadow-xs" />
            </div>

            {/* Compact Thinking Capsule */}
            <div className="w-full max-w-[94%] sm:max-w-[88%] md:max-w-[80%] min-w-0 flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-semibold text-neutral-600">Leo AI</span>
              </div>

              <div className="bg-white border border-purple-100/90 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-center gap-2.5 min-h-[40px]">
                {/* Luminous orbiting indicator */}
                <div className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin [animation-duration:3s]" />
                </div>
                {/* Grok-style shimmering wave text */}
                <span className="text-xs font-semibold animate-grok-text tracking-tight select-none">
                  Thinking & researching...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar in Active Chat View */}
      <div className="flex-shrink-0 p-2.5 md:p-6 bg-white/95 border-t border-purple-100/70 backdrop-blur-xl pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl border border-purple-100/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100/50 p-2.5 md:p-3 transition-all duration-200">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-purple-200 shadow-xs"
                >
                  <img src={img} alt="Vision upload" className="w-14 h-14 object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black text-white rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Leo AI a follow up..."
            className="w-full resize-none bg-transparent text-base md:text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none px-1 py-1 leading-relaxed"
          />

          {/* Bottom Bar Controls */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              {onOpenModelSelector && (
                <button
                  type="button"
                  onClick={onOpenModelSelector}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-neutral-50 hover:bg-purple-50 text-neutral-800 hover:text-purple-900 border border-neutral-200/80 hover:border-purple-200 transition active:scale-95 group shadow-2xs cursor-pointer"
                  title="Change AI Model"
                >
                  <ModelLogo iconKey={activeModelDef.iconKey} modelId={activeModelDef.id} size="xs" />
                  <span className="font-semibold max-w-[110px] truncate">{activeModelDef.name}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-purple-600 transition" />
                </button>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload image for Vision analysis"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-lg transition active:scale-95 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenSavedPrompts}
                title="Open Prompt Library"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-lg transition active:scale-95 cursor-pointer"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleVoice}
                title="Voice input"
                className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSubmit()}
                disabled={(!inputText.trim() && selectedImages.length === 0) || isLoading || Boolean(streamingMsgId)}
                className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-black disabled:opacity-30 text-white flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Inspection Modal */}
      {inspectImage && (
        <div
          onClick={() => setInspectImage(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setInspectImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={inspectImage}
              alt="Inspected vision asset"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
