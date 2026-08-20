import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HeroState } from './components/HeroState';
import { ChatView } from './components/ChatView';
import { AdminPortalPage } from './components/AdminPortalPage';
import { PromptLibraryModal } from './components/PromptLibraryModal';
import { AuthModal } from './components/AuthModal';
import { ExportModal } from './components/ExportModal';
import { ExploreModal } from './components/ExploreModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { HelpModal } from './components/HelpModal';
import { INITIAL_CHAT_SESSIONS } from './lib/prompts';
import {
  getCurrentStoredUser,
  saveChatToRealtimeDB,
  loadChatsFromRealtimeDB,
  deleteChatFromRealtimeDB
} from './lib/firebase';
import { api } from './lib/api';
import { ChatSession, Message, UserProfile } from './types';

export default function App() {
  // Routing: Detect /admin or #admin
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path.includes('/admin') || hash === '#admin' || hash === '#/admin') {
      return '/admin';
    }
    return '/';
  });

  // Listen to browser navigation
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('/admin') || hash === '#admin' || hash === '#/admin') {
        setCurrentRoute('/admin');
      } else {
        setCurrentRoute('/');
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('leo_chat_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_CHAT_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserProfile>(getCurrentStoredUser());
  const [isLoading, setIsLoading] = useState(false);

  // User-facing Modals state
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Sync sessions to localStorage
  useEffect(() => {
    localStorage.setItem('leo_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Load chats from Firebase Realtime Database and backend API on mount
  useEffect(() => {
    // 1. Try Firebase Realtime Database
    loadChatsFromRealtimeDB(user.uid).then((rtdbChats) => {
      if (rtdbChats && rtdbChats.length > 0) {
        setSessions(rtdbChats);
        return;
      }
      // 2. Fallback to Express backend store
      api.getChats(user.uid).then((backendChats) => {
        if (backendChats && backendChats.length > 0) {
          setSessions(backendChats);
        }
      }).catch(() => {});
    });
  }, [user.uid]);

  // Global Keyboard Shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Require a real (non-guest) login before the chat interface is shown.
  const isLoggedIn = !user.isAnonymous;

  // Auto-open the login modal the first time a guest lands on the app.
  // (Kept above the /admin early-return below so hook order stays stable.)
  useEffect(() => {
    if (!isLoggedIn && currentRoute !== '/admin') {
      setIsAuthOpen(true);
    }
  }, [isLoggedIn, currentRoute]);

  // If user navigated directly to /admin, render the dedicated Admin Portal
  if (currentRoute === '/admin') {
    return (
      <AdminPortalPage
        onExit={() => {
          window.history.pushState({}, '', '/');
          setCurrentRoute('/');
        }}
      />
    );
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Create New Chat
  const handleNewChat = () => {
    setActiveSessionId(null);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Delete Chat Session
  const handleDeleteSession = async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    // Delete from Firebase Realtime Database & backend
    deleteChatFromRealtimeDB(user.uid, id).catch(() => {});
    await api.deleteChat(id).catch(() => {});
  };

  // Send Message
  const handleSendMessage = async (
    text: string,
    images: string[] = [],
    isDeepResearch: boolean = false
  ) => {
    let currentSession = activeSession;
    let newSessionId = activeSessionId;

    // Create session if none active
    if (!currentSession) {
      newSessionId = 'chat-' + Date.now();
      const generatedTitle =
        text.slice(0, 38).trim() + (text.length > 38 ? '...' : '') || 'Conversation';

      currentSession = {
        id: newSessionId,
        title: generatedTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        model: selectedModel,
      };

      setSessions((prev) => [currentSession!, ...prev]);
      setActiveSessionId(newSessionId);
    }

    const userMessage: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      images: images && images.length > 0 ? images : undefined,
      isDeepResearch,
    };

    const updatedMessages = [...currentSession.messages, userMessage];

    // Optimistically update UI
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSession!.id
          ? { ...s, messages: updatedMessages, updatedAt: Date.now() }
          : s
      )
    );

    setIsLoading(true);

    try {
      // Call backend AI chat endpoint
      const response = await api.sendChat({
        messages: updatedMessages,
        userId: user.uid,
        images,
        isDeepResearch,
      });

      const assistantMessage: Message = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        isDeepResearch,
      };

      const finalMessages = [...updatedMessages, assistantMessage];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession!.id
            ? { ...s, messages: finalMessages, updatedAt: Date.now() }
            : s
        )
      );

      const finalSession: ChatSession = {
        ...currentSession,
        messages: finalMessages,
        updatedAt: Date.now(),
      };

      // Asynchronously sync to Firebase Realtime Database & backend DB
      saveChatToRealtimeDB(user.uid, finalSession).catch(() => {});
      api.saveChat({
        id: currentSession.id,
        userId: user.uid,
        title: currentSession.title,
        messages: finalMessages,
        model: selectedModel,
      }).catch(() => {});

    } catch (err: any) {
      const errorMessage: Message = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: `⚠️ **Leo AI Communication Error**: ${err.message || 'Unable to connect to AI engine'}. Please try again.`,
        timestamp: Date.now(),
        status: 'error',
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession!.id
            ? { ...s, messages: [...updatedMessages, errorMessage], updatedAt: Date.now() }
            : s
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate Response
  const handleRegenerate = () => {
    if (!activeSession || activeSession.messages.length === 0) return;
    const lastUserMsg = [...activeSession.messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (lastUserMsg) {
      handleSendMessage(
        lastUserMsg.content,
        lastUserMsg.images,
        lastUserMsg.isDeepResearch
      );
    }
  };

  // Share Chat
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('🔗 Leo AI conversation link copied to clipboard!');
    }
  };

  if (currentRoute === '/admin') {
    return (
      <AdminPortalPage
        onExit={() => {
          setCurrentRoute('/');
          if (window.location.hash) {
            window.location.hash = '';
          }
          if (window.location.pathname.includes('/admin')) {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  // Gate: don't render the chat interface (or any of its data) until the
  // user has actually logged in. Only the login modal is shown.
  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 w-full h-full h-[100dvh] bg-[#dcd6eb] flex items-center justify-center overflow-hidden font-sans">
        <div className="hidden md:block absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-purple-300/40 blur-[100px] pointer-events-none -z-10" />
        <div className="hidden md:block absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-300/30 blur-[120px] pointer-events-none -z-10" />

        <div className="text-center space-y-4 px-6">
          <h1 className="font-display font-bold text-2xl text-neutral-800">Leo AI</h1>
          <p className="text-sm text-neutral-500">Please sign in to start chatting.</p>
          <button
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-500/20 transition"
          >
            Sign in
          </button>
        </div>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          user={user}
          onUserUpdate={setUser}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full h-[100dvh] max-w-[100vw] bg-white md:bg-[#dcd6eb] text-neutral-900 flex flex-col md:relative md:h-screen md:p-4 lg:p-6 md:flex-row md:items-center md:justify-center overflow-hidden font-sans select-none">
      {/* Background Soft Atmospheric Ambient Glowing Blobs (Visible only on desktop md:) */}
      <div className="hidden md:block absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-purple-300/40 blur-[100px] pointer-events-none -z-10" />
      <div className="hidden md:block absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-300/30 blur-[120px] pointer-events-none -z-10" />
      <div className="hidden md:block absolute top-[30%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-pink-200/25 blur-[90px] pointer-events-none -z-10" />

      {/* Main Container: Edge-to-edge native full-screen on mobile, Floating luxury card on desktop */}
      <div className="w-full h-full md:h-[92vh] md:max-w-7xl bg-white md:bg-white/95 md:backdrop-blur-xl border-0 md:border md:border-white/80 rounded-none md:rounded-3xl md:shadow-2xl md:shadow-purple-900/10 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenExplore={() => setIsExploreOpen(true)}
          onOpenLibrary={() => setIsPromptLibraryOpen(true)}
          onOpenFiles={() => setIsPromptLibraryOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSearchModal={() => setIsCommandPaletteOpen(true)}
        />

        {/* Right Main Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#fdfcff] overflow-hidden">
          {/* Top Header Bar */}
          <Header
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            activeSession={activeSession}
            onOpenExport={() => setIsExportOpen(true)}
            onShare={handleShare}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
          />

          {/* Body Content: Welcome Hero OR Active Chat */}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {!activeSession || activeSession.messages.length === 0 ? (
              <HeroState
                user={user}
                onSendMessage={handleSendMessage}
                onOpenSavedPrompts={() => setIsPromptLibraryOpen(true)}
                onOpenHelp={() => setIsHelpOpen(true)}
                onOpenLanguage={() => alert('Leo AI supports over 95 languages automatically. Simply type in any language!')}
                onOpenDiscord={() => window.open('https://discord.gg', '_blank')}
              />
            ) : (
              <ChatView
                messages={activeSession.messages}
                isLoading={isLoading}
                onSendMessage={handleSendMessage}
                onRegenerate={handleRegenerate}
                user={user}
                onOpenSavedPrompts={() => setIsPromptLibraryOpen(true)}
              />
            )}
          </main>
        </div>
      </div>

      {/* Modals for Users */}
      <PromptLibraryModal
        isOpen={isPromptLibraryOpen}
        onClose={() => setIsPromptLibraryOpen(false)}
        onSelectPrompt={(p) => handleSendMessage(p)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        onUserUpdate={setUser}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        session={activeSession}
      />

      <ExploreModal
        isOpen={isExploreOpen}
        onClose={() => setIsExploreOpen(false)}
        onSelectWorkflow={(p) => handleSendMessage(p)}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        sessions={sessions}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setIsCommandPaletteOpen(false);
        }}
        onNewChat={handleNewChat}
        onOpenSavedPrompts={() => {
          setIsCommandPaletteOpen(false);
          setIsPromptLibraryOpen(true);
        }}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
