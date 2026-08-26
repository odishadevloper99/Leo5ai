import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  BrainCircuit,
  Mic,
  ArrowUp,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  Globe,
  ExternalLink,
  Pencil,
  Search,
  Square,
  Plus,
  MessageSquare,
  Monitor
} from 'lucide-react';
import { Message, UserProfile } from '../types';
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
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [inspectImage, setInspectImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDeepResearchMode, setIsDeepResearchMode] = useState<boolean>(false);
  const [showModeDropdown, setShowModeDropdown] = useState<boolean>(false);

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

      completedStreamIdsRef.current.add(lastMsg.id);
      setStreamingMsgId(lastMsg.id);
      setStreamedLength(1);
      scrollToBottomIfAppropriate(true);

      const fullContent = lastMsg.content || '';
      const totalLen = fullContent.length;

      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
      }

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

  // Resilient Copy to Clipboard
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

  // Edit previous user prompt
  const handleEditUserMessage = (content: string) => {
    setInputText(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
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

    onSendMessage(inputText, selectedImages, isDeepResearchMode);
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

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
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

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131314]">
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
        className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-4 md:px-8 py-5 md:py-8 space-y-6 max-w-4xl mx-auto w-full"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isCurrentlyStreaming = streamingMsgId === message.id;
          
          const displayContent = isCurrentlyStreaming
            ? (message.content || '').slice(0, streamedLength)
            : message.content;

          // Thinking state default is open for first viewing
          const isThinkingOpen = expandedThinking[message.id] !== undefined 
            ? expandedThinking[message.id] 
            : true;

          return (
            <div
              key={message.id}
              className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* User Uploaded Images (if any) */}
              {isUser && message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.images.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setInspectImage(img)}
                      className="relative group rounded-xl overflow-hidden border border-[#333538] shadow-xs cursor-pointer"
                    >
                      <img
                        src={img}
                        alt="Uploaded attachment"
                        className="max-w-[200px] max-h-[160px] object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* User Bubble Layout (Matches Screenshot: Sleek Dark Rounded Pill) */}
              {isUser ? (
                <div className="flex flex-col items-end gap-1 max-w-[92%] sm:max-w-[85%]">
                  <div className="inline-block rounded-2xl bg-[#212124] text-[#e3e3e3] border border-[#333538] px-4 py-2.5 text-sm md:text-[15px] leading-relaxed shadow-sm break-words">
                    {message.content}
                  </div>

                  {/* User Action icons (Copy, Edit) below bubble */}
                  <div className="flex items-center gap-1.5 px-1 pt-0.5 text-neutral-400">
                    <button
                      onClick={() => handleCopyText(message.id, message.content)}
                      title="Copy question"
                      className="p-1 hover:text-neutral-200 hover:bg-[#212124] rounded-md transition cursor-pointer"
                    >
                      {copiedMsgId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditUserMessage(message.content)}
                      title="Edit question"
                      className="p-1 hover:text-neutral-200 hover:bg-[#212124] rounded-md transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Assistant Output Flow (Exact Match to Screenshot) */
                <div className="w-full max-w-full flex flex-col items-start space-y-2.5">
                  {/* 1. Reasoning Pill Header */}
                  <button
                    type="button"
                    onClick={() => toggleReasoning(message.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c4c7c5] hover:text-white transition cursor-pointer active:scale-95 py-0.5"
                  >
                    <BrainCircuit className="w-4 h-4 text-[#c4c7c5]" />
                    <span>Reasoning</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${expandedReasoning[message.id] ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded Reasoning Overview (if clicked) */}
                  {expandedReasoning[message.id] && (
                    <div className="w-full border border-[#333538] rounded-xl bg-[#1e1f20] p-3 text-xs text-[#c4c7c5] space-y-1.5 animate-in fade-in duration-150">
                      <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                        <span>Cognitive Execution Framework</span>
                      </div>
                      <p className="text-[12px] text-[#9aa0a6] leading-relaxed">
                        • Deconstructed prompt parameters and validated technical penetration testing references.
                        <br />
                        • Structured multi-phase security evaluation, tools analysis, and precision remediation insights.
                      </p>
                    </div>
                  )}

                  {/* 2. Web Search Pill (Matches screenshot: Search icon + query pill) */}
                  {message.searched && (
                    <div className="w-full">
                      <button
                        type="button"
                        onClick={() => toggleSources(message.id)}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#212124] border border-[#333538] text-[#c4c7c5] hover:text-white hover:border-neutral-500 text-xs font-normal transition cursor-pointer active:scale-[0.99] shadow-2xs max-w-full text-left"
                      >
                        <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">
                          {message.searchQueries?.[0]
                            ? `Searching for ${message.searchQueries[0]}`
                            : 'Searching for relevant web intelligence and sources...'}
                        </span>
                        {message.searchSources && message.searchSources.length > 0 && (
                          <span className="text-[10px] bg-[#333538] px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                            {message.searchSources.length}
                          </span>
                        )}
                      </button>

                      {/* Expandable Web Sources List */}
                      {expandedSources[message.id] && message.searchSources && message.searchSources.length > 0 && (
                        <div className="mt-2 p-2.5 bg-[#1e1f20] border border-[#333538] rounded-xl flex flex-wrap gap-1.5 animate-in fade-in duration-150">
                          {message.searchSources.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#212124] border border-[#333538] text-[#c4c7c5] hover:text-white hover:border-neutral-400 text-[11px] transition shadow-2xs truncate max-w-[260px]"
                              title={source.url}
                            >
                              <Globe className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{source.title || 'Source'}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-neutral-500 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Thinking Accordion Header & Thought Process (Clean Brain icon, NO star logo!) */}
                  {message.thinkingProcess && (
                    <div className="w-full space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleThinking(message.id)}
                        className="flex items-center gap-1.5 text-xs font-normal text-[#9aa0a6] hover:text-[#e3e3e3] transition cursor-pointer"
                      >
                        <BrainCircuit className="w-4 h-4 text-[#9aa0a6]" />
                        <span>Thinking...</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isThinkingOpen ? '' : '-rotate-90'}`} />
                      </button>

                      {isThinkingOpen && (
                        <div className="text-xs md:text-sm text-[#9aa0a6] leading-relaxed font-sans pl-0.5 animate-in fade-in duration-150">
                          {message.thinkingProcess}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Markdown Assistant Output (Dark Theme) */}
                  <div className="w-full min-w-0 prose-sm max-w-none break-words text-[#e3e3e3] pt-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre({ children }: any) {
                          return <div className="my-3 w-full min-w-0 max-w-full overflow-hidden">{children}</div>;
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
                              <div className="relative my-2.5 rounded-xl overflow-hidden bg-[#1e1f20] border border-[#333538] text-neutral-100 shadow-md w-full min-w-0 max-w-full">
                                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#28292c] border-b border-[#333538] text-xs text-neutral-300 w-full min-w-0 select-none">
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
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#333538] hover:bg-[#444746] text-neutral-200 hover:text-white transition text-xs font-medium active:scale-95 shadow-2xs shrink-0 cursor-pointer"
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
                                <div className="p-3.5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed text-neutral-200 w-full max-w-full">
                                  <pre className="m-0 p-0 font-mono bg-transparent whitespace-pre">
                                    <code>{codeString}</code>
                                  </pre>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <code
                              className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[12px] md:text-[13px] bg-[#28292c] text-[#e3e3e3] border border-[#333538]"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p({ children }: any) {
                          return (
                            <p className="mb-3 last:mb-0 leading-relaxed text-sm md:text-[15px] inline-block w-full text-[#e3e3e3]">
                              {children}
                              {isCurrentlyStreaming && (
                                <span
                                  aria-hidden="true"
                                  className="inline-block w-1.5 h-3.5 md:h-4 ml-1 -mb-0.5 align-middle bg-white rounded-xs animate-cursor-blink shadow-2xs"
                                />
                              )}
                            </p>
                          );
                        },
                        h1({ children }: any) {
                          return <h1 className="text-lg md:text-xl font-bold text-white mt-4 mb-2">{children}</h1>;
                        },
                        h2({ children }: any) {
                          return <h2 className="text-base md:text-lg font-bold text-white mt-3.5 mb-2">{children}</h2>;
                        },
                        h3({ children }: any) {
                          return <h3 className="text-sm md:text-base font-semibold text-white mt-3 mb-1.5">{children}</h3>;
                        },
                        ul({ children }: any) {
                          return <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-sm md:text-[15px] text-[#e3e3e3]">{children}</ul>;
                        },
                        ol({ children }: any) {
                          return <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-sm md:text-[15px] text-[#e3e3e3]">{children}</ol>;
                        },
                        li({ children }: any) {
                          return <li className="leading-relaxed">{children}</li>;
                        },
                        blockquote({ children }: any) {
                          return <blockquote className="border-l-4 border-neutral-600 pl-3 my-2.5 italic text-neutral-400 text-sm">{children}</blockquote>;
                        },
                        strong({ children }: any) {
                          return <strong className="font-semibold text-white">{children}</strong>;
                        }
                      }}
                    >
                      {displayContent}
                    </ReactMarkdown>
                  </div>

                  {/* Assistant Actions Bar (Copy, Audio, Thumbs) */}
                  {!isCurrentlyStreaming && (
                    <div className="flex items-center gap-2 pt-2 text-[#8e918f]">
                      <button
                        onClick={() => handleCopyText(message.id, message.content)}
                        title="Copy response"
                        className="p-1 hover:text-white hover:bg-[#212124] rounded-md transition cursor-pointer"
                      >
                        {copiedMsgId === message.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => handleToggleSpeech(message.id, message.content)}
                        title="Read aloud"
                        className={`p-1 rounded-md transition cursor-pointer ${
                          speakingMsgId === message.id
                            ? 'text-white bg-[#28292c]'
                            : 'hover:text-white hover:bg-[#212124]'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={onRegenerate}
                        title="Regenerate answer"
                        className="p-1 hover:text-white hover:bg-[#212124] rounded-md transition cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        title="Good response"
                        className="p-1 hover:text-white hover:bg-[#212124] rounded-md transition cursor-pointer"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        title="Bad response"
                        className="p-1 hover:text-white hover:bg-[#212124] rounded-md transition cursor-pointer"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Reasoning & Progressive Thinking State (Matches screenshot while waiting) */}
        {isLoading && (
          <div className="w-full flex flex-col items-start space-y-2.5 animate-in fade-in duration-150">
            {/* 1. Reasoning Badge */}
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c4c7c5]">
              <BrainCircuit className="w-4 h-4 text-[#c4c7c5]" />
              <span>Reasoning</span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
            </div>

            {/* 2. Live Web Search Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#212124] border border-[#333538] text-[#c4c7c5] text-xs font-normal shadow-2xs max-w-full animate-pulse">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">
                {lastUserMessage?.content
                  ? `Searching for ${lastUserMessage.content.slice(0, 55)}...`
                  : 'Searching for relevant web intelligence and sources...'}
              </span>
            </div>

            {/* 3. Thinking Header (Clean Brain icon, text Thinking...) */}
            <div className="flex items-center gap-1.5 text-xs font-normal text-[#9aa0a6]">
              <BrainCircuit className="w-4 h-4 text-[#9aa0a6] animate-pulse" />
              <span>Thinking...</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </div>

            {/* 4. Subtle Thought Line */}
            <div className="text-xs md:text-sm text-[#9aa0a6] leading-relaxed font-sans pl-0.5 italic animate-pulse">
              Analyzing prompt objectives, evaluating constraints and industry best practices to formulate structured response...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar (Exact match to screenshot) */}
      <div className="flex-shrink-0 p-3 md:p-6 bg-[#131314] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto w-full bg-[#1e1f20] rounded-3xl border border-[#333538] shadow-2xl p-3 md:p-3.5 transition-all duration-200">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-[#333538] shadow-xs"
                >
                  <img src={img} alt="Vision upload" className="w-14 h-14 object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text Area (Placeholder: Ask, learn, brainstorm) */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, learn, brainstorm"
            className="w-full resize-none bg-transparent text-sm sm:text-base text-[#e3e3e3] placeholder-[#8e918f] focus:outline-none px-1 py-1 leading-relaxed"
          />

          {/* Bottom Bar Controls Row */}
          <div className="flex items-center justify-between mt-2 pt-1">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* + Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Add attachment"
                className="p-2 text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Chat Mode Selector Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDeepResearchMode
                      ? 'bg-[#2d2f33] text-white border border-[#444746]'
                      : 'text-[#c4c7c5] hover:text-white hover:bg-[#28292c]'
                  }`}
                  title="Toggle Chat Mode"
                >
                  <MessageSquare className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </button>

                {showModeDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 w-44 bg-[#1e1f20] rounded-2xl shadow-2xl border border-[#333538] py-1.5 z-30 text-xs animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeepResearchMode(false);
                        setShowModeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#28292c] cursor-pointer ${
                        !isDeepResearchMode ? 'font-semibold text-white' : 'text-[#c4c7c5]'
                      }`}
                    >
                      <span>Standard Chat</span>
                      {!isDeepResearchMode && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeepResearchMode(true);
                        setShowModeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#28292c] cursor-pointer ${
                        isDeepResearchMode ? 'font-semibold text-white' : 'text-[#c4c7c5]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                        <span>Deep Research</span>
                      </div>
                      {isDeepResearchMode && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Monitor / Canvas Icon */}
              <button
                type="button"
                onClick={onOpenSavedPrompts}
                title="Workspace / Prompts"
                className="p-2 text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Model Selector Button (Displays "Model ⌄" or Active Model Name) */}
              {onOpenModelSelector && (
                <button
                  type="button"
                  onClick={onOpenModelSelector}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#c4c7c5] hover:text-white bg-[#28292c] hover:bg-[#333538] transition active:scale-95 cursor-pointer"
                  title="Select AI Model"
                >
                  <span className="font-medium">{activeModelDef.name.length > 16 ? 'Model' : activeModelDef.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              )}

              {/* Voice input button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                title="Voice input"
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-[#c4c7c5] hover:text-white hover:bg-[#28292c]'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Send / Stop Action Button */}
              {isLoading ? (
                <button
                  type="button"
                  disabled
                  className="w-8 h-8 rounded-full bg-[#333538] text-white flex items-center justify-center shadow-xs transition cursor-wait"
                  title="Generating response..."
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={(!inputText.trim() && selectedImages.length === 0) || Boolean(streamingMsgId)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 disabled:opacity-30 text-black flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Inspection Modal */}
      {inspectImage && (
        <div
          onClick={() => setInspectImage(null)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-[#1e1f20] rounded-2xl overflow-hidden p-2 border border-[#333538]">
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

