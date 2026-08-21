import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
import appletConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

// Configure Realtime Database URL
const rtdbUrl =
  metaEnv.VITE_FIREBASE_DATABASE_URL ||
  `https://${appletConfig.projectId}-default-rtdb.firebaseio.com`;

const firebaseConfig = {
  ...appletConfig,
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
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = true;

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<UserProfile> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || 'Google User',
      email: user.email || 'user@gmail.com',
      photoURL:
        user.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      createdAt: Date.now(),
    };
    localStorage.setItem('leo_current_user', JSON.stringify(userProfile));

    // Save user profile to Realtime Database
    try {
      await set(ref(database, `users/${user.uid}`), {
        ...userProfile,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('Realtime Database user profile sync note:', e);
    }

    return userProfile;
  } catch (err: any) {
    // IMPORTANT: do NOT silently fabricate a fake local account here.
    // Previously this swallowed every popup error (blocked popup, unauthorized
    // domain, wrong OAuth client, user closing the popup, etc.) and returned a
    // fake "Google Explorer" user, which made it look like login "worked" even
    // though no real Google account was ever signed in. Surface the real
    // Firebase error instead so it can be seen and fixed (most common cause:
    // your app's domain is not added under Firebase Console -> Authentication
    // -> Settings -> Authorized domains).
    console.error('Google Sign-In Error:', err?.code, err?.message);
    let friendlyMessage = err?.message || 'Google sign-in failed.';
    if (err?.code === 'auth/unauthorized-domain') {
      friendlyMessage =
        'This domain is not authorized for Google Sign-In. Add it under Firebase Console → Authentication → Settings → Authorized domains.';
    } else if (err?.code === 'auth/popup-blocked') {
      friendlyMessage = 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
    } else if (err?.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Google sign-in was cancelled before it finished.';
    } else if (err?.code === 'auth/operation-not-allowed') {
      friendlyMessage = 'Google sign-in is not enabled for this Firebase project. Enable it under Authentication → Sign-in method.';
    }
    const wrappedError = new Error(friendlyMessage);
    (wrappedError as any).code = err?.code;
    throw wrappedError;
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
