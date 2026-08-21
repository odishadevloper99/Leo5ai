import React, { useState } from 'react';
import {
  Plus,
  Search,
  Compass,
  Bookmark,
  FolderClosed,
  History,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Trash2,
  Share2,
  MoreHorizontal,
  Command,
  Shield,
  Crown,
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
  onOpenFiles,
  searchQuery,
  onSearchChange,
  onOpenSearchModal,
}) => {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  // Group sessions by time
  const now = Date.now();
  const oneDay = 86400000;

  const todaySessions = sessions.filter(
    (s) => now - s.updatedAt < oneDay
  );
  const yesterdaySessions = sessions.filter(
    (s) => now - s.updatedAt >= oneDay && now - s.updatedAt < oneDay * 2
  );
  const olderSessions = sessions.filter(
    (s) => now - s.updatedAt >= oneDay * 2
  );

  const filteredSessions = searchQuery
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onToggle}
          aria-label="Close sidebar overlay"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="sidebar-container"
        className={`fixed inset-y-0 left-0 md:relative z-50 h-full flex flex-col justify-between bg-white border-r border-purple-100/70 shadow-sm transition-all duration-300 ease-in-out ${
          isOpen ? 'w-72 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Top Branding & Navigation */}
        <div className="flex flex-col flex-1 min-h-0 p-4 pb-2">
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <LeoLogo size="sm" onClick={onNewChat} className="cursor-pointer" />

            {/* Collapse toggle button */}
            <button
              id="sidebar-collapse-btn"
              onClick={onToggle}
              title="Collapse sidebar"
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Primary Button */}
          <button
            id="sidebar-new-chat-btn"
            onClick={onNewChat}
            className="w-full bg-[#18181b] hover:bg-black text-white text-sm font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all duration-150 active:scale-[0.99] mb-3"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>

          {/* Search Bar with ⌘K */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="sidebar-search-input"
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white text-xs text-neutral-800 placeholder-neutral-400 pl-9 pr-10 py-2 rounded-xl border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-100 outline-none transition"
            />
            <button
              onClick={onOpenSearchModal}
              title="Quick command palette"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-neutral-400 border border-neutral-200 shadow-xs flex items-center gap-0.5"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </button>
          </div>

          {/* Quick Nav Items */}
          <div className="space-y-0.5 mb-4 px-0.5 text-xs font-medium text-neutral-600">
            <button
              id="nav-explore-btn"
              onClick={onOpenExplore}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100/90 text-left transition"
            >
              <Compass className="w-4 h-4 text-neutral-500" />
              <span>Explore</span>
            </button>
            <button
              id="nav-library-btn"
              onClick={onOpenLibrary}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100/90 text-left transition"
            >
              <Bookmark className="w-4 h-4 text-neutral-500" />
              <span>Library</span>
            </button>
            <button
              id="nav-files-btn"
              onClick={onOpenFiles}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100/90 text-left transition"
            >
              <FolderClosed className="w-4 h-4 text-neutral-500" />
              <span>Files</span>
            </button>
            <button
              id="nav-history-btn"
              onClick={onOpenSearchModal}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100/90 text-left transition"
            >
              <History className="w-4 h-4 text-neutral-500" />
              <span>History</span>
            </button>
          </div>

          {/* Chat History Grouping */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            {filteredSessions ? (
              <div>
                <p className="px-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Search Results ({filteredSessions.length})
                </p>
                {filteredSessions.map((session) => renderChatItem(session))}
              </div>
            ) : (
              <>
                {todaySessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">Today</p>
                    <div className="space-y-0.5">
                      {todaySessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}

                {yesterdaySessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">Yesterday</p>
                    <div className="space-y-0.5">
                      {yesterdaySessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}

                {olderSessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">7 days</p>
                    <div className="space-y-0.5">
                      {olderSessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Upgrade & User Profile Section */}
        <div className="p-3 border-t border-purple-100/70 bg-neutral-50/50 space-y-2">
          {/* Pro / Credit Status Card */}
          <div
            className="p-2.5 rounded-xl bg-gradient-to-br from-purple-900 to-neutral-900 text-white shadow-xs hover:shadow-md cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold">
                  {user.plan === 'ultra' ? 'Leo Ultra' : user.plan === 'pro' ? 'Leo Pro' : 'Upgrade to Pro'}
                </span>
              </div>
              <span className="text-[10px] bg-purple-800/80 group-hover:bg-purple-700 px-2 py-0.5 rounded-md font-semibold text-purple-200 flex items-center gap-1 transition">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                {user.credits ?? 50} cr
              </span>
            </div>
            <p className="text-[10px] text-purple-300/80 mt-1 line-clamp-1">
              {user.plan === 'pro' || user.plan === 'ultra'
                ? 'High-speed Vision & Reasoner active'
                : 'Get 500+ credits & fast reasoning'}
            </p>
          </div>

          <div
            id="sidebar-user-profile-card"
            onClick={onOpenAuth}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-white hover:shadow-xs border border-transparent hover:border-purple-100 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  user.photoURL ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt={user.displayName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-purple-200 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-neutral-900 truncate">
                  {user.displayName || 'Emerson Sterling'}
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  {user.email || 'sterlingr@gmail.com'}
                </p>
              </div>
            </div>

            <button
              id="sidebar-profile-action-btn"
              title="Account settings & Sign out"
              className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-xs transition ${
          isActive
            ? 'bg-purple-50/80 text-purple-950 font-medium'
            : 'text-neutral-700 hover:bg-neutral-100/80'
        }`}
      >
        <span className="truncate flex-1 pr-2">{session.title}</span>

        {hoveredChat === session.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(session.id);
            }}
            title="Delete conversation"
            className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-500 rounded transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
};
