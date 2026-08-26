import React from 'react';
import { HelpCircle, X, Shield, Cpu, Sparkles, Database, ExternalLink } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl border border-[#333538] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#28292c] text-purple-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h3 className="font-display font-semibold text-base text-white">
              About Leo AI
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8e918f] hover:text-white hover:bg-[#28292c] rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-[#c4c7c5] leading-relaxed">
          <p>
            <strong className="text-white">Leo AI</strong> is an intelligent AI assistant engineered for conversation, creative generation, multimodal vision reasoning, and persistent memory context.
          </p>

          <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#333538] space-y-2">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Key Capabilities</span>
            </div>
            <ul className="list-disc pl-4 space-y-1.5 text-[#c4c7c5] text-[11px]">
              <li><strong className="text-white">Multi-Model Intelligence</strong>: Access next-generation reasoning, coding, and chat models.</li>
              <li><strong className="text-white">Vision & File Analysis</strong>: Upload images, documents, and code snippets for instant multimodal analysis.</li>
              <li><strong className="text-white">Smart Context & Memory</strong>: Seamlessly retains conversation context for personalized responses.</li>
              <li><strong className="text-white">Real-time Responses</strong>: High-speed streaming for fast and accurate answers.</li>
            </ul>
          </div>

          <div className="p-3 rounded-2xl bg-[#131314] border border-[#333538] text-[11px] text-[#8e918f] flex items-center justify-between">
            <span>Have questions or suggestions?</span>
            <span className="font-medium text-purple-400">Leo AI Help & Support</span>
          </div>
        </div>
      </div>
    </div>
  );
};
