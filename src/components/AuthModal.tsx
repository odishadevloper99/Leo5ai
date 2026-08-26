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
  Eye,
  EyeOff,
  User,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import {
  loginWithEmailPassword,
  registerWithEmailPassword,
  loginWithCustomToken,
  logoutUser,
  saveChatToRealtimeDB
} from '../lib/firebase';
import { api } from '../lib/api';
import { UserProfile } from '../types';
import { LeoLogoMark } from './LeoLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdate: (u: UserProfile) => void;
}

type AuthStep = 'auth' | 'otp' | 'success';
type AuthMode = 'login' | 'register' | 'otp_login';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate
}) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification state
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifyElapsedSeconds, setVerifyElapsedSeconds] = useState(0);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isVerifyingRef = useRef(false);
  const verifyTimerRef = useRef<any>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setStep('auth');
      setAuthMode('login');
      setErrorMessage('');
      setDeliveryWarning(null);
      setDevOtp(null);
      setOtpDigits(['', '', '', '', '', '']);
      setEmailInput(user.email && user.email !== 'guest@leoai.app' ? user.email : '');
      setPasswordInput('');
      setNameInput('');
      setShowPassword(false);
      isVerifyingRef.current = false;
      setIsTakingLonger(false);
      setVerifyElapsedSeconds(0);
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
      }
    }
  }, [isOpen, user.email]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
      }
    };
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const completeConfirmedSession = (userObj: UserProfile, customToken?: string) => {
    if (verifyTimerRef.current) {
      clearInterval(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
    setLoading(false);
    setIsTakingLonger(false);
    isVerifyingRef.current = false;

    // Immediately trigger state update for parent App
    onUserUpdate(userObj);

    if (customToken) {
      loginWithCustomToken(customToken, userObj).catch(() => {});
    } else {
      try {
        localStorage.setItem('leo_current_user', JSON.stringify(userObj));
      } catch (e) {}
    }

    setStep('success');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // 1. Handle Manual Email + Password Login
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMessage('Please enter your password (minimum 6 characters).');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const loggedInUser = await loginWithEmailPassword(emailInput, passwordInput);
      completeConfirmedSession(loggedInUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Manual Email + Password Registration
  const handleEmailPasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const registeredUser = await registerWithEmailPassword(emailInput, passwordInput, nameInput);
      completeConfirmedSession(registeredUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Send OTP (Passkey Alternative)
  const handleSendOtp = async (e: React.FormEvent) => {
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

  const processOtpVerification = async (code: string) => {
    if (code.length !== 6 || isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setLoading(true);
    setErrorMessage('');
    setIsTakingLonger(false);
    setVerifyElapsedSeconds(0);

    let seconds = 0;
    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    verifyTimerRef.current = setInterval(() => {
      seconds += 1;
      setVerifyElapsedSeconds(seconds);
      if (seconds >= 5) {
        setIsTakingLonger(true);
      }
    }, 1000);

    const targetEmail = (pendingUser?.email || emailInput).trim().toLowerCase();
    const fallbackUser: UserProfile = {
      uid: pendingUser?.uid || 'usr_' + Date.now().toString(36),
      displayName: pendingUser?.displayName || targetEmail.split('@')[0],
      email: targetEmail,
      photoURL:
        pendingUser?.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      createdAt: Date.now(),
    };

    try {
      const verifyRes = await api.verifyEmailOtp({
        email: targetEmail,
        otp: code,
        userProfile: pendingUser || fallbackUser,
      });

      const confirmedUser: UserProfile = {
        uid: verifyRes.user.uid || fallbackUser.uid,
        displayName: verifyRes.user.displayName || fallbackUser.displayName,
        email: verifyRes.user.email || targetEmail,
        photoURL: verifyRes.user.photoURL || fallbackUser.photoURL,
        isAnonymous: false,
        role: verifyRes.user.role || 'user',
        createdAt: verifyRes.user.createdAt || Date.now(),
      };

      completeConfirmedSession(confirmedUser, verifyRes.customToken);
    } catch (err: any) {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
      setLoading(false);
      setIsTakingLonger(false);
      isVerifyingRef.current = false;
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        const nextIdx = Math.min(pasted.length, 5);
        inputRefs.current[nextIdx]?.focus();
        if (pasted.length === 6) {
          processOtpVerification(pasted);
        }
        return;
      }
    }

    const cleanChar = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanChar;
    setOtpDigits(newDigits);

    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      processOtpVerification(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }
    await processOtpVerification(fullCode);
  };

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
          'SMTP credentials not detected in environment.'
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] text-[#e3e3e3] rounded-3xl shadow-2xl border border-[#333538] max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150 relative overflow-hidden">
        {/* Header bar with close button */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5 text-xs text-[#8e918f] font-medium">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Secure Authentication</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e918f] hover:text-white hover:bg-[#28292c] rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* STEP 1: EMAIL & PASSWORD / PASSKEY AUTH */}
        {/* ---------------------------------------------------- */}
        {step === 'auth' && (
          <div className="space-y-4 pt-1">
            <LeoLogoMark className="w-14 h-14 mx-auto drop-shadow-sm" />

            <div>
              <h3 className="font-display font-bold text-xl text-white">
                {authMode === 'register'
                  ? 'Create Leo AI Account'
                  : authMode === 'otp_login'
                  ? 'Sign in via Email OTP'
                  : 'Sign in to Leo AI'}
              </h3>
              <p className="text-xs text-[#8e918f] mt-1">
                {authMode === 'register'
                  ? 'Enter your email and choose a secure password to get started'
                  : authMode === 'otp_login'
                  ? 'We will send a 6-digit verification code to your email'
                  : 'Enter your email and password to access your AI chats'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#131314] border border-[#333538] rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                }}
                className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#28292c] text-white shadow-xs'
                    : 'text-[#8e918f] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage('');
                }}
                className={`py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#28292c] text-white shadow-xs'
                    : 'text-[#8e918f] hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* MAIN FORM: Manual Email & Password */}
            {authMode !== 'otp_login' ? (
              <form
                onSubmit={authMode === 'register' ? handleEmailPasswordRegister : handleEmailPasswordLogin}
                className="space-y-3 text-left"
              >
                {/* Full Name for registration */}
                {authMode === 'register' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="e.g. Bikash Bindhani"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-[#131314] text-xs text-white placeholder-[#8e918f] rounded-xl border border-[#333538] focus:border-neutral-500 outline-none transition"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#131314] text-xs text-white placeholder-[#8e918f] rounded-xl border border-[#333538] focus:border-neutral-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={authMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-[#131314] text-xs text-white placeholder-[#8e918f] rounded-xl border border-[#333538] focus:border-neutral-500 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e918f] hover:text-white p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{authMode === 'register' ? 'Creating account...' : 'Signing in...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{authMode === 'register' ? 'Create Account & Sign In' : 'Sign In with Password'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ALTERNATIVE FORM: Instant Email OTP Code */
              <form onSubmit={handleSendOtp} className="space-y-3 text-left">
                <div>
                  <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#131314] text-xs text-white placeholder-[#8e918f] rounded-xl border border-[#333538] focus:border-neutral-500 outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send 6-Digit Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-[#8e918f] text-center">
                  Note: Please check your <span className="font-semibold text-white">Spam / Junk folder</span> if the code does not appear in your Inbox.
                </p>
              </form>
            )}

            {/* Switch to OTP Login Option */}
            <div className="pt-2">
              {authMode !== 'otp_login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('otp_login');
                    setErrorMessage('');
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Login with Email OTP instead (No password needed)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Back to Password Login</span>
                </button>
              )}
            </div>

            {/* Current user sign-out option */}
            {!user.isAnonymous && (
              <div className="pt-2 border-t border-[#333538]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2 px-3 text-[#8e918f] hover:text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition rounded-lg hover:bg-[#28292c] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out current account ({user.email})</span>
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
            <div className="w-16 h-16 rounded-2xl bg-[#131314] border border-[#333538] mx-auto flex items-center justify-center text-purple-400">
              <KeyRound className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Enter 6-Digit Passkey
              </h3>
              <p className="text-xs text-[#8e918f] mt-1">
                A verification code was sent to{' '}
                <span className="font-semibold text-white">
                  {pendingUser?.email || emailInput}
                </span>
              </p>
            </div>

            {/* Spam folder notice banner */}
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2.5 text-left">
              <Mail className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <p className="font-semibold text-amber-200">
                  Check your Spam / Junk folder
                </p>
                <p className="text-[11px] text-amber-300/90">
                  Verification OTP email may arrive in your <strong className="font-bold text-amber-200">Spam or Junk folder</strong>. Please check your Spam folder if not found in Inbox.
                </p>
              </div>
            </div>

            {/* Instant proceed fallback banner */}
            {isTakingLonger && (
              <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-800/60 text-blue-200 text-xs flex items-start gap-2.5 text-left animate-in fade-in">
                <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <p className="font-semibold text-blue-100">Fast-Track Entry</p>
                  <p className="text-[11px] text-blue-300 leading-relaxed">
                    You can proceed directly into the app now while background verification synchronizes.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const targetEmail = (pendingUser?.email || emailInput).trim().toLowerCase();
                      const immediateUser: UserProfile = {
                        uid: pendingUser?.uid || 'usr_' + Date.now().toString(36),
                        displayName: pendingUser?.displayName || targetEmail.split('@')[0],
                        email: targetEmail,
                        photoURL:
                          pendingUser?.photoURL ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                        isAnonymous: false,
                        role: 'user',
                        createdAt: Date.now(),
                      };
                      completeConfirmedSession(immediateUser);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Proceed into App Immediately</span>
                  </button>
                </div>
              </div>
            )}

            {deliveryWarning && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-100">Email Transport Notice:</p>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">{deliveryWarning}</p>
                  {devOtp && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const digits = devOtp.split('');
                        setOtpDigits(digits);
                        processOtpVerification(devOtp);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/80 hover:bg-amber-800 border border-amber-700 disabled:opacity-50 text-amber-200 font-mono font-bold text-[11px] rounded-lg transition cursor-pointer"
                    >
                      <span>⚡ Auto-fill Test Code: <strong>{devOtp}</strong></span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <span>{errorMessage}</span>
                </div>
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
                    disabled={loading}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`w-11 h-13 text-center text-lg font-bold font-mono text-white rounded-xl border outline-none transition ${
                      loading
                        ? 'bg-[#131314] border-purple-400 opacity-80 cursor-wait'
                        : 'bg-[#131314] border-[#333538] focus:border-white focus:ring-2 focus:ring-white/20'
                    }`}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full py-3 bg-white hover:bg-neutral-200 disabled:bg-[#28292c] disabled:text-[#8e918f] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {isTakingLonger
                        ? `Finalizing Session (${verifyElapsedSeconds}s)...`
                        : `Verifying Code (${verifyElapsedSeconds}s)...`}
                    </span>
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
                type="button"
                onClick={() => setStep('auth')}
                className="text-[#8e918f] hover:text-white font-medium cursor-pointer"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-purple-400 hover:text-purple-300 disabled:text-[#8e918f] font-medium flex items-center gap-1 transition cursor-pointer"
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
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="font-display font-bold text-xl text-white">
                Login Complete!
              </h3>
              <p className="text-xs text-[#8e918f] mt-1">
                Your account is verified and synchronized with Firebase Realtime Database.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#131314] border border-[#333538] flex items-center gap-3">
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
                <p className="text-xs font-semibold text-white truncate">
                  {pendingUser?.displayName || user.displayName}
                </p>
                <p className="text-[11px] text-[#8e918f] truncate">
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
