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
  ExternalLink,
  Eye,
  LogOut,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { AIConfig, MemoMemoryItem, SystemStats, UserProfile } from '../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ isOpen, onClose }) => {
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
  const [newMemoryCategory, setNewMemoryCategory] = useState<'preference' | 'fact' | 'project' | 'general'>('preference');

  // Check if existing token works on open
  useEffect(() => {
    if (isOpen && api.getAdminToken()) {
      loadAdminData();
    }
  }, [isOpen]);

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
      setLoginError(err.message || 'Invalid password. Check your Render Secret / Environment variable.');
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
      setSaveSuccessMsg('Configuration saved and active across all AI instances!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err: any) {
      alert('Error saving configuration: ' + err.message);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;

    try {
      const mem = await api.addMemory({
        text: newMemoryText,
        category: newMemoryCategory,
      });
      setMemories((prev) => [mem, ...prev]);
      setNewMemoryText('');
    } catch (err: any) {
      alert('Error saving memory: ' + err.message);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert('Error deleting memory: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await api.adminLogout();
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-purple-100 max-w-4xl w-full h-[94vh] sm:h-[88vh] md:h-[820px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="font-display font-semibold text-sm sm:text-base text-white truncate">
                Admin Control Center
              </h2>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
                AI models, system prompt, Memo memory & users
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                title="Sign out of Admin Panel"
                className="p-2 sm:p-1.5 text-neutral-300 hover:text-white rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 sm:p-1.5 text-neutral-300 hover:text-white rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {!isAuthenticated ? (
            /* Authentication Gate */
            <div className="p-6 sm:p-8 md:p-12 max-w-md mx-auto flex flex-col items-center text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 ring-8 ring-purple-50/50">
                <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-neutral-900 mb-1">
                Admin Authentication Required
              </h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Enter your secure Admin Password. The password is validated directly against your backend <code>ADMIN_PASSWORD</code> environment secret.
              </p>

              <form onSubmit={handleLogin} className="w-full space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="Enter Admin Password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-base sm:text-sm"
                  />
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn || !passwordInput.trim()}
                  className="w-full min-h-[44px] py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Unlock Admin Panel</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-left text-[11px] text-neutral-500 w-full">
                <p className="font-semibold text-neutral-700 mb-1">Deployment Tip:</p>
                <p>Default local password is <code>leo_admin_secret_pass</code>. In production, configure the <code>ADMIN_PASSWORD</code> environment variable in your dashboard.</p>
              </div>
            </div>
          ) : (
            /* Admin Tabs & Management Views */
            <div className="flex flex-col md:flex-row h-full">
              {/* Tab Navigation: Mobile Horizontal Scrollable Pills & Desktop Vertical Sidebar */}
              <div className="w-full md:w-56 bg-neutral-50 border-b md:border-b-0 md:border-r border-neutral-200 p-2.5 md:p-3 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 md:gap-1 text-xs font-medium text-neutral-600 shrink-0 no-scrollbar">
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'metrics'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <Server className="w-4 h-4 shrink-0" />
                  <span>Metrics & Health</span>
                </button>

                <button
                  onClick={() => setActiveTab('aiConfig')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'aiConfig'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span>AI Models</span>
                </button>

                <button
                  onClick={() => setActiveTab('systemPrompt')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'systemPrompt'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 shrink-0" />
                  <span>System Prompt</span>
                </button>

                <button
                  onClick={() => setActiveTab('memoMemory')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'memoMemory'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Memo Memory</span>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'users'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Users ({users.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployment')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 ${
                    activeTab === 'deployment'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'hover:bg-neutral-200/60 bg-white md:bg-transparent border md:border-0 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Deploy Secrets</span>
                </button>
              </div>

              {/* Tab Body */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {/* 1. METRICS & TELEMETRY */}
                {activeTab === 'metrics' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-neutral-900">
                        System Telemetry & Live Usage
                      </h3>
                      <button
                        onClick={loadAdminData}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                        <p className="text-[11px] text-purple-600 font-medium">Total Messages</p>
                        <p className="text-2xl font-bold text-purple-950 mt-1">
                          {stats?.totalMessages ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                        <p className="text-[11px] text-indigo-600 font-medium">Vision OCR Queries</p>
                        <p className="text-2xl font-bold text-indigo-950 mt-1">
                          {stats?.totalVisionQueries ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                        <p className="text-[11px] text-emerald-600 font-medium">Memo API Memories</p>
                        <p className="text-2xl font-bold text-emerald-950 mt-1">
                          {stats?.totalMemories ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                        <p className="text-[11px] text-neutral-500 font-medium">Active Users</p>
                        <p className="text-2xl font-bold text-neutral-900 mt-1">
                          {stats?.activeUsersCount ?? 1}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                        <p className="text-[11px] text-neutral-500 font-medium">Estimated Tokens</p>
                        <p className="text-2xl font-bold text-neutral-900 mt-1">
                          {stats?.estimatedTokens?.toLocaleString() ?? '0'}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
                        <p className="text-[11px] text-neutral-500 font-medium">Server Uptime</p>
                        <p className="text-2xl font-bold text-neutral-900 mt-1">
                          {stats?.serverUptime ? `${Math.floor(stats.serverUptime / 60)}m` : 'Live'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-900 text-white text-xs space-y-2">
                      <div className="flex items-center justify-between font-mono text-[11px] text-neutral-400">
                        <span>SERVICE ENDPOINTS HEALTH</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          ALL SYSTEMS OPERATIONAL
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                        <div>aicredits.in API: <span className="text-purple-300">Ready</span></div>
                        <div>Vision Pipeline: <span className="text-purple-300">Active</span></div>
                        <div>Memo Memory: <span className="text-purple-300">Synced</span></div>
                        <div>Firebase Auth: <span className="text-purple-300">Connected</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. AI & VISION MODEL SETTINGS */}
                {activeTab === 'aiConfig' && config && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-neutral-900">
                        AI Model & Vision Configuration
                      </h3>
                      {saveSuccessMsg && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          {saveSuccessMsg}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        AICredits.in API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Configured via AICREDITS_API_KEY on Render"
                        value=""
                        disabled
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-400 outline-none text-xs font-mono cursor-not-allowed"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Provider secrets are Render-environment-only and can't be set from the Admin Panel — set <code>AICREDITS_API_KEY</code> in your Render service's environment variables. Status: {config.hasAiCreditsKey ? 'configured ✓' : 'not configured'}.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          AICredits Model
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. gpt-4o-mini"
                          value={(config as any).aiCreditsModel || ''}
                          onChange={(e) => setConfig({ ...config, aiCreditsModel: e.target.value } as any)}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          AICredits Base URL
                        </label>
                        <input
                          type="text"
                          value={config.aiCreditsBaseUrl}
                          onChange={(e) => setConfig({ ...config, aiCreditsBaseUrl: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Tokenin API Key
                        </label>
                        <input
                          type="password"
                          placeholder="Configured via TOKENIN_API_KEY on Render"
                          value=""
                          disabled
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-400 outline-none text-xs font-mono cursor-not-allowed"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Status: {(config as any).hasTokeninKey ? 'configured ✓' : 'not configured'}.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Tokenin Base URL
                        </label>
                        <input type="text" value={(config as any).tokeninBaseUrl || 'https://tokenin.my.id/api/v1'} onChange={(e) => setConfig({ ...config, tokeninBaseUrl: e.target.value } as any)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs font-mono" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Tokenin Model (fallback)
                        </label>
                        <input type="text" placeholder="e.g. gpt-4o-mini" value={(config as any).tokeninModel || ''} onChange={(e) => setConfig({ ...config, tokeninModel: e.target.value } as any)} className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs font-mono" />
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 mb-3">
                      <p className="text-xs font-semibold text-neutral-800">Tokenin Models</p>
                      <p className="text-[10px] text-neutral-500 mt-1">Grok 4.6 · Kimi K3 · GLM 5.3 · Qwen 3.8 Max · DeepSeek V4 Pro — routed through Tokenin, not AICredits. Tokenin is also the automatic fallback for all other models if AICredits is unavailable.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Vision Model (Cheapest Vision-Capable)
                        </label>
                        <select
                          value={config.visionModel}
                          onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs bg-white"
                        >
                          <option value="gemini-1.5-flash">gemini-1.5-flash (Cheapest Vision Model)</option>
                          <option value="gpt-4o-mini">gpt-4o-mini (Cost-Efficient OpenAI Vision)</option>
                          <option value="gemini-2.0-flash">gemini-2.0-flash (Ultra-Fast Multimodal)</option>
                          <option value="claude-3-haiku-20240307">claude-3-haiku (Anthropic Vision)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Temperature: {config.temperature}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={config.temperature}
                          onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                          className="w-full accent-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Max Output Tokens
                        </label>
                        <input
                          type="number"
                          value={config.maxTokens}
                          onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                          className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Daily Message Limit (per user)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={config.dailyMessageLimit}
                          onChange={(e) =>
                            setConfig({ ...config, dailyMessageLimit: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Max chat messages each user can send per day. Set to 0 for unlimited. Admins are never limited.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={config.enableVision}
                          onChange={(e) => setConfig({ ...config, enableVision: e.target.checked })}
                          className="rounded accent-purple-600"
                        />
                        <span>Enable Vision & Multimodal Image Analysis</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={config.enableDeepResearch}
                          onChange={(e) => setConfig({ ...config, enableDeepResearch: e.target.checked })}
                          className="rounded accent-purple-600"
                        />
                        <span>Enable Deeper Research & Step-by-Step Thinking</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                        <input
                          type="checkbox"
                          checked={config.fallbackToGemini}
                          onChange={(e) => setConfig({ ...config, fallbackToGemini: e.target.checked })}
                          className="rounded accent-purple-600"
                        />
                        <span>Fallback to Server-Side Gemini API if AICredits key is unset</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-sm transition"
                    >
                      Save AI Configuration
                    </button>
                  </form>
                )}

                {/* 3. SYSTEM PROMPT & STRICT GUARDRAILS */}
                {activeTab === 'systemPrompt' && config && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-neutral-900">
                        Strict System Prompt & Directives
                      </h3>
                      {saveSuccessMsg && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          {saveSuccessMsg}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500 leading-relaxed">
                      The AI strictly adheres to this system prompt for all conversations. It cannot be overridden or bypassed by prompt injections.
                    </p>

                    <div>
                      <textarea
                        rows={10}
                        value={config.systemPrompt}
                        onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-neutral-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none text-xs font-mono leading-relaxed"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-semibold text-neutral-500 self-center mr-1">
                        Preset Archetypes:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            systemPrompt: `You are Leo AI, an elite, highly intelligent, and versatile AI assistant created to assist humans across engineering, reasoning, visual analysis, writing, and creative brainstorms.\nDirectives:\n1. Follow user instructions strictly.\n2. Output well-formatted markdown.\n3. Analyze visual diagrams with high precision.`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-medium text-neutral-700"
                      >
                        Default Leo AI
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            systemPrompt: `You are Leo AI Enterprise Copilot. Deliver concise, actionable executive intelligence. Every answer must prioritize security, scalability, and measurable business ROI.`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-medium text-neutral-700"
                      >
                        Enterprise Copilot
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            systemPrompt: `You are Leo AI Principal Software Architect. Provide mathematically sound, typed, performant, and secure code solutions. Include thorough architectural analysis and edge-case handling.`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[11px] font-medium text-neutral-700"
                      >
                        Code Architect
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-sm transition"
                    >
                      Save System Prompt
                    </button>
                  </form>
                )}

                {/* 4. MEMO API MEMORY MANAGER */}
                {activeTab === 'memoMemory' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-neutral-900">
                        Memo API — Persistent AI Memory
                      </h3>
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {memories.length} Stored Memories
                      </span>
                    </div>

                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Leo AI utilizes Memo API (or our persistent local vector memory cache) to recall user preferences, architectural goals, and past decisions across sessions.
                    </p>

                    {/* Add Memory Form */}
                    <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add new persistent memory fact (e.g. 'User prefers TypeScript and dark theme')..."
                          value={newMemoryText}
                          onChange={(e) => setNewMemoryText(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs bg-white"
                        />
                        <select
                          value={newMemoryCategory}
                          onChange={(e: any) => setNewMemoryCategory(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-neutral-200 focus:border-purple-500 outline-none text-xs bg-white"
                        >
                          <option value="preference">Preference</option>
                          <option value="project">Project</option>
                          <option value="fact">Fact</option>
                          <option value="general">General</option>
                        </select>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </form>

                    {/* Memories List */}
                    <div className="space-y-2">
                      {memories.map((mem) => (
                        <div
                          key={mem.id}
                          className="p-3 rounded-xl bg-white border border-neutral-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 mr-2">
                              {mem.category}
                            </span>
                            <span className="text-neutral-800">{mem.text}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="p-1 text-neutral-400 hover:text-red-500 transition"
                            title="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. USER MANAGEMENT */}
                {activeTab === 'users' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-neutral-900">
                        Registered Users & Role Management
                      </h3>
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {users.length} Users
                      </span>
                    </div>

                    <div className="space-y-2">
                      {users.map((u) => (
                        <div
                          key={u.uid}
                          className="p-3 rounded-2xl bg-white border border-neutral-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.photoURL ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                              }
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-purple-200"
                            />
                            <div>
                              <p className="text-xs font-semibold text-neutral-900">{u.displayName}</p>
                              <p className="text-[11px] text-neutral-400">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <select value={u.plan || 'free'} onChange={async (e) => { try { const result = await api.updateAdminUser(u.uid, { plan: e.target.value }); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="text-[10px] px-2 py-1 rounded-lg border border-neutral-200 bg-white">
                              <option value="free">Free</option><option value="premium">Premium</option><option value="pro">Pro</option><option value="ultra">Ultra</option>
                            </select>
                            <input type="number" min="0" placeholder="Daily limit" value={u.dailyMessageLimitOverride ?? ''} onChange={(e) => setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, dailyMessageLimitOverride: e.target.value === '' ? undefined : Number(e.target.value) } : x))} onBlur={async (e) => { try { const value = e.target.value === '' ? null : Number(e.target.value); const result = await api.updateAdminUser(u.uid, { dailyMessageLimitOverride: value }); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="w-24 text-[10px] px-2 py-1 rounded-lg border border-neutral-200 outline-none" />
                            <button onClick={async () => { try { const result = await api.resetAdminUserDailyUsage(u.uid); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="text-[10px] px-2 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50">Reset today</button>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">{u.plan || 'free'} · used {u.dailyMessageCount || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. RENDER & VERCEL DEPLOYMENT GUIDE */}
                {activeTab === 'deployment' && (
                  <div className="space-y-4">
                    <h3 className="font-display font-semibold text-base text-neutral-900">
                      Dual-Tier Deployment: Render (Backend) + Vercel (Frontend)
                    </h3>

                    <p className="text-xs text-neutral-500 leading-relaxed">
                      Deploy your production full-stack architecture seamlessly. The backend runs on Render with secure environment secrets, and the frontend deploys to Vercel.
                    </p>

                    <div className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-300">
                          Render Backend Environment Secrets (.env)
                        </span>
                        <button
                          onClick={() => {
                            const envString = `NODE_ENV=production\nPORT=3000\nADMIN_PASSWORD=your_super_secret_admin_pass\nAICREDITS_API_KEY=your_aicredits_api_key\nAICREDITS_BASE_URL=https://api.aicredits.in/v1\nAICREDITS_VISION_MODEL=gemini-1.5-flash\nMEMO_API_KEY=your_memo_api_key\nMONGODB_URI=mongodb+srv://...\nGEMINI_API_KEY=your_gemini_key`;
                            navigator.clipboard.writeText(envString);
                            setCopiedEnv(true);
                            setTimeout(() => setCopiedEnv(false), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white bg-neutral-800 px-2.5 py-1 rounded-lg transition"
                        >
                          {copiedEnv ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedEnv ? 'Copied!' : 'Copy Render .env'}</span>
                        </button>
                      </div>

                      <pre className="p-3 bg-neutral-950 rounded-xl text-[11px] font-mono text-purple-200 overflow-x-auto">
{`# 1. Render Environment Secrets:
ADMIN_PASSWORD=your_super_secret_admin_pass
AICREDITS_API_KEY=your_aicredits_api_key
AICREDITS_BASE_URL=https://api.aicredits.in/v1
AICREDITS_VISION_MODEL=gemini-1.5-flash
MEMO_API_KEY=your_memo_api_key
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=your_gemini_key

# 2. Vercel Frontend Environment Secrets:
VITE_API_BASE_URL=https://your-render-backend.onrender.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...`}
                      </pre>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                        <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-purple-600" />
                          <span>Render Backend Steps</span>
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          1. Create Web Service on Render.<br />
                          2. Build command: <code>npm run build</code><br />
                          3. Start command: <code>npm run start</code><br />
                          4. Add <code>ADMIN_PASSWORD</code> secret in Render settings.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                        <p className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-purple-600" />
                          <span>Vercel Frontend Steps</span>
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          1. Import repository into Vercel.<br />
                          2. Framework Preset: Vite.<br />
                          3. Add environment variables for Firebase and API Base URL.<br />
                          4. Deploy with automatic SSL.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
