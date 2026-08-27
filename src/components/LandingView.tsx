import React, { useState } from 'react';
import { Plus, ArrowUp } from 'lucide-react';
import { LeoLogo } from './LeoLogo';

interface LandingViewProps {
  onSignIn: () => void;
  onGetStarted: () => void;
  onSendMessage: (text: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onSignIn,
  onGetStarted,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#000000] text-white flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none font-sans">
      {/* Top Header Row (Matches Screenshot 1) */}
      <header className="w-full flex items-center justify-between z-20">
        <LeoLogo size="sm" />

        <div className="flex items-center gap-2">
          {/* Sign In Button */}
          <button
            id="landing-signin-btn"
            onClick={onSignIn}
            className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition active:scale-95 cursor-pointer shadow-xs"
          >
            Sign in
          </button>

          {/* Get Started Button */}
          <button
            id="landing-getstarted-btn"
            onClick={onGetStarted}
            className="px-4 py-1.5 rounded-xl bg-[#141416] hover:bg-[#202024] text-white font-semibold text-xs border border-[#27272a] transition active:scale-95 cursor-pointer shadow-xs"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Center Headline and Subtitle (Matches Screenshot 1) */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto my-auto py-8">
        <h1 className="font-sans font-bold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight">
          What will you
          <br />
          hack today?
        </h1>
        <p className="mt-3 text-sm text-zinc-400 font-normal">
          Find and fix vulnerabilities by working with AI.
        </p>

        {/* Input Box Card (Matches Screenshot 1) */}
        <div className="w-full max-w-lg mt-8 bg-[#141416] rounded-3xl border border-[#222225] p-3 sm:p-4 shadow-2xl transition focus-within:border-zinc-500">
          <textarea
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Leo AI to find vulnerabilities in..."
            className="w-full resize-none bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none px-1 leading-relaxed"
          />

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a1d]">
            <button
              onClick={onGetStarted}
              className="w-8 h-8 rounded-full bg-transparent hover:bg-[#202024] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSubmit()}
              disabled={!inputText.trim()}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                inputText.trim()
                  ? 'bg-white text-black hover:bg-zinc-200 shadow-md cursor-pointer'
                  : 'bg-[#27272a] text-zinc-500 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </main>

      <footer className="w-full text-center text-[11px] text-zinc-600 pb-2">
        <span>LeoAI — Advanced Multimodal Security & Intelligence</span>
      </footer>
    </div>
  );
};
