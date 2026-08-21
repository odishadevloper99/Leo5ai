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
  Crown
} from 'lucide-react';
import { ChatSession } from '../types';
import { LeoLogoMark } from './LeoLogo';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  activeSession: ChatSession | null;
  onOpenExport: () => void;
  onShare: () => void;
  selectedModel: string;
  onSelectModel: (m: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  activeSession,
  onOpenExport,
  onShare,
  selectedModel,
  onSelectModel
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

  // Clean, user-friendly modes with NO model IDs exposed
  const engineModes = [
    {
      id: 'default',
      name: 'Leo AI Standard',
      desc: 'Optimized for conversation, writing, and everyday problem solving',
      icon: Sparkles,
    },
    {
      id: 'vision',
      name: 'Leo AI Vision',
      desc: 'High-speed image understanding, OCR, and diagram reasoning',
      icon: Eye,
    },
    {
      id: 'reasoning',
      name: 'Leo AI Deep Reasoner',
      desc: 'Extended cognitive synthesis for coding and complex logic',
      icon: Zap,
    },
  ];

  const currentMode = engineModes.find((m) => m.id === selectedModel) || engineModes[0];

  return (
    <header
      id="main-app-header"
      className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-purple-100/50 bg-white/80 backdrop-blur-md sticky top-0 z-30"
    >
      {/* Left: Sidebar toggle (if closed or mobile) + Clean Model/Engine Selector */}
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

        {/* Clean Model Selector dropdown matching mockup */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="header-model-selector-btn"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200/70 rounded-xl text-xs font-medium text-neutral-800 transition"
          >
            <LeoLogoMark className="w-5 h-5 rounded-md" />
            <span className="font-semibold text-neutral-900">Leo AI</span>
            <span className="text-[11px] text-neutral-400 hidden sm:inline">
              ({currentMode.name.replace('Leo AI ', '')})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
          </button>

          {/* Clean Engine Modes Dropdown */}
          {modelDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Select Intelligence Mode
              </div>
              <div className="space-y-1">
                {engineModes.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = selectedModel === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        onSelectModel(mode.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition ${
                        isSelected
                          ? 'bg-purple-50 text-purple-950 ring-1 ring-purple-200'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold">{mode.name}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1">{mode.desc}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-purple-600 mt-1" />}
                    </button>
                  );
                })}
              </div>
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

        {/* Upgrade Pill Button strictly matching the user's mockup design */}
        <button
          id="header-upgrade-btn"
          onClick={() => {
            alert('🌟 Leo AI Pro: Unlimited high-speed vision inference and persistent memory enabled for your workspace!');
          }}
          className="bg-neutral-950 hover:bg-black text-white text-xs font-medium px-4 py-1.5 rounded-xl shadow-xs hover:shadow transition flex items-center gap-1.5"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>Upgrade</span>
        </button>
      </div>
    </header>
  );
};
