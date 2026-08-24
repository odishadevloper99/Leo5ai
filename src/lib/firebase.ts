import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
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
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  getDocFromServer,
  Firestore
} from 'firebase/firestore';
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
const firestoreDatabaseId = metaEnv.VITE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || 'ai-studio-leoai-434fd984-e3fa-4bcf-9e8d-e03e334f487d';

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
export const db: Firestore = getFirestore(app, firestoreDatabaseId);

// Test Firestore Connection
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore test connection note: client appears offline.');
    }
  }
}
testFirestoreConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

    // 3. Persist profile to LocalStorage safely
    try {
      localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
    } catch (storageErr) {
      console.warn('[Leo AI Storage] User profile storage notice:', storageErr);
    }

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

    try {
      localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
    } catch (e) {}
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
 * Sign in with Email and Password
 */
export async function loginWithEmailPassword(email: string, pass: string): Promise<UserProfile> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const fbUser = result.user;

    let userProfile: UserProfile = {
      uid: fbUser.uid,
      displayName: fbUser.displayName || cleanEmail.split('@')[0] || 'Leo Explorer',
      email: cleanEmail,
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

    // Synchronize user from Realtime Database
    try {
      const userRef = ref(database, `users/${fbUser.uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const existingData = snap.val();
        userProfile = {
          ...userProfile,
          ...existingData,
          displayName: existingData.displayName || userProfile.displayName,
          email: cleanEmail,
          uid: fbUser.uid,
        };
      }
      await set(userRef, {
        ...userProfile,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('RTDB sync notice:', e);
    }

    try {
      localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
    } catch (e) {}
    return userProfile;
  } catch (err: any) {
    let msg = err.message || 'Invalid email or password.';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msg = 'Invalid email or password. Please check your credentials.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Too many failed login attempts. Please try again later or reset password.';
    }
    const customErr = new Error(msg);
    (customErr as any).code = err.code;
    throw customErr;
  }
}

/**
 * Register with Email and Password
 */
export async function registerWithEmailPassword(email: string, pass: string, name?: string): Promise<UserProfile> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const fbUser = result.user;

    const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'Leo Explorer';

    try {
      await updateProfile(fbUser, { displayName });
    } catch (e) {}

    const userProfile: UserProfile = {
      uid: fbUser.uid,
      displayName,
      email: cleanEmail,
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isAnonymous: false,
      role: 'user',
      credits: 50,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
      chatCount: 0,
    };

    try {
      await set(ref(database, `users/${fbUser.uid}`), {
        ...userProfile,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('RTDB register sync notice:', e);
    }

    try {
      localStorage.setItem('leo_current_user', JSON.stringify(userProfile));
    } catch (e) {}
    return userProfile;
  } catch (err: any) {
    let msg = err.message || 'Registration failed.';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'An account with this email already exists. Please sign in instead.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Password should be at least 6 characters long.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    }
    const customErr = new Error(msg);
    (customErr as any).code = err.code;
    throw customErr;
  }
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

export interface DailyUsageCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  date: string;
  reason?: string;
}

/**
 * Checks a user's daily usage counter in Firestore against global and user-specific limits,
 * and atomically increments the counter if permitted.
 *
 * Document paths:
 * - Daily Usage: `users/{userId}/dailyUsage/{YYYY-MM-DD}`
 * - Global Settings: `settings/usage`
 * - User Profile: `users/{userId}`
 *
 * @param userId Unique user identifier
 * @param date Optional date string in YYYY-MM-DD format (defaults to current UTC/local date)
 * @param incrementAmount Amount to increment if permitted (default: 1)
 * @returns DailyUsageCheckResult object indicating if request is permitted and current stats
 */
export async function checkAndIncrementDailyUsage(
  userId: string,
  date?: string,
  incrementAmount: number = 1
): Promise<DailyUsageCheckResult> {
  const dateKey = date || new Date().toISOString().split('T')[0];
  const usageDocPath = `users/${userId}/dailyUsage/${dateKey}`;

  if (!userId) {
    return {
      allowed: false,
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      date: dateKey,
      reason: 'User ID is missing or invalid.',
    };
  }

  const usageDocRef = doc(db, 'users', userId, 'dailyUsage', dateKey);
  const settingsDocRef = doc(db, 'settings', 'usage');
  const userDocRef = doc(db, 'users', userId);

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Fetch Global limit from settings/usage
      let globalLimit = 50; // Fallback default
      try {
        const settingsSnap = await transaction.get(settingsDocRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          if (typeof settingsData.defaultDailyLimit === 'number') {
            globalLimit = settingsData.defaultDailyLimit;
          } else if (typeof settingsData.dailyLimit === 'number') {
            globalLimit = settingsData.dailyLimit;
          } else if (typeof settingsData.limit === 'number') {
            globalLimit = settingsData.limit;
          }
        }
      } catch (err) {
        console.warn('[Firestore] settings/usage read notice:', err);
      }

      // 2. Fetch User-specific limit from users/{userId}
      let effectiveLimit = globalLimit;
      try {
        const userSnap = await transaction.get(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (typeof userData.customDailyLimit === 'number') {
            effectiveLimit = userData.customDailyLimit;
          } else if (typeof userData.dailyMessageLimitOverride === 'number') {
            effectiveLimit = userData.dailyMessageLimitOverride;
          } else if (typeof userData.dailyLimit === 'number') {
            effectiveLimit = userData.dailyLimit;
          } else if (userData.role === 'admin') {
            effectiveLimit = 10000;
          } else if (['pro', 'ultra', 'premium'].includes(String(userData.plan || '').toLowerCase())) {
            effectiveLimit = Math.max(globalLimit, 500);
          }
        }
      } catch (err) {
        console.warn('[Firestore] users/{userId} limit read notice:', err);
      }

      // 3. Fetch current daily usage from users/{userId}/dailyUsage/{YYYY-MM-DD}
      const usageSnap = await transaction.get(usageDocRef);
      const currentUsage = usageSnap.exists() ? (usageSnap.data().count || 0) : 0;

      // 4. Compare current usage + incrementAmount against effective limit
      const projectedUsage = currentUsage + incrementAmount;

      if (projectedUsage <= effectiveLimit) {
        // Permitted: atomically increment the counter
        if (usageSnap.exists()) {
          transaction.update(usageDocRef, {
            count: projectedUsage,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(usageDocRef, {
            userId,
            date: dateKey,
            count: projectedUsage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        return {
          allowed: true,
          currentUsage: projectedUsage,
          limit: effectiveLimit,
          remaining: Math.max(0, effectiveLimit - projectedUsage),
          date: dateKey,
        };
      } else {
        // Not permitted: do NOT increment
        return {
          allowed: false,
          currentUsage,
          limit: effectiveLimit,
          remaining: Math.max(0, effectiveLimit - currentUsage),
          date: dateKey,
          reason: `Daily usage limit reached (${currentUsage}/${effectiveLimit} requests used).`,
        };
      }
    });
  } catch (error) {
    console.error(`[checkAndIncrementDailyUsage] Error on ${usageDocPath}:`, error);
    handleFirestoreError(error, OperationType.WRITE, usageDocPath);
  }
}

