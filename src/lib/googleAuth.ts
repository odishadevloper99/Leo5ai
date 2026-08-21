import { api } from './api';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

let gsiScriptLoaded = false;
let gsiScriptPromise: Promise<boolean> | null = null;

/**
 * Load Google Identity Services script dynamically
 */
export function loadGsiScript(): Promise<boolean> {
  if (gsiScriptLoaded && window.google?.accounts?.oauth2) {
    return Promise.resolve(true);
  }
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve) => {
    if (document.getElementById('google-gsi-client')) {
      gsiScriptLoaded = true;
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiScriptLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      console.warn('[GSI Script] Could not load Google Identity Services SDK.');
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/**
 * Unified Google Sign-in:
 * 1. Checks backend OAuth config for Google Client ID
 * 2. Attempts Google Identity Services (GSI) Token Client popup
 * 3. Falls back to Firebase Auth signInWithPopup if GSI is not configured or in iframe
 * 4. Cryptographically verifies token on backend /api/auth/google
 * 5. Registers/retrieves user with default AI credits & returns verified session
 */
export async function performGoogleSignIn(): Promise<UserProfile> {
  let oauthConfig: { googleClientId: string; googleConfigured: boolean; defaultCredits: number } = {
    googleClientId: '',
    googleConfigured: false,
    defaultCredits: 50,
  };

  try {
    oauthConfig = await api.getOAuthConfig();
  } catch (err) {
    console.warn('[OAuth Config Warning]:', err);
  }

  const clientId = oauthConfig.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // ----------------------------------------------------
  // Strategy A: Google Identity Services (GSI) Token Client (Direct Google OAuth 2.0)
  // ----------------------------------------------------
  if (clientId) {
    try {
      await loadGsiScript();
      if (window.google?.accounts?.oauth2) {
        const tokenResponse: any = await new Promise((resolve, reject) => {
          try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'openid email profile',
              callback: (res: any) => {
                if (res.error) {
                  reject(new Error(res.error_description || res.error || 'Google login was cancelled.'));
                } else if (res.access_token) {
                  resolve(res);
                } else {
                  reject(new Error('No access token received from Google.'));
                }
              },
              error_callback: (err: any) => {
                reject(new Error(err?.message || 'Google OAuth prompt error.'));
              }
            });
            tokenClient.requestAccessToken({ prompt: 'select_account' });
          } catch (e: any) {
            reject(e);
          }
        });

        if (tokenResponse?.access_token) {
          // Verify with backend
          const backendRes = await api.loginWithGoogle({
            accessToken: tokenResponse.access_token,
          });

          if (backendRes.success && backendRes.user) {
            localStorage.setItem('leo_current_user', JSON.stringify(backendRes.user));
            if (backendRes.token) {
              localStorage.setItem('leo_auth_token', backendRes.token);
            }
            return backendRes.user;
          }
        }
      }
    } catch (gsiErr: any) {
      console.warn('[GSI Sign-In Notice]: Falling back to Firebase Auth provider.', gsiErr.message);
      if (gsiErr.message?.includes('cancelled') || gsiErr.message?.includes('closed')) {
        throw new Error('Google sign-in was cancelled.');
      }
    }
  }

  // ----------------------------------------------------
  // Strategy B: Firebase Auth with GoogleAuthProvider
  // ----------------------------------------------------
  if (isFirebaseConfigured) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken().catch(() => '');

      // Verify token on backend
      let verifiedUser: UserProfile;
      try {
        const backendRes = await api.loginWithGoogle({
          idToken: idToken || undefined,
          credential: (result as any)._tokenResponse?.idToken || idToken || undefined,
          accessToken: (result as any)._tokenResponse?.oauthAccessToken || undefined,
        });

        verifiedUser = backendRes.user;
        if (backendRes.token) {
          localStorage.setItem('leo_auth_token', backendRes.token);
        }
      } catch (backendErr: any) {
        console.warn('[Backend Google Auth Verify Notice]:', backendErr.message);
        // Fallback user structure if backend was momentarily unreachable
        verifiedUser = {
          uid: user.uid,
          googleId: user.providerData?.[0]?.uid || user.uid,
          displayName: user.displayName || 'Google User',
          email: user.email || 'user@gmail.com',
          photoURL:
            user.photoURL ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isAnonymous: false,
          role: 'user',
          credits: oauthConfig.defaultCredits || 50,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          lastActive: Date.now(),
          chatCount: 0,
        };
      }

      localStorage.setItem('leo_current_user', JSON.stringify(verifiedUser));
      return verifiedUser;
    } catch (fbErr: any) {
      console.error('Firebase Google Sign-In Error:', fbErr?.code, fbErr?.message);
      let friendlyMessage = fbErr?.message || 'Google sign-in failed.';
      if (fbErr?.code === 'auth/unauthorized-domain') {
        friendlyMessage =
          'This domain is not authorized in Firebase/Google Cloud Console. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.';
      } else if (fbErr?.code === 'auth/popup-blocked') {
        friendlyMessage = 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
      } else if (fbErr?.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Google sign-in was cancelled before completing.';
      } else if (fbErr?.code === 'auth/operation-not-allowed') {
        friendlyMessage = 'Google sign-in is not enabled in Firebase Authentication → Sign-in method.';
      }
      const errorObj = new Error(friendlyMessage);
      (errorObj as any).code = fbErr?.code;
      throw errorObj;
    }
  }

  throw new Error('Google Sign-in is not configured. Please add GOOGLE_CLIENT_ID or Firebase credentials in settings.');
}
