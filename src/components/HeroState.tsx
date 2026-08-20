import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Globe,
  Lightbulb,
  Mic,
  Paperclip,
  Clock,
  Hammer,
  HelpCircle,
  Languages,
  X,
  ArrowUp,
  BrainCircuit,
  FileText
} from 'lucide-react';
import { PromptTemplate, UserProfile } from '../types';

interface HeroStateProps {
  user: UserProfile;
  onSendMessage: (text: string, images?: string[], isDeepResearch?: boolean) => void;
  onOpenSavedPrompts: () => void;
  onOpenHelp: () => void;
  onOpenLanguage: () => void;
  onOpenDiscord: () => void;
}

export const HeroState: React.FC<HeroStateProps> = ({
  user,
  onSendMessage,
  onOpenSavedPrompts,
  onOpenHelp,
  onOpenLanguage,
  onOpenDiscord
}) => {
  const [inputText, setInputText] = useState('');
  const [isDeepResearch, setIsDeepResearch] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const firstName = user.displayName?.split(' ')[0] || 'Jackson';

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
        <div className="relative mb-4 md:mb-5 flex items-center justify-center">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-purple-400 via-purple-300 to-indigo-200 shadow-2xl animate-float-orb relative flex items-center justify-center overflow-hidden">
            {/* Luminous internal reflection highlight */}
            <div className="absolute top-2 left-3 w-10 h-6 bg-white/70 rounded-full blur-xs -rotate-25" />
            <div className="absolute bottom-2 right-4 w-12 h-12 bg-purple-600/25 rounded-full blur-sm" />
            <div className="absolute inset-0 bg-radial from-white/30 via-transparent to-purple-800/20" />
          </div>
          {/* Subtle ambient blur behind */}
          <div className="absolute -inset-4 bg-purple-400/20 rounded-full blur-2xl -z-10" />
        </div>

        {/* Hello Greeting & Main Question */}
        <h2 className="font-display font-medium text-base md:text-xl text-[#8b5cf6] tracking-tight">
          Hello, {firstName}
        </h2>
        <h1 className="font-display font-bold text-xl md:text-4xl text-neutral-900 tracking-tight mt-1 mb-5 md:mb-8">
          How can I assist you today?
        </h1>

        {/* Central Input Box Container */}
        <div className="w-full max-w-2xl bg-white rounded-3xl border border-purple-100/90 shadow-lg shadow-purple-500/5 p-3.5 md:p-4 transition-all focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100/50">
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
            className="w-full resize-none bg-transparent text-base md:text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none px-1"
          />

          {/* Inner Controls Row */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100/80">
            {/* Left Controls: [✨ Deeper Research] [Image] [Globe] [Lightbulb] */}
            <div className="flex items-center gap-2">
              <button
                id="toggle-deep-research-btn"
                onClick={() => setIsDeepResearch(!isDeepResearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  isDeepResearch
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 shadow-xs'
                    : 'bg-purple-50/70 hover:bg-purple-100/80 text-purple-700 border border-purple-200/60'
                }`}
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>Deeper Research</span>
              </button>

              <button
                id="hero-vision-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image for Vision OCR analysis"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                id="hero-web-search-btn"
                onClick={() => setIsWebSearch(!isWebSearch)}
                title="Toggle Web Knowledge"
                className={`p-1.5 rounded-lg transition ${
                  isWebSearch
                    ? 'text-purple-600 bg-purple-50'
                    : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Globe className="w-4 h-4" />
              </button>

              <button
                id="hero-prompt-suggestions-btn"
                onClick={onOpenSavedPrompts}
                title="Open Prompt Library"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
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
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-700 hover:to-indigo-600 text-white flex items-center justify-center shadow-md transition active:scale-95"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : (
                <button
                  id="hero-voice-mic-btn"
                  onClick={handleToggleVoice}
                  title="Voice input"
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gradient-to-tr from-purple-500 to-indigo-400 hover:from-purple-600 hover:to-indigo-500 text-white active:scale-95'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sub-bar below prompt box: [+ Saved prompts] [Attach file] */}
        <div className="w-full max-w-2xl flex items-center justify-between mt-2.5 px-2 text-xs text-neutral-500 font-medium">
          <button
            id="hero-saved-prompts-btn"
            onClick={onOpenSavedPrompts}
            className="flex items-center gap-1.5 text-purple-700 hover:text-purple-900 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>+ Saved prompts</span>
          </button>

          <button
            id="hero-attach-file-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-neutral-50 border border-neutral-200/80 rounded-xl text-neutral-600 transition shadow-xs"
          >
            <Paperclip className="w-3.5 h-3.5 text-neutral-400" />
            <span>Attach file</span>
          </button>
        </div>

        {/* 3 Suggested Cards Grid matching mockup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-3xl mt-8">
          {/* Card 1: Synthesize Data */}
          <button
            id="suggested-card-synthesize"
            onClick={() =>
              onSendMessage(
                'Please synthesize my meeting notes into 5 key action points for the leadership team:\n\n[Paste your raw notes here]'
              )
            }
            className="group text-left p-4 bg-white/90 hover:bg-white rounded-2xl border border-purple-100/70 hover:border-purple-200 hover:shadow-md hover:shadow-purple-500/5 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-2 w-fit rounded-xl bg-purple-50 group-hover:bg-purple-100 text-purple-600 transition mb-3">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-neutral-900 mb-1">Synthesize Data</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Turn my meeting notes into 5 key bullet points for the team
              </p>
            </div>
          </button>

          {/* Card 2: Creative Brainstorm */}
          <button
            id="suggested-card-brainstorm"
            onClick={() =>
              onSendMessage(
                'Generate 3 creative, high-impact taglines for a modern sustainable fashion brand with psychological resonance.'
              )
            }
            className="group text-left p-4 bg-white/90 hover:bg-white rounded-2xl border border-purple-100/70 hover:border-purple-200 hover:shadow-md hover:shadow-purple-500/5 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-2 w-fit rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-600 transition mb-3">
                <Lightbulb className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-neutral-900 mb-1">Creative Brainstorm</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Generate 3 taglines for a new sustainable fashion brand
              </p>
            </div>
          </button>

          {/* Card 3: Check Facts */}
          <button
            id="suggested-card-facts"
            onClick={() =>
              onSendMessage(
                'Compare key differences between GDPR and CCPA across applicability, consumer consent, and compliance penalties.'
              )
            }
            className="group text-left p-4 bg-white/90 hover:bg-white rounded-2xl border border-purple-100/70 hover:border-purple-200 hover:shadow-md hover:shadow-purple-500/5 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="p-2 w-fit rounded-xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 transition mb-3">
                <Hammer className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-neutral-900 mb-1">Check Facts</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Compare key differences between GDPR and CCPA.
              </p>
            </div>
          </button>
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
