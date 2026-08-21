import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  Crown,
  Sparkles,
  ShieldCheck,
  CreditCard,
  History,
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Receipt,
  ExternalLink,
  Flame
} from 'lucide-react';
import { CashfreeConfig, PaymentOrder, PricingPlan, UserProfile } from '../types';
import { api } from '../lib/api';
import { initiateCashfreePayment } from '../lib/cashfree';

interface UpgradePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  defaultTab?: 'plans' | 'history';
}

export const UpgradePricingModal: React.FC<UpgradePricingModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  defaultTab = 'plans',
}) => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [cashfreeConfig, setCashfreeConfig] = useState<CashfreeConfig>({
    isConfigured: false,
    env: 'SANDBOX',
  });
  const [activeTab, setActiveTab] = useState<'plans' | 'credit_packs' | 'history'>(
    defaultTab === 'history' ? 'history' : 'plans'
  );
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [phone, setPhone] = useState<string>(user.phone || '9876543210');
  const [loading, setLoading] = useState<boolean>(true);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [successOrder, setSuccessOrder] = useState<PaymentOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [historyOrders, setHistoryOrders] = useState<PaymentOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadPaymentHistory();
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const configRes = await api.getCashfreeConfig();
      setCashfreeConfig({
        isConfigured: configRes.isConfigured,
        env: configRes.env,
        appId: configRes.appId,
      });

      if (configRes.plans && configRes.plans.length > 0) {
        setPlans(configRes.plans);
      } else {
        const plansRes = await api.getPricingPlans();
        setPlans(plansRes.plans || []);
      }
    } catch (err: any) {
      console.warn('Failed to load pricing plans:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getPaymentHistory(user.uid);
      setHistoryOrders(res.orders || []);
    } catch (err: any) {
      console.warn('Failed to load history:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStartPayment = async (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setErrorMessage('');
    setSuccessOrder(null);
    setCheckoutLoading(true);
    setStatusMessage('Connecting to Cashfree Gateway...');

    try {
      const result = await initiateCashfreePayment({
        plan,
        user,
        customerPhone: phone,
        onStatusUpdate: (msg) => setStatusMessage(msg),
      });

      if (result.success) {
        if (result.user) {
          onUserUpdated(result.user);
        }
        if (result.order) {
          setSuccessOrder(result.order);
        } else {
          setSuccessOrder({
            orderId: result.orderId || `order_${Date.now()}`,
            orderAmount: plan.price,
            orderCurrency: 'INR',
            orderStatus: 'PAID',
            planId: plan.id,
            planName: plan.name,
            creditsGranted: plan.creditsGranted,
            customerName: user.displayName || 'Leo User',
            customerEmail: user.email || 'user@example.com',
            customerPhone: phone,
            createdAt: Date.now(),
            paidAt: Date.now(),
          });
        }
      } else {
        setErrorMessage(result.error || 'Payment failed or cancelled.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during payment processing.');
    } finally {
      setCheckoutLoading(false);
      setStatusMessage('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const subscriptionPlans = plans.filter((p) => p.type === 'subscription');
  const creditPackPlans = plans.filter((p) => p.type === 'credit_pack');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="upgrade-pricing-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-neutral-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">Leo AI Pro & Credits</h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  Cashfree PG
                </span>
                {cashfreeConfig.env === 'SANDBOX' && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-200">
                    Sandbox Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                Unlock high-speed vision reasoning, deep cognitive search, and persistent memory.
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

        {/* Current Balance Banner */}
        <div className="bg-purple-900 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            <span>
              Current Plan:{' '}
              <strong className="font-semibold uppercase tracking-wider text-purple-200">
                {user.plan || 'Free Starter'}
              </strong>
            </span>
            <span className="text-purple-300">•</span>
            <span>
              Available Balance: <strong className="text-amber-300 font-bold">{user.credits ?? 50}</strong> credits
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-purple-200">
            <span>Powered by Cashfree Payments (UPI, Cards, NetBanking, Wallets)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-100 bg-white">
          <button
            onClick={() => {
              setActiveTab('plans');
              setSuccessOrder(null);
              setErrorMessage('');
            }}
            className={`pb-2.5 text-xs font-semibold px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'plans'
                ? 'border-purple-600 text-purple-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Monthly & Yearly Plans</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('credit_packs');
              setSuccessOrder(null);
              setErrorMessage('');
            }}
            className={`pb-2.5 text-xs font-semibold px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'credit_packs'
                ? 'border-purple-600 text-purple-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Top-up Credit Packs</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              setSuccessOrder(null);
              setErrorMessage('');
            }}
            className={`pb-2.5 text-xs font-semibold px-3 border-b-2 transition flex items-center gap-1.5 ml-auto ${
              activeTab === 'history'
                ? 'border-purple-600 text-purple-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Payment Invoices</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Payment Notice</p>
                <p>{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Screen */}
          {successOrder ? (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-950">Payment Successful!</h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Your payment of <strong className="font-bold">₹{successOrder.orderAmount}</strong> via Cashfree was
                  verified.
                </p>
              </div>

              <div className="max-w-md mx-auto bg-white rounded-xl p-4 border border-emerald-100 text-left text-xs space-y-2 shadow-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Order ID:</span>
                  <span className="font-mono text-neutral-800 font-semibold">{successOrder.orderId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Plan Activated:</span>
                  <span className="font-semibold text-purple-900">{successOrder.planName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100">
                  <span className="text-neutral-500">Credits Credited:</span>
                  <span className="font-bold text-emerald-700">+{successOrder.creditsGranted} Credits</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Updated Balance:</span>
                  <span className="font-bold text-neutral-900">{user.credits} Total Credits</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setSuccessOrder(null);
                    onClose();
                  }}
                  className="px-5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition"
                >
                  Start Using Leo AI Pro
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  View Invoice
                </button>
              </div>
            </div>
          ) : null}

          {/* Loading Indicator for checkout */}
          {checkoutLoading && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-center gap-3 text-purple-900 text-xs font-medium">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <span>{statusMessage || 'Processing checkout with Cashfree PG...'}</span>
            </div>
          )}

          {/* TAB 1: Subscription Plans */}
          {activeTab === 'plans' && !successOrder && (
            <div>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <p className="text-xs">Loading plans...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {subscriptionPlans.map((plan) => {
                    const isCurrent = (user.plan || 'free') === (plan.id.includes('ultra') ? 'ultra' : plan.id.includes('pro') ? 'pro' : 'free');
                    return (
                      <div
                        key={plan.id}
                        className={`relative rounded-2xl p-5 flex flex-col justify-between transition border ${
                          plan.popular
                            ? 'border-purple-500 bg-gradient-to-b from-purple-50/60 to-white shadow-md ring-1 ring-purple-400'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-xs'
                        }`}
                      >
                        {plan.badge && (
                          <div className="absolute -top-2.5 right-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider flex items-center gap-1">
                            <Flame className="w-3 h-3 text-amber-300" />
                            {plan.badge}
                          </div>
                        )}

                        <div>
                          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                            {plan.name}
                            {plan.id.includes('pro') && <Crown className="w-4 h-4 text-amber-500" />}
                          </h3>
                          <p className="text-[11px] text-neutral-500 mt-0.5 min-h-[32px]">{plan.tagline}</p>

                          <div className="my-4">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-extrabold text-neutral-900">₹{plan.price}</span>
                              <span className="text-xs text-neutral-400">/{plan.period}</span>
                              {plan.originalPrice && (
                                <span className="text-xs text-neutral-400 line-through ml-1">
                                  ₹{plan.originalPrice}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-purple-700 font-semibold mt-0.5">
                              Includes {plan.creditsGranted.toLocaleString()} AI Credits
                            </p>
                          </div>

                          <div className="space-y-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                            {plan.features.map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5" />
                                <span className="text-[11px] leading-tight">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-neutral-100">
                          {plan.price === 0 ? (
                            <button
                              disabled
                              className="w-full py-2 px-3 rounded-xl bg-neutral-100 text-neutral-400 text-xs font-semibold cursor-not-allowed text-center"
                            >
                              {isCurrent ? 'Current Plan' : 'Free Tier'}
                            </button>
                          ) : (
                            <button
                              disabled={checkoutLoading}
                              onClick={() => handleStartPayment(plan)}
                              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] ${
                                plan.popular
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 hover:shadow-md'
                                  : 'bg-neutral-900 hover:bg-black text-white'
                              }`}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay ₹{plan.price} via Cashfree</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Credit Packs */}
          {activeTab === 'credit_packs' && !successOrder && (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-neutral-900">Instant AI Token Packs</h3>
                <p className="text-xs text-neutral-500">
                  Non-expiring credits for Vision OCR, deep reasoning, and high-frequency queries.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {creditPackPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-5 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-purple-300 hover:shadow-sm transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-neutral-900">{plan.name}</h4>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          +{plan.creditsGranted} Credits
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">{plan.tagline}</p>

                      <div className="my-3">
                        <span className="text-2xl font-extrabold text-neutral-900">₹{plan.price}</span>
                        <span className="text-xs text-neutral-400 ml-1">one-time payment</span>
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-600 mb-4">
                        {plan.features.map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[11px]">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={checkoutLoading}
                      onClick={() => handleStartPayment(plan)}
                      className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Buy {plan.creditsGranted} Credits for ₹{plan.price}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Payment History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Payment Invoices & Receipts</h3>
                  <p className="text-xs text-neutral-500">View transactions processed through Cashfree Gateway.</p>
                </div>
                <button
                  onClick={loadPaymentHistory}
                  className="px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
                >
                  Refresh
                </button>
              </div>

              {historyLoading ? (
                <div className="py-8 flex flex-col items-center justify-center text-neutral-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <p className="text-xs">Fetching transactions...</p>
                </div>
              ) : historyOrders.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                  <Receipt className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-neutral-700">No payment records found yet</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Your invoices and transaction receipts will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100 text-xs">
                  {historyOrders.map((order) => (
                    <div key={order.orderId} className="p-3.5 flex items-center justify-between hover:bg-neutral-50/60 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{order.planName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              order.orderStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.orderStatus}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                          <span>{order.orderId}</span>
                          <button
                            onClick={() => copyToClipboard(order.orderId, order.orderId)}
                            title="Copy Order ID"
                            className="hover:text-neutral-700"
                          >
                            {copiedId === order.orderId ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400">
                          {new Date(order.createdAt).toLocaleDateString()} at{' '}
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-neutral-900">₹{order.orderAmount}</span>
                        <p className="text-[10px] text-purple-700 font-medium">+{order.creditsGranted} Credits</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cashfree Environment Variable Setup Guide Card */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-600" />
                Cashfree Gateway Configuration for Render / Production
              </span>
              <span className="text-[10px] text-neutral-400">Environment Setup</span>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              To connect your real Cashfree merchant account, add these secret environment variables in your Render /
              Vercel dashboard:
            </p>
            <div className="bg-neutral-900 text-neutral-200 p-2.5 rounded-xl font-mono text-[11px] space-y-1">
              <p className="text-emerald-400">CASHFREE_APP_ID=your_cashfree_app_id</p>
              <p className="text-emerald-400">CASHFREE_SECRET_KEY=your_cashfree_secret_key</p>
              <p className="text-neutral-400">CASHFREE_ENV=SANDBOX # or PRODUCTION</p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
              <span>Supports UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, NetBanking, EMI.</span>
              <a
                href="https://merchant.cashfree.com/merchants/login"
                target="_blank"
                rel="noreferrer"
                className="text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1"
              >
                Cashfree Dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-bit SSL encrypted checkout via Cashfree PG</span>
          </div>

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
