import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Globe,
  Lightbulb,
  Mic,
  HelpCircle,
  Languages,
  X,
  ArrowUp,
  BrainCircuit,
  ChevronDown,
  Sparkles,
  Code,
  Compass,
  FileText,
  Zap
} from 'lucide-react';
import { UserProfile } from '../types';
import { ModelLogo } from './ModelLogo';
import { AI_MODELS, DEFAULT_MODEL_ID } from '../data/models';

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

const QUICK_STARTER_PROMPTS = [
  {
    icon: <Code className="w-3.5 h-3.5 text-purple-600" />,
    label: 'Build React UI component',
    prompt: 'Write a clean, responsive TypeScript React component with Tailwind CSS styling and smooth transitions.'
  },
  {
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
    label: 'Deep Problem Analysis',
    prompt: 'Explain the core principles and trade-offs of microservices vs monolithic architecture in modern web systems.'
  },
  {
    icon: <FileText className="w-3.5 h-3.5 text-blue-500" />,
    label: 'Summarize & Draft',
    prompt: 'Draft an executive briefing email proposing our Q3 product roadmap with actionable milestones and ROI.'
  },
  {
    icon: <Zap className="w-3.5 h-3.5 text-emerald-500" />,
    label: 'Debug & Optimize',
    prompt: 'How can I optimize slow database queries and reduce API latency in high-traffic full-stack applications?'
  }
];

export const HeroState: React.FC<HeroStateProps> = ({
  user,
  onSendMessage,
  onOpenSavedPrompts,
  onOpenHelp,
  onOpenLanguage,
  onOpenDiscord,
  selectedModel,
  onOpenModelSelector
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = user.displayName?.split(' ')[0] || 'Explorer';

  // Resolve active model
  const activeModelDef = AI_MODELS.find(
    (m) => m.id === selectedModel || (selectedModel === 'default' && m.id === DEFAULT_MODEL_ID)
  ) || {
    id: selectedModel || DEFAULT_MODEL_ID,
    name: selectedModel ? selectedModel.split('/').pop() || 'Gemini 2.0 Flash' : 'Gemini 2.0 Flash',
    iconKey: 'gemini',
    provider: 'aicredits'
  };

  // Handle Image Upload / Vision
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

  // Submit Prompt
  const handleSubmit = (overrideText?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() && selectedImages.length === 0) return;

    onSendMessage(textToSend, selectedImages, false);
    setInputText('');
    setSelectedImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Voice recording simulation / Web Speech API
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported on this browser. You can type directly into the prompt box.');
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
      recognition.maxAlternatives = 1;

      setIsRecording(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between items-center px-3 sm:px-6 md:px-8 py-3 sm:py-6 md:py-8 max-w-4xl mx-auto w-full overflow-y-auto overscroll-contain">
      {/* Hidden File Input for Vision */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Top Center: 3D Luminous Floating Orb + Welcome Text */}
      <div className="flex flex-col items-center text-center mt-1 sm:mt-3 md:mt-4 w-full">
        {/* Floating Glowing Sphere */}
        <div className="relative mb-3 sm:mb-5 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-purple-500 via-purple-300 to-indigo-200 shadow-2xl animate-float-orb relative flex items-center justify-center overflow-hidden ring-1 ring-white/40">
            {/* Luminous internal reflection highlight */}
            <div className="absolute top-1.5 left-2.5 w-8 h-4 sm:w-10 sm:h-6 bg-white/80 rounded-full blur-xs -rotate-25" />
            <div className="absolute bottom-2 right-3 w-10 h-10 sm:w-12 sm:h-12 bg-purple-700/30 rounded-full blur-sm" />
            <div className="absolute inset-0 bg-radial from-white/40 via-transparent to-purple-900/25" />
          </div>
          {/* Subtle ambient blur behind */}
          <div className="absolute -inset-4 bg-purple-400/25 rounded-full blur-xl -z-10" />
        </div>

        {/* Hello Greeting & Main Question */}
        <h2 className="font-display font-semibold text-xs sm:text-sm md:text-base text-purple-600 tracking-tight">
          Hello, {firstName}
        </h2>
        <h1 className="font-display font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl text-neutral-900 tracking-tight mt-0.5 mb-4 sm:mb-6 md:mb-7 drop-shadow-xs">
          How can I assist you today?
        </h1>

        {/* Central Input Box Container */}
        <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-purple-100/90 shadow-[0_10px_35px_-8px_rgba(147,51,234,0.08),0_2px_10px_rgba(0,0,0,0.02)] p-2.5 sm:p-3.5 md:p-4 transition-all duration-200 focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100/60 focus-within:shadow-[0_12px_40px_-8px_rgba(147,51,234,0.12)]">
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
                  <span className="absolute bottom-0 inset-x-0 bg-purple-700/80 text-[8px] text-white text-center font-medium py-0.5">
                    Vision
                  </span>
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
            placeholder="Ask me anything..."
            className="w-full resize-none bg-transparent text-sm sm:text-base text-neutral-800 placeholder-neutral-400 focus:outline-none px-1 leading-relaxed"
          />

          {/* Inner Controls Row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100/90 gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Left Controls: [Model Pill] [Image Vision] [Lightbulb Prompts] */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {onOpenModelSelector && (
                <button
                  id="hero-model-pill-btn"
                  type="button"
                  onClick={onOpenModelSelector}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium bg-neutral-50 hover:bg-purple-50 text-neutral-800 hover:text-purple-900 border border-neutral-200/80 hover:border-purple-200 transition active:scale-95 shadow-2xs group cursor-pointer"
                  title="Select AI Model"
                >
                  <ModelLogo iconKey={activeModelDef.iconKey} modelId={activeModelDef.id} size="xs" />
                  <span className="font-semibold max-w-[90px] sm:max-w-[120px] truncate">{activeModelDef.name}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-purple-600 transition" />
                </button>
              )}

              <button
                id="hero-vision-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image for Vision OCR analysis"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-lg sm:rounded-xl transition active:scale-95 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                id="hero-prompt-suggestions-btn"
                onClick={onOpenSavedPrompts}
                title="Open Prompt Library"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-lg sm:rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls: Voice / Mic + Send */}
            <div className="flex items-center gap-1.5 ml-auto">
              {inputText.trim() || selectedImages.length > 0 ? (
                <button
                  id="hero-submit-prompt-btn"
                  onClick={() => handleSubmit()}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-md shadow-purple-500/20 transition active:scale-95"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  id="hero-voice-mic-btn"
                  onClick={handleToggleVoice}
                  title="Voice input"
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition active:scale-95 ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gradient-to-tr from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-purple-500/20'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Starter Suggestion Chips */}
        <div className="w-full max-w-2xl mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {QUICK_STARTER_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmit(item.prompt)}
              className="flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl bg-white/70 hover:bg-white border border-purple-100/60 hover:border-purple-200 shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99] group text-left"
            >
              <div className="p-1.5 rounded-lg bg-purple-50/80 group-hover:bg-purple-100/80 shrink-0 transition">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-neutral-800 group-hover:text-purple-900 transition truncate">
                  {item.label}
                </div>
                <div className="text-[11px] text-neutral-400 line-clamp-1">
                  {item.prompt}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Footer */}
      <footer className="w-full flex items-center justify-between text-xs text-neutral-400 mt-6 sm:mt-8 pt-3 border-t border-purple-100/30">
        <div className="flex-1 text-center md:text-center text-[11px]">
          <span>Join the Leo AI community for insights </span>
          <button
            onClick={onOpenDiscord}
            className="text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition ml-1"
          >
            Discord
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="footer-language-btn"
            onClick={onOpenLanguage}
            title="Language switcher"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/80 rounded-lg transition"
          >
            <Languages className="w-3.5 h-3.5" />
          </button>
          <button
            id="footer-help-btn"
            onClick={onOpenHelp}
            title="Help & documentation"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/80 rounded-lg transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
};
