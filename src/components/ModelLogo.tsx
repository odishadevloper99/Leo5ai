import React, { useState } from 'react';

export interface ModelBrandInfo {
  key: string;
  name: string;
  url: string;
  fallbackUrls?: string[];
  bgClass: string;
  borderClass: string;
  textClass: string;
  glowClass: string;
}

/**
 * Local Bundled and CDN AI Model Logos
 * Provides reliable local assets with CDN fallback
 */
export const BRAND_LOGOS: Record<string, ModelBrandInfo> = {
  openai: {
    key: 'openai',
    name: 'OpenAI / GPT',
    url: '/icons/models/openai.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/openai.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg'
    ],
    bgClass: 'bg-[#10a37f]/15 dark:bg-[#10a37f]/20',
    borderClass: 'border-emerald-500/40 ring-1 ring-emerald-400/20',
    textClass: 'text-emerald-400',
    glowClass: 'shadow-emerald-950/60'
  },
  claude: {
    key: 'claude',
    name: 'Claude / Anthropic',
    url: '/icons/models/claude-color.svg',
    fallbackUrls: [
      '/icons/models/claude.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/claude-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/claude.svg'
    ],
    bgClass: 'bg-[#d97706]/15 dark:bg-[#d97706]/20',
    borderClass: 'border-amber-600/50 ring-1 ring-amber-400/20',
    textClass: 'text-amber-400',
    glowClass: 'shadow-amber-950/60'
  },
  gemini: {
    key: 'gemini',
    name: 'Google Gemini',
    url: '/icons/models/gemini-color.svg',
    fallbackUrls: [
      '/icons/models/gemini.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/gemini-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini.svg'
    ],
    bgClass: 'bg-[#4f46e5]/15 dark:bg-[#4f46e5]/20',
    borderClass: 'border-indigo-500/40 ring-1 ring-indigo-400/20',
    textClass: 'text-indigo-300',
    glowClass: 'shadow-indigo-950/60'
  },
  gemma: {
    key: 'gemma',
    name: 'Google Gemma',
    url: '/icons/models/gemma-color.svg',
    fallbackUrls: [
      '/icons/models/gemma.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/gemma-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemma.svg'
    ],
    bgClass: 'bg-[#2563eb]/15 dark:bg-[#2563eb]/20',
    borderClass: 'border-blue-500/40 ring-1 ring-blue-400/20',
    textClass: 'text-blue-400',
    glowClass: 'shadow-blue-950/60'
  },
  deepseek: {
    key: 'deepseek',
    name: 'DeepSeek',
    url: '/icons/models/deepseek-color.svg',
    fallbackUrls: [
      '/icons/models/deepseek.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/deepseek-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek.svg'
    ],
    bgClass: 'bg-[#0284c7]/15 dark:bg-[#0284c7]/20',
    borderClass: 'border-sky-500/40 ring-1 ring-sky-400/20',
    textClass: 'text-sky-400',
    glowClass: 'shadow-sky-950/60'
  },
  grok: {
    key: 'grok',
    name: 'xAI Grok',
    url: '/icons/models/grok.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/grok.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/grok.svg'
    ],
    bgClass: 'bg-neutral-800/80 dark:bg-neutral-900/80',
    borderClass: 'border-neutral-700 ring-1 ring-white/10',
    textClass: 'text-white',
    glowClass: 'shadow-neutral-950/70'
  },
  meta: {
    key: 'meta',
    name: 'Meta / Llama',
    url: '/icons/models/meta-color.svg',
    fallbackUrls: [
      '/icons/models/meta.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/meta-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/meta.svg'
    ],
    bgClass: 'bg-[#0081fb]/15 dark:bg-[#0081fb]/20',
    borderClass: 'border-sky-500/40 ring-1 ring-sky-400/20',
    textClass: 'text-sky-400',
    glowClass: 'shadow-sky-950/60'
  },
  qwen: {
    key: 'qwen',
    name: 'Alibaba Qwen',
    url: '/icons/models/qwen-color.svg',
    fallbackUrls: [
      '/icons/models/qwen.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/qwen-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen.svg'
    ],
    bgClass: 'bg-[#0891b2]/15 dark:bg-[#0891b2]/20',
    borderClass: 'border-cyan-500/40 ring-1 ring-cyan-400/20',
    textClass: 'text-cyan-400',
    glowClass: 'shadow-cyan-950/60'
  },
  mistral: {
    key: 'mistral',
    name: 'Mistral AI',
    url: '/icons/models/mistral-color.svg',
    fallbackUrls: [
      '/icons/models/mistral.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/mistral-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/mistral.svg'
    ],
    bgClass: 'bg-[#ea580c]/15 dark:bg-[#ea580c]/20',
    borderClass: 'border-amber-500/40 ring-1 ring-amber-400/20',
    textClass: 'text-amber-400',
    glowClass: 'shadow-amber-950/60'
  },
  kimi: {
    key: 'kimi',
    name: 'Moonshot Kimi',
    url: '/icons/models/kimi-color.svg',
    fallbackUrls: [
      '/icons/models/kimi.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/kimi-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/kimi.svg'
    ],
    bgClass: 'bg-[#9333ea]/15 dark:bg-[#9333ea]/20',
    borderClass: 'border-purple-500/40 ring-1 ring-purple-400/20',
    textClass: 'text-purple-400',
    glowClass: 'shadow-purple-950/60'
  },
  perplexity: {
    key: 'perplexity',
    name: 'Perplexity AI',
    url: '/icons/models/perplexity-color.svg',
    fallbackUrls: [
      '/icons/models/perplexity.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/perplexity-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/perplexity.svg'
    ],
    bgClass: 'bg-[#0d9488]/15 dark:bg-[#0d9488]/20',
    borderClass: 'border-teal-500/40 ring-1 ring-teal-400/20',
    textClass: 'text-teal-400',
    glowClass: 'shadow-teal-950/60'
  },
  copilot: {
    key: 'copilot',
    name: 'GitHub Copilot',
    url: '/icons/models/githubcopilot.svg',
    fallbackUrls: [
      '/icons/models/github.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/githubcopilot.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/github-copilot.svg'
    ],
    bgClass: 'bg-[#4338ca]/15 dark:bg-[#4338ca]/20',
    borderClass: 'border-indigo-500/40 ring-1 ring-indigo-400/20',
    textClass: 'text-indigo-400',
    glowClass: 'shadow-indigo-950/60'
  },
  groq: {
    key: 'groq',
    name: 'Groq LPU',
    url: '/icons/models/groq.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/groq.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/groq.svg'
    ],
    bgClass: 'bg-[#c2410c]/15 dark:bg-[#c2410c]/20',
    borderClass: 'border-orange-500/40 ring-1 ring-orange-400/20',
    textClass: 'text-orange-400',
    glowClass: 'shadow-orange-950/60'
  },
  cohere: {
    key: 'cohere',
    name: 'Cohere',
    url: '/icons/models/cohere-color.svg',
    fallbackUrls: [
      '/icons/models/cohere.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/cohere-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/cohere.svg'
    ],
    bgClass: 'bg-[#059669]/15 dark:bg-[#059669]/20',
    borderClass: 'border-emerald-600/40 ring-1 ring-emerald-500/20',
    textClass: 'text-emerald-400',
    glowClass: 'shadow-emerald-950/60'
  },
  sora: {
    key: 'sora',
    name: 'OpenAI Sora',
    url: '/icons/models/sora-color.svg',
    fallbackUrls: [
      '/icons/models/sora.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/sora-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/sora.svg'
    ],
    bgClass: 'bg-[#0284c7]/15 dark:bg-[#0284c7]/20',
    borderClass: 'border-sky-500/40 ring-1 ring-sky-400/20',
    textClass: 'text-sky-400',
    glowClass: 'shadow-sky-950/60'
  },
  dalle: {
    key: 'dalle',
    name: 'DALL-E',
    url: '/icons/models/openai.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/openai.svg'
    ],
    bgClass: 'bg-[#ca8a04]/15 dark:bg-[#ca8a04]/20',
    borderClass: 'border-yellow-500/40 ring-1 ring-yellow-400/20',
    textClass: 'text-yellow-400',
    glowClass: 'shadow-yellow-950/60'
  },
  flux: {
    key: 'flux',
    name: 'Flux / Black Forest Labs',
    url: '/icons/models/flux.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/flux.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/flux.svg'
    ],
    bgClass: 'bg-[#7c3aed]/15 dark:bg-[#7c3aed]/20',
    borderClass: 'border-violet-500/40 ring-1 ring-violet-400/20',
    textClass: 'text-violet-400',
    glowClass: 'shadow-violet-950/60'
  },
  huggingface: {
    key: 'huggingface',
    name: 'Hugging Face',
    url: '/icons/models/huggingface-color.svg',
    fallbackUrls: [
      '/icons/models/huggingface.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/huggingface-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/huggingface.svg'
    ],
    bgClass: 'bg-[#d97706]/15 dark:bg-[#d97706]/20',
    borderClass: 'border-amber-500/40 ring-1 ring-amber-400/20',
    textClass: 'text-amber-400',
    glowClass: 'shadow-amber-950/60'
  },
  ollama: {
    key: 'ollama',
    name: 'Ollama',
    url: '/icons/models/ollama.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/ollama.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/ollama.svg'
    ],
    bgClass: 'bg-neutral-800/80 dark:bg-neutral-900/80',
    borderClass: 'border-neutral-600 ring-1 ring-white/10',
    textClass: 'text-white',
    glowClass: 'shadow-neutral-950/70'
  },
  midjourney: {
    key: 'midjourney',
    name: 'Midjourney',
    url: '/icons/models/midjourney.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/midjourney.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/midjourney.svg'
    ],
    bgClass: 'bg-[#1d4ed8]/15 dark:bg-[#1d4ed8]/20',
    borderClass: 'border-blue-500/40 ring-1 ring-blue-400/20',
    textClass: 'text-blue-400',
    glowClass: 'shadow-blue-950/60'
  },
  kling: {
    key: 'kling',
    name: 'Kling AI',
    url: '/icons/models/kling-color.svg',
    fallbackUrls: [
      '/icons/models/kling.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/kling-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/kling.svg'
    ],
    bgClass: 'bg-[#9333ea]/15 dark:bg-[#9333ea]/20',
    borderClass: 'border-purple-500/40 ring-1 ring-purple-400/20',
    textClass: 'text-purple-400',
    glowClass: 'shadow-purple-950/60'
  },
  minimax: {
    key: 'minimax',
    name: 'MiniMax',
    url: '/icons/models/minimax-color.svg',
    fallbackUrls: [
      '/icons/models/minimax.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/minimax-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/minimax.svg'
    ],
    bgClass: 'bg-[#db2777]/15 dark:bg-[#db2777]/20',
    borderClass: 'border-pink-500/40 ring-1 ring-pink-400/20',
    textClass: 'text-pink-400',
    glowClass: 'shadow-pink-950/60'
  },
  yi: {
    key: 'yi',
    name: '01.AI Yi',
    url: '/icons/models/yi-color.svg',
    fallbackUrls: [
      '/icons/models/yi.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/yi-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/yi.svg'
    ],
    bgClass: 'bg-[#0284c7]/15 dark:bg-[#0284c7]/20',
    borderClass: 'border-sky-500/40 ring-1 ring-sky-400/20',
    textClass: 'text-sky-400',
    glowClass: 'shadow-sky-950/60'
  },
  rwkv: {
    key: 'rwkv',
    name: 'RWKV',
    url: '/icons/models/rwkv-color.svg',
    fallbackUrls: [
      '/icons/models/rwkv.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/rwkv-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/rwkv.svg'
    ],
    bgClass: 'bg-[#4f46e5]/15 dark:bg-[#4f46e5]/20',
    borderClass: 'border-indigo-500/40 ring-1 ring-indigo-400/20',
    textClass: 'text-indigo-400',
    glowClass: 'shadow-indigo-950/60'
  },
  phind: {
    key: 'phind',
    name: 'Phind',
    url: '/icons/models/phind.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/phind.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/phind.svg'
    ],
    bgClass: 'bg-[#2563eb]/15 dark:bg-[#2563eb]/20',
    borderClass: 'border-blue-500/40 ring-1 ring-blue-400/20',
    textClass: 'text-blue-400',
    glowClass: 'shadow-blue-950/60'
  },
  elevenlabs: {
    key: 'elevenlabs',
    name: 'ElevenLabs',
    url: '/icons/models/elevenlabs.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/elevenlabs.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/elevenlabs.svg'
    ],
    bgClass: 'bg-neutral-800/80 dark:bg-neutral-900/80',
    borderClass: 'border-neutral-700 ring-1 ring-white/10',
    textClass: 'text-neutral-200',
    glowClass: 'shadow-neutral-950/70'
  },
  glm: {
    key: 'glm',
    name: 'GLM / ChatGLM',
    url: '/icons/models/chatglm-color.svg',
    fallbackUrls: [
      '/icons/models/chatglm.svg',
      '/icons/models/zhipu-color.svg',
      '/icons/models/zhipu.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/chatglm-color.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/chatglm.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/chatglm.svg'
    ],
    bgClass: 'bg-[#2563eb]/15 dark:bg-[#2563eb]/20',
    borderClass: 'border-blue-500/40 ring-1 ring-blue-400/20',
    textClass: 'text-blue-400',
    glowClass: 'shadow-blue-950/60'
  },
  chatglm: {
    key: 'chatglm',
    name: 'GLM / ChatGLM',
    url: '/icons/models/chatglm-color.svg',
    fallbackUrls: [
      '/icons/models/chatglm.svg',
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/chatglm-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/chatglm.svg'
    ],
    bgClass: 'bg-[#2563eb]/15 dark:bg-[#2563eb]/20',
    borderClass: 'border-blue-500/40 ring-1 ring-blue-400/20',
    textClass: 'text-blue-400',
    glowClass: 'shadow-blue-950/60'
  }
};

/**
 * Intelligent Brand Identification from iconKey or modelId string
 */
export function resolveModelBrand(iconKey = '', modelId = ''): ModelBrandInfo {
  const k = (iconKey || '').toLowerCase().trim();
  const id = (modelId || '').toLowerCase().trim();

  // Exact iconKey matching
  if (k && BRAND_LOGOS[k]) {
    return BRAND_LOGOS[k];
  }

  // Alias iconKey normalizations
  if (k === 'llama' || k === 'meta-llama') return BRAND_LOGOS.meta;
  if (k === 'gpt' || k === 'chatgpt') return BRAND_LOGOS.openai;
  if (k === 'anthropic') return BRAND_LOGOS.claude;
  if (k === 'google') return BRAND_LOGOS.gemini;
  if (k === 'zhipu' || k === 'z-ai' || k === 'chatglm') return BRAND_LOGOS.glm;
  if (k === 'alibaba') return BRAND_LOGOS.qwen;
  if (k === 'moonshot') return BRAND_LOGOS.kimi;
  if (k === 'xai' || k === 'x-ai') return BRAND_LOGOS.grok;
  if (k === 'github' || k === 'copilot') return BRAND_LOGOS.copilot;
  if (k === 'black-forest' || k === 'bfl') return BRAND_LOGOS.flux;
  if (k === 'hf' || k === 'huggingface') return BRAND_LOGOS.huggingface;
  if (k === '01-ai' || k === 'lingyi') return BRAND_LOGOS.yi;

  // Substring and prefix heuristics on modelId
  if (id.startsWith('openai/') || id.includes('gpt-') || id.includes('o1') || id.includes('o3') || id.includes('text-embedding')) {
    return BRAND_LOGOS.openai;
  }
  if (id.startsWith('anthropic/') || id.includes('claude')) {
    return BRAND_LOGOS.claude;
  }
  if (id.includes('gemma')) {
    return BRAND_LOGOS.gemma;
  }
  if (id.startsWith('google/') || id.includes('gemini') || id.includes('imagen')) {
    return BRAND_LOGOS.gemini;
  }
  if (id.startsWith('deepseek/') || id.includes('deepseek')) {
    return BRAND_LOGOS.deepseek;
  }
  if (id.startsWith('x-ai/') || id.includes('grok') || id.includes('xai')) {
    return BRAND_LOGOS.grok;
  }
  if (id.startsWith('meta/') || id.includes('llama')) {
    return BRAND_LOGOS.meta;
  }
  if (id.startsWith('qwen/') || id.startsWith('alibaba/') || id.includes('qwen')) {
    return BRAND_LOGOS.qwen;
  }
  if (id.startsWith('mistral') || id.includes('mistral') || id.includes('codestral') || id.includes('pixtral') || id.includes('ministral')) {
    return BRAND_LOGOS.mistral;
  }
  if (id.startsWith('moonshot/') || id.includes('kimi')) {
    return BRAND_LOGOS.kimi;
  }
  if (id.includes('perplexity') || id.includes('sonar')) {
    return BRAND_LOGOS.perplexity;
  }
  if (id.includes('copilot')) {
    return BRAND_LOGOS.copilot;
  }
  if (id.startsWith('groq/') || id.includes('groq')) {
    return BRAND_LOGOS.groq;
  }
  if (id.startsWith('cohere/') || id.includes('cohere') || id.includes('command-r')) {
    return BRAND_LOGOS.cohere;
  }
  if (id.includes('sora')) {
    return BRAND_LOGOS.sora;
  }
  if (id.includes('dall-e') || id.includes('dalle')) {
    return BRAND_LOGOS.dalle;
  }
  if (id.includes('flux')) {
    return BRAND_LOGOS.flux;
  }
  if (id.includes('huggingface') || id.includes('hf/')) {
    return BRAND_LOGOS.huggingface;
  }
  if (id.includes('ollama')) {
    return BRAND_LOGOS.ollama;
  }
  if (id.includes('midjourney') || id.includes('mj/')) {
    return BRAND_LOGOS.midjourney;
  }
  if (id.includes('kling')) {
    return BRAND_LOGOS.kling;
  }
  if (id.includes('minimax') || id.includes('abab')) {
    return BRAND_LOGOS.minimax;
  }
  if (id.startsWith('yi/') || id.includes('01-ai') || id.includes('yi-')) {
    return BRAND_LOGOS.yi;
  }
  if (id.includes('rwkv')) {
    return BRAND_LOGOS.rwkv;
  }
  if (id.includes('phind')) {
    return BRAND_LOGOS.phind;
  }
  if (id.includes('elevenlabs') || id.includes('eleven')) {
    return BRAND_LOGOS.elevenlabs;
  }
  if (id.startsWith('z-ai/') || id.includes('glm') || id.includes('zhipu') || id.includes('chatglm')) {
    return BRAND_LOGOS.glm;
  }

  // Fallback brand metadata
  return {
    key: 'generic',
    name: 'AI Model',
    url: '/icons/models/gemini-color.svg',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/gemini-color.svg',
      'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/gemini.svg'
    ],
    bgClass: 'bg-purple-600/15 dark:bg-purple-600/20',
    borderClass: 'border-purple-500/40 ring-1 ring-purple-400/20',
    textClass: 'text-purple-400',
    glowClass: 'shadow-purple-950/60'
  };
}

interface ModelLogoProps {
  iconKey?: string;
  modelId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNew?: boolean;
}

const sizeClasses = {
  xs: {
    container: 'w-4 h-4 rounded-md',
    img: 'p-0.5',
    fallbackText: 'text-[7px]'
  },
  sm: {
    container: 'w-6 h-6 rounded-lg',
    img: 'p-1',
    fallbackText: 'text-[9px]'
  },
  md: {
    container: 'w-8 h-8 rounded-xl',
    img: 'p-1.5',
    fallbackText: 'text-[11px]'
  },
  lg: {
    container: 'w-9 h-9 rounded-xl',
    img: 'p-1.5',
    fallbackText: 'text-xs'
  },
  xl: {
    container: 'w-11 h-11 rounded-2xl',
    img: 'p-2',
    fallbackText: 'text-sm'
  },
};

/**
 * Universal Brand & Model Logo Renderer
 * High resilience with local bundle assets, multi-CDN fallbacks, and CSS color adaptability
 */
export const ModelLogo: React.FC<ModelLogoProps> = ({
  iconKey = '',
  modelId = '',
  size = 'md',
  className = '',
  isNew = false,
}) => {
  const brand = resolveModelBrand(iconKey, modelId);
  const sizing = sizeClasses[size] || sizeClasses.md;

  const urlList = [brand.url, ...(brand.fallbackUrls || [])];
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [hasExhaustedErrors, setHasExhaustedErrors] = useState(false);

  const handleError = () => {
    if (currentUrlIndex + 1 < urlList.length) {
      setCurrentUrlIndex(prev => prev + 1);
    } else {
      setHasExhaustedErrors(true);
    }
  };

  const currentSrc = urlList[currentUrlIndex] || brand.url;

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {isNew && (
        <span className="absolute -top-1.5 -left-1 px-1 py-0.2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[8px] font-black rounded uppercase tracking-wider shadow-sm z-10 scale-90">
          New
        </span>
      )}
      <div
        className={`${sizing.container} ${brand.bgClass} ${brand.borderClass} ${brand.glowClass} ${brand.textClass} border flex items-center justify-center shadow-xs overflow-hidden transition-all duration-200 group-hover:scale-105`}
        title={brand.name}
      >
        {!hasExhaustedErrors ? (
          <img
            key={currentSrc}
            src={currentSrc}
            alt={brand.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleError}
            className={`w-full h-full object-contain ${sizing.img} transition-opacity duration-200`}
          />
        ) : (
          <span className={`font-black uppercase tracking-tighter ${brand.textClass} ${sizing.fallbackText}`}>
            {brand.name.charAt(0)}
          </span>
        )}
      </div>
    </div>
  );
};
