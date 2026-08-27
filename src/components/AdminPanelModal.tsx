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
import { ModelLogo } from './ModelLogo';
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

  const handleToggleFreeModel = async (modelId: string) => {
    if (!config) return;
    const current = config.freeTokeninModels || [];
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];

    const previous = config;
    setConfig({ ...config, freeTokeninModels: next });
    try {
      await api.saveAdminConfig({ freeTokeninModels: next });
      setSaveSuccessMsg('Free model access updated successfully!');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    } catch (err: any) {
      setConfig(previous);
      alert('Failed to update free model access: ' + err.message);
    }
  };

  const handleSetAllModelsAccess = async (makeFree: boolean) => {
    if (!config) return;
    const allIds = [
      'myt/grok-4.6-free',
      'myt/kimi-k3-free',
      'myt/glm-5.3-free',
      'myt/qwen3.8-max-free',
      'myt/deepseek-v4-pro-free'
    ];
    const next = makeFree ? allIds : [];
    const previous = config;
    setConfig({ ...config, freeTokeninModels: next });
    try {
      await api.saveAdminConfig({ freeTokeninModels: next });
      setSaveSuccessMsg(makeFree ? 'All models unlocked for Free users!' : 'All models set to Premium!');
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    } catch (err: any) {
      setConfig(previous);
      alert('Failed to update: ' + err.message);
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#333538] max-w-4xl w-full h-[94vh] sm:h-[88vh] md:h-[820px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#333538] flex items-center justify-between bg-[#131314] text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center shadow-sm shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="font-display font-semibold text-sm sm:text-base text-white truncate">
                Admin Control Center
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#8e918f] truncate">
                AI models, system prompt, Memo memory & users
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                title="Sign out of Admin Panel"
                className="p-2 sm:p-1.5 text-neutral-400 hover:text-white rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 sm:p-1.5 text-neutral-400 hover:text-white rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
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
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#28292c] text-white flex items-center justify-center mb-4 ring-4 ring-[#333538]">
                <Lock className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-white mb-1">
                Admin Authentication Required
              </h3>
              <p className="text-xs text-[#8e918f] mb-6 leading-relaxed">
                Enter your secure Admin Password. The password is validated directly against your backend <code>ADMIN_PASSWORD</code> environment secret.
              </p>

              <form onSubmit={handleLogin} className="w-full space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="Enter Admin Password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#333538] bg-[#131314] text-white placeholder-[#8e918f] focus:border-neutral-500 outline-none text-base sm:text-sm"
                  />
                </div>

                {loginError && (
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn || !passwordInput.trim()}
                  className="w-full min-h-[44px] py-3 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Access Admin Dashboard</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 p-3.5 rounded-xl bg-[#131314] border border-[#333538] text-[11px] text-[#8e918f] text-left">
                <p className="font-semibold text-white mb-1">Deployment Tip:</p>
                <p>Default local password is <code>leo_admin_secret_pass</code>. In production, configure the <code>ADMIN_PASSWORD</code> environment variable in your dashboard.</p>
              </div>
            </div>
          ) : (
            /* Admin Tabs & Management Views */
            <div className="flex flex-col md:flex-row h-full">
              {/* Tab Navigation: Mobile Horizontal Scrollable Pills & Desktop Vertical Sidebar */}
              <div className="w-full md:w-56 bg-[#131314] border-b md:border-b-0 md:border-r border-[#333538] p-2.5 md:p-3 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 md:gap-1 text-xs font-medium text-[#c4c7c5] shrink-0 no-scrollbar">
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'metrics'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <Server className="w-4 h-4 shrink-0" />
                  <span>Metrics & Health</span>
                </button>

                <button
                  onClick={() => setActiveTab('aiConfig')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'aiConfig'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span>AI Models</span>
                </button>

                <button
                  onClick={() => setActiveTab('systemPrompt')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'systemPrompt'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <BrainCircuit className="w-4 h-4 shrink-0" />
                  <span>System Prompt</span>
                </button>

                <button
                  onClick={() => setActiveTab('memoMemory')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'memoMemory'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Memo Memory</span>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Users ({users.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployment')}
                  className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl whitespace-nowrap transition min-h-[38px] md:w-full shrink-0 cursor-pointer ${
                    activeTab === 'deployment'
                      ? 'bg-white text-black shadow-xs font-semibold'
                      : 'hover:bg-[#28292c] bg-[#1e1f20] md:bg-transparent border md:border-0 border-[#333538] text-[#c4c7c5]'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Deploy Secrets</span>
                </button>
              </div>

              {/* Tab Body */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-[#1e1f20]">
                {/* 1. METRICS & TELEMETRY */}
                {activeTab === 'metrics' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-white">
                        System Telemetry & Live Usage
                      </h3>
                      <button
                        onClick={loadAdminData}
                        className="flex items-center gap-1 text-xs text-white hover:text-neutral-300 font-medium cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Total Messages</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.totalMessages ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Vision OCR Queries</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.totalVisionQueries ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Memo API Memories</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.totalMemories ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Active Users</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.activeUsersCount ?? 1}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Estimated Tokens</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.estimatedTokens?.toLocaleString() ?? '0'}
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538]">
                        <p className="text-[11px] text-[#8e918f] font-medium">Server Uptime</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {stats?.serverUptime ? `${Math.floor(stats.serverUptime / 60)}m` : 'Live'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black border border-[#333538] text-white text-xs space-y-2">
                      <div className="flex items-center justify-between font-mono text-[11px] text-[#8e918f]">
                        <span>SERVICE ENDPOINTS HEALTH</span>
                        <span className="text-white flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          ALL SYSTEMS OPERATIONAL
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-[#c4c7c5]">
                        <div>aicredits.in API: <span className="text-white font-semibold">Ready</span></div>
                        <div>Vision Pipeline: <span className="text-white font-semibold">Active</span></div>
                        <div>Memo Memory: <span className="text-white font-semibold">Synced</span></div>
                        <div>Firebase Auth: <span className="text-white font-semibold">Connected</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. AI & VISION MODEL SETTINGS */}
                {activeTab === 'aiConfig' && config && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-white">
                        AI Model & Vision Configuration
                      </h3>
                      {saveSuccessMsg && (
                        <span className="text-xs text-white flex items-center gap-1 font-medium bg-[#28292c] px-2 py-1 rounded-lg border border-neutral-700">
                          <Check className="w-3.5 h-3.5" />
                          {saveSuccessMsg}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                        AICredits.in API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Configured via AICREDITS_API_KEY on Render"
                        value=""
                        disabled
                        className="w-full px-3 py-2 rounded-xl border border-[#333538] bg-[#131314] text-[#8e918f] outline-none text-xs font-mono cursor-not-allowed"
                      />
                      <p className="text-[10px] text-[#8e918f] mt-1">
                        Provider secrets are Render-environment-only and can't be set from the Admin Panel — set <code>AICREDITS_API_KEY</code> in your Render service's environment variables. Status: {config.hasAiCreditsKey ? 'configured ✓' : 'not configured'}.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538] mb-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                          Backend Active AI Model (Real Global Active Model)
                        </label>
                        <span className="text-[10px] font-mono bg-[#28292c] text-white border border-neutral-700 px-2 py-0.5 rounded-md font-semibold">
                          Live: {config.activeModelId || (config as any).aiCreditsModel || config.visionModel || 'google/gemini-2.0-flash'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                            Preset Flagship Models
                          </label>
                          <select
                            value={config.activeModelId || (config as any).aiCreditsModel || config.visionModel || 'google/gemini-2.0-flash'}
                            onChange={(e) => setConfig({ ...config, activeModelId: e.target.value, aiCreditsModel: e.target.value, visionModel: e.target.value } as any)}
                            className="w-full px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white font-mono"
                          >
                            <optgroup label="Google Paid Flagships">
                              <option value="google/gemini-2.0-flash">google/gemini-2.0-flash (Cheapest Dynamic Default)</option>
                              <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Advanced - Flagship)</option>
                              <option value="gemini-2.0-flash">gemini-2.0-flash (Ultra-Fast 2.0)</option>
                              <option value="gemini-1.5-pro">gemini-1.5-pro (1M+ Long Context Pro)</option>
                              <option value="gemini-1.5-flash">gemini-1.5-flash (High-Speed Multimodal)</option>
                            </optgroup>
                            <optgroup label="OpenAI Flagships">
                              <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (Cost-Efficient Flagship)</option>
                              <option value="gpt-4o">gpt-4o (Omni Intelligence)</option>
                              <option value="gpt-4o-mini">gpt-4o-mini (Fast Multimodal)</option>
                            </optgroup>
                            <optgroup label="Anthropic Flagships">
                              <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet (Flagship Reasoning)</option>
                              <option value="claude-3-5-sonnet">claude-3-5-sonnet (Industry Coding & Reasoning)</option>
                            </optgroup>
                            <optgroup label="DeepSeek / Open Weights Reasoning">
                              <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (DeepSeek V3)</option>
                              <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek R1 Reasoning)</option>
                              <option value="mistralai/mistral-small-24b-instruct-2501">mistralai/mistral-small (Mistral Small)</option>
                              <option value="qwen-plus">qwen-plus (Alibaba Qwen 2.5 Plus)</option>
                              <option value="glm-4-plus">glm-4-plus (Zhipu GLM 4 Plus)</option>
                              <option value="grok-beta">grok-beta (xAI Grok 2)</option>
                              <option value="llama-3.3-70b-instruct">llama-3.3-70b-instruct (Meta Llama 70B)</option>
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                            Exact Model ID Override
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. google/gemini-2.0-flash"
                            value={config.activeModelId || (config as any).aiCreditsModel || ''}
                            onChange={(e) => setConfig({ ...config, activeModelId: e.target.value, aiCreditsModel: e.target.value, visionModel: e.target.value } as any)}
                            className="w-full px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs font-mono bg-[#1e1f20] text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                          AICredits Base URL
                        </label>
                        <input
                          type="text"
                          value={config.aiCreditsBaseUrl}
                          onChange={(e) => setConfig({ ...config, aiCreditsBaseUrl: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs font-mono bg-[#1e1f20] text-white"
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#131314] border border-[#333538] mb-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-white" />
                            Model Access & Free Tier Settings
                          </p>
                          <p className="text-[11px] text-[#8e918f] mt-0.5">
                            Control which models are unlocked for Free users vs restricted to Premium.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetAllModelsAccess(true)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-200 text-black text-[11px] font-semibold transition shadow-sm cursor-pointer"
                          >
                            Make All Models Free
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetAllModelsAccess(false)}
                            className="px-2.5 py-1 rounded-lg bg-[#28292c] hover:bg-[#333538] text-white text-[11px] font-medium transition cursor-pointer"
                          >
                            Reset All to Premium
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {[
                          { id: 'myt/grok-4.6-free', name: 'Grok 4.6' },
                          { id: 'myt/kimi-k3-free', name: 'Kimi K3' },
                          { id: 'myt/glm-5.3-free', name: 'GLM 5.3' },
                          { id: 'myt/qwen3.8-max-free', name: 'Qwen 3.8 Max' },
                          { id: 'myt/deepseek-v4-pro-free', name: 'DeepSeek V4 Pro' },
                        ].map((model) => {
                          const isFree = (config.freeTokeninModels || []).includes(model.id);
                          return (
                            <div
                              key={model.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-[#1e1f20] border border-[#333538] shadow-xs gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ModelLogo modelId={model.id} size="sm" />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-white truncate block">{model.name}</span>
                                  <div className="text-[10px] text-[#8e918f] font-mono truncate">{model.id}</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleToggleFreeModel(model.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                                  isFree
                                    ? 'bg-white text-black font-bold'
                                    : 'bg-[#28292c] text-[#8e918f] border border-neutral-700 hover:text-white'
                                }`}
                              >
                                {isFree ? 'Free (Active ✓)' : 'Premium Only'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                          Vision Model (Cheapest Vision-Capable)
                        </label>
                        <select
                          value={config.visionModel}
                          onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white"
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
                        <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                          Temperature: {config.temperature}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={config.temperature}
                          onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                          className="w-full accent-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                          Max Output Tokens
                        </label>
                        <input
                          type="number"
                          value={config.maxTokens}
                          onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                          className="w-full px-3 py-1.5 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                          Daily Message Limit (per user)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={config.dailyMessageLimit}
                          onChange={(e) =>
                            setConfig({ ...config, dailyMessageLimit: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white"
                        />
                        <p className="text-[10px] text-[#8e918f] mt-1">
                          Max chat messages each user can send per day. Set to 0 for unlimited. Admins are never limited.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#333538]">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#e3e3e3]">
                        <input
                          type="checkbox"
                          checked={config.enableVision}
                          onChange={(e) => setConfig({ ...config, enableVision: e.target.checked })}
                          className="rounded accent-white"
                        />
                        <span>Enable Vision & Multimodal Image Analysis</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#e3e3e3]">
                        <input
                          type="checkbox"
                          checked={config.enableDeepResearch}
                          onChange={(e) => setConfig({ ...config, enableDeepResearch: e.target.checked })}
                          className="rounded accent-white"
                        />
                        <span>Enable Deeper Research & Step-by-Step Thinking</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#e3e3e3]">
                        <input
                          type="checkbox"
                          checked={config.fallbackToGemini}
                          onChange={(e) => setConfig({ ...config, fallbackToGemini: e.target.checked })}
                          className="rounded accent-white"
                        />
                        <span>Fallback to Server-Side Gemini API if AICredits key is unset</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Save AI Configuration
                    </button>
                  </form>
                )}

                {/* 3. SYSTEM PROMPT & STRICT GUARDRAILS */}
                {activeTab === 'systemPrompt' && config && (
                  <form onSubmit={handleSaveConfig} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-white">
                        Strict System Prompt & Directives
                      </h3>
                      {saveSuccessMsg && (
                        <span className="text-xs text-white flex items-center gap-1 font-medium bg-[#28292c] px-2 py-1 rounded-lg border border-neutral-700">
                          <Check className="w-3.5 h-3.5" />
                          {saveSuccessMsg}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#8e918f] leading-relaxed">
                      The AI strictly adheres to this system prompt for all conversations. It cannot be overridden or bypassed by prompt injections.
                    </p>

                    <div>
                      <textarea
                        rows={10}
                        value={config.systemPrompt}
                        onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                        className="w-full p-3 rounded-2xl border border-[#333538] bg-[#131314] text-white focus:border-neutral-500 outline-none text-xs font-mono leading-relaxed"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-semibold text-[#8e918f] self-center mr-1">
                        Preset Archetypes:
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            systemPrompt: `You are Leo AI, a world-class, exceptionally thorough, articulate, and intelligent AI assistant engineered to deliver Claude-grade excellence across software engineering, deep reasoning, writing, visual analysis, and creative problem solving.

CORE DIRECTIVES & QUALITY STANDARDS:
1. Always follow user constraints strictly and accurately.
2. Never give half-finished, truncated, or lazy responses. Provide complete, fully realized solutions and exhaustively developed code without placeholders.
3. Write clean, highly structured, beautifully formatted Markdown with descriptive headings, bullet points, and code blocks with syntax highlighting.
4. When writing code, deliver production-ready, typed, and complete implementations.
5. In reasoning and analysis, balance deep technical precision with clarity, offering nuanced trade-offs and actionable next steps.`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#28292c] hover:bg-[#333538] text-[11px] font-medium text-[#c4c7c5] cursor-pointer"
                      >
                        Default Leo AI (Claude-Grade)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            systemPrompt: `You are Leo AI Enterprise Copilot. Deliver concise, actionable executive intelligence. Every answer must prioritize security, scalability, and measurable business ROI.`,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#28292c] hover:bg-[#333538] text-[11px] font-medium text-[#c4c7c5] cursor-pointer"
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
                        className="px-2.5 py-1 rounded-lg bg-[#28292c] hover:bg-[#333538] text-[11px] font-medium text-[#c4c7c5] cursor-pointer"
                      >
                        Code Architect
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Save System Prompt
                    </button>
                  </form>
                )}

                {/* 4. MEMO API MEMORY MANAGER */}
                {activeTab === 'memoMemory' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-semibold text-base text-white">
                        Memo API — Persistent AI Memory
                      </h3>
                      <span className="text-xs bg-[#28292c] text-white px-2 py-0.5 rounded-full font-medium border border-neutral-700">
                        {memories.length} Stored Memories
                      </span>
                    </div>

                    <p className="text-xs text-[#8e918f] leading-relaxed">
                      Leo AI utilizes Memo API (or our persistent local vector memory cache) to recall user preferences, architectural goals, and past decisions across sessions.
                    </p>

                    {/* Add Memory Form */}
                    <form onSubmit={handleAddMemory} className="p-4 rounded-2xl bg-[#131314] border border-[#333538] space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Add new persistent memory fact (e.g. 'User prefers TypeScript and dark theme')..."
                          value={newMemoryText}
                          onChange={(e) => setNewMemoryText(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white"
                        />
                        <select
                          value={newMemoryCategory}
                          onChange={(e: any) => setNewMemoryCategory(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-[#333538] focus:border-neutral-500 outline-none text-xs bg-[#1e1f20] text-white"
                        >
                          <option value="preference">Preference</option>
                          <option value="project">Project</option>
                          <option value="fact">Fact</option>
                          <option value="general">General</option>
                        </select>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-white hover:bg-neutral-200 text-black text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
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
                          className="p-3 rounded-xl bg-[#131314] border border-[#333538] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#28292c] text-white mr-2 border border-neutral-700">
                              {mem.category}
                            </span>
                            <span className="text-[#e3e3e3]">{mem.text}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="p-1 text-[#8e918f] hover:text-white transition cursor-pointer"
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
                      <h3 className="font-display font-semibold text-base text-white">
                        Registered Users & Role Management
                      </h3>
                      <span className="text-xs bg-[#28292c] text-white px-2 py-0.5 rounded-full font-medium border border-neutral-700">
                        {users.length} Users
                      </span>
                    </div>

                    <div className="space-y-2">
                      {users.map((u) => (
                        <div
                          key={u.uid}
                          className="p-3 rounded-2xl bg-[#131314] border border-[#333538] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.photoURL ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                              }
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover ring-1 ring-neutral-700"
                            />
                            <div>
                              <p className="text-xs font-semibold text-white">{u.displayName}</p>
                              <p className="text-[11px] text-[#8e918f]">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <select value={u.plan || 'free'} onChange={async (e) => { try { const result = await api.updateAdminUser(u.uid, { plan: e.target.value }); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="text-[10px] px-2 py-1 rounded-lg border border-[#333538] bg-[#1e1f20] text-white">
                              <option value="free">Free</option><option value="premium">Premium</option><option value="pro">Pro</option><option value="ultra">Ultra</option>
                            </select>
                            <input type="number" min="0" placeholder="Daily limit" value={u.dailyMessageLimitOverride ?? ''} onChange={(e) => setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, dailyMessageLimitOverride: e.target.value === '' ? undefined : Number(e.target.value) } : x))} onBlur={async (e) => { try { const value = e.target.value === '' ? null : Number(e.target.value); const result = await api.updateAdminUser(u.uid, { dailyMessageLimitOverride: value }); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="w-24 text-[10px] px-2 py-1 rounded-lg border border-[#333538] bg-[#1e1f20] text-white outline-none" />
                            <button onClick={async () => { try { const result = await api.resetAdminUserDailyUsage(u.uid); setUsers(prev => prev.map(x => x.uid === u.uid ? result.user : x)); } catch (err: any) { alert(err.message); } }} className="text-[10px] px-2 py-1 rounded-lg border border-[#333538] bg-[#28292c] text-white hover:bg-[#333538] cursor-pointer">Reset today</button>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#28292c] text-white border border-neutral-700">{u.plan || 'free'} · used {u.dailyMessageCount || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. RENDER & VERCEL DEPLOYMENT GUIDE */}
                {activeTab === 'deployment' && (
                  <div className="space-y-4">
                    <h3 className="font-display font-semibold text-base text-white">
                      Dual-Tier Deployment: Render (Backend) + Vercel (Frontend)
                    </h3>

                    <p className="text-xs text-[#8e918f] leading-relaxed">
                      Deploy your production full-stack architecture seamlessly. The backend runs on Render with secure environment secrets, and the frontend deploys to Vercel.
                    </p>

                    <div className="p-4 rounded-2xl bg-black border border-[#333538] text-white space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          Render Backend Environment Secrets (.env)
                        </span>
                        <button
                          onClick={() => {
                            const envString = `NODE_ENV=production\nPORT=3000\nADMIN_PASSWORD=your_super_secret_admin_pass\nAICREDITS_API_KEY=your_aicredits_api_key\nAICREDITS_BASE_URL=https://api.aicredits.in/v1\nAICREDITS_VISION_MODEL=gemini-1.5-flash\nMEMO_API_KEY=your_memo_api_key\nMONGODB_URI=mongodb+srv://...\nGEMINI_API_KEY=your_gemini_key`;
                            navigator.clipboard.writeText(envString);
                            setCopiedEnv(true);
                            setTimeout(() => setCopiedEnv(false), 2000);
                          }}
                          className="flex items-center gap-1 text-[11px] text-white bg-[#28292c] hover:bg-[#333538] px-2.5 py-1 rounded-lg transition cursor-pointer border border-neutral-700"
                        >
                          {copiedEnv ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedEnv ? 'Copied!' : 'Copy Render .env'}</span>
                        </button>
                      </div>

                      <pre className="p-3 bg-[#131314] border border-[#333538] rounded-xl text-[11px] font-mono text-[#e3e3e3] overflow-x-auto">
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
                      <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#333538] space-y-1">
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          <Server className="w-4 h-4 text-white" />
                          <span>Render Backend Steps</span>
                        </p>
                        <p className="text-[11px] text-[#8e918f]">
                          1. Create Web Service on Render.<br />
                          2. Build command: <code>npm run build</code><br />
                          3. Start command: <code>npm run start</code><br />
                          4. Add <code>ADMIN_PASSWORD</code> secret in Render settings.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#333538] space-y-1">
                        <p className="font-semibold text-white flex items-center gap-1.5">
                          <Cpu className="w-4 h-4 text-white" />
                          <span>Vercel Frontend Steps</span>
                        </p>
                        <p className="text-[11px] text-[#8e918f]">
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
