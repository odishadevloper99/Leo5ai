import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Check,
  Info,
  ChevronRight,
} from 'lucide-react';
import { AIModelDefinition } from '../types';
import { AI_MODELS } from '../data/models';
import { api } from '../lib/api';
import { ModelLogo } from './ModelLogo';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedModelId,
  onSelectModel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'cheap' | 'quality' | 'reasoning' | 'coding' | 'vision'>('all');
  const [hoveredInfoId, setHoveredInfoId] = useState<string | null>(null);
  const [models, setModels] = useState<AIModelDefinition[]>(AI_MODELS);
  const [defaultModelId, setDefaultModelId] = useState<string>('google/gemini-2.0-flash');
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadDynamicModels = async () => {
      setIsLoadingDynamic(true);
      try {
        const res = await api.getAvailableModels();
        if (isMounted && res && res.models && res.models.length > 0) {
          setModels(res.models);
          if (res.defaultModel) {
            setDefaultModelId(res.defaultModel);
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic models, using static fallback:', err);
      } finally {
        if (isMounted) setIsLoadingDynamic(false);
      }
    };

    loadDynamicModels();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const categories: { id: 'all' | 'cheap' | 'quality' | 'reasoning' | 'coding' | 'vision'; label: string }[] = [
    { id: 'all', label: 'All Models' },
    { id: 'cheap', label: 'Cheap / Default' },
    { id: 'quality', label: 'Better Quality' },
    { id: 'reasoning', label: 'Reasoning' },
    { id: 'coding', label: 'Code' },
    { id: 'vision', label: 'Vision' },
  ];

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      let matchesCategory = true;
      if (activeCategory === 'cheap') {
        matchesCategory = m.tier === 'cheap' || m.id.includes('mini') || m.id.includes('flash') || m.id.includes('small') || m.isDefault === true;
      } else if (activeCategory === 'quality') {
        matchesCategory = m.tier === 'quality' || m.id.includes('pro') || m.id.includes('r1') || m.id.includes('reasoner') || m.id.includes('sonnet') || (m.id.includes('gpt-4o') && !m.id.includes('mini'));
      } else if (activeCategory !== 'all') {
        matchesCategory = m.category === activeCategory;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [models, searchQuery, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      id="model-selector-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="model-selector-modal"
        className="w-full max-w-lg bg-[#141416] border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden text-neutral-100 animate-in zoom-in-95 duration-150"
      >
        {/* Modal Top Bar */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-800 bg-[#18181b]">
          <button
            id="close-model-selector-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <span>Model Selection</span>
          </h2>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200">
              AICredits Hub
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by model name or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#1c1c20] border border-neutral-800 focus:border-white rounded-xl text-xs text-neutral-100 placeholder-neutral-500 outline-none transition focus:ring-1 focus:ring-white/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-5 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-[#1c1c20] text-neutral-400 hover:text-neutral-200 hover:bg-[#25252a] border border-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 divide-y divide-neutral-800/40">
          {filteredModels.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-xs">
              No matching AI models found.
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = selectedModelId === model.id;
              const isHovered = hoveredInfoId === model.id;
              const isCheapestDefault = model.id === defaultModelId || model.isDefault;

              return (
                <div
                  key={model.id}
                  onClick={() => {
                    onSelectModel(model.id);
                    onClose();
                  }}
                  className={`pt-2.5 pb-2.5 px-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition group ${
                    isSelected
                      ? 'bg-white/10 border border-white/30 text-white'
                      : 'hover:bg-[#1c1c20] border border-transparent'
                  }`}
                >
                  {/* Left Logo + Name + Company */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ModelLogo iconKey={model.iconKey} modelId={model.id} size="lg" isNew={model.isNew} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-neutral-100 group-hover:text-white transition">
                          {model.name}
                        </span>
                        {isCheapestDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 text-white font-bold rounded-full uppercase tracking-wider">
                            Default
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoveredInfoId(isHovered ? null : model.id);
                          }}
                          className="text-neutral-500 hover:text-neutral-300 p-0.5 rounded transition"
                          title={model.description}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-neutral-400 truncate font-mono">
                          {model.id}
                        </span>
                        {model.totalCostPer1M !== undefined && (
                          <span className="text-[10px] text-neutral-400 font-medium font-mono">
                            ~${model.totalCostPer1M.toFixed(2)}/1M tokens
                          </span>
                        )}
                      </div>

                      {isHovered && (
                        <div className="text-[10px] text-neutral-300 mt-1 leading-relaxed bg-[#25252a] p-2 rounded-lg border border-neutral-700 space-y-1">
                          <p>{model.description}</p>
                          {model.inputCostPer1M !== undefined && (
                            <div className="flex items-center gap-3 text-neutral-300 pt-1 border-t border-neutral-700/40 font-mono">
                              <span>In: ${model.inputCostPer1M.toFixed(3)}/1M</span>
                              <span>Out: ${model.outputCostPer1M?.toFixed(3)}/1M</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Badges & Select Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {model.badges.slice(0, 2).map((badge, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-block bg-[#1c1c20] text-neutral-300 border-neutral-700"
                      >
                        {badge}
                      </span>
                    ))}

                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shadow-sm ml-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-neutral-700 opacity-0 group-hover:opacity-100 flex items-center justify-center transition ml-1">
                        <ChevronRight className="w-3 h-3 text-neutral-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Bar info */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-[#121214] flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span>Fallback Chain: Top 3 Auto-Recovery Active</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-medium">
            Dynamic Pricing & Model Discovery
          </span>
        </div>
      </div>
    </div>
  );
};
