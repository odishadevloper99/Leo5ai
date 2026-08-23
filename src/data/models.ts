import { AIModelDefinition } from '../types';

export const AI_MODELS: AIModelDefinition[] = [
  // Google Gemini Models (Powered by AICredits)
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    company: 'Google',
    category: 'reasoning',
    description: 'Ultra-fast multimodal hybrid cognitive reasoning with advanced problem solving and code generation',
    badges: ['Flagship', 'Vision', 'Reasoning'],
    iconKey: 'gemini',
    provider: 'aicredits',
    isNew: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    company: 'Google',
    category: 'vision',
    description: 'Next-generation low-latency multimodal intelligence and real-time vision processing',
    badges: ['Vision', 'Fast'],
    iconKey: 'gemini',
    provider: 'aicredits',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    company: 'Google',
    category: 'vision',
    description: 'High-speed multimodal vision, OCR extraction and conversational intelligence',
    badges: ['Vision'],
    iconKey: 'gemini',
    provider: 'aicredits',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    company: 'Google',
    category: 'reasoning',
    description: 'Deep reasoning, complex document analysis and 1M+ token context window comprehension',
    badges: ['1M Context', 'Pro'],
    iconKey: 'gemini',
    provider: 'aicredits',
  },

  // OpenAI Models (Powered by AICredits)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    company: 'OpenAI',
    category: 'text',
    description: 'Omni flagship intelligence across text, coding, analysis and high-precision visual understanding',
    badges: ['Omni', 'Flagship'],
    iconKey: 'openai',
    provider: 'aicredits',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    company: 'OpenAI',
    category: 'text',
    description: 'Fast, cost-efficient multimodal reasoning and versatile conversational workflows',
    badges: ['Vision', 'Fast'],
    iconKey: 'openai',
    provider: 'aicredits',
  },

  // Anthropic Claude (Powered by AICredits)
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    company: 'Anthropic',
    category: 'coding',
    description: 'Industry-leading code generation, architectural analysis, nuanced writing and deep reasoning',
    badges: ['Top Code', 'Reasoning'],
    iconKey: 'claude',
    provider: 'aicredits',
  },

  // DeepSeek Models (Powered by AICredits)
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    company: 'DeepSeek',
    category: 'reasoning',
    description: 'Open-weights reasoning breakthrough with chain-of-thought mathematical and logic verification',
    badges: ['Deep Reasoning', 'Math'],
    iconKey: 'deepseek',
    provider: 'aicredits',
    isNew: true,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    company: 'DeepSeek',
    category: 'coding',
    description: 'Top-tier code generation, technical synthesis, speed and deep algorithmic intelligence',
    badges: ['Coding', 'Speed'],
    iconKey: 'deepseek',
    provider: 'aicredits',
  },

  // Alibaba Cloud Qwen (Powered by AICredits)
  {
    id: 'qwen-plus',
    name: 'Qwen 2.5 Plus',
    company: 'Alibaba Cloud',
    category: 'text',
    description: 'Flagship multilingual reasoning, complex mathematical logic, coding and tool integration',
    badges: ['Multilingual', 'Math'],
    iconKey: 'qwen',
    provider: 'aicredits',
  },

  // Zhipu AI GLM (Powered by AICredits)
  {
    id: 'glm-4-plus',
    name: 'GLM 4 Plus',
    company: 'Zhipu AI',
    category: 'text',
    description: 'Next-generation flagship intelligence with deep analytical and multilingual reasoning',
    badges: ['Flagship'],
    iconKey: 'glm',
    provider: 'aicredits',
  },

  // xAI Grok (Powered by AICredits)
  {
    id: 'grok-beta',
    name: 'Grok 2',
    company: 'xAI',
    category: 'reasoning',
    description: 'Advanced real-time cognitive reasoning, witty dialogue and direct synthesis',
    badges: ['Reasoning'],
    iconKey: 'grok',
    provider: 'aicredits',
  },

  // Moonshot AI Kimi (Powered by AICredits)
  {
    id: 'moonshot-v1-32k',
    name: 'Kimi Chat',
    company: 'Moonshot AI',
    category: 'text',
    description: 'Long-context reasoning with deep research document comprehension and analytical synthesis',
    badges: ['Long Context'],
    iconKey: 'kimi',
    provider: 'aicredits',
  },

  // Meta Llama (Powered by AICredits)
  {
    id: 'llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    company: 'Meta',
    category: 'text',
    description: 'High-performance open architecture fine-tuned for conversational clarity and code synthesis',
    badges: ['Open Weight', '70B'],
    iconKey: 'llama',
    provider: 'aicredits',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
