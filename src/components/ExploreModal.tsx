import React from 'react';
import { Compass, Sparkles, X, BrainCircuit, Eye, Code2, Zap, ArrowRight } from 'lucide-react';

interface ExploreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkflow: (prompt: string) => void;
}

export const ExploreModal: React.FC<ExploreModalProps> = ({ isOpen, onClose, onSelectWorkflow }) => {
  if (!isOpen) return null;

  const workflows = [
    {
      title: 'Vision Architectural Auditor',
      desc: 'Upload system architecture diagrams or wireframes for security & performance breakdown.',
      icon: Eye,
      color: 'text-purple-600 bg-purple-50',
      prompt: 'Please audit this system architecture: Identify single points of failure, recommend caching layers, and analyze data access bottlenecks.',
    },
    {
      title: 'Deep Research Synthesis',
      desc: 'Exhaustive comparative breakdown across legal, economic, or technical frameworks.',
      icon: BrainCircuit,
      color: 'text-indigo-600 bg-indigo-50',
      prompt: 'Conduct an in-depth research breakdown on state-of-the-art vector memory persistence techniques (Memo API vs Pinecone vs pgvector) with benchmark trade-offs.',
    },
    {
      title: 'Full-Stack Code Architect',
      desc: 'Generate end-to-end typed React and Node.js solutions with clean separation of concerns.',
      icon: Code2,
      color: 'text-emerald-600 bg-emerald-50',
      prompt: 'Design a production-grade Express route handler in TypeScript with robust input validation, rate limiting, and structured error responses.',
    },
    {
      title: 'Rapid Executive Pitch',
      desc: 'Transform raw product specs into crisp, persuasive investor and stakeholder pitches.',
      icon: Zap,
      color: 'text-amber-600 bg-amber-50',
      prompt: 'Draft an executive pitch deck outline (10 slides) for an enterprise AI assistant named Leo AI with vision models and persistent memory.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl border border-[#333538] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-[#333538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#28292c] text-white">
              <Compass className="w-4 h-4" />
            </div>
            <h2 className="font-display font-semibold text-base text-white">Explore Leo AI Intelligence</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8e918f] hover:text-white hover:bg-[#28292c] rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3">
          <p className="text-xs text-[#8e918f] mb-2">
            Pre-configured cognitive engines tailored for complex enterprise workflows:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {workflows.map((wf, i) => {
              const Icon = wf.icon;
              return (
                <div
                  key={i}
                  onClick={() => {
                    onSelectWorkflow(wf.prompt);
                    onClose();
                  }}
                  className="p-4 rounded-2xl border border-[#333538] hover:border-neutral-500 bg-[#131314] hover:bg-[#28292c] transition cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#28292c] text-white">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-semibold text-white group-hover:text-white">
                      {wf.title}
                    </h3>
                    <p className="text-[11px] text-[#8e918f] mt-1 leading-relaxed">{wf.desc}</p>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-white font-medium mt-3">
                    <span>Activate workflow</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
