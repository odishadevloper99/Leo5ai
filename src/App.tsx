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
import { getStoredSessions, saveStoredSessions } from './lib/storage';
import {
  auth,
  db,
  getCurrentStoredUser,
  saveChatToRealtimeDB,
  loadChatsFromRealtimeDB,
  deleteChatFromRealtimeDB
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { api } from './lib/api';
import { ChatSession, Message, UserProfile, AgentStepItem } from './types';
import { LeoLogo, LeoLogoMark } from './components/LeoLogo';

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
    return getStoredSessions();
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

  // Sync sessions safely to localStorage
  useEffect(() => {
    saveStoredSessions(sessions);
  }, [sessions]);

  // Reactive Firebase Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken().catch(() => '');
          let userProfile: UserProfile = {
            uid: fbUser.uid,
            googleId: fbUser.providerData?.[0]?.uid || fbUser.uid,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Leo Explorer',
            email: fbUser.email || '',
            photoURL:
              fbUser.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            isAnonymous: false,
            role: 'user',
            credits: 50,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            lastActive: Date.now(),
            chatCount: 0,
          };

          // 1. Sync with backend API to preserve credits & chat history
          try {
            if (idToken) {
              const backendRes = await api.loginWithGoogle({
                idToken,
                credential: idToken,
              });
              if (backendRes.success && backendRes.user) {
                userProfile = {
                  ...backendRes.user,
                  uid: fbUser.uid,
                  displayName: fbUser.displayName || backendRes.user.displayName,
                  email: fbUser.email || backendRes.user.email,
                  photoURL: fbUser.photoURL || backendRes.user.photoURL,
                };
                if (backendRes.token) {
                  localStorage.setItem('leo_auth_token', backendRes.token);
                }
              }
            }
          } catch (e) {}

          // 2. Sync with Firestore
          try {
            const userDocRef = doc(db, 'users', fbUser.uid);
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
              const data = snap.data();
              userProfile = {
                ...userProfile,
                credits: typeof data.credits === 'number' ? data.credits : userProfile.credits,
                createdAt: data.createdAt ? (typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || userProfile.createdAt) : userProfile.createdAt,
                chatCount: typeof data.chatCount === 'number' ? data.chatCount : userProfile.chatCount,
                role: data.role || userProfile.role,
              };
            } else {
              await setDoc(userDocRef, {
                userId: userProfile.uid,
                displayName: userProfile.displayName,
                email: userProfile.email,
                photoURL: userProfile.photoURL,
                role: userProfile.role,
                credits: userProfile.credits,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            }
          } catch (e) {}

          localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
          setUser(userProfile);
        } catch (err) {
          console.warn('[Firebase Auth State Sync Notice]:', err);
        }
      } else {
        const stored = localStorage.getItem('leo_current_user');
        if (!stored) {
          setUser({
            uid: 'guest-' + Date.now(),
            displayName: 'Guest',
            email: '',
            isAnonymous: true,
            role: 'user',
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load chats from Firebase Realtime Database and backend API on mount
  useEffect(() => {
    // Check for Google OAuth callback params (#auth_token=...&user=... or ?auth_error=...)
    try {
      const hash = window.location.hash;
      const search = window.location.search;

      if (hash.includes('auth_token=')) {
        const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));
        const authToken = hashParams.get('auth_token');
        const userJson = hashParams.get('user');

        if (authToken && userJson) {
          const parsedUser = JSON.parse(decodeURIComponent(userJson));
          localStorage.setItem('leo_auth_token', authToken);
          localStorage.setItem('leo_current_user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          setIsAuthOpen(false);
          // Clean up URL hash cleanly without reloading
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (search.includes('auth_error=')) {
        const searchParams = new URLSearchParams(search);
        const errorMsg = searchParams.get('auth_error');
        console.warn('[Leo AI Auth] OAuth Error Notice:', errorMsg);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('[Leo AI Auth] OAuth URL parse note:', e);
    }

    // 1. Try Firebase Realtime Database with robust error handling
    loadChatsFromRealtimeDB(user.uid)
      .then((rtdbChats) => {
        if (rtdbChats && rtdbChats.length > 0) {
          setSessions(rtdbChats);
          return;
        }
        // 2. Fallback to Express backend store
        api.getChats(user.uid)
          .then((backendChats) => {
            if (backendChats && backendChats.length > 0) {
              setSessions(backendChats);
            }
          })
          .catch((err) => {
            console.warn('[Leo AI Backend chats notice]:', err?.message || err);
          });
      })
      .catch((err) => {
        console.warn('[Leo AI RTDB chats notice]:', err?.message || err);
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
  useEffect(() => {
    if (!isLoggedIn && currentRoute !== '/admin') {
      setIsAuthOpen(true);
    }
  }, [isLoggedIn, currentRoute]);

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
    const assistantMsgId = 'msg-' + (Date.now() + 1);
    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      isDeepResearch,
      currentAgentAction: undefined,
      agentSteps: [],
      searchSources: []
    };

    const messagesWithAssistant = [...updatedMessages, initialAssistantMessage];

    // Optimistically update UI
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSession!.id
          ? { ...s, messages: messagesWithAssistant, updatedAt: Date.now() }
          : s
      )
    );

    setIsLoading(true);

    try {
      let accumulatedContent = '';
      let liveThinking = '';
      let liveQueries: string[] = [];
      let liveSteps: AgentStepItem[] = [];
      let liveSources: { title: string; url: string }[] = [];
      let currentAction: string | undefined = undefined;

      // Call backend AI chat endpoint with real-time SSE live agent events
      const response = await api.sendChatStream(
        {
          messages: updatedMessages,
          userId: user.uid,
          images,
          isDeepResearch,
          model: selectedModel,
        },
        (event) => {
          if (event.type === 'agent_start') {
            currentAction = event.message || 'Thinking…';
          } else if (event.type === 'thinking') {
            currentAction = event.message || 'Thinking…';
            if (typeof event.data === 'string' && event.data) {
              liveThinking = event.data;
            } else if (event.chunk) {
              liveThinking += event.chunk;
            }
          } else if (event.type === 'planning') {
            currentAction = event.message || 'Planning next steps…';
          } else if (event.type === 'tool_start') {
            currentAction = event.message || `Running tool ${event.tool}…`;
            if (event.input?.query && typeof event.input.query === 'string') {
              const q = event.input.query.trim();
              if (q && !liveQueries.includes(q)) {
                liveQueries.push(q);
              }
            } else if (event.input?.command && typeof event.input.command === 'string') {
              const c = `Command: ${event.input.command.trim()}`;
              if (!liveQueries.includes(c)) {
                liveQueries.push(c);
              }
            }
            if (event.tool && event.input) {
              liveSteps = [
                ...liveSteps,
                {
                  tool: event.tool,
                  input: event.input,
                  output: 'Executing…',
                  success: true
                }
              ];
            }
          } else if (event.type === 'tool_result') {
            currentAction = event.message || 'Tool execution completed';
            if (event.sources && event.sources.length > 0) {
              for (const src of event.sources) {
                if (!liveSources.some((s) => s.url === src.url)) {
                  liveSources.push(src);
                }
              }
            }
            if (liveSteps.length > 0) {
              const lastStep = liveSteps[liveSteps.length - 1];
              lastStep.output = event.outputSummary || (event.success ? 'Completed' : 'Failed');
              lastStep.durationMs = event.durationMs;
              lastStep.success = event.success;
              if (event.sources) lastStep.sources = event.sources;
              liveSteps = [...liveSteps];
            }
          } else if (event.type === 'analyzing') {
            currentAction = event.message || 'Analyzing results…';
          } else if (event.type === 'generating') {
            currentAction = event.message || 'Writing response…';
          }

          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSession!.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            currentAgentAction: currentAction,
                            thinkingProcess: liveThinking || m.thinkingProcess,
                            searchQueries: liveQueries.length > 0 ? liveQueries : m.searchQueries,
                            agentSteps: liveSteps.length > 0 ? liveSteps : m.agentSteps,
                            searchSources: liveSources.length > 0 ? liveSources : m.searchSources,
                            searched: liveSources.length > 0 || liveQueries.length > 0 || m.searched
                          }
                        : m
                    )
                  }
                : s
            )
          );
        },
        (chunk) => {
          accumulatedContent += chunk;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSession!.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content: accumulatedContent,
                            status: 'streaming'
                          }
                        : m
                    )
                  }
                : s
            )
          );
        }
      );

      const finalAssistantMessage: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.content || accumulatedContent,
        timestamp: Date.now(),
        isDeepResearch,
        searched: response.searched || liveSources.length > 0,
        searchQueries: response.searchQueries,
        searchSources: response.searchSources || liveSources,
        thinkingProcess: response.thinkingProcess,
        agentSteps: response.agentSteps || (liveSteps.length > 0 ? liveSteps : undefined),
        iterations: response.iterations,
        modelUsed: response.model,
        status: 'completed',
        currentAgentAction: undefined
      };

      const finalMessages = [...updatedMessages, finalAssistantMessage];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession!.id
            ? { ...s, messages: finalMessages, updatedAt: Date.now(), model: selectedModel }
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
        id: assistantMsgId,
        role: 'assistant',
        content: `⚠️ **Leo AI Communication Error**: ${err.message || 'Unable to connect to AI engine'}. Please try again.`,
        timestamp: Date.now(),
        status: 'error',
        currentAgentAction: undefined
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
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
      }
    } catch (e) {}
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

  return (
    <div className="fixed inset-0 w-full h-full h-[100dvh] max-w-[100vw] bg-[#000000] text-zinc-100 flex overflow-hidden font-sans select-none">
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
        onOpenSettings={() => setIsExploreOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Right Main Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-[#000000] overflow-hidden relative">
        {/* Top Header Bar */}
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          activeSession={activeSession}
          onOpenExport={() => setIsExportOpen(true)}
          onShare={handleShare}
          onOpenUpgrade={() => setIsExploreOpen(true)}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          userPlan={user.plan}
        />

        {/* Body Content: Welcome Hero OR Active Chat */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#000000]">
          {!activeSession || activeSession.messages.length === 0 ? (
            <HeroState
              user={user}
              onSendMessage={handleSendMessage}
              onOpenSavedPrompts={() => setIsPromptLibraryOpen(true)}
              onOpenHelp={() => setIsHelpOpen(true)}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isSidebarOpen={isSidebarOpen}
              onOpenAuth={() => setIsAuthOpen(true)}
              onOpenUpgrade={() => setIsExploreOpen(true)}
              selectedModel={selectedModel}
            />
          ) : (
            <ChatView
              messages={activeSession.messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onRegenerate={handleRegenerate}
              user={user}
              onOpenSavedPrompts={() => setIsPromptLibraryOpen(true)}
              selectedModel={selectedModel}
            />
          )}
        </main>
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
