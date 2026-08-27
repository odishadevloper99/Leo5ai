import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Share2,
  MoreHorizontal,
  Sparkles,
  PanelLeft,
  ChevronDown
} from 'lucide-react';
import { ChatSession } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  activeSession: ChatSession | null;
  onOpenExport: () => void;
  onShare: () => void;
  onOpenUpgrade?: () => void;
  selectedModel?: string;
  onSelectModel?: (m: string) => void;
  userPlan?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  activeSession,
  onOpenExport,
  onShare,
  onOpenUpgrade,
  userPlan
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="main-app-header"
      className="h-13 px-3 md:px-4 flex items-center justify-between bg-[#000000] text-zinc-200 sticky top-0 z-30 transition-all select-none"
    >
      {/* Left: Sidebar toggle + Upgrade pill button (Matches Screenshot 4 & 5) */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            id="header-sidebar-toggle-btn"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#141416] transition cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        )}

        {/* Upgrade pill button (Matches Screenshot 4 & 5) */}
        {userPlan !== 'pro' && userPlan !== 'ultra' && (
          <button
            onClick={onOpenUpgrade}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#463b78] hover:bg-[#52458c] text-white text-xs font-semibold tracking-wide transition cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>Upgrade plan</span>
          </button>
        )}

        {/* Active Session Title */}
        {activeSession?.title && (
          <span className="hidden sm:inline-block text-xs font-medium text-zinc-400 truncate max-w-[240px] md:max-w-[340px] px-2 py-0.5 rounded bg-[#141416] border border-[#222225]">
            {activeSession.title}
          </span>
        )}
      </div>

      {/* Right Controls: Share & Export & More */}
      <div className="flex items-center gap-1">
        <button
          id="header-share-btn"
          onClick={onShare}
          title="Share link"
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#141416] rounded-lg transition cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          id="header-export-btn"
          onClick={onOpenExport}
          title="Export task"
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#141416] rounded-lg transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* More Menu */}
        <div className="relative" ref={moreRef}>
          <button
            id="header-more-btn"
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            title="More actions"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#141416] rounded-lg transition cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {moreMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#18181b] rounded-xl shadow-2xl border border-[#27272a] p-1 z-50 text-zinc-200 text-xs animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  onShare();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg text-left transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Chat</span>
              </button>
              <button
                onClick={() => {
                  onOpenExport();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg text-left transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
