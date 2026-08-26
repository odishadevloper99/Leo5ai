import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Plus, Shield, Download, X, MessageSquare } from 'lucide-react';
import { ChatSession } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onOpenSavedPrompts: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onNewChat,
  onOpenSavedPrompts
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle palette
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl border border-[#333538] max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search input */}
        <div className="relative p-4 border-b border-[#333538] flex items-center">
          <Search className="w-5 h-5 text-[#8e918f] mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm outline-none text-white placeholder-[#8e918f] bg-transparent"
          />
          <button onClick={onClose} className="p-1 text-[#8e918f] hover:text-white rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick actions & chat results */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {query.length === 0 && (
            <div className="p-2 text-[10px] font-semibold text-[#8e918f] uppercase tracking-wider">
              Quick Actions
            </div>
          )}

          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#e3e3e3] hover:bg-[#28292c] hover:text-white rounded-xl transition text-left cursor-pointer"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>Create New Chat</span>
          </button>

          <button
            onClick={() => {
              onOpenSavedPrompts();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#e3e3e3] hover:bg-[#28292c] hover:text-white rounded-xl transition text-left cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Open Saved Prompt Presets</span>
          </button>

          {filteredSessions.length > 0 && (
            <>
              <div className="p-2 text-[10px] font-semibold text-[#8e918f] uppercase tracking-wider pt-3">
                Chat History
              </div>
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#c4c7c5] hover:text-white hover:bg-[#28292c] rounded-xl transition text-left cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#8e918f] flex-shrink-0" />
                  <span className="truncate">{session.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
