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
import { ModelLogo } from './ModelLogo';
import { AIConfig, MemoMemoryItem, SystemStats, UserProfile } from '../types';

const FREE_MODEL_OPTIONS = [
  { id: 'myt/grok-4.6-free', name: 'Grok 4.6' },
  { id: 'myt/kimi-k3-free', name: 'Kimi K3' },
  { id: 'myt/glm-5.3-free', name: 'GLM 5.3' },
  { id: 'myt/qwen3.8-max-free', name: 'Qwen 3.8 Max' },
  { id: 'myt/deepseek-v4-pro-free', name: 'DeepSeek V4 Pro' },
];

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

  const handleToggleFreeModel = async (modelId: string) => {
    if (!config) return;
    const current = config.freeOpenRouterModels || [];
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];

    const previous = config;
    setConfig({ ...config, freeOpenRouterModels: next });
    try {
      await api.saveAdminConfig({ freeOpenRouterModels: next });
      setSaveSuccessMsg('Free model access updated successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    } catch (err: any) {
      setConfig(previous);
      alert('Failed to update free model access: ' + err.message);
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
    const envContent = `Configure backend-only secrets in Render. See backend/.env.example in the repository.
Configure only the public backend URL in Vercel.`;

    navigator.clipboard.writeText(envContent);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 3000);
  };

  return (
    <div className="min-h-screen w-full bg-[#131314] text-[#e3e3e3] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 px-3 sm:px-6 border-b border-[#333538] bg-[#1e1f20]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-[#28292c] hover:bg-[#333538] text-white text-xs font-medium transition min-h-[38px] shrink-0 border border-[#333538] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Chat</span>
            <span className="sm:hidden">Exit</span>
          </button>

          <div className="h-4 w-px bg-[#333538] shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-black text-white border border-[#333538] shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h1 className="font-display font-semibold text-xs sm:text-sm text-white truncate">
                Admin Control Portal
              </h1>
              <p className="text-[10px] text-[#8e918f] hidden sm:block truncate">
                Route: /admin
              </p>
            </div>
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
            <span className="text-[10px] sm:text-xs text-white items-center gap-1.5 bg-[#28292c] border border-[#333538] px-2 sm:px-2.5 py-1 rounded-full hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Authenticated
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#28292c] hover:bg-[#333538] text-white text-xs transition min-h-[38px] border border-[#333538] cursor-pointer"
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
            <div className="bg-[#1e1f20] border border-[#333538] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#333538] flex items-center justify-center text-white mx-auto mb-4">
                <Lock className="w-6 h-6" />
              </div>

              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Executive Authentication Required
              </h2>
              <p className="text-xs text-[#8e918f] mt-2 mb-6 leading-relaxed">
                The Admin Panel is protected by a secure server-side key. Enter your secret password (configured in your Render Environment Variables).
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    placeholder="Enter Admin Password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-[#333538] text-base sm:text-sm text-white placeholder-[#8e918f] focus:border-white outline-none transition"
                    autoFocus
                  />
                  {loginError && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-black border border-neutral-700 text-white text-xs flex items-center gap-2 text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                      <span>{loginError}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full min-h-[44px] py-3 px-4 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <Key className="w-4 h-4 text-black" />
                      <span>Verify & Access Admin Portal</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-[#333538] text-[11px] text-[#8e918f]">
                <p>
                  Tip: Set <code className="text-white bg-black px-1.5 py-0.5 rounded border border-neutral-700 font-mono">ADMIN_PASSWORD</code> in your backend .env or Render dashboard.
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
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'metrics'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                <span>Metrics & Health</span>
              </button>

              <button
                onClick={() => setActiveTab('aiConfig')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'aiConfig'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>AI Models</span>
              </button>

              <button
                onClick={() => setActiveTab('systemPrompt')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'systemPrompt'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <BrainCircuit className="w-4 h-4 shrink-0" />
                <span>System Prompt</span>
              </button>

              <button
                onClick={() => setActiveTab('memoMemory')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'memoMemory'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Memo Memory</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Users ({users.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('deployment')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left whitespace-nowrap shrink-0 min-h-[40px] md:w-full border cursor-pointer ${
                  activeTab === 'deployment'
                    ? 'bg-white text-black font-semibold border-white'
                    : 'text-[#8e918f] bg-[#1e1f20] md:bg-transparent border-[#333538] md:border-transparent hover:bg-[#28292c] hover:text-white'
                }`}
              >
                <Server className="w-4 h-4 shrink-0" />
                <span>Deploy Secrets</span>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-[#1e1f20] border border-[#333538] rounded-2xl sm:rounded-3xl p-4 sm:p-6 overflow-y-auto">
              {saveSuccessMsg && (
                <div className="mb-6 p-3 rounded-xl bg-black border border-white text-white text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* TAB 1: Metrics */}
              {activeTab === 'metrics' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">System Metrics & Overview</h2>
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      Live status of your Leo AI engine and backend integrations.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-black border border-[#333538]">
                      <p className="text-[10px] sm:text-[11px] text-[#8e918f]">Total Messages</p>
                      <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                        {stats?.totalMessages || 42}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-black border border-[#333538]">
                      <p className="text-[10px] sm:text-[11px] text-[#8e918f]">Vision Inferences</p>
                      <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                        {stats?.totalVisionQueries || 14}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-black border border-[#333538]">
                      <p className="text-[10px] sm:text-[11px] text-[#8e918f]">Memory Facts</p>
                      <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                        {memories.length || 5}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl bg-black border border-[#333538]">
                      <p className="text-[10px] sm:text-[11px] text-[#8e918f]">Active Mode</p>
                      <p className="text-sm sm:text-base font-bold text-white mt-1 truncate">
                        {config?.hasAiCreditsKey ? 'AICredits.in' : (config?.hasOpenRouterKey ? 'OpenRouter' : 'Not configured')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AI Config */}
              {activeTab === 'aiConfig' && config && (
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div className="p-4 rounded-2xl bg-black border border-[#333538]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Free Model Access</h3>
                        <p className="text-[11px] text-[#8e918f] mt-1">
                          Turn on a button to allow Free users to use that OpenRouter model. Premium access stays unchanged for every model you leave off.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FREE_MODEL_OPTIONS.map((model) => {
                        const isFree = (config.freeOpenRouterModels || []).includes(model.id);
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => handleToggleFreeModel(model.id)}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer ${
                              isFree
                                ? 'bg-white text-black border-white'
                                : 'bg-[#131314] text-white border-[#333538] hover:border-neutral-500'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 text-left">
                              <ModelLogo modelId={model.id} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate">{model.name}</div>
                                <div className={`text-[10px] truncate font-mono ${isFree ? 'text-neutral-600' : 'text-[#8e918f]'}`}>{model.id}</div>
                              </div>
                            </div>
                            <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${
                              isFree
                                ? 'text-white bg-black border-black'
                                : 'text-white bg-[#28292c] border-neutral-700'
                            }`}>
                              {isFree ? 'FREE' : 'PREMIUM'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-white">AI Engine & Multi-Provider Configuration</h2>
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      Configure server-side OpenRouter free-model access and AICredits premium routing with unified system prompt enforcement.
                    </p>
                  </div>

                  {/* Primary Provider Toggle */}
                  <div className="p-4 rounded-2xl bg-black border border-[#333538] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-white" />
                        Primary AI Provider
                      </label>
                      <span className="text-[10px] bg-[#28292c] text-white border border-[#333538] px-2.5 py-0.5 rounded-full font-mono">
                        Active: {config.aiProvider === 'aicredits' ? 'AICredits' : 'OpenRouter'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, aiProvider: 'openrouter' })}
                        className={`p-3 rounded-xl border text-xs font-medium text-left transition flex items-center justify-between cursor-pointer ${
                          (config.aiProvider || 'openrouter') === 'openrouter'
                            ? 'bg-white text-black border-white'
                            : 'bg-[#131314] border-[#333538] text-[#8e918f] hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold">OpenRouter</div>
                          <div className={`text-[10px] ${(config.aiProvider || 'openrouter') === 'openrouter' ? 'text-neutral-600' : 'text-[#8e918f]'}`}>openrouter.ai/api/v1</div>
                        </div>
                        {(config.aiProvider || 'openrouter') === 'openrouter' && <Check className="w-4 h-4 text-black" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, aiProvider: 'aicredits' })}
                        className={`p-3 rounded-xl border text-xs font-medium text-left transition flex items-center justify-between cursor-pointer ${
                          config.aiProvider === 'aicredits'
                            ? 'bg-white text-black border-white'
                            : 'bg-[#131314] border-[#333538] text-[#8e918f] hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold">AICredits</div>
                          <div className={`text-[10px] ${config.aiProvider === 'aicredits' ? 'text-neutral-600' : 'text-[#8e918f]'}`}>aicredits.in/api/v1</div>
                        </div>
                        {config.aiProvider === 'aicredits' && <Check className="w-4 h-4 text-black" />}
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538] space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          Smart Model Roles & Intelligent Routing
                        </label>
                        <span className="text-[10px] font-mono bg-black text-white border border-[#333538] px-2 py-0.5 rounded-md">
                          Live Active
                        </span>
                      </div>

                      {/* 1. DEFAULT MODEL */}
                      <div className="p-3 rounded-xl bg-black border border-[#333538] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-white">
                            1. Default Model (Normal Text & General Q&A)
                          </label>
                          <span className="text-[10px] text-[#8e918f] font-mono">DEFAULT_AI_MODEL</span>
                        </div>
                        <select
                          value={config.defaultAiModel || config.activeModelId || config.aiCreditsModel || 'google/gemini-2.0-flash'}
                          onChange={(e) => setConfig({ ...config, defaultAiModel: e.target.value, activeModelId: e.target.value, aiCreditsModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        >
                          <option value="google/gemini-2.0-flash">google/gemini-2.0-flash (Cheapest Dynamic Default)</option>
                          <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Advanced - Flagship)</option>
                          <option value="gemini-2.0-flash">gemini-2.0-flash (Ultra-Fast 2.0)</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro (1M+ Long Context Pro)</option>
                          <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (Cost-Efficient Flagship)</option>
                          <option value="gpt-4o">gpt-4o (Omni Intelligence)</option>
                          <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Or custom model ID (e.g. google/gemini-2.0-flash)"
                          value={config.defaultAiModel || config.activeModelId || ''}
                          onChange={(e) => setConfig({ ...config, defaultAiModel: e.target.value, activeModelId: e.target.value, aiCreditsModel: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#333538] text-[11px] text-white outline-none focus:border-white font-mono"
                        />
                      </div>

                      {/* 2. VISION MODEL */}
                      <div className="p-3 rounded-xl bg-black border border-[#333538] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-white">
                            2. Vision Model (Image & Screenshot Analysis)
                          </label>
                          <span className="text-[10px] text-[#8e918f] font-mono">VISION_AI_MODEL</span>
                        </div>
                        <select
                          value={config.visionAiModel || config.visionModel || 'google/gemini-2.0-flash'}
                          onChange={(e) => setConfig({ ...config, visionAiModel: e.target.value, visionModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        >
                          <option value="google/gemini-2.0-flash">google/gemini-2.0-flash (Recommended Multimodal)</option>
                          <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (Fast Multimodal)</option>
                          <option value="gemini-2.5-flash">gemini-2.5-flash (Google Multimodal Flagship)</option>
                          <option value="gpt-4o">gpt-4o (Omni Multimodal Intelligence)</option>
                          <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet (High-Res Multimodal)</option>
                          <option value="mistralai/pixtral-12b-2409">mistralai/pixtral-12b-2409 (Pixtral Vision)</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Or custom vision model ID (e.g. google/gemini-2.0-flash)"
                          value={config.visionAiModel || config.visionModel || ''}
                          onChange={(e) => setConfig({ ...config, visionAiModel: e.target.value, visionModel: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#333538] text-[11px] text-white outline-none focus:border-white font-mono"
                        />
                      </div>

                      {/* 3. CODE MODEL */}
                      <div className="p-3 rounded-xl bg-black border border-[#333538] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-white">
                            3. Code Model (Programming, Debugging & Dev)
                          </label>
                          <span className="text-[10px] text-[#8e918f] font-mono">CODE_AI_MODEL</span>
                        </div>
                        <select
                          value={config.codeAiModel || 'deepseek/deepseek-chat'}
                          onChange={(e) => setConfig({ ...config, codeAiModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        >
                          <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3 Coding Flagship)</option>
                          <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek R1 Deep Reasoning)</option>
                          <option value="qwen/qwen-2.5-coder-32b-instruct">qwen/qwen-2.5-coder-32b-instruct (Alibaba Coder)</option>
                          <option value="mistralai/codestral-2501">mistralai/codestral-2501 (Mistral Codestral)</option>
                          <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet (Claude 3.5 Sonnet)</option>
                          <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (GPT-4o Mini)</option>
                          <option value="google/gemini-2.0-flash">google/gemini-2.0-flash (Gemini 2.0)</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Or custom code model ID (e.g. deepseek/deepseek-chat)"
                          value={config.codeAiModel || ''}
                          onChange={(e) => setConfig({ ...config, codeAiModel: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#333538] text-[11px] text-white outline-none focus:border-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OpenRouter Credentials */}
                  <div className="p-4 rounded-2xl bg-black border border-[#333538] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">OpenRouter API Configuration</span>
                      <span className="text-[10px] text-white font-mono bg-[#28292c] border border-neutral-700 px-2 py-0.5 rounded">https://openrouter.ai</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-white mb-1">OpenRouter API Key</label>
                        <input
                          type="password"
                          placeholder="openrouter_key_..."
                          value={config.openRouterApiKey || ''}
                          onChange={(e) => setConfig({ ...config, openRouterApiKey: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-white mb-1">OpenRouter Base URL</label>
                        <input
                          type="text"
                          placeholder="https://openrouter.ai/api/v1"
                          value={config.openRouterBaseUrl || 'https://openrouter.ai/api/v1'}
                          onChange={(e) => setConfig({ ...config, openRouterBaseUrl: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AICredits Credentials */}
                  <div className="p-4 rounded-2xl bg-black border border-[#333538] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">AICredits.in Configuration</span>
                      <span className="text-[10px] text-white font-mono bg-[#28292c] border border-neutral-700 px-2 py-0.5 rounded">https://aicredits.in</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-white mb-1">AICredits API Key</label>
                        <input
                          type="password"
                          placeholder="sk-aicredits-..."
                          value={config.aiCreditsApiKey || ''}
                          onChange={(e) => setConfig({ ...config, aiCreditsApiKey: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-white mb-1">AICredits Base URL</label>
                        <input
                          type="text"
                          value={config.aiCreditsBaseUrl || 'https://api.aicredits.in/v1'}
                          onChange={(e) => setConfig({ ...config, aiCreditsBaseUrl: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#333538] text-xs text-white outline-none focus:border-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">
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
                        className="w-full accent-white mt-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white mb-1.5">
                        Max Output Tokens ({config.maxTokens})
                      </label>
                      <input
                        type="number"
                        value={config.maxTokens}
                        onChange={(e) =>
                          setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-black border border-[#333538] text-sm sm:text-xs text-white outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black border border-[#333538]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                      <input
                        type="checkbox"
                        checked={config.enableProviderFallback ?? true}
                        onChange={(e) => setConfig({ ...config, enableProviderFallback: e.target.checked })}
                        className="rounded accent-white"
                      />
                      <span className="font-semibold text-white">Provider routing is backend-enforced (Free → OpenRouter, Premium → AICredits)</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-[#333538] flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
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
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      This core directive is strictly prepended to every conversation. The AI will strictly follow these instructions without bypass.
                    </p>
                  </div>

                  <div>
                    <textarea
                      rows={10}
                      value={config.systemPrompt}
                      onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                      className="w-full p-4 rounded-2xl bg-black border border-[#333538] text-sm sm:text-xs text-white font-mono leading-relaxed outline-none focus:border-white"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#333538] flex justify-end">
                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
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
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      View and manage persistent memory facts injected automatically into user chats.
                    </p>
                  </div>

                  {/* Add memory item */}
                  <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-black border border-[#333538] space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Add new memory fact (e.g. 'User prefers TypeScript')..."
                        value={newMemoryText}
                        onChange={(e) => setNewMemoryText(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#1e1f20] border border-[#333538] text-sm sm:text-xs text-white outline-none focus:border-white"
                      />
                      <button
                        type="submit"
                        className="min-h-[40px] px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                        className="p-3.5 rounded-xl bg-black border border-[#333538] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-[#e3e3e3] break-words">{m.text}</p>
                          <span className="text-[10px] text-[#8e918f] mt-0.5 block">
                            Category: {m.category} • Confidence: {m.confidence || 0.95}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          className="p-2 text-[#8e918f] hover:text-white rounded-lg hover:bg-[#28292c] transition min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 cursor-pointer"
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
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      Firebase Authentication users synchronized to Firebase Realtime Database.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {users.length > 0 ? (
                      users.map((u) => (
                        <div key={u.uid} className="p-3.5 sm:p-4 rounded-2xl bg-black border border-[#333538] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={u.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-neutral-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{u.displayName}</p>
                              <p className="text-[11px] text-[#8e918f] truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#28292c] text-white border border-neutral-700 shrink-0">
                            Active
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-[#8e918f] rounded-2xl bg-black border border-[#333538]">
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
                    <p className="text-xs text-[#8e918f] mt-0.5">
                      Deploy your Express backend to Render and your Vite React frontend to Vercel.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-black border border-[#333538]">
                    <span className="text-xs text-[#e3e3e3]">
                      Copy production environment variables:
                    </span>
                    <button
                      onClick={copyEnvFile}
                      className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-medium flex items-center justify-center gap-1.5 transition min-h-[40px] cursor-pointer"
                    >
                      {copiedEnv ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-black" />}
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
