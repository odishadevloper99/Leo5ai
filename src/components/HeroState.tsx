import React, { useState, useRef } from 'react';
import {
  Plus,
  ArrowUp,
  X,
  MessageSquare,
  Monitor,
  ChevronDown,
  Sparkles,
  Zap,
  PanelLeft,
  FileCode2,
  Shield,
  Search,
  Code2
} from 'lucide-react';
import { UserProfile } from '../types';
import { LeoLogoMark } from './LeoLogo';

interface HeroStateProps {
  user: UserProfile;
  onSendMessage: (text: string, images?: string[], isDeepResearch?: boolean) => void;
  onOpenSavedPrompts: () => void;
  onOpenHelp?: () => void;
  onOpenLanguage?: () => void;
  onOpenDiscord?: () => void;
  selectedModel?: string;
  onOpenModelSelector?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenAuth?: () => void;
  onOpenUpgrade?: () => void;
}

export const HeroState: React.FC<HeroStateProps> = ({
  user,
  onSendMessage,
  onOpenSavedPrompts,
  onToggleSidebar,
  isSidebarOpen,
  onOpenAuth,
  onOpenUpgrade,
  selectedModel = 'Leo Default',
  onOpenModelSelector
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'chat' | 'canvas'>('chat');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState(selectedModel || 'Leo-Pro');

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

  const userNickname = user.displayName && user.displayName !== 'Guest'
    ? user.displayName.toUpperCase()
    : 'WORM';

  return (
    <div className="flex-1 flex flex-col justify-between h-full bg-[#000000] text-white p-4 sm:p-6 overflow-hidden select-none relative">
      {/* Hidden File Input for Vision / File Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*,.txt,.pdf,.py,.js,.ts,.json"
        multiple
        className="hidden"
      />

      {/* Center Headline (Matches Screenshot: "What are we exploiting today, WORM?") */}
      <div className="flex-1 flex flex-col justify-center items-center text-center px-4 max-w-xl mx-auto my-auto py-8">
        <h1 className="font-sans font-bold text-2xl sm:text-3xl text-white tracking-normal leading-tight text-center">
          What are we exploiting today,
          <br />
          <span className="text-white">{userNickname}?</span>
        </h1>
      </div>

      {/* Bottom Composer Card (Matches Screenshot 5 exactly) */}
      <div className="w-full max-w-2xl mx-auto pb-4 z-20">
        <div className="bg-[#141416] rounded-3xl border border-[#222225] hover:border-zinc-700 focus-within:border-zinc-600 shadow-2xl p-3 sm:p-3.5 transition duration-200">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-[#27272a] shadow-xs"
                >
                  <img src={img} alt="Upload" className="w-14 h-14 object-cover" />
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

          {/* Textarea Input */}
          <textarea
            id="hero-chat-textarea"
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, learn, brainstorm"
            className="w-full resize-none bg-transparent text-[14px] text-zinc-100 placeholder-zinc-500 focus:outline-none px-2 pt-1 leading-relaxed"
          />

          {/* Bottom Action Row (Matches Screenshot 5) */}
          <div className="flex items-center justify-between mt-2 pt-2 gap-2 relative">
            {/* Left Controls: Plus + Chat Mode + Canvas Mode */}
            <div className="flex items-center gap-2">
              {/* Plus Button */}
              <button
                id="hero-vision-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file or image"
                className="w-8 h-8 rounded-full bg-transparent hover:bg-[#1f1f23] text-zinc-300 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>

              {/* Chat Mode Pill with Chevron (Matches Screenshot 5) */}
              <div className="relative">
                <button
                  onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer border border-[#27272a]"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>

                {isModeDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 text-xs text-zinc-200">
                    <button
                      onClick={() => {
                        setActiveMode('chat');
                        setIsDeepResearch(false);
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                      <span>Standard Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsDeepResearch(true);
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <Search className="w-3.5 h-3.5 text-white" />
                      <span>Deep Research</span>
                    </button>
                    <button
                      onClick={() => {
                        onOpenSavedPrompts();
                        setIsModeDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Prompt Library</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Canvas / Workspace Mode Button (Matches Screenshot 5) */}
              <button
                onClick={() => {
                  setActiveMode(activeMode === 'canvas' ? 'chat' : 'canvas');
                }}
                title="Canvas workspace"
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  activeMode === 'canvas'
                    ? 'bg-[#25252a] text-white border border-zinc-600'
                    : 'bg-transparent hover:bg-[#1c1c20] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls: Model Selector + Send Arrow */}
            <div className="flex items-center gap-2">
              {/* Model Selector Pill (Matches Screenshot 5: "Model ⌵") */}
              <div className="relative">
                <button
                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-transparent hover:bg-[#1c1c20] text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  <span>Model</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {isModelMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 text-xs text-zinc-200">
                    <button
                      onClick={() => {
                        setCurrentModel('Leo-3.7-Pro');
                        setIsModelMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <span className="font-semibold text-white">Leo-3.7-Pro</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Fast</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentModel('Leo-Cyber-Sec');
                        setIsModelMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <span className="font-semibold text-white">Leo-Cyber-Sec</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Payload</span>
                    </button>
                    <button
                      onClick={() => {
                        setCurrentModel('Leo-DeepThink');
                        setIsModelMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition"
                    >
                      <span className="font-semibold text-white">Leo-DeepThink</span>
                      <span className="text-[10px] text-zinc-400 font-mono">Reasoning</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Circular Send Arrow (Matches Screenshot 5) */}
              <button
                id="hero-submit-prompt-btn"
                onClick={() => handleSubmit()}
                disabled={!inputText.trim() && selectedImages.length === 0}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition duration-150 active:scale-95 cursor-pointer ${
                  inputText.trim() || selectedImages.length > 0
                    ? 'bg-[#e4e4e7] text-black hover:bg-white shadow-md'
                    : 'bg-[#2a2a2e] text-zinc-500 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
