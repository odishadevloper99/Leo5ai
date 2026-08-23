import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Info,
  Sparkles,
  Zap,
  Eye,
  Code2,
  BrainCircuit,
  Coins,
  ChevronRight,
  SlidersHorizontal,
  Star
} from 'lucide-react';
import { AIModelDefinition } from '../types';
import { AI_MODELS } from '../data/models';
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
  const [activeCategory, setActiveCategory] = useState<'all' | 'text' | 'vision' | 'reasoning' | 'coding'>('all');
  const [hoveredInfoId, setHoveredInfoId] = useState<string | null>(null);

  const categories: { id: 'all' | 'text' | 'vision' | 'reasoning' | 'coding'; label: string }[] = [
    { id: 'all', label: 'All Models' },
    { id: 'text', label: 'Text' },
    { id: 'reasoning', label: 'Reasoning' },
    { id: 'coding', label: 'Code' },
    { id: 'vision', label: 'Vision' },
  ];

  const filteredModels = useMemo(() => {
    return AI_MODELS.filter((m) => {
      const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      id="model-selector-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="model-selector-modal"
        className="w-full max-w-lg bg-[#0b0f19] border border-neutral-800/80 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden text-neutral-100 animate-in zoom-in-95 duration-150"
      >
        {/* Modal Top Bar */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-800/60 bg-[#0e1424]/90">
          <button
            id="close-model-selector-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <span>Models</span>
          </h2>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-700/40 text-purple-300">
              AI Engines
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#141b2d] border border-neutral-800 focus:border-purple-500 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 outline-none transition focus:ring-2 focus:ring-purple-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                    : 'bg-[#141b2d] text-neutral-400 hover:text-neutral-200 hover:bg-[#1a233a] border border-neutral-800/60'
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

              return (
                <div
                  key={model.id}
                  onClick={() => {
                    onSelectModel(model.id);
                    onClose();
                  }}
                  className={`pt-2 pb-2 px-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition group ${
                    isSelected
                      ? 'bg-purple-950/40 border border-purple-600/40 text-white'
                      : 'hover:bg-[#141b2d]/80 border border-transparent'
                  }`}
                >
                  {/* Left Logo + Name + Company */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ModelLogo iconKey={model.iconKey} modelId={model.id} size="lg" isNew={model.isNew} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-100 group-hover:text-purple-200 transition">
                          {model.name}
                        </span>
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
                      <p className="text-[11px] text-neutral-400 truncate">
                        {model.company}
                      </p>
                      {isHovered && (
                        <p className="text-[10px] text-purple-300 mt-1 leading-relaxed bg-[#1b233a] p-1.5 rounded-lg border border-neutral-700/60">
                          {model.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Badges & Select Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {model.badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          badge === '50% off'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
                            : badge === 'Anon'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800/40'
                            : badge === 'Private'
                            ? 'bg-neutral-800/90 text-neutral-300 border-neutral-700'
                            : badge === 'Uncensored'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                            : 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                        }`}
                      >
                        {badge}
                      </span>
                    ))}

                    <div className="w-5 h-5 flex items-center justify-center text-amber-400/80 ml-0.5">
                      <Coins className="w-3.5 h-3.5" />
                    </div>

                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm ml-1">
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
        <div className="px-5 py-3 border-t border-neutral-800/60 bg-[#0c111e] flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Unified System Persona Active</span>
          </div>
          <span className="text-[11px] text-neutral-500">
            Powered by AICredits & Leo AI
          </span>
        </div>
      </div>
    </div>
  );
};
