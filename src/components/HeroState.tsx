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
  ChevronDown
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
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
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
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && selectedImages.length === 0) return;

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
    <div className="flex-1 flex flex-col justify-between items-center px-4 md:px-8 py-4 md:py-10 max-w-4xl mx-auto w-full overflow-y-auto overscroll-contain">
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
      <div className="flex flex-col items-center text-center mt-1 md:mt-6 w-full">
        {/* Floating Glowing Sphere matching mockup */}
        <div className="relative mb-4 md:mb-6 flex items-center justify-center">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-purple-500 via-purple-300 to-indigo-200 shadow-2xl animate-float-orb relative flex items-center justify-center overflow-hidden ring-1 ring-white/40">
            {/* Luminous internal reflection highlight */}
            <div className="absolute top-2 left-3 w-10 h-6 bg-white/80 rounded-full blur-xs -rotate-25" />
            <div className="absolute bottom-2 right-4 w-12 h-12 bg-purple-700/30 rounded-full blur-sm" />
            <div className="absolute inset-0 bg-radial from-white/40 via-transparent to-purple-900/25" />
          </div>
          {/* Subtle ambient blur behind */}
          <div className="absolute -inset-5 bg-purple-400/25 rounded-full blur-2xl -z-10" />
        </div>

        {/* Hello Greeting & Main Question */}
        <h2 className="font-display font-semibold text-base md:text-lg text-purple-600 tracking-tight">
          Hello, {firstName}
        </h2>
        <h1 className="font-display font-bold text-2xl md:text-4xl text-neutral-900 tracking-tight mt-1 mb-6 md:mb-8 drop-shadow-xs">
          How can I assist you today?
        </h1>

        {/* Central Input Box Container */}
        <div className="w-full max-w-2xl bg-white rounded-3xl border border-purple-100/90 shadow-[0_10px_35px_-8px_rgba(147,51,234,0.08),0_2px_10px_rgba(0,0,0,0.02)] p-3.5 md:p-4 transition-all duration-200 focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100/60 focus-within:shadow-[0_12px_40px_-8px_rgba(147,51,234,0.12)]">
          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {selectedImages.map((img, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-purple-200 shadow-xs"
                >
                  <img src={img} alt="Vision upload" className="w-16 h-16 object-cover" />
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
            className="w-full resize-none bg-transparent text-base md:text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none px-1.5 leading-relaxed"
          />

          {/* Inner Controls Row */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-100">
            {/* Left Controls: [Model Pill] [✨ Deeper Research] [Image] [Globe] [Lightbulb] */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {onOpenModelSelector && (
                <button
                  id="hero-model-pill-btn"
                  type="button"
                  onClick={onOpenModelSelector}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-50 hover:bg-purple-50 text-neutral-800 hover:text-purple-900 border border-neutral-200/80 hover:border-purple-200 transition active:scale-95 shadow-2xs group"
                  title="Select AI Model"
                >
                  <ModelLogo iconKey={activeModelDef.iconKey} modelId={activeModelDef.id} size="xs" />
                  <span className="font-semibold max-w-[120px] truncate">{activeModelDef.name}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-purple-600 transition" />
                </button>
              )}

              <button
                id="toggle-deep-research-btn"
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition active:scale-95 ${
                  isDeepResearch
                    ? 'bg-purple-100 text-purple-900 border border-purple-300 shadow-xs font-semibold'
                    : 'bg-purple-50/80 hover:bg-purple-100 text-purple-700 border border-purple-200/70'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Deeper Research</span>
              </button>

              <button
                id="hero-vision-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image for Vision OCR analysis"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-xl transition active:scale-95"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                id="hero-web-search-btn"
                onClick={() => setIsWebSearch(!isWebSearch)}
                title="Toggle Web Knowledge"
                className={`p-1.5 rounded-xl transition active:scale-95 ${
                  isWebSearch
                    ? 'text-purple-600 bg-purple-50 ring-1 ring-purple-200'
                    : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80'
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                id="hero-prompt-suggestions-btn"
                onClick={onOpenSavedPrompts}
                title="Open Prompt Library"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 rounded-xl transition active:scale-95"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls: Voice / Mic + Send */}
            <div className="flex items-center gap-2">
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
      </div>

      {/* Bottom Footer matching mockup */}
      <footer className="w-full flex items-center justify-between text-xs text-neutral-400 mt-10 pt-4 border-t border-purple-100/30">
        <div className="flex-1 text-center md:text-center text-[11px]">
          <span>Join the Leo AI community for more insights </span>
          <button
            onClick={onOpenDiscord}
            className="text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition ml-1"
          >
            Join Discord
          </button>
        </div>

        <div className="flex items-center gap-1.5">
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
