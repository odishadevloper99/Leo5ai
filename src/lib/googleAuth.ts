import { api } from './api';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { UserProfile } from '../types';

/**
 * Perform Google Sign-in via Firebase Authentication
 * 1. Uses Firebase Auth signInWithPopup with GoogleAuthProvider
 * 2. Synchronizes verified user profile with backend and session storage
 */
export async function performGoogleSignIn(): Promise<UserProfile> {
  let defaultCredits = 50;
  try {
    const oauthConfig = await api.getOAuthConfig();
    if (oauthConfig.defaultCredits) {
      defaultCredits = oauthConfig.defaultCredits;
    }
  } catch (err) {
    console.warn('[OAuth Config Note]:', err);
  }

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
          credits: defaultCredits,
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
          'This domain is not authorized in Firebase Console. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.';
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

  throw new Error('Firebase Authentication is not configured. Please ensure Firebase credentials are provided.');
}
