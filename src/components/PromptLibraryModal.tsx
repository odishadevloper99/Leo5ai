import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Search,
  Clock,
  Lightbulb,
  Hammer,
  Camera,
  Layers,
  Mail,
  ArrowRight
} from 'lucide-react';
import { DEFAULT_PROMPT_TEMPLATES } from '../lib/prompts';
import { PromptTemplate } from '../types';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Productivity', 'Creative', 'Research', 'Coding', 'Writing'];

  const filtered = DEFAULT_PROMPT_TEMPLATES.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'clock':
        return <Clock className="w-4 h-4 text-purple-600" />;
      case 'lightbulb':
        return <Lightbulb className="w-4 h-4 text-amber-600" />;
      case 'gavel':
        return <Hammer className="w-4 h-4 text-indigo-600" />;
      case 'camera':
        return <Camera className="w-4 h-4 text-emerald-600" />;
      case 'layers':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'mail':
        return <Mail className="w-4 h-4 text-rose-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="font-display font-semibold text-base text-neutral-900">
              Leo AI Saved Prompts & Intelligence Presets
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-neutral-100 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search prompt templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs focus:bg-white focus:border-purple-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Prompts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectPrompt(item.prompt);
                onClose();
              }}
              className="group p-3.5 rounded-2xl border border-purple-100/80 hover:border-purple-300 hover:bg-purple-50/40 hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-neutral-50 group-hover:bg-white transition mt-0.5">
                  {getIcon(item.icon)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-neutral-900 group-hover:text-purple-900">
                      {item.title}
                    </h3>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-neutral-100 text-neutral-600">
                      {item.category}
                    </span>
                    {item.isVisionPrompt && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Vision
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">{item.description}</p>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition flex-shrink-0 mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
