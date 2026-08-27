import { AIModelDefinition } from '../types';

export const AI_MODELS: AIModelDefinition[] = [
  {
    id: 'default',
    name: 'AI Model',
    company: 'Configured Engine',
    category: 'text',
    description: 'Active model engine configured in Render environment variables.',
    badges: ['Active'],
    iconKey: 'gemini',
    provider: 'aicredits',
    tier: 'standard',
    isDefault: true,
  },
];

export const DEFAULT_MODEL_ID = 'default';
