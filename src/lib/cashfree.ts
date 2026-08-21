import { api } from './api';
import { PaymentOrder, PricingPlan, UserProfile } from '../types';

declare global {
  interface Window {
    Cashfree?: any;
  }
}

/**
 * Load Cashfree JS SDK dynamically if not already loaded in the document
 */
export async function loadCashfreeSdk(): Promise<any> {
  if (typeof window !== 'undefined' && window.Cashfree) {
    return window.Cashfree;
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('cashfree-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Cashfree));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Cashfree SDK')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'cashfree-js-sdk';
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        reject(new Error('Cashfree SDK loaded but window.Cashfree is undefined'));
      }
    };
    script.onerror = () => reject(new Error('Network error loading Cashfree SDK'));
    document.head.appendChild(script);
  });
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  user?: UserProfile;
  order?: PaymentOrder;
  creditsAdded?: number;
  message?: string;
  error?: string;
}

/**
 * Initiate Cashfree checkout session
 */
export async function initiateCashfreePayment(params: {
  plan: PricingPlan;
  user: UserProfile;
  customerPhone?: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<CheckoutResult> {
  const { plan, user, customerPhone, onStatusUpdate } = params;

  try {
    onStatusUpdate?.('Creating secure payment order...');

    // 1. Create order on backend
    const orderRes = await api.createCashfreeOrder({
      planId: plan.id,
      customerName: user.displayName || 'Leo User',
      customerEmail: user.email || 'user@example.com',
      customerPhone: customerPhone || user.phone || '9876543210',
      userId: user.uid,
    });

    if (!orderRes.success || !orderRes.orderId) {
      throw new Error(orderRes.message || 'Could not create Cashfree order');
    }

    const { orderId, paymentSessionId, isSimulated, env } = orderRes;

    // 2. If simulation mode (e.g. credentials not set in env yet), run simulated instant verification
    if (isSimulated || !paymentSessionId || paymentSessionId.startsWith('session_sim_')) {
      onStatusUpdate?.('Processing sandbox payment...');
      await new Promise((r) => setTimeout(r, 1200));

      onStatusUpdate?.('Verifying activation...');
      const verifyRes = await api.verifyCashfreeOrder({
        orderId,
        userId: user.uid,
      });

      return {
        success: true,
        orderId,
        user: verifyRes.user,
        order: verifyRes.order,
        creditsAdded: verifyRes.creditsAdded,
        message: verifyRes.message || `Activated ${plan.name} in Sandbox Test Mode!`,
      };
    }

    // 3. Initialize real Cashfree SDK
    onStatusUpdate?.('Opening Cashfree Gateway...');
    const CashfreeFactory = await loadCashfreeSdk();
    const cashfree = CashfreeFactory({
      mode: env === 'PRODUCTION' ? 'production' : 'sandbox',
    });

    return new Promise((resolve) => {
      cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_modal',
      }).then(async (result: any) => {
        if (result.error) {
          console.warn('[CASHFREE POPUP ERROR]:', result.error);
          resolve({
            success: false,
            error: result.error.message || 'Payment was cancelled or failed.',
          });
          return;
        }

        if (result.paymentDetails) {
          onStatusUpdate?.('Verifying payment confirmation...');
          try {
            const verifyRes = await api.verifyCashfreeOrder({
              orderId,
              userId: user.uid,
            });

            resolve({
              success: true,
              orderId,
              user: verifyRes.user,
              order: verifyRes.order,
              creditsAdded: verifyRes.creditsAdded,
              message: verifyRes.message,
            });
          } catch (err: any) {
            resolve({
              success: false,
              error: err.message || 'Failed to verify transaction with server',
            });
          }
        } else if (result.redirect) {
          // Modal will redirect or handled via redirect
          resolve({
            success: true,
            orderId,
            message: 'Redirecting to payment confirmation...',
          });
        } else {
          // Modal closed without completing or payment status unknown, attempt verification
          try {
            const verifyRes = await api.verifyCashfreeOrder({
              orderId,
              userId: user.uid,
            });
            resolve({
              success: true,
              orderId,
              user: verifyRes.user,
              order: verifyRes.order,
              creditsAdded: verifyRes.creditsAdded,
              message: verifyRes.message,
            });
          } catch {
            resolve({
              success: false,
              error: 'Payment window was closed before completion.',
            });
          }
        }
      }).catch((err: any) => {
        console.error('Cashfree checkout error:', err);
        resolve({
          success: false,
          error: err.message || 'Cashfree checkout failed to open',
        });
      });
    });
  } catch (err: any) {
    console.error('Initiate payment exception:', err);
    return {
      success: false,
      error: err.message || 'Failed to initiate payment',
    };
  }
}
