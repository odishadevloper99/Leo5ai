import React, { useState, useRef } from 'react';
import {
  Plus,
  ArrowUp,
  Image as ImageIcon,
  Sparkles,
  Search,
  Code2,
  Shield,
  FileCode2,
  Terminal,
  Cpu,
  X,
  Mic,
  ChevronDown
} from 'lucide-react';
import { UserProfile } from '../types';

interface HeroStateProps {
  user: UserProfile;
  onSendMessage: (text: string, images?: string[], isDeepResearch?: boolean) => void;
  onOpenSavedPrompts: () => void;
  onOpenHelp: () => void;
  onOpenLanguage: () => void;
  onOpenDiscord: () => void;
  selectedModel?: string;
  onOpenModelSelector?: () => void;
}

const STARTER_PROMPTS = [
  {
    icon: <Code2 className="w-4 h-4 text-purple-400" />,
    label: 'Code Architecture',
    prompt: 'Design a modular full-stack architecture with React, TypeScript, and server-side API proxying.'
  },
  {
    icon: <Shield className="w-4 h-4 text-emerald-400" />,
    label: 'Security & Pen Testing',
    prompt: 'Analyze common security vulnerabilities like SQLi, XSS, and SSRF with exploit mitigation strategies.'
  },
  {
    icon: <Search className="w-4 h-4 text-blue-400" />,
    label: 'Deep Research',
    prompt: 'Perform deep research on state-of-the-art LLM reasoning models and multimodal vision benchmarks.'
  },
  {
    icon: <Terminal className="w-4 h-4 text-amber-400" />,
    label: 'Script & Payload Helper',
    prompt: 'Generate standard Linux reverse shell one-liners, port scanning scripts, and automation workflows.'
  }
];

export const HeroState: React.FC<HeroStateProps> = ({
  user,
  onSendMessage,
  onOpenSavedPrompts,
  onOpenHelp,
  selectedModel = 'default',
  onOpenModelSelector
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (overrideText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() && selectedImages.length === 0) return;

    onSendMessage(textToSend, selectedImages, isDeepResearch);
    setInputText('');
    setSelectedImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Web speech recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your prompt.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
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

  const displayName = user.displayName && user.displayName !== 'Guest'
    ? user.displayName.split(' ')[0]
    : 'there';

  return (
    <div className="flex-1 flex flex-col justify-between items-center px-4 sm:px-6 md:px-8 py-6 sm:py-10 max-w-3xl mx-auto w-full overflow-y-auto select-none">
      {/* Hidden File Input for Vision uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Main Centered Content */}
      <div className="flex-1 flex flex-col justify-center items-center text-center w-full my-auto py-4">
        {/* Large Clean Minimal Title */}
        <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-zinc-100 tracking-tight mb-2 sm:mb-3">
          How can Leo help you today?
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-6 sm:mb-8 font-normal leading-relaxed">
          Ask questions, write and audit code, analyze security payloads, or brainstorm complex architectures.
        </p>

        {/* Centered Floating Composer Card (Signature HackerAI reference look) */}
        <div className="w-full max-w-2xl bg-[#141416] rounded-2xl sm:rounded-3xl border border-[#27272a] hover:border-zinc-700 focus-within:border-zinc-500 shadow-2xl p-3 sm:p-4 transition duration-200">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-[#27272a] shadow-xs"
                >
                  <img src={img} alt="Vision upload" className="w-14 h-14 object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-0.5 bg-black/80 hover:bg-red-500 text-white rounded-full transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text Area */}
          <textarea
            id="hero-chat-textarea"
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, learn, brainstorm..."
            className="w-full resize-none bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none px-1 leading-relaxed"
          />

          {/* Bottom Action Bar inside composer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1f1f23] gap-2">
            {/* Left Tools */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* + Attachment Button */}
              <button
                id="hero-vision-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image or file"
                className="w-7 h-7 rounded-lg bg-[#1a1a1d] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 border border-[#27272a] flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Prompt Library Pill */}
              <button
                id="hero-prompt-suggestions-btn"
                onClick={onOpenSavedPrompts}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a1d] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 border border-[#27272a] text-[11px] font-medium transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Prompts</span>
              </button>

              {/* Deep Research Toggle */}
              <button
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition active:scale-95 cursor-pointer ${
                  isDeepResearch
                    ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                    : 'bg-[#1a1a1d] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 border-[#27272a]'
                }`}
              >
                <Search className="w-3 h-3" />
                <span>Deep Research</span>
              </button>
            </div>

            {/* Right Tools: Mic + Send Button */}
            <div className="flex items-center gap-2">
              <button
                id="hero-voice-mic-btn"
                onClick={handleToggleVoice}
                title="Voice input"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[#1a1a1d] hover:bg-[#27272a] text-zinc-400 hover:text-zinc-200 border border-[#27272a]'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>

              {/* Circular Send Arrow Button */}
              <button
                id="hero-submit-prompt-btn"
                onClick={() => handleSubmit()}
                disabled={!inputText.trim() && selectedImages.length === 0}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition duration-150 active:scale-95 cursor-pointer ${
                  inputText.trim() || selectedImages.length > 0
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-md'
                    : 'bg-[#222225] text-zinc-600 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Starter Prompts Grid */}
        <div className="w-full max-w-2xl mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {STARTER_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmit(item.prompt)}
              className="flex items-start gap-3 p-3 rounded-2xl bg-[#141416] hover:bg-[#1a1a1d] border border-[#27272a] hover:border-zinc-700 transition duration-150 active:scale-[0.99] group text-left cursor-pointer shadow-xs"
            >
              <div className="p-2 rounded-xl bg-[#1a1a1d] group-hover:bg-[#222226] shrink-0 transition">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-200 group-hover:text-white transition">
                  {item.label}
                </div>
                <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                  {item.prompt}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Minimalist Info */}
      <footer className="w-full text-center text-[11px] text-zinc-600 pt-3">
        <span>Leo AI is a powerful multimodal intelligence and coding assistant.</span>
      </footer>
    </div>
  );
};
