import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Cpu,
  BrainCircuit,
  Sliders,
  Users,
  Database,
  Key,
  Check,
  AlertCircle,
  Sparkles,
  Server,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { api } from '../lib/api';
import { AIConfig, MemoMemoryItem, SystemStats, UserProfile } from '../types';

interface AdminPortalPageProps {
  onExit: () => void;
}

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({ onExit }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'metrics' | 'aiConfig' | 'systemPrompt' | 'memoMemory' | 'users' | 'deployment'
  >('metrics');

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [memories, setMemories] = useState<MemoMemoryItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [copiedEnv, setCopiedEnv] = useState(false);

  // New Memory Form
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<
    'preference' | 'fact' | 'project' | 'general'
  >('preference');

  // Check if existing token works on mount
  useEffect(() => {
    if (api.getAdminToken()) {
      loadAdminData();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      await api.adminLogin(passwordInput);
      setIsAuthenticated(true);
      await loadAdminData();
    } catch (err: any) {
      setLoginError(
        err.message ||
          'Invalid password. Check your ADMIN_PASSWORD backend environment secret.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loadAdminData = async () => {
    setIsLoadingData(true);
    try {
      const [statsData, configData, memoryData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminConfig(),
        api.getMemories('default-user'),
        api.getAdminUsers(),
      ]);

      setStats(statsData);
      setConfig(configData);
      setMemories(memoryData);
      setUsers(usersData.users || []);
      setIsAuthenticated(true);
    } catch (err) {
      setIsAuthenticated(false);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      await api.saveAdminConfig(config);
      setSaveSuccessMsg('System configuration saved & deployed successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to save config: ' + err.message);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    try {
      const added = await api.addMemory({
        userId: 'default-user',
        text: newMemoryText,
        category: newMemoryCategory,
      });
      setMemories((prev) => [added, ...prev]);
      setNewMemoryText('');
    } catch (err: any) {
      alert('Failed to save memory: ' + err.message);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await api.deleteMemory(memoryId, 'default-user');
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch (err: any) {
      alert('Failed to delete memory: ' + err.message);
    }
  };

  const handleLogout = () => {
    api.adminLogout();
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  const copyEnvFile = () => {
    const envContent = `# Backend (Render) Environment Variables
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=your_secure_admin_password_here
AICREDITS_API_KEY=your_aicredits_api_key_here
AICREDITS_BASE_URL=https://aicredits.in/api/v1
MEMO_API_KEY=your_memo_api_key_here
MEMO_BASE_URL=https://api.memo.dev/v1
MONGODB_URI=mongodb+srv://admin:pass@cluster.mongodb.net/leoai

# Frontend (Vercel) Environment Variables
VITE_BACKEND_URL=https://your-render-service.onrender.com
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=leo-ai-production.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=leo-ai-production
VITE_FIREBASE_STORAGE_BUCKET=leo-ai-production.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=507367657580
VITE_FIREBASE_APP_ID=1:507367657580:web:abcd1234
VITE_FIREBASE_DATABASE_URL=https://leo-ai-production-default-rtdb.firebaseio.com`;

    navigator.clipboard.writeText(envContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 px-3 sm:px-6 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition min-h-[38px] shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Chat</span>
            <span className="sm:hidden">Exit</span>
          </button>

          <div className="h-4 w-px bg-neutral-700 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h1 className="font-display font-semibold text-xs sm:text-sm text-white truncate">
                Admin Control Portal
              </h1>
              <p className="text-[10px] text-neutral-400 hidden sm:block truncate">
                Route: /admin
              </p>
            </div>
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
            <span className="text-[10px] sm:text-xs text-emerald-400 items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/60 px-2 sm:px-2.5 py-1 rounded-full hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Authenticated
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition min-h-[38px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="flex-1 flex flex-col p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
        {!isAuthenticated ? (
          /* Password Authentication Screen */
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
                <Lock className="w-6 h-6" />
              </div>

              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Executive Authentication Required
              </h2>
              <p className="text-xs text-neutral-400 mt-2 mb-6 leading-relaxed">
                The Admin Panel is protected by a secure server-side key. Enter your secret password (configured in your Render Environment Variables).
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="Enter Admin Password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-base sm:text-sm text-white placeholder-neutral-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                    autoFocus
                  />
                  {loginError && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2 text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full min-h-[44px] py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Verify & Access Admin Portal</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-neutral-800 text-[11px] text-neutral-500">
                <p>
                  Tip: Set <code className="text-purple-400 bg-neutral-950 px-1 py-0.5 rounded">ADMIN_PASSWORD</code> in your backend .env or Render dashboard.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Full Admin Dashboard */
          <div className="flex flex-col md:flex-row gap-4 sm:gap-6 flex-1">
            {/* Sidebar Navigation: Horizontal Pill bar on Mobile / Android & Vertical on Desktop */}
            <div className="w-full md:w-64 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 md:gap-1 p-1 md:p-0 shrink-0 no-scrollbar">
              <button
                onClick={() => setActiveTab('metrics')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'metrics'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                <span>Metrics & Health</span>
              </button>

              <button
                onClick={() => setActiveTab('aiConfig')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'aiConfig'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>AI Models</span>
              </button>

              <button
                onClick={() => setActiveTab('systemPrompt')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'systemPrompt'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <BrainCircuit className="w-4 h-4 shrink-0" />
                <span>System Prompt</span>
              </button>

              <button
                onClick={() => setActiveTab('memoMemory')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'memoMemory'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Memo Memory</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'users'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Users ({users.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('deployment')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full ${
                  activeTab === 'deployment'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-neutral-400 bg-neutral-900 md:bg-transparent hover:bg-neutral-850 hover:text-neutral-200'
                }`}
              >
                <Server className="w-4 h-4 shrink-0" />
                <span>Deploy Secrets</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 overflow-y-auto">
              {saveSuccessMsg && (
                <div className="mb-6 p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* TAB 1: Metrics */}
              {activeTab === 'metrics' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">System Metrics & Overview</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Live status of your Leo AI engine and backend integrations.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                      <p className="text-[10px] sm:text-[11px] text-neutral-400">Total Messages</p>
                      <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                        {stats?.totalMessages || 42}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                      <p className="text-[10px] sm:text-[11px] text-neutral-400">Vision Inferences</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-400 mt-1">
                        {stats?.totalVisionQueries || 14}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                      <p className="text-[10px] sm:text-[11px] text-neutral-400">Memory Facts</p>
                      <p className="text-xl sm:text-2xl font-bold text-indigo-400 mt-1">
                        {memories.length || 5}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                      <p className="text-[10px] sm:text-[11px] text-neutral-400">Active Mode</p>
                      <p className="text-sm sm:text-base font-bold text-emerald-400 mt-1 truncate">
                        {config?.aiCreditsApiKey ? 'AICredits.in' : 'Gemini / Cloud'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AI Config */}
              {activeTab === 'aiConfig' && config && (
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">AI Engine & Vision Configuration</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Configure your AICredits.in endpoints, cost-effective vision models, and inference parameters.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        AICredits API Base URL
                      </label>
                      <input
                        type="text"
                        value={config.aiCreditsBaseUrl}
                        onChange={(e) => setConfig({ ...config, aiCreditsBaseUrl: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm sm:text-xs text-white outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Cheapest Vision Model (Multimodal & OCR)
                      </label>
                      <input
                        type="text"
                        value={config.visionModel}
                        onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm sm:text-xs text-white outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Temperature ({config.temperature})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={config.temperature}
                        onChange={(e) =>
                          setConfig({ ...config, temperature: parseFloat(e.target.value) })
                        }
                        className="w-full accent-purple-500 mt-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Max Output Tokens ({config.maxTokens})
                      </label>
                      <input
                        type="number"
                        value={config.maxTokens}
                        onChange={(e) =>
                          setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm sm:text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-800 flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save AI Configuration</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: System Prompt */}
              {activeTab === 'systemPrompt' && config && (
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">System Prompt Enforcement</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      This core directive is strictly prepended to every conversation. The AI will strictly follow these instructions without bypass.
                    </p>
                  </div>

                  <div>
                    <textarea
                      rows={10}
                      value={config.systemPrompt}
                      onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                      className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-sm sm:text-xs text-white font-mono leading-relaxed outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-neutral-800 flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Deploy System Prompt</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 4: Memo API Memory */}
              {activeTab === 'memoMemory' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">Memo API Memory Persistence</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      View and manage persistent memory facts injected automatically into user chats.
                    </p>
                  </div>

                  {/* Add memory item */}
                  <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add new memory fact (e.g. 'User prefers TypeScript')..."
                        value={newMemoryText}
                        onChange={(e) => setNewMemoryText(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm sm:text-xs text-white outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        className="min-h-[40px] px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Memory</span>
                      </button>
                    </div>
                  </form>

                  {/* List of memories */}
                  <div className="space-y-2">
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-neutral-200 break-words">{m.text}</p>
                          <span className="text-[10px] text-neutral-500 mt-0.5 block">
                            Category: {m.category} • Confidence: {m.confidence || 0.95}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          className="p-2 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-900 transition min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: Users & RTDB */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">Users & Database Synchronization</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Firebase Authentication users synchronized to Firebase Realtime Database.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {users.length > 0 ? (
                      users.map((u) => (
                        <div key={u.uid} className="p-3.5 sm:p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={u.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-400 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{u.displayName}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                            Active
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-neutral-500 rounded-2xl bg-neutral-950 border border-neutral-800">
                        No registered users found in Realtime Database.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: Deployment */}
              {activeTab === 'deployment' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">Cloud Production Deployment (Render + Vercel)</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Deploy your Express backend to Render and your Vite React frontend to Vercel.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/50">
                    <span className="text-xs text-purple-200">
                      Copy production environment variables:
                    </span>
                    <button
                      onClick={copyEnvFile}
                      className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition min-h-[40px] cursor-pointer"
                    >
                      {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEnv ? 'Copied to Clipboard!' : 'Copy .env Config'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
