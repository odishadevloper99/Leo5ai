import React, { useState } from 'react';
import {
  X,
  Crown,
  Check,
  Zap,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Send,
  MessageCircle,
  Copy,
  Users
} from 'lucide-react';
import { UserProfile } from '../types';

interface UpgradePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdated?: (user: UserProfile) => void;
  defaultTab?: 'plans' | 'history';
}

export const UpgradePricingModal: React.FC<UpgradePricingModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [copiedHandle, setCopiedHandle] = useState(false);

  if (!isOpen) return null;

  const copyTelegramHandle = () => {
    navigator.clipboard.writeText('@MrNewton_2');
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const plans = [
    {
      name: 'Free Starter',
      badge: 'Active Tier',
      tagline: 'Standard access for everyday questions, chat, and learning',
      limit: '50 chats / day',
      features: [
        'Access to GLM 5.3, Grok 4.6 & Qwen 3.8 Max',
        'Standard response speed',
        '50 AI chats refreshed daily',
        'Persistent cross-session memory',
        'Image and visual analysis'
      ],
      isCurrent: true,
    },
    {
      name: 'Leo Pro VIP',
      badge: 'Most Popular',
      tagline: 'High volume reasoning, faster response times, and extended limits',
      limit: '500+ chats / day',
      features: [
        'High priority processing & reasoning speed',
        'Deep cognitive search and code synthesis',
        '500+ daily chats limit (or custom limit)',
        'Direct priority support on Telegram',
        'Early access to new experimental models'
      ],
      highlight: true,
    },
    {
      name: 'Leo Enterprise / Unlimited',
      badge: 'Unlimited Power',
      tagline: 'Dedicated unlimited throughput for power users and teams',
      limit: 'Unlimited (∞)',
      features: [
        'Completely unlimited daily chats',
        'Dedicated custom token allowances',
        'Custom system prompt tailoring & API endpoints',
        'VIP direct 1-on-1 contact on Telegram',
        'White-glove account onboarding'
      ],
      highlight: false,
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="upgrade-pricing-modal"
        className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-[#333538] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333538] bg-[#131314]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-xs">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Leo AI Upgrade & Limits</h2>
                <span className="bg-[#28292c] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-neutral-700">
                  <Sparkles className="w-3 h-3 text-white" />
                  VIP Access
                </span>
              </div>
              <p className="text-xs text-[#8e918f]">
                Upgrade your daily chat limits and unlock premium intelligence tiers.
              </p>
            </div>
          </div>

          <button
            id="close-upgrade-modal-btn"
            onClick={onClose}
            className="p-2 text-[#8e918f] hover:text-white hover:bg-[#28292c] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Plan Summary Banner */}
        <div className="bg-[#131314] border-b border-[#333538] text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-white animate-pulse" />
            <span>
              Current Account Status:{' '}
              <strong className="font-semibold uppercase tracking-wider text-white">
                {user.plan || 'Free'}
              </strong>
            </span>
            <span className="text-neutral-500">•</span>
            <span>
              Daily Limit: <strong className="text-white font-bold">{user.dailyChatLimit && user.dailyChatLimit >= 90000 ? 'Unlimited' : (user.dailyChatLimit || 50)} chats/day</strong>
            </span>
          </div>

          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 font-mono">
            <span>Used today: {user.dailyChatsUsed || 0}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Direct Upgrade Telegram Card */}
          <div className="p-5 bg-[#131314] border border-[#333538] rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#28292c] border border-neutral-700 flex items-center justify-center text-white shrink-0 shadow-md font-bold text-xl">
                ✈️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Get Custom Limits & Instant VIP Upgrade
                  </h3>
                  <span className="text-[10px] bg-[#28292c] text-white font-bold px-2 py-0.5 rounded-full border border-neutral-700">
                    Active
                  </span>
                </div>
                <p className="text-xs text-[#8e918f] leading-relaxed">
                  For unlimited daily chats, Premium ₹299, VIP status, or account limit increases, message the administrator directly on Telegram:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 bg-black border border-neutral-700 rounded-lg font-mono text-xs font-bold text-white shadow-2xs">
                    @MrNewton_2
                  </span>
                  <button
                    type="button"
                    onClick={copyTelegramHandle}
                    className="p-1.5 text-neutral-300 hover:text-white bg-[#28292c] border border-neutral-700 rounded-lg text-[11px] font-medium flex items-center gap-1 hover:border-neutral-500 transition cursor-pointer"
                  >
                    {copiedHandle ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span className="text-white">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <a
              href="https://t.me/MrNewton_2"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-neutral-200 active:scale-[0.99] text-black rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shrink-0 shadow-md cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Message on Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Plan Comparison Grid */}
          <div>
            <h4 className="text-xs font-bold text-[#8e918f] uppercase tracking-wider mb-3">
              Membership Tiers & Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-4 flex flex-col justify-between transition border ${
                    plan.highlight
                      ? 'border-white/40 bg-[#131314] shadow-md ring-1 ring-white/20'
                      : 'border-[#333538] bg-[#131314] hover:border-neutral-600 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{plan.name}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          plan.highlight
                            ? 'bg-white text-black'
                            : 'bg-[#28292c] text-[#c4c7c5]'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8e918f] mb-3 min-h-[30px] leading-tight">
                      {plan.tagline}
                    </p>

                    <div className="p-2.5 bg-[#1e1f20] rounded-xl border border-[#333538] mb-3 text-center">
                      <span className="text-[10px] text-[#8e918f] uppercase font-semibold block">Daily Allowance</span>
                      <span className="text-sm font-extrabold text-white">{plan.limit}</span>
                    </div>

                    <div className="space-y-2 border-t border-[#333538] pt-3 text-xs text-[#c4c7c5]">
                      {plan.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight text-[#e3e3e3]">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#333538]">
                    {plan.isCurrent ? (
                      <div className="w-full py-2 text-center text-xs font-semibold text-[#8e918f] bg-[#28292c] rounded-xl">
                        Active Tier
                      </div>
                    ) : (
                      <a
                        href="https://t.me/MrNewton_2"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 bg-white hover:bg-neutral-200 text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition text-center cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Request via Telegram</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="p-4 bg-[#131314] rounded-2xl border border-[#333538] text-xs flex items-center justify-between gap-3 text-[#c4c7c5]">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-white shrink-0" />
              <span>
                Daily chat limits automatically reset at midnight. For team licensing or custom model parameters, please contact the administrator.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#333538] bg-[#131314] flex items-center justify-between text-xs text-[#8e918f]">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#8e918f]" />
            Support: Telegram @MrNewton_2
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-white hover:bg-[#28292c] rounded-xl transition font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
