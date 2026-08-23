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
    navigator.clipboard.writeText('@Unknownboy1525');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="upgrade-pricing-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-neutral-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">Leo AI Upgrade & Limits</h2>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  VIP Access
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Upgrade your daily chat limits and unlock premium intelligence tiers.
              </p>
            </div>
          </div>

          <button
            id="close-upgrade-modal-btn"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Plan Summary Banner */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>
              Current Account Status:{' '}
              <strong className="font-semibold uppercase tracking-wider text-purple-200">
                {user.plan || 'Free'}
              </strong>
            </span>
            <span className="text-purple-300">•</span>
            <span>
              Daily Limit: <strong className="text-amber-300 font-bold">{user.dailyChatLimit && user.dailyChatLimit >= 90000 ? 'Unlimited' : (user.dailyChatLimit || 50)} chats/day</strong>
            </span>
          </div>

          <div className="text-[11px] text-purple-200 flex items-center gap-1.5 font-mono">
            <span>Used today: {user.dailyChatsUsed || 0}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Direct Upgrade Telegram Card */}
          <div className="p-5 bg-gradient-to-br from-purple-50 via-indigo-50/50 to-blue-50 border-2 border-purple-300/80 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md font-bold text-xl">
                ✈️
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900">
                    Get Custom Limits & Instant VIP Upgrade
                  </h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  For unlimited daily chats, VIP status, or account limit increases, message the administrator directly on Telegram:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 bg-white border border-purple-200 rounded-lg font-mono text-xs font-bold text-purple-900 shadow-2xs">
                    @Unknownboy1525
                  </span>
                  <button
                    type="button"
                    onClick={copyTelegramHandle}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 bg-white border border-neutral-200 rounded-lg text-[11px] font-medium flex items-center gap-1 hover:border-neutral-300 transition"
                  >
                    {copiedHandle ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
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
              href="https://t.me/Unknownboy1525"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shrink-0 shadow-md hover:shadow-lg"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Message on Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Plan Comparison Grid */}
          <div>
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
              Membership Tiers & Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-4 flex flex-col justify-between transition border ${
                    plan.highlight
                      ? 'border-purple-500 bg-purple-50/30 shadow-md ring-1 ring-purple-300'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-neutral-900">{plan.name}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          plan.highlight
                            ? 'bg-purple-600 text-white'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mb-3 min-h-[30px] leading-tight">
                      {plan.tagline}
                    </p>

                    <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 mb-3 text-center">
                      <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Daily Allowance</span>
                      <span className="text-sm font-extrabold text-neutral-900">{plan.limit}</span>
                    </div>

                    <div className="space-y-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                      {plan.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight text-neutral-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100">
                    {plan.isCurrent ? (
                      <div className="w-full py-2 text-center text-xs font-semibold text-neutral-500 bg-neutral-100 rounded-xl">
                        Active Tier
                      </div>
                    ) : (
                      <a
                        href="https://t.me/Unknownboy1525"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition text-center"
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
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs flex items-center justify-between gap-3 text-neutral-600">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                Daily chat limits automatically reset at midnight. For team licensing or custom model parameters, please contact the administrator.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            Support: Telegram @Unknownboy1525
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-xl transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
