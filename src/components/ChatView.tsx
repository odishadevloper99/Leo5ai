import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  Brain,
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
  Monitor,
  Terminal,
  Download,
  Share2,
  Sparkles,
  Play,
  Loader2
} from 'lucide-react';
import { Message, UserProfile } from '../types';
import {
  AgentMessage,
  ReasoningBox,
  ToolCallPill,
  MarkdownLite,
  ActionBar,
  StreamingCursor,
  markdownComponents
} from './AgentMessage';

export {
  AgentMessage,
  ReasoningBox,
  ToolCallPill,
  MarkdownLite,
  ActionBar,
  StreamingCursor,
  markdownComponents
};

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
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);
  const [downloadedTableId, setDownloadedTableId] = useState<string | null>(null);

  const handleCopyTable = (tableRefOrText: string, id: string) => {
    navigator.clipboard.writeText(tableRefOrText);
    setCopiedTableId(id);
    setTimeout(() => setCopiedTableId(null), 2000);
  };

  const handleDownloadTableCsv = (tableText: string, id: string) => {
    // Generate CSV blob from Markdown or tab-delimited text
    const rows = tableText.trim().split('\n').filter(r => !r.includes('---'));
    const csvContent = rows.map(r => {
      const cols = r.split('|').map(c => c.trim()).filter(Boolean);
      return cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    }).filter(Boolean).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `table-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadedTableId(id);
    setTimeout(() => setDownloadedTableId(null), 2000);
  };
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedAgentSteps, setExpandedAgentSteps] = useState<Record<string, boolean>>({});
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

  const toggleAgentSteps = (id: string) => {
    setExpandedAgentSteps((prev) => ({
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-black">
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
        className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-3 sm:px-6 py-5 md:py-6 space-y-5 max-w-[700px] mx-auto w-full font-sans"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isCurrentlyStreaming = streamingMsgId === message.id || message.status === 'streaming';
          
          const displayContent = isCurrentlyStreaming && streamingMsgId === message.id
            ? (message.content || '').slice(0, streamedLength)
            : message.content;

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
                      className="relative group rounded-xl overflow-hidden border border-zinc-800 shadow-xs cursor-pointer"
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

              {/* User Bubble Layout */}
              {isUser ? (
                <div className="flex flex-col items-end gap-1 max-w-[85%]">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-[15px] text-zinc-100 leading-relaxed break-words">
                    {message.content}
                  </div>

                  {/* User Action icons (Copy, Edit) below bubble */}
                  <div className="flex items-center gap-1.5 px-1 pt-0.5 text-zinc-500">
                    <button
                      onClick={() => handleCopyText(message.id, message.content)}
                      title="Copy question"
                      className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer"
                    >
                      {copiedMsgId === message.id ? (
                        <Check size={14} className="text-emerald-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditUserMessage(message.content)}
                      title="Edit question"
                      className="p-1 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Assistant Output Flow using unified AgentMessage component */
                <AgentMessage
                  message={message}
                  isStreaming={isCurrentlyStreaming}
                  displayContent={displayContent}
                  copiedCodeBlock={copiedCodeBlock}
                  onCopyCode={handleCopyCode}
                  copiedTableId={copiedTableId}
                  onCopyTable={handleCopyTable}
                  downloadedTableId={downloadedTableId}
                  onDownloadTableCsv={handleDownloadTableCsv}
                  onRetry={onRegenerate}
                  onToggleSpeech={handleToggleSpeech}
                  isSpeaking={speakingMsgId === message.id}
                  onToggleSources={toggleSources}
                  showSources={Boolean(expandedSources[message.id])}
                />
              )}
            </div>
          );
        })}

        {/* Elegant typing indicator when loading and no message text yet */}
        {isLoading && !messages.some((m) => m.status === 'streaming' || m.content) && (
          <div className="w-full flex items-center gap-2 text-zinc-400 py-2 text-xs font-mono animate-in fade-in duration-150">
            <Loader2 size={14} className="animate-spin text-zinc-400" />
            <span>Thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar */}
      <div className="flex-shrink-0 p-3 md:p-4 bg-black pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-zinc-900">
        <div className="max-w-[700px] mx-auto w-full bg-zinc-900 rounded-3xl border border-zinc-800 p-3 md:p-3.5 transition-all duration-200">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-zinc-700 shadow-xs"
                >
                  <img src={img} alt="Vision upload" className="w-14 h-14 object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer"
                  >
                    <X size={12} />
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
            className="w-full resize-none bg-transparent text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none px-1 py-1 leading-relaxed"
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
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Plus size={18} />
              </button>

              {/* Chat Mode Selector Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDeepResearchMode
                      ? 'bg-zinc-100 text-black border border-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title="Toggle Chat Mode"
                >
                  <MessageSquare size={14} />
                  <ChevronDown size={12} className="text-zinc-400" />
                </button>

                {showModeDropdown && (
                  <div className="absolute left-0 bottom-full mb-2 w-44 bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 py-1.5 z-30 text-xs animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeepResearchMode(false);
                        setShowModeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-zinc-800 cursor-pointer ${
                        !isDeepResearchMode ? 'font-semibold text-white' : 'text-zinc-400'
                      }`}
                    >
                      <span>Standard Chat</span>
                      {!isDeepResearchMode && <Check size={14} className="text-emerald-500" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeepResearchMode(true);
                        setShowModeDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-zinc-800 cursor-pointer ${
                        isDeepResearchMode ? 'font-semibold text-white' : 'text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BrainCircuit size={14} className="text-white" />
                        <span>Deep Research</span>
                      </div>
                      {isDeepResearchMode && <Check size={14} className="text-emerald-500" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Monitor / Workspace */}
              <button
                type="button"
                onClick={onOpenSavedPrompts}
                title="Workspace / Prompts"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Monitor size={16} />
              </button>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Voice input button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                title="Voice input"
                className={`p-1.5 rounded-full transition active:scale-95 cursor-pointer ${
                  isRecording
                    ? 'bg-zinc-100 text-black animate-pulse'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Mic size={16} />
              </button>

              {/* Send / Stop Action Button */}
              {isLoading ? (
                <button
                  type="button"
                  disabled
                  className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center shadow-xs transition cursor-wait"
                  title="Generating response..."
                >
                  <Square size={14} className="fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={(!inputText.trim() && selectedImages.length === 0) || Boolean(streamingMsgId)}
                  className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-white disabled:opacity-30 text-black flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
                  title="Send message"
                >
                  <ArrowUp size={16} />
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
          <div className="relative max-w-4xl max-h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden p-2 border border-zinc-800">
            <button
              onClick={() => setInspectImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition z-10 cursor-pointer"
            >
              <X size={20} />
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
