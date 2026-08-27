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
  Sparkles,
  User,
  Zap,
  PanelLeft,
  Columns
} from 'lucide-react';
import { ChatSession, UserProfile } from '../types';
import { LeoLogoMark } from './LeoLogo';

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
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
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
  onOpenSearchModal,
  onOpenSettings,
  onOpenHelp
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
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar-container"
        className={`fixed inset-y-0 left-0 md:relative z-50 h-full flex flex-col justify-between bg-[#000000] border-r border-[#1a1a1c] text-zinc-300 shadow-2xl transition-all duration-300 ease-in-out ${
          isOpen ? 'w-68 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col flex-1 min-h-0 p-3 pb-1">
          {/* Top Row: Brand Icon + Search & Collapse (Matches Screenshot 2/3/4) */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div
              onClick={onNewChat}
              className="cursor-pointer hover:opacity-80 transition active:scale-95"
              title="Leo AI"
            >
              <LeoLogoMark className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-1.5 text-zinc-400">
              <button
                id="sidebar-search-btn"
                onClick={() => {
                  setIsSearchActive(!isSearchActive);
                  if (!isSearchActive) onOpenSearchModal();
                }}
                title="Search tasks"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#141416] rounded-lg transition active:scale-95 cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                id="sidebar-collapse-btn"
                onClick={onToggle}
                title="Toggle sidebar"
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#141416] rounded-lg transition active:scale-95 cursor-pointer"
              >
                {/* Minimalist split icon matching screenshot */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            </div>
          </div>

          {/* New Task Button (Matches Screenshot) */}
          <button
            id="sidebar-new-task-btn"
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-100 hover:text-white bg-transparent hover:bg-[#141416] rounded-xl transition duration-150 active:scale-[0.98] mb-3 cursor-pointer group"
          >
            <SquarePen className="w-4 h-4 text-zinc-300 group-hover:text-white" />
            <span className="font-medium text-[13px]">New task</span>
          </button>

          {/* Quick Search Bar if opened */}
          {isSearchActive && (
            <div className="relative mb-2 px-1 animate-in fade-in duration-150">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Filter tasks..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-[#121214] text-xs text-zinc-200 placeholder-zinc-500 pl-8.5 pr-2.5 py-1.5 rounded-lg border border-[#222225] focus:border-zinc-500 outline-none transition"
              />
            </div>
          )}

          {/* Projects Section (Matches Screenshot) */}
          <div className="mb-3">
            <div className="flex items-center justify-between px-3 py-1 text-[12px] font-medium text-zinc-500">
              <span>Projects</span>
              <button
                onClick={onOpenExplore}
                title="New project"
                className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-0.5"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5 mt-1">
              <button
                onClick={onOpenExplore}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-[#141416] text-left transition active:scale-[0.99] cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span>New project</span>
              </button>
            </div>
          </div>

          {/* Tasks Section Header (Matches Screenshot) */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1 text-[12px] font-medium text-zinc-500">
            <span>Tasks</span>
            <button
              onClick={onNewChat}
              title="New task"
              className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-0.5"
            >
              <SquarePen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tasks List or Empty State (Matches Screenshot 2/3/4) */}
          <div className="flex-1 overflow-y-auto pr-0.5 space-y-0.5 text-xs">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-3 my-auto">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-zinc-200">
                  <svg className="w-10 h-10 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect width="18" height="14" x="3" y="4" rx="2" />
                    <line x1="8" x2="16" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-100">No tasks yet</p>
                  <p className="text-[12px] text-zinc-500 max-w-[170px] leading-relaxed">
                    Start a task to see your task history here
                  </p>
                </div>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onMouseEnter={() => setHoveredChat(session.id)}
                  onMouseLeave={() => setHoveredChat(null)}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition duration-150 active:scale-[0.99] ${
                    session.id === activeSessionId
                      ? 'bg-[#18181b] text-white font-medium shadow-xs'
                      : 'text-zinc-400 hover:bg-[#121214] hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate flex-1 pr-1.5 text-[13px]">{session.title}</span>

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
              ))
            )}
          </div>
        </div>

        {/* Bottom Section: Upgrade to Pro + User Profile Menu */}
        <div className="p-3 border-t border-[#1a1a1c] bg-[#000000] space-y-2 relative" ref={profileMenuRef}>
          {/* Upgrade to Pro Card (Matches Screenshot 3 & 4) */}
          {user.plan !== 'pro' && user.plan !== 'ultra' && (
            <div
              onClick={onOpenExplore}
              className="p-3 rounded-2xl bg-[#141416] hover:bg-[#1a1a1d] border border-[#222225] flex items-center justify-between transition cursor-pointer group"
            >
              <div className="min-w-0 pr-2">
                <p className="text-[13px] font-semibold text-zinc-100 group-hover:text-white transition">
                  Upgrade to Pro
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  Unlock more features
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black shrink-0 shadow-sm">
                <Zap className="w-4 h-4 fill-black text-black" />
              </div>
            </div>
          )}

          {/* Profile Popup Menu (Matches Screenshot 2 exactly) */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#141416] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs">
              {/* User Email header */}
              <div className="px-3 py-2.5 flex items-center gap-2.5 text-zinc-200 border-b border-[#222225]">
                <div className="w-5 h-5 rounded-full border border-zinc-600 flex items-center justify-center text-zinc-400">
                  <User className="w-3 h-3" />
                </div>
                <span className="truncate text-xs font-normal text-zinc-300">
                  {user.email || 'bindhanibikash71@gmail.com'}
                </span>
              </div>

              {/* Menu items */}
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (onOpenSettings) onOpenSettings();
                    else onOpenExplore();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-zinc-200 hover:text-white hover:bg-[#1f1f23] rounded-xl text-left transition cursor-pointer text-[13px]"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (onOpenHelp) onOpenHelp();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-200 hover:text-white hover:bg-[#1f1f23] rounded-xl text-left transition cursor-pointer text-[13px]"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-zinc-400" />
                    <span>Help</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-zinc-200 hover:text-white hover:bg-[#1f1f23] rounded-xl text-left transition cursor-pointer text-[13px]"
                >
                  <LogOut className="w-4 h-4 text-zinc-400" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}

          {/* User Profile Bar (Matches Screenshot 2, 3, 4) */}
          <div
            id="sidebar-user-profile-card"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#141416] transition cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-white text-black font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white text-black font-extrabold flex items-center justify-center text-xs">
                  B
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-zinc-100 truncate leading-tight uppercase">
                {user.displayName || 'WORM BIKASH'}
              </p>
              <p className="text-[11px] text-zinc-500 capitalize leading-tight">
                {user.plan || 'Free'}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
