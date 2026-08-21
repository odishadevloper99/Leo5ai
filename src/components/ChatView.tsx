import React, { useState, useRef, useEffect } from 'react';
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
  Paperclip,
  Mic,
  ArrowUp,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
  Bot,
  User,
  Lightbulb
} from 'lucide-react';
import { Message, UserProfile } from '../types';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string, images?: string[], isDeepResearch?: boolean) => void;
  onRegenerate: () => void;
  user: UserProfile;
  onOpenSavedPrompts: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onRegenerate,
  user,
  onOpenSavedPrompts
}) => {
  const [inputText, setInputText] = useState('');
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [inspectImage, setInspectImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Copy Message Content
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Copy Specific Code
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
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
    if (isLoading) return;

    onSendMessage(inputText, selectedImages, isDeepResearch);
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
      <div className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-3 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6 max-w-4xl mx-auto w-full">
        {messages.map((message) => {
          const isUser = message.role === 'user';
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/20 flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`max-w-[85%] md:max-w-[78%] flex flex-col ${
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
                  className={`rounded-2xl p-4 text-xs md:text-sm leading-relaxed transition ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-tr-xs shadow-sm'
                      : 'bg-white border border-purple-100/80 rounded-tl-xs shadow-xs text-neutral-800'
                  }`}
                >
                  {/* Assistant Deep Reasoning Collapsible Block */}
                  {!isUser && message.isDeepResearch && (
                    <div className="mb-3 border border-purple-100 rounded-xl bg-purple-50/50 p-2.5 text-xs">
                      <button
                        onClick={() => toggleReasoning(message.id)}
                        className="flex items-center justify-between w-full font-medium text-purple-900"
                      >
                        <div className="flex items-center gap-1.5">
                          <BrainCircuit className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                          <span>Deep Reasoning & Cognitive Steps</span>
                        </div>
                        {expandedReasoning[message.id] ? (
                          <ChevronUp className="w-3.5 h-3.5 text-purple-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-purple-500" />
                        )}
                      </button>

                      {expandedReasoning[message.id] && (
                        <div className="mt-2 pt-2 border-t border-purple-100 text-[11px] text-purple-800/90 space-y-1">
                          <p>1. Deconstructed user objective and identified core domain requirements.</p>
                          <p>2. Evaluated systemic constraints, tradeoffs, and production best practices.</p>
                          <p>3. Synthesized structured, multi-dimensional response adhering strictly to directives.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Markdown Content */}
                  <div className={`prose-sm max-w-none break-words ${isUser ? 'text-white' : 'text-neutral-800'}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre({ children }: any) {
                          return <div className="my-2.5 overflow-hidden">{children}</div>;
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
                              <div className="relative my-2 rounded-xl overflow-hidden bg-[#18181b] border border-neutral-800 text-neutral-100 shadow-xs">
                                {/* Header Bar with Language tag & Prominent Copy Button */}
                                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#27272a] border-b border-neutral-700/60 text-xs text-neutral-300">
                                  <span className="font-mono text-[11px] uppercase tracking-wider text-purple-300 font-semibold">
                                    {language}
                                  </span>
                                  <button
                                    onClick={() => handleCopyCode(codeString)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition text-xs font-medium active:scale-95"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy code</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {/* Code content with horizontal scrolling */}
                                <div className="p-3.5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed text-neutral-200">
                                  <pre className="m-0 p-0 font-mono bg-transparent">
                                    <code>{codeString}</code>
                                  </pre>
                                </div>
                              </div>
                            );
                          }

                          // Clean Inline Code Badge
                          return (
                            <code
                              className={`px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[12px] md:text-[13px] font-medium inline-block transition ${
                                isUser
                                  ? 'bg-purple-700/80 text-white'
                                  : 'bg-purple-50 text-purple-800 border border-purple-200/70'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p({ children }: any) {
                          return <p className={`mb-2.5 last:mb-0 leading-relaxed text-xs md:text-sm ${isUser ? 'text-white' : 'text-neutral-800'}`}>{children}</p>;
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
                            <div className="overflow-x-auto my-3 rounded-xl border border-purple-100">
                              <table className="min-w-full text-xs text-left divide-y divide-purple-100">
                                {children}
                              </table>
                            </div>
                          );
                        },
                        th({ children }: any) {
                          return <th className="px-3 py-2 bg-purple-50 font-semibold text-purple-900">{children}</th>;
                        },
                        td({ children }: any) {
                          return <td className="px-3 py-2 border-t border-purple-50 text-neutral-700">{children}</td>;
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Assistant Message Actions Toolbar */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-1 text-neutral-400 text-xs">
                    <button
                      onClick={() => handleCopyText(message.id, message.content)}
                      title="Copy response"
                      className="p-1 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition"
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
                      className={`p-1 rounded-md transition ${
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
                      className="p-1 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-3 w-[1px] bg-neutral-200 mx-0.5" />

                    <button
                      title="Helpful"
                      className="p-1 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Not helpful"
                      className="p-1 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming / Loading State */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/20 flex-shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-white border border-purple-100/80 rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs text-neutral-400 font-medium ml-1">
                Leo AI is reasoning...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Bar in Active Chat View */}
      <div className="flex-shrink-0 p-2.5 md:p-6 bg-white/95 border-t border-purple-100/60 backdrop-blur-md pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl border border-purple-100/90 shadow-md shadow-purple-500/5 p-2.5 md:p-3">
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
                    className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black text-white rounded-full transition"
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
            className="w-full resize-none bg-transparent text-base md:text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none px-1 py-1"
          />

          {/* Bottom Bar Controls */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                  isDeepResearch
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-purple-50/70 hover:bg-purple-100/80 text-purple-700'
                }`}
              >
                <BrainCircuit className="w-3 h-3" />
                <span>Deep Research</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload image for Vision analysis"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenSavedPrompts}
                title="Open Prompt Library"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleVoice}
                title="Voice input"
                className={`p-1.5 rounded-lg transition ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSubmit()}
                disabled={!inputText.trim() && selectedImages.length === 0}
                className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-black disabled:opacity-30 text-white flex items-center justify-center shadow-xs transition"
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
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition z-10"
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
