import React, { useState, useRef, useEffect } from 'react';
import {
  SquarePen,
  Search,
  Plus,
  FolderPlus,
  Bookmark,
  MessageSquare,
  Trash2,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  Sparkles,
  User,
  Shield,
  CreditCard,
  Layers,
  Zap
} from 'lucide-react';
import { ChatSession, UserProfile } from '../types';
import { LeoLogo } from './LeoLogo';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  user: UserProfile;
  onOpenAuth: () => void;
  onOpenExplore: () => void;
  onOpenLibrary: () => void;
  onOpenFiles: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSearchModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  user,
  onOpenAuth,
  onOpenExplore,
  onOpenLibrary,
  searchQuery,
  onSearchChange,
  onOpenSearchModal
}) => {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSessions = searchQuery
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onToggle}
          aria-label="Close sidebar overlay"
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar-container"
        className={`fixed inset-y-0 left-0 md:relative z-50 h-full flex flex-col justify-between bg-[#0e0e11] border-r border-[#1f1f23] text-zinc-300 shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col flex-1 min-h-0 p-3 pb-1">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <LeoLogo
              size="sm"
              onClick={onNewChat}
              className="cursor-pointer hover:opacity-90 transition active:scale-95 text-white"
            />

            <div className="flex items-center gap-1">
              <button
                id="sidebar-search-btn"
                onClick={() => {
                  setIsSearchActive(!isSearchActive);
                  if (!isSearchActive) onOpenSearchModal();
                }}
                title="Search tasks (⌘K)"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition active:scale-95 cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                id="sidebar-collapse-btn"
                onClick={onToggle}
                title="Collapse sidebar"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181b] rounded-lg transition active:scale-95 cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Task Button */}
          <button
            id="sidebar-new-chat-btn"
            onClick={onNewChat}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-200 hover:text-white bg-[#141416] hover:bg-[#1c1c1f] rounded-xl border border-[#27272a] hover:border-zinc-600 transition duration-150 active:scale-[0.98] mb-3 cursor-pointer group shadow-xs"
          >
            <span className="flex items-center gap-2.5 font-medium">
              <SquarePen className="w-4 h-4 text-zinc-400 group-hover:text-purple-400 transition" />
              <span>New task</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono tracking-wider">⌘N</span>
          </button>

          {/* Quick Search Input (if opened inline) */}
          {isSearchActive && (
            <div className="relative mb-2 px-0.5 animate-in fade-in duration-150">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Filter tasks..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-[#161619] text-xs text-zinc-200 placeholder-zinc-500 pl-8.5 pr-2.5 py-1.5 rounded-lg border border-[#27272a] focus:border-purple-500/50 outline-none transition"
              />
            </div>
          )}

          {/* Projects Section */}
          <div className="mb-2">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-zinc-400 tracking-wide">
              <span>Projects</span>
              <button
                onClick={onOpenExplore}
                title="Create project / explore templates"
                className="p-0.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5 mt-0.5">
              <button
                onClick={onOpenExplore}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] text-left transition active:scale-[0.99] cursor-pointer group"
              >
                <FolderPlus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition" />
                <span>New project</span>
              </button>

              <button
                onClick={onOpenLibrary}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] text-left transition active:scale-[0.99] cursor-pointer group"
              >
                <Bookmark className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition" />
                <span>Prompt Library</span>
              </button>
            </div>
          </div>

          {/* Tasks Section Header */}
          <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[11px] font-semibold text-zinc-400 tracking-wide">
            <span>Tasks</span>
            <button
              onClick={onNewChat}
              title="New task"
              className="p-0.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition cursor-pointer"
            >
              <SquarePen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tasks List or Empty State */}
          <div className="flex-1 overflow-y-auto pr-0.5 space-y-0.5 text-xs">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 px-3 space-y-2.5 my-auto">
                <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center text-zinc-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-200">No tasks yet</p>
                  <p className="text-[11px] text-zinc-500 max-w-[170px] leading-relaxed">
                    Start a task to see your task history here
                  </p>
                </div>
              </div>
            ) : (
              filteredSessions.map((session) => renderChatItem(session))
            )}
          </div>
        </div>

        {/* Bottom Area: Upgrade Pro Card & User Profile Menu */}
        <div className="p-2.5 border-t border-[#1f1f23] bg-[#0c0c0e] space-y-2 relative" ref={profileMenuRef}>
          {/* Upgrade to Pro Card (shown for free tier) */}
          {user.plan !== 'pro' && user.plan !== 'ultra' && (
            <div
              onClick={onOpenExplore}
              className="p-2.5 rounded-xl bg-[#141416] hover:bg-[#1a1a1d] border border-[#27272a] hover:border-zinc-700 flex items-center justify-between transition cursor-pointer group shadow-xs"
            >
              <div className="min-w-0 pr-2">
                <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition">
                  Upgrade to Pro
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  Unlock more features
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Profile Menu Popover (matches Screenshot 3) */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
              {/* User Email header */}
              <div className="px-3 py-2 border-b border-[#27272a] flex items-center gap-2.5 text-zinc-300">
                <User className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate text-xs font-medium">
                  {user.email || user.displayName || 'user@leo-ai.com'}
                </span>
              </div>

              {/* Menu items */}
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenExplore();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Plan & Credits ({user.credits ?? 50})</span>
                  </span>
                  <span className="text-[10px] text-purple-400 font-medium uppercase px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/30">
                    {user.plan || 'Free'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenLibrary();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-lg text-left transition cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Prompt Library</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    window.location.hash = '#admin';
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-lg text-left transition cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Admin Portal</span>
                </button>

                <div className="h-[1px] bg-[#27272a] my-1" />

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg text-left transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out / Switch account</span>
                </button>
              </div>
            </div>
          )}

          {/* User Profile Button Trigger */}
          <div
            id="sidebar-user-profile-card"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#141416] hover:bg-[#1a1a1d] border border-[#27272a] hover:border-zinc-700 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  user.photoURL ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt={user.displayName}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-700 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">
                  {user.displayName || 'Leo Explorer'}
                </p>
                <p className="text-[10px] text-zinc-500 capitalize leading-tight">
                  {user.plan || 'Free'}
                </p>
              </div>
            </div>

            <ChevronRight
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${
                isProfileMenuOpen ? 'rotate-90 text-zinc-300' : ''
              }`}
            />
          </div>
        </div>
      </aside>
    </>
  );

  function renderChatItem(session: ChatSession) {
    const isActive = session.id === activeSessionId;
    return (
      <div
        key={session.id}
        onMouseEnter={() => setHoveredChat(session.id)}
        onMouseLeave={() => setHoveredChat(null)}
        onClick={() => onSelectSession(session.id)}
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition duration-150 active:scale-[0.99] ${
          isActive
            ? 'bg-[#1a1a1d] text-white font-medium border border-[#2e2e33] shadow-xs'
            : 'text-zinc-400 hover:bg-[#141416] hover:text-zinc-200'
        }`}
      >
        <span className="truncate flex-1 pr-1.5">{session.title}</span>

        {hoveredChat === session.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(session.id);
            }}
            title="Delete task"
            className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
};
