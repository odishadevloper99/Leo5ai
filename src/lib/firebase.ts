import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  onValue,
  off,
  Database
} from 'firebase/database';
import { ChatSession, UserProfile, Message, MemoMemoryItem } from '../types';
import { api } from './api';
import appletConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

// Configure Firebase Project Credentials
const projectId = metaEnv.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'gen-lang-client-0682444492';
const apiKey = metaEnv.VITE_FIREBASE_API_KEY || appletConfig.apiKey;
const authDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || `${projectId}.firebaseapp.com`;
const storageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || `${projectId}.firebasestorage.app`;
const messagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '387156119079';
const appId = metaEnv.VITE_FIREBASE_APP_ID || appletConfig.appId || '1:387156119079:web:e624ae1f226a56f590c802';

// Configure Realtime Database URL
const rtdbUrl =
  metaEnv.VITE_FIREBASE_DATABASE_URL ||
  `https://${projectId}-default-rtdb.firebaseio.com`;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  databaseURL: rtdbUrl,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth: Auth = getAuth(app);
export const database: Database = getDatabase(app, rtdbUrl);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
googleProvider.addScope('email');
googleProvider.addScope('profile');

export const isFirebaseConfigured = Boolean(apiKey && projectId);

/**
 * Sign in with Google Popup via Firebase Authentication
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const idToken = await fbUser.getIdToken();

    // Default base profile from Firebase user data
    let userProfile: UserProfile = {
      uid: fbUser.uid,
      googleId: fbUser.providerData?.[0]?.uid || fbUser.uid,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Leo Explorer',
      email: fbUser.email || '',
      photoURL:
        fbUser.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      credits: 50,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
      chatCount: 0,
    };

    // 1. Verify ID token on backend and synchronize user record with AI credits
    try {
      const backendRes = await api.loginWithGoogle({
        idToken: idToken || undefined,
        credential: idToken || undefined,
      });

      if (backendRes.success && backendRes.user) {
        userProfile = {
          ...backendRes.user,
          uid: fbUser.uid, // Strictly preserve authenticated Firebase UID
          displayName: fbUser.displayName || backendRes.user.displayName,
          email: fbUser.email || backendRes.user.email,
          photoURL: fbUser.photoURL || backendRes.user.photoURL,
        };
        if (backendRes.token) {
          localStorage.setItem('leo_auth_token', backendRes.token);
        }
      }
    } catch (backendErr) {
      console.warn('[Backend Google Auth Verify Note]:', backendErr);
    }

    // 2. Fetch existing profile from Realtime Database to preserve existing credits and chatCount
    try {
      const userRef = ref(database, `users/${fbUser.uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const existingData = snap.val();
        userProfile = {
          ...userProfile,
          credits: typeof existingData.credits === 'number' ? existingData.credits : userProfile.credits,
          createdAt: existingData.createdAt || userProfile.createdAt,
          chatCount: typeof existingData.chatCount === 'number' ? existingData.chatCount : userProfile.chatCount,
          role: existingData.role || userProfile.role,
        };
      }

      // Save updated login timestamp and active status
      await set(userRef, {
        ...userProfile,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (dbErr) {
      console.warn('[Realtime Database User Sync Note]:', dbErr);
    }

    // 3. Persist profile to LocalStorage
    localStorage.setItem('leo_current_user', JSON.stringify(userProfile));

    return userProfile;
  } catch (err: any) {
    console.error('Google Sign-In Error:', err?.code, err?.message);
    let friendlyMessage = err?.message || 'Google sign-in could not be completed.';
    
    if (err?.code === 'auth/unauthorized-domain') {
      friendlyMessage =
        'This domain is not authorized for Google Sign-In in Firebase. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.';
    } else if (err?.code === 'auth/popup-blocked') {
      friendlyMessage = 'Your browser blocked the Google sign-in popup. Please allow popups for this website and try again.';
    } else if (err?.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Google sign-in was cancelled before completion.';
    } else if (err?.code === 'auth/operation-not-allowed') {
      friendlyMessage = 'Google sign-in provider is disabled in Firebase. Enable it under Firebase Console → Authentication → Sign-in method → Google.';
    } else if (err?.code === 'auth/account-exists-with-different-credential') {
      friendlyMessage = 'An account already exists with the same email address using a different sign-in method.';
    } else if (err?.code === 'auth/network-request-failed') {
      friendlyMessage = 'Network connection failure. Please check your internet connection and try again.';
    } else if (err?.code === 'auth/invalid-api-key') {
      friendlyMessage = 'Invalid Firebase API key. Please check your Firebase configuration.';
    } else if (err?.code === 'auth/user-disabled') {
      friendlyMessage = 'This account has been disabled by the administrator.';
    }

    const wrappedError = new Error(friendlyMessage);
    (wrappedError as any).code = err?.code;
    throw wrappedError;
  }
}

/**
 * Sign in with Google Redirect (Fallback for blocked popups / strict sandbox iframe)
 */
export async function loginWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Check for pending redirect sign-in results on app load
 */
export async function checkRedirectResult(): Promise<UserProfile | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result || !result.user) return null;

    const fbUser = result.user;
    const idToken = await fbUser.getIdToken();

    let userProfile: UserProfile = {
      uid: fbUser.uid,
      googleId: fbUser.providerData?.[0]?.uid || fbUser.uid,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Leo Explorer',
      email: fbUser.email || '',
      photoURL:
        fbUser.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      credits: 50,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
      chatCount: 0,
    };

    try {
      const backendRes = await api.loginWithGoogle({
        idToken: idToken || undefined,
        credential: idToken || undefined,
      });
      if (backendRes.success && backendRes.user) {
        userProfile = {
          ...backendRes.user,
          uid: fbUser.uid,
          displayName: fbUser.displayName || backendRes.user.displayName,
          email: fbUser.email || backendRes.user.email,
          photoURL: fbUser.photoURL || backendRes.user.photoURL,
        };
        if (backendRes.token) {
          localStorage.setItem('leo_auth_token', backendRes.token);
        }
      }
    } catch (backendErr) {
      console.warn('[Backend Google Auth Verify Note]:', backendErr);
    }

    try {
      const userRef = ref(database, `users/${fbUser.uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const existingData = snap.val();
        userProfile = {
          ...userProfile,
          credits: typeof existingData.credits === 'number' ? existingData.credits : userProfile.credits,
          createdAt: existingData.createdAt || userProfile.createdAt,
          chatCount: typeof existingData.chatCount === 'number' ? existingData.chatCount : userProfile.chatCount,
          role: existingData.role || userProfile.role,
        };
      }
      await set(userRef, {
        ...userProfile,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (dbErr) {
      console.warn('[Realtime Database User Sync Note]:', dbErr);
    }

    localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
    return userProfile;
  } catch (err: any) {
    console.warn('[Google Redirect Auth Check Notice]:', err?.message || err);
    return null;
  }
}

/**
 * Sign in with Firebase Custom Token
 */
export async function loginWithCustomToken(customToken: string, userProfile: UserProfile): Promise<UserProfile> {
  // 1. Immediately save to localStorage to ensure instant session establishment
  try {
    localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
  } catch (e) {
    console.warn('LocalStorage save notice:', e);
  }

  // 2. Attempt Firebase client custom token authentication with a safety timeout (non-blocking)
  if (customToken) {
    const authPromise = signInWithCustomToken(auth, customToken).catch((err) => {
      console.warn('Firebase custom token notice (proceeding with verified session):', err.message || err);
    });
    // Race with 2.5s timeout so UI never hangs
    await Promise.race([
      authPromise,
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  }

  // 3. Asynchronously sync user profile to Realtime Database without blocking UI
  try {
    const syncPromise = set(ref(database, `users/${userProfile.uid}`), {
      ...userProfile,
      updatedAt: Date.now(),
    }).catch((err) => {
      console.warn('Realtime Database user profile sync note:', err.message || err);
    });
    // Non-blocking wait with quick timeout
    Promise.race([
      syncPromise,
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]).catch(() => {});
  } catch (e) {
    console.warn('Realtime Database user profile sync caught:', e);
  }

  return userProfile;
}

/**
 * Logout User
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {}
  localStorage.removeItem('leo_current_user');
}

/**
 * Get current stored user profile
 */
export function getCurrentStoredUser(): UserProfile {
  const stored = localStorage.getItem('leo_current_user');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Only trust the stored profile if it's a real, non-anonymous session.
      if (parsed && parsed.isAnonymous !== true && parsed.uid) {
        return parsed;
      }
    } catch (e) {}
  }
  // IMPORTANT: no user is signed in yet. Previously this returned a fully
  // formed fake "logged in" profile (Emerson Sterling), which meant the app
  // always behaved as if someone had already logged in and the chat UI opened
  // immediately without ever requiring login. Return a real guest/anonymous
  // profile instead so the app can correctly gate access behind sign-in.
  return {
    uid: 'guest-' + Date.now(),
    displayName: 'Guest',
    email: '',
    isAnonymous: true,
    role: 'user',
  };
}

/**
 * Save Chat Session to Realtime Database
 */
export async function saveChatToRealtimeDB(userId: string, chat: ChatSession): Promise<void> {
  try {
    const chatRef = ref(database, `chats/${userId}/${chat.id}`);
    await set(chatRef, {
      ...chat,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('Realtime Database chat save note:', e);
  }
}

/**
 * Load Chat Sessions from Realtime Database
 */
export async function loadChatsFromRealtimeDB(userId: string): Promise<ChatSession[]> {
  try {
    const userChatsRef = ref(database, `chats/${userId}`);
    const snapshot = await get(userChatsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const sessions: ChatSession[] = Object.values(data);
      // Sort newest first
      return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
  } catch (e) {
    console.warn('Realtime Database load chats note:', e);
  }
  return [];
}

/**
 * Delete Chat Session from Realtime Database
 */
export async function deleteChatFromRealtimeDB(userId: string, chatId: string): Promise<void> {
  try {
    const chatRef = ref(database, `chats/${userId}/${chatId}`);
    await remove(chatRef);
  } catch (e) {
    console.warn('Realtime Database delete chat note:', e);
  }
}

/**
 * Save Memo Memory to Realtime Database
 */
export async function saveMemoryToRealtimeDB(userId: string, memory: MemoMemoryItem): Promise<void> {
  try {
    const memRef = ref(database, `memories/${userId}/${memory.id}`);
    await set(memRef, memory);
  } catch (e) {
    console.warn('Realtime Database save memory note:', e);
  }
}

/**
 * Load Memo Memories from Realtime Database
 */
export async function loadMemoriesFromRealtimeDB(userId: string): Promise<MemoMemoryItem[]> {
  try {
    const memsRef = ref(database, `memories/${userId}`);
    const snapshot = await get(memsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const memories: MemoMemoryItem[] = Object.values(data);
      return memories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch (e) {
    console.warn('Realtime Database load memories note:', e);
  }
  return [];
}

/**
 * Subscribe to Realtime Database Chats Live Changes
 */
export function subscribeToRealtimeChats(
  userId: string,
  callback: (sessions: ChatSession[]) => void
): () => void {
  const userChatsRef = ref(database, `chats/${userId}`);
  const listener = onValue(
    userChatsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const sessions: ChatSession[] = Object.values(data);
        sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(sessions);
      } else {
        callback([]);
      }
    },
    (err) => {
      console.warn('Realtime listener error:', err);
    }
  );

  return () => {
    off(userChatsRef, 'value', listener);
  };
}
