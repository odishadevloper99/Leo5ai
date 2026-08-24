import React from 'react';

interface ModelLogoProps {
  iconKey?: string;
  modelId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNew?: boolean;
}

const sizeClasses = {
  xs: 'w-4 h-4 rounded-md',
  sm: 'w-6 h-6 rounded-lg',
  md: 'w-8 h-8 rounded-xl',
  lg: 'w-9 h-9 rounded-xl',
  xl: 'w-11 h-11 rounded-2xl',
};

/**
 * Universal Brand & Model Logo Renderer
 * High-fidelity vector logos with exact geometry, dynamic gradients, and crisp specular rendering
 */
export const ModelLogo: React.FC<ModelLogoProps> = ({
  iconKey = '',
  modelId = '',
  size = 'md',
  className = '',
  isNew = false,
}) => {
  const normalizedKey = (iconKey || '').toLowerCase();
  const normalizedId = (modelId || '').toLowerCase();

  const isGemini = normalizedKey === 'gemini' || normalizedId.includes('gemini');
  const isGrok = normalizedKey === 'grok' || normalizedId.includes('grok') || normalizedId.includes('xai');
  const isGlm = normalizedKey === 'glm' || normalizedId.includes('glm') || normalizedId.includes('zhipu');
  const isKimi = normalizedKey === 'kimi' || normalizedId.includes('kimi') || normalizedId.includes('moonshot');
  const isQwen = normalizedKey === 'qwen' || normalizedId.includes('qwen') || normalizedId.includes('alibaba');
  const isDeepSeek = normalizedKey === 'deepseek' || normalizedId.includes('deepseek');
  const isOpenAI = normalizedKey === 'openai' || normalizedKey === 'gpt' || normalizedId.includes('gpt') || normalizedId.includes('openai');
  const isClaude = normalizedKey === 'claude' || normalizedId.includes('claude') || normalizedId.includes('anthropic');
  const isMistral = normalizedKey === 'mistral' || normalizedId.includes('mistral') || normalizedId.includes('codestral');
  const isMeta = normalizedKey === 'llama' || normalizedId.includes('llama') || normalizedId.includes('meta');

  const baseSizeClass = sizeClasses[size] || sizeClasses.md;

  const renderInnerSvg = () => {
    // 1. Google Gemini (Iconic 4-point dynamic curved radiant spark with quad-color gradient)
    if (isGemini) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gemini-quad-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A89FF" />
              <stop offset="35%" stopColor="#8E55EA" />
              <stop offset="65%" stopColor="#E05273" />
              <stop offset="100%" stopColor="#FFA63D" />
            </linearGradient>
            <radialGradient id="gemini-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Subtle central flare */}
          <circle cx="18" cy="18" r="8" fill="url(#gemini-center-glow)" />
          {/* Main 4-point star path */}
          <path
            d="M18 2C18 10.8366 10.8366 18 2 18C10.8366 18 18 25.1634 18 34C18 25.1634 25.1634 18 34 18C25.1634 18 18 10.8366 18 2Z"
            fill="url(#gemini-quad-grad)"
          />
          {/* Internal diagonal accent sparkle */}
          <path
            d="M18 11C18 14.866 14.866 18 11 18C14.866 18 18 21.134 18 25C18 21.134 21.134 18 25 18C21.134 18 18 14.866 18 11Z"
            fill="#FFFFFF"
            fillOpacity="0.65"
          />
        </svg>
      );
    }

    // 2. OpenAI (Accurate 6-petal hexagonal rotational rosette)
    if (isOpenAI) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="openai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10A37F" />
              <stop offset="100%" stopColor="#2DD4BF" />
            </linearGradient>
          </defs>
          <g stroke="url(#openai-grad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M28.5 14.8A6.8 6.8 0 0 0 27.2 8.4A6.9 6.9 0 0 0 19.4 5.7A6.8 6.8 0 0 0 9.2 8.1A6.8 6.8 0 0 0 7.1 19.8A6.8 6.8 0 0 0 8.4 26.2A6.9 6.9 0 0 0 16.2 28.9A6.8 6.8 0 0 0 26.4 26.5A6.8 6.8 0 0 0 28.5 14.8Z" />
            <path d="M18 12.5V23.5" />
            <path d="M13.2 15.3L22.8 20.7" />
            <path d="M22.8 15.3L13.2 20.7" />
            <circle cx="18" cy="18" r="2" fill="#10A37F" />
          </g>
        </svg>
      );
    }

    // 3. Anthropic Claude (Iconic Terracotta Geometric Asterisk Starburst)
    if (isClaude) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1.2" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="claude-sun-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <g stroke="url(#claude-sun-grad)" strokeWidth="3.2" strokeLinecap="round">
            <path d="M18 4V32" />
            <path d="M4 18H32" />
            <path d="M8.1 8.1L27.9 27.9" />
            <path d="M27.9 8.1L8.1 27.9" />
          </g>
          <circle cx="18" cy="18" r="3.2" fill="#F59E0B" />
        </svg>
      );
    }

    // 4. DeepSeek (Whale Tail / Deep Oceanic Azure Hydrofoil)
    if (isDeepSeek) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="deepseek-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
          </defs>
          {/* Whale caudal fin top flow */}
          <path
            d="M5 21C11 15 16 15.5 18 17.5C20 19.5 25 20 31 15"
            stroke="url(#deepseek-glow-grad)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Lower hydrofoil ripple */}
          <path
            d="M7 26C12 21 16 21.5 18 23.5C20 25.5 24 26 29 21"
            stroke="#38BDF8"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          {/* Core dorsal neural spark */}
          <path d="M18 6V13" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="18" cy="6" r="2.8" fill="#E0F2FE" />
        </svg>
      );
    }

    // 5. xAI Grok (Precision Monochrome / Diagonal Speed-Slash X)
    if (isGrok) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grok-slash-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
          </defs>
          <path
            d="M8 7L28 29"
            stroke="url(#grok-slash-grad)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <path
            d="M28 7L8 29"
            stroke="url(#grok-slash-grad)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <path
            d="M17 13L21 18L17 23"
            stroke="#38BDF8"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // 6. Alibaba Cloud / Qwen (Prismatic Cyan-Teal Hexagonal Crystal)
    if (isQwen) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="qwen-prism-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          {/* Outer Prism Hexagon */}
          <path
            d="M18 3L30 10V24L18 31L6 24V10L18 3Z"
            stroke="url(#qwen-prism-grad)"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {/* Inner Facet */}
          <path
            d="M18 10L24 14V21L18 25L12 21V14L18 10Z"
            fill="url(#qwen-prism-grad)"
            fillOpacity="0.35"
            stroke="url(#qwen-prism-grad)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="17.5" r="2" fill="#E0F2FE" />
        </svg>
      );
    }

    // 7. Zhipu AI / GLM (Zhipu Cobalt-Indigo Neural Z Emblem)
    if (isGlm) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="glm-cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          <path
            d="M8 10H28L12 26H28"
            stroke="url(#glm-cyber-grad)"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="10" r="2.4" fill="#93C5FD" />
          <circle cx="12" cy="26" r="2.4" fill="#C7D2FE" />
        </svg>
      );
    }

    // 8. Moonshot AI / Kimi (Lunar Crescent & Neon Violet K Mark)
    if (isKimi) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="kimi-neon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="50%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#E879F9" />
            </linearGradient>
          </defs>
          <path
            d="M10 7V29M10 18L24 7M14 15.5L26 29"
            stroke="url(#kimi-neon-grad)"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="25" cy="8" r="2.2" fill="#FDF4FF" />
        </svg>
      );
    }

    // 9. Meta Llama (Infinity Gradient Loop)
    if (isMeta) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="meta-loop-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0081FB" />
              <stop offset="50%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path
            d="M12 12C9 12 6.5 14.5 6.5 18C6.5 21.5 9 24 12 24C15.5 24 18 19.5 18 18C18 16.5 20.5 12 24 12C27 12 29.5 14.5 29.5 18C29.5 21.5 27 24 24 24C20.5 24 18 19.5 18 18"
            stroke="url(#meta-loop-grad)"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        </svg>
      );
    }

    // 10. Mistral AI (Iconic Orange Stepped Pixel Chevron)
    if (isMistral) {
      return (
        <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1.2" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mistral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF7000" />
              <stop offset="50%" stopColor="#FF9E00" />
              <stop offset="100%" stopColor="#FFD000" />
            </linearGradient>
          </defs>
          <g fill="url(#mistral-grad)">
            <rect x="6" y="8" width="5" height="20" rx="1.5" />
            <rect x="25" y="8" width="5" height="20" rx="1.5" />
            <rect x="11" y="13" width="5" height="15" rx="1.5" />
            <rect x="20" y="13" width="5" height="15" rx="1.5" />
            <rect x="15.5" y="18" width="5" height="10" rx="1.5" />
          </g>
        </svg>
      );
    }

    // Default Fallback Star Sparkle
    return (
      <svg viewBox="0 0 36 36" fill="none" className="w-full h-full p-1.5" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M18 4L22 14L32 18L22 22L18 32L14 22L4 18L14 14L18 4Z"
          fill="#A855F7"
        />
      </svg>
    );
  };

  // Background container styling based on model identity with subtle rim borders & depth
  const getContainerBg = () => {
    if (isGemini) return 'bg-gradient-to-br from-[#12122b] via-[#1a1438] to-[#0f0e24] border-indigo-500/40 text-indigo-200 shadow-indigo-950/60 ring-1 ring-indigo-400/20';
    if (isGrok) return 'bg-[#090b10] border-neutral-700 text-white shadow-neutral-950/70 ring-1 ring-white/10';
    if (isOpenAI) return 'bg-gradient-to-br from-[#04241d] via-[#062c23] to-[#041d17] border-emerald-500/40 text-emerald-300 shadow-emerald-950/60 ring-1 ring-emerald-400/20';
    if (isClaude) return 'bg-gradient-to-br from-[#2f1809] via-[#241307] to-[#1a0e05] border-amber-600/50 text-amber-300 shadow-amber-950/60 ring-1 ring-amber-400/20';
    if (isDeepSeek) return 'bg-gradient-to-br from-[#06203d] via-[#081e36] to-[#051629] border-sky-500/40 text-sky-300 shadow-sky-950/60 ring-1 ring-sky-400/20';
    if (isQwen) return 'bg-gradient-to-br from-[#052631] via-[#072029] to-[#041820] border-cyan-500/40 text-cyan-300 shadow-cyan-950/60 ring-1 ring-cyan-400/20';
    if (isGlm) return 'bg-gradient-to-br from-[#0d1738] via-[#0d142d] to-[#090e21] border-blue-500/40 text-blue-300 shadow-blue-950/60 ring-1 ring-blue-400/20';
    if (isKimi) return 'bg-gradient-to-br from-[#240e3b] via-[#1c0b2f] to-[#140722] border-purple-500/40 text-purple-300 shadow-purple-950/60 ring-1 ring-purple-400/20';
    if (isMistral) return 'bg-gradient-to-br from-[#2f1604] via-[#241103] to-[#170a02] border-amber-500/40 text-amber-300 shadow-amber-950/60 ring-1 ring-amber-400/20';
    if (isMeta) return 'bg-gradient-to-br from-[#06223b] via-[#081d30] to-[#051524] border-sky-500/40 text-sky-300 shadow-sky-950/60 ring-1 ring-sky-400/20';
    return 'bg-neutral-900 border-neutral-800 text-neutral-200 ring-1 ring-white/5';
  };

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {isNew && (
        <span className="absolute -top-1.5 -left-1 px-1 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[8px] font-black rounded uppercase tracking-wider shadow-sm z-10 scale-90">
          New
        </span>
      )}
      <div
        className={`${baseSizeClass} border flex items-center justify-center shadow-md overflow-hidden transition-all duration-200 group-hover:scale-105 ${getContainerBg()}`}
      >
        {renderInnerSvg()}
      </div>
    </div>
  );
};

