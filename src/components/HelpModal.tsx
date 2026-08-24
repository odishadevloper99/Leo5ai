import React from 'react';
import { HelpCircle, X, Shield, Cpu, Sparkles, Database, ExternalLink } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h3 className="font-display font-semibold text-base text-neutral-900">
              About Leo AI
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-neutral-600 leading-relaxed">
          <p>
            <strong>Leo AI</strong> is an intelligent AI assistant engineered for conversation, creative generation, multimodal vision reasoning, and persistent memory context.
          </p>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-2">
            <div className="font-semibold text-purple-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Key Capabilities</span>
            </div>
            <ul className="list-disc pl-4 space-y-1.5 text-purple-900/80 text-[11px]">
              <li><strong>Multi-Model Intelligence</strong>: Access next-generation reasoning, coding, and chat models.</li>
              <li><strong>Vision & File Analysis</strong>: Upload images, documents, and code snippets for instant multimodal analysis.</li>
              <li><strong>Smart Context & Memory</strong>: Seamlessly retains conversation context for personalized responses.</li>
              <li><strong>Real-time Responses</strong>: High-speed streaming for fast and accurate answers.</li>
            </ul>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Have questions or suggestions?</span>
            <span className="font-medium text-purple-600">Leo AI Help & Support</span>
          </div>
        </div>
      </div>
    </div>
  );
};
