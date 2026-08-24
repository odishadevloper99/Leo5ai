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
      className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-purple-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-30"
    >
      {/* Left: Sidebar toggle + Clean Model Selector */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            id="header-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title="Open sidebar"
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Clean Model Selector Dropdown & Modal Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="header-model-selector-btn"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/70 rounded-xl text-xs font-medium text-neutral-800 transition shadow-xs group"
          >
            <ModelLogo iconKey={activeModelDef.iconKey} modelId={activeModelDef.id} size="xs" />
            <span className="font-semibold text-neutral-900 group-hover:text-purple-700 transition">
              {activeModelDef.name}
            </span>
            {activeModelDef.badges && activeModelDef.badges[0] && (
              <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full font-medium hidden sm:inline">
                {activeModelDef.badges[0]}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
          </button>

          {/* Model Selection Dropdown Menu */}
          {modelDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-neutral-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 mb-1">
                <span>Select AI Model</span>
                <span className="text-[10px] text-purple-600 font-normal">AICredits Hub</span>
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
                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2.5 transition ${
                        isSelected
                          ? 'bg-purple-50 text-purple-950 ring-1 ring-purple-200 font-medium'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <ModelLogo iconKey={m.iconKey} modelId={m.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate">{m.name}</span>
                            {m.isDefault && (
                              <span className="text-[9px] px-1 bg-emerald-100 text-emerald-700 font-semibold rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {m.company} • {m.totalCostPer1M ? `$${m.totalCostPer1M.toFixed(2)}/1M` : 'Standard'}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* View All Models Action Button */}
              {onOpenModelSelector && (
                <div className="pt-2 mt-1 border-t border-neutral-100">
                  <button
                    onClick={() => {
                      setModelDropdownOpen(false);
                      onOpenModelSelector();
                    }}
                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition"
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
      <div className="flex items-center gap-2">
        {/* More Menu */}
        <div className="relative" ref={moreRef}>
          <button
            id="header-more-btn"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            title="More actions"
            className="p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-neutral-100 p-1.5 z-50">
              <button
                onClick={() => {
                  onShare();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 rounded-xl text-left"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Chat</span>
              </button>
              <button
                onClick={() => {
                  onOpenExport();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 rounded-xl text-left"
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
          className="p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Export Chat Pill Button */}
        <button
          id="header-export-btn"
          onClick={onOpenExport}
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100/80 hover:bg-neutral-200/80 rounded-xl transition"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          <span>Export chat</span>
        </button>

        {/* Pro/Ultra Plan Badge (display only — purchase flow removed) */}
        {(userPlan === 'pro' || userPlan === 'ultra') && (
          <span
            id="header-plan-badge"
            className="bg-gradient-to-r from-purple-900 to-neutral-950 border border-purple-400/40 text-white text-xs font-medium px-4 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Pro Member</span>
          </span>
        )}
      </div>
    </header>
  );
};
