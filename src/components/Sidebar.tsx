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
  onOpenSearchModal
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
        className={`fixed inset-y-0 left-0 md:relative z-50 h-full flex flex-col justify-between bg-[#1e1f20] border-r border-[#333538] text-[#e3e3e3] shadow-xl transition-all duration-300 ease-in-out ${
          isOpen ? 'w-72 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
        }`}
      >
        {/* Top Branding & Navigation */}
        <div className="flex flex-col flex-1 min-h-0 p-4 pb-2">
          {/* Brand Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <LeoLogo size="sm" onClick={onNewChat} className="cursor-pointer hover:opacity-90 transition active:scale-95 text-white" />

            {/* Collapse toggle button */}
            <button
              id="sidebar-collapse-btn"
              onClick={onToggle}
              title="Collapse sidebar"
              className="p-1.5 text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-lg transition active:scale-95 cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Primary Button */}
          <button
            id="sidebar-new-chat-btn"
            onClick={onNewChat}
            className="w-full bg-[#28292c] hover:bg-[#333538] text-white border border-[#444746] text-sm font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all duration-150 active:scale-[0.98] mb-3 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>

          {/* Search Bar with ⌘K */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-[#8e918f] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="sidebar-search-input"
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#131314] hover:bg-[#18191a] focus:bg-[#18191a] text-xs text-[#e3e3e3] placeholder-[#8e918f] pl-9 pr-10 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none transition"
            />
            <button
              onClick={onOpenSearchModal}
              title="Quick command palette"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#28292c] text-[10px] font-mono text-[#8e918f] border border-[#333538] flex items-center gap-0.5"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </button>
          </div>

          {/* Quick Nav Items */}
          <div className="space-y-0.5 mb-4 px-0.5 text-xs font-medium text-[#c4c7c5]">
            <button
              id="nav-explore-btn"
              onClick={onOpenExplore}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#28292c] hover:text-white text-left transition active:scale-[0.99] cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#8e918f]" />
              <span>Explore</span>
            </button>
            <button
              id="nav-library-btn"
              onClick={onOpenLibrary}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#28292c] hover:text-white text-left transition active:scale-[0.99] cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-[#8e918f]" />
              <span>Library</span>
            </button>
            <button
              id="nav-files-btn"
              onClick={onOpenFiles}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#28292c] hover:text-white text-left transition active:scale-[0.99] cursor-pointer"
            >
              <FolderClosed className="w-4 h-4 text-[#8e918f]" />
              <span>Files</span>
            </button>
            <button
              id="nav-history-btn"
              onClick={onOpenSearchModal}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#28292c] hover:text-white text-left transition active:scale-[0.99] cursor-pointer"
            >
              <History className="w-4 h-4 text-[#8e918f]" />
              <span>History</span>
            </button>
          </div>

          {/* Chat History Grouping */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            {filteredSessions ? (
              <div>
                <p className="px-2 text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider mb-1">
                  Search Results ({filteredSessions.length})
                </p>
                {filteredSessions.map((session) => renderChatItem(session))}
              </div>
            ) : (
              <>
                {todaySessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-[#8e918f] mb-1.5">Today</p>
                    <div className="space-y-0.5">
                      {todaySessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}

                {yesterdaySessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-[#8e918f] mb-1.5">Yesterday</p>
                    <div className="space-y-0.5">
                      {yesterdaySessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}

                {olderSessions.length > 0 && (
                  <div>
                    <p className="px-2 text-[11px] font-semibold text-[#8e918f] mb-1.5">Previous</p>
                    <div className="space-y-0.5">
                      {olderSessions.map((session) => renderChatItem(session))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Plan Status & User Profile Section */}
        <div className="p-3 border-t border-[#333538] bg-[#18191a] space-y-2">
          {/* Pro / Credit Status Card */}
          <div className="p-2.5 rounded-xl bg-[#28292c] border border-[#333538] text-white shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold">
                  {user.plan === 'ultra' ? 'Leo Ultra' : user.plan === 'pro' ? 'Leo Pro' : 'Leo Free'}
                </span>
              </div>
              <span className="text-[10px] bg-[#333538] px-2 py-0.5 rounded-md font-semibold text-[#e3e3e3] flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                {user.credits ?? 50} cr
              </span>
            </div>
            <p className="text-[10px] text-[#8e918f] mt-1 line-clamp-1">
              {user.plan === 'pro' || user.plan === 'ultra'
                ? 'High-speed Vision & Reasoner active'
                : 'Standard chat reasoning & intelligence'}
            </p>
          </div>

          <div
            id="sidebar-user-profile-card"
            onClick={onOpenAuth}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#28292c] border border-transparent hover:border-[#333538] transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  user.photoURL ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt={user.displayName}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-[#444746] flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#e3e3e3] truncate">
                  {user.displayName || 'Emerson Sterling'}
                </p>
                <p className="text-[10px] text-[#8e918f] truncate">
                  {user.email || 'sterlingr@gmail.com'}
                </p>
              </div>
            </div>

            <button
              id="sidebar-profile-action-btn"
              title="Account settings & Sign out"
              className="p-1 text-[#8e918f] hover:text-white rounded-md transition"
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
        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-all duration-150 active:scale-[0.99] ${
          isActive
            ? 'bg-[#28292c] text-white font-medium border border-[#444746] shadow-2xs'
            : 'text-[#c4c7c5] hover:bg-[#28292c]/60 hover:text-white'
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
            className="p-1 text-[#8e918f] hover:text-red-400 hover:bg-[#333538] rounded-md transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
};
