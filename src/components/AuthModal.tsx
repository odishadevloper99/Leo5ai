import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  X,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Lock,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { loginWithGoogle, loginWithCustomToken, logoutUser, isFirebaseConfigured, saveChatToRealtimeDB } from '../lib/firebase';
import { api } from '../lib/api';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdate: (u: UserProfile) => void;
}

type AuthStep = 'initial' | 'otp' | 'success';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate
}) => {
  const [step, setStep] = useState<AuthStep>('initial');
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setStep('initial');
      setErrorMessage('');
      setDeliveryWarning(null);
      setDevOtp(null);
      setOtpDigits(['', '', '', '', '', '']);
      setEmailInput(user.email || '');
    }
  }, [isOpen, user.email]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Step 1: Google + Firebase Authentication -> Send OTP
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    setDevOtp(null);
    try {
      // 1. Authenticate with Google popup via Firebase Auth
      const googleUser = await loginWithGoogle();
      setPendingUser(googleUser);
      setEmailInput(googleUser.email);

      // 2. Generate and Send OTP to email
      const sendRes = await api.sendEmailOtp({
        email: googleUser.email,
        uid: googleUser.uid,
        displayName: googleUser.displayName,
      });

      if (sendRes.devOtp) {
        setDevOtp(sendRes.devOtp);
      }

      if (sendRes.emailDelivered === false) {
        setDeliveryWarning(
          sendRes.deliveryError ||
          'SMTP credentials not detected in environment. If using Gmail, an App Password is required.'
        );
      } else {
        setDeliveryWarning(null);
      }

      setResendCooldown(30);
      setStep('otp');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (e: any) {
      setErrorMessage(e.message || 'Google sign-in or OTP generation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Email Login -> Send OTP
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setDeliveryWarning(null);
    setDevOtp(null);
    try {
      const generatedUid = 'usr_' + Math.random().toString(36).substring(2, 9);
      const emailUser: UserProfile = {
        uid: generatedUid,
        displayName: emailInput.split('@')[0],
        email: emailInput.trim().toLowerCase(),
        photoURL:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isAnonymous: false,
        role: 'user',
        createdAt: Date.now(),
      };
      setPendingUser(emailUser);

      const sendRes = await api.sendEmailOtp({
        email: emailUser.email,
        uid: emailUser.uid,
        displayName: emailUser.displayName,
      });

      if (sendRes.devOtp) {
        setDevOtp(sendRes.devOtp);
      }

      if (sendRes.emailDelivered === false) {
        setDeliveryWarning(
          sendRes.deliveryError ||
          'SMTP credentials not detected in environment. If using Gmail, an App Password is required.'
        );
      } else {
        setDeliveryWarning(null);
      }

      setResendCooldown(30);
      setStep('otp');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to dispatch verification email.');
    } finally {
      setLoading(false);
    }
  };

  const autoVerifyCode = async (code: string) => {
    if (code.length !== 6) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const targetEmail = pendingUser?.email || emailInput;
      const verifyRes = await api.verifyEmailOtp({
        email: targetEmail,
        otp: code,
        userProfile: pendingUser || undefined,
      });

      const confirmedUser: UserProfile = {
        uid: verifyRes.user.uid,
        displayName: verifyRes.user.displayName,
        email: verifyRes.user.email,
        photoURL: verifyRes.user.photoURL,
        isAnonymous: false,
        role: verifyRes.user.role || 'user',
        createdAt: verifyRes.user.createdAt || Date.now(),
      };

      await loginWithCustomToken(verifyRes.customToken || '', confirmedUser);
      onUserUpdate(confirmedUser);

      setStep('success');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit input box change
  const handleOtpChange = (index: number, val: string) => {
    // Handle paste of whole 6-digit code
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...otpDigits];
      digits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(digits.length, 5);
      inputRefs.current[nextFocus]?.focus();

      if (newDigits.join('').length === 6) {
        autoVerifyCode(newDigits.join(''));
      }
      return;
    }

    const cleanVal = val.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.join('').length === 6) {
      autoVerifyCode(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const targetEmail = pendingUser?.email || emailInput;
      const verifyRes = await api.verifyEmailOtp({
        email: targetEmail,
        otp: fullCode,
        userProfile: pendingUser || undefined,
      });

      const confirmedUser: UserProfile = {
        uid: verifyRes.user.uid,
        displayName: verifyRes.user.displayName,
        email: verifyRes.user.email,
        photoURL: verifyRes.user.photoURL,
        isAnonymous: false,
        role: verifyRes.user.role || 'user',
        createdAt: verifyRes.user.createdAt || Date.now(),
      };

      // Authenticate with Firebase using minted custom token & sync profile
      await loginWithCustomToken(verifyRes.customToken || '', confirmedUser);
      onUserUpdate(confirmedUser);

      // Transition to Success state
      setStep('success');
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const targetEmail = pendingUser?.email || emailInput;
      const sendRes = await api.sendEmailOtp({
        email: targetEmail,
        uid: pendingUser?.uid,
        displayName: pendingUser?.displayName,
      });

      if (sendRes.emailDelivered === false) {
        setDeliveryWarning(
          sendRes.deliveryError ||
          'SMTP credentials not detected in environment. If using Gmail, an App Password is required.'
        );
      } else {
        setDeliveryWarning(null);
      }

      setResendCooldown(30);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await logoutUser();
    onUserUpdate({
      uid: 'guest-' + Date.now(),
      displayName: 'Guest User',
      email: 'guest@leoai.app',
      isAnonymous: true,
      role: 'user',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150 relative overflow-hidden">
        {/* Close Button */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>2-Step Verification</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* STEP 1: INITIAL LOGIN (Google + Firebase Auth) */}
        {/* ---------------------------------------------------- */}
        {step === 'initial' && (
          <div className="space-y-4 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 mx-auto flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-display font-bold text-lg text-neutral-900">
                Sign in to Leo AI
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Authenticate with Google & verify via secure Email OTP
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Google Authentication Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 hover:border-purple-300 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2.5 shadow-xs hover:shadow transition group cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? 'Authenticating with Google...' : 'Continue with Google'}</span>
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-[10px] uppercase font-semibold text-neutral-400">or email</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            {/* Direct Email OTP form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 focus:bg-white text-xs text-neutral-900 rounded-xl border border-neutral-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition"
              >
                <span>Send Verification OTP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Current user sign-out option */}
            {!user.isAnonymous && (
              <div className="pt-2 border-t border-neutral-100">
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 px-3 text-neutral-500 hover:text-red-600 text-xs font-medium flex items-center justify-center gap-1.5 transition rounded-lg hover:bg-neutral-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out current account</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 2: ENTER & VERIFY OTP */}
        {/* ---------------------------------------------------- */}
        {step === 'otp' && (
          <div className="space-y-4 pt-2">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 mx-auto flex items-center justify-center text-purple-600">
              <KeyRound className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-display font-bold text-lg text-neutral-900">
                Enter Verification Code
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                We sent a 6-digit OTP code to <br />
                <span className="font-semibold text-neutral-800">{pendingUser?.email || emailInput}</span>
              </p>
            </div>

            {deliveryWarning && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950">Email Transport Notice:</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">{deliveryWarning}</p>
                  {devOtp && (
                    <button
                      type="button"
                      onClick={() => {
                        const digits = devOtp.split('');
                        setOtpDigits(digits);
                        autoVerifyCode(devOtp);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-mono font-bold text-[11px] rounded-lg transition"
                    >
                      <span>⚡ Auto-fill Test Code: <strong>{devOtp}</strong></span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex justify-center gap-2 sm:gap-2.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-lg font-bold font-mono text-neutral-900 bg-neutral-50 focus:bg-white rounded-xl border border-neutral-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none transition"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify OTP & Complete Login</span>
                  </>
                )}
              </button>
            </form>

            {/* Resend OTP */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                onClick={() => setStep('initial')}
                className="text-neutral-400 hover:text-neutral-700 font-medium"
              >
                ← Back
              </button>

              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-purple-600 hover:text-purple-800 disabled:text-neutral-400 font-medium flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Code'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* STEP 3: SUCCESS (✅ Login Complete) */}
        {/* ---------------------------------------------------- */}
        {step === 'success' && (
          <div className="space-y-4 py-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="font-display font-bold text-xl text-neutral-900">
                Login Complete!
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Your account is verified and synchronized with Firebase Realtime Database.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center gap-3">
              <img
                src={
                  pendingUser?.photoURL ||
                  user.photoURL ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt="User"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-400"
              />
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-neutral-900 truncate">
                  {pendingUser?.displayName || user.displayName}
                </p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {pendingUser?.email || user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
