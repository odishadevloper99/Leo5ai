import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Download,
  Share2,
  MoreHorizontal,
  Sparkles,
  Eye,
  Zap,
  Menu,
  Check,
  Crown,
  Layers,
  Search
} from 'lucide-react';
import { ChatSession, AIModelDefinition } from '../types';
import { api } from '../lib/api';
import { LeoLogoMark } from './LeoLogo';
import { ModelLogo } from './ModelLogo';
import { AI_MODELS, DEFAULT_MODEL_ID } from '../data/models';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  activeSession: ChatSession | null;
  onOpenExport: () => void;
  onShare: () => void;
  selectedModel: string;
  onSelectModel: (m: string) => void;
  onOpenModelSelector?: () => void;
  userPlan?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  activeSession,
  onOpenExport,
  onShare,
  selectedModel,
  onSelectModel,
  onOpenModelSelector,
  userPlan
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Resolve current active model definition
  const activeModelDef = AI_MODELS.find(
    (m) => m.id === selectedModel || (selectedModel === 'default' && m.id === DEFAULT_MODEL_ID)
  ) || {
    id: selectedModel || DEFAULT_MODEL_ID,
    name: selectedModel.replace('google/', '').replace('openai/', '').replace('deepseek/', '').replace('anthropic/', '').replace('mistralai/', '') || 'Gemini 2.0 Flash',
    company: 'AI Engine',
    category: 'vision',
    badges: ['Active'],
    iconKey: 'gemini',
    description: 'Active model engine',
    provider: 'aicredits'
  };

  const quickPriorityModels = AI_MODELS.slice(0, 7);

  return (
    <header
      id="main-app-header"
      className="h-14 md:h-16 px-3 md:px-6 flex items-center justify-between border-b border-[#212124] bg-[#131314] text-[#e3e3e3] sticky top-0 z-30 transition-all"
    >
      {/* Left: Sidebar toggle + Clean Model Selector */}
      <div className="flex items-center gap-2 sm:gap-3">
        {!isSidebarOpen && (
          <button
            id="header-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title="Open sidebar"
            className="p-2 text-[#c4c7c5] hover:text-white hover:bg-[#212124] rounded-xl transition cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Clean Model Selector Dropdown & Modal Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="header-model-selector-btn"
            onClick={() => {
              if (onOpenModelSelector) {
                onOpenModelSelector();
              } else {
                setModelDropdownOpen(!modelDropdownOpen);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1e1f20] hover:bg-[#28292c] border border-[#333538] rounded-full text-xs md:text-sm font-medium text-[#e3e3e3] hover:text-white transition shadow-xs group cursor-pointer"
          >
            <ModelLogo iconKey={activeModelDef.iconKey} modelId={activeModelDef.id} size="xs" />
            <span className="font-medium text-[#e3e3e3] group-hover:text-white truncate max-w-[140px] sm:max-w-[220px]">
              {activeModelDef.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white ml-0.5" />
          </button>

          {/* Model Selection Dropdown Menu */}
          {modelDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-[#1e1f20] rounded-2xl shadow-2xl border border-[#333538] p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#e3e3e3]">
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider border-b border-[#333538] mb-1">
                <span>Select AI Model</span>
                <span className="text-[10px] text-purple-400 font-normal">AICredits Hub</span>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {quickPriorityModels.map((m) => {
                  const isSelected = selectedModel === m.id || (selectedModel === 'default' && m.id === DEFAULT_MODEL_ID);
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#28292c] text-white border border-[#444746]'
                          : 'hover:bg-[#28292c] text-[#c4c7c5]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <ModelLogo iconKey={m.iconKey} modelId={m.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate text-[#e3e3e3]">{m.name}</span>
                            {m.isDefault && (
                              <span className="text-[9px] px-1 bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8e918f] truncate">
                            {m.company}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* View All Models Action Button */}
              {onOpenModelSelector && (
                <div className="pt-2 mt-1 border-t border-[#333538]">
                  <button
                    onClick={() => {
                      setModelDropdownOpen(false);
                      onOpenModelSelector();
                    }}
                    className="w-full py-2 px-3 bg-[#28292c] hover:bg-[#333538] text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 border border-[#444746] transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Browse All Models & Details...</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls matching mockup: [...] [🔗] [Export chat] [Upgrade] */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* More Menu */}
        <div className="relative" ref={moreRef}>
          <button
            id="header-more-btn"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            title="More actions"
            className="p-2 text-[#c4c7c5] hover:text-white hover:bg-[#212124] rounded-xl transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#1e1f20] rounded-2xl shadow-2xl border border-[#333538] p-1.5 z-50 text-[#e3e3e3]">
              <button
                onClick={() => {
                  onShare();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-xl text-left cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Chat</span>
              </button>
              <button
                onClick={() => {
                  onOpenExport();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-xl text-left cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Chat</span>
              </button>
            </div>
          )}
        </div>

        {/* Share Link button */}
        <button
          id="header-share-btn"
          onClick={onShare}
          title="Copy share link"
          className="p-2 text-[#c4c7c5] hover:text-white hover:bg-[#212124] rounded-xl transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Export Chat Pill Button */}
        <button
          id="header-export-btn"
          onClick={onOpenExport}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#c4c7c5] hover:text-white bg-[#1e1f20] hover:bg-[#28292c] border border-[#333538] rounded-xl transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-neutral-400" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
