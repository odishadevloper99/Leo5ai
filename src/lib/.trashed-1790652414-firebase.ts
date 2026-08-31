import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
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
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
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

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

export let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app, firestoreDatabaseId);

// Test Firestore Connection (non-blocking validation per Firebase guidelines)
async function testFirestoreConnection() {
  try {
    if (typeof window !== 'undefined') {
      // Delay test slightly to allow browser network & auth state to initialize
      setTimeout(async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error: any) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.info('[Firebase] Firestore operating in offline/client mode.');
          } else if (error?.code === 'unavailable') {
            console.info('[Firebase] Firestore initial connection deferred; cache active.');
          }
        }
      }, 1000);
    }
  } catch (e) {
    // Non-blocking
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

export const isFirebaseConfigured = Boolean(apiKey && projectId);

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

  // 3. Asynchronously sync user profile to Firestore without blocking UI
  try {
    const userDocRef = doc(db, 'users', userProfile.uid);
    setDoc(
      userDocRef,
      {
        userId: userProfile.uid,
        displayName: userProfile.displayName || 'Leo Explorer',
        email: userProfile.email || '',
        photoURL: userProfile.photoURL || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).catch((err) => {
      console.warn('Firestore user profile sync note:', err.message || err);
    });
  } catch (e) {
    console.warn('Firestore user profile sync caught:', e);
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

    // Synchronize user from Firestore
    try {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const existingData = snap.data();
        userProfile = {
          ...userProfile,
          ...existingData,
          displayName: existingData.displayName || userProfile.displayName,
          email: cleanEmail,
          uid: fbUser.uid,
        };
      }
      await setDoc(
        userDocRef,
        {
          userId: userProfile.uid,
          displayName: userProfile.displayName,
          email: cleanEmail,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore sync notice:', e);
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
      const userDocRef = doc(db, 'users', fbUser.uid);
      await setDoc(userDocRef, {
        userId: fbUser.uid,
        displayName,
        email: cleanEmail,
        photoURL: userProfile.photoURL,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Firestore register sync notice:', e);
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
      if (parsed && parsed.isAnonymous !== true && parsed.uid) {
        return parsed;
      }
    } catch (e) {}
  }
  return {
    uid: 'guest-' + Date.now(),
    displayName: 'Guest',
    email: '',
    isAnonymous: true,
    role: 'user',
  };
}

/**
 * Save Chat Session to Firestore
 */
export async function saveChatToRealtimeDB(userId: string, chat: ChatSession): Promise<void> {
  try {
    const sessionDocRef = doc(db, 'chat_sessions', chat.id);
    await setDoc(
      sessionDocRef,
      {
        sessionId: chat.id,
        userId,
        title: (chat.title || 'New Chat').slice(0, 300),
        selectedModel: chat.model || 'default',
        model: chat.model || 'default',
        messages: chat.messages || [],
        createdAt: typeof chat.createdAt === 'number' ? new Date(chat.createdAt).toISOString() : (chat.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Firestore chat save note:', e);
  }
}

export const saveChatToFirestore = saveChatToRealtimeDB;

/**
 * Load Chat Sessions from Firestore
 */
export async function loadChatsFromRealtimeDB(userId: string): Promise<ChatSession[]> {
  try {
    const sessionsCol = collection(db, 'chat_sessions');
    const q = query(sessionsCol, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const sessions: ChatSession[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      sessions.push({
        id: data.sessionId || docSnap.id,
        userId: data.userId || userId,
        title: data.title || 'Untitled Chat',
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: data.createdAt ? (typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || Date.now()) : Date.now(),
        updatedAt: data.updatedAt ? (typeof data.updatedAt === 'number' ? data.updatedAt : Date.parse(data.updatedAt) || Date.now()) : Date.now(),
        model: data.model || data.selectedModel || 'default',
      });
    });
    return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (e) {
    console.warn('Firestore load chats note:', e);
  }
  return [];
}

export const loadChatsFromFirestore = loadChatsFromRealtimeDB;

/**
 * Delete Chat Session from Firestore
 */
export async function deleteChatFromRealtimeDB(userId: string, chatId: string): Promise<void> {
  try {
    const sessionDocRef = doc(db, 'chat_sessions', chatId);
    await deleteDoc(sessionDocRef);
  } catch (e) {
    console.warn('Firestore delete chat note:', e);
  }
}

export const deleteChatFromFirestore = deleteChatFromRealtimeDB;

/**
 * Save Memo Memory to Firestore
 */
export async function saveMemoryToRealtimeDB(userId: string, memory: MemoMemoryItem): Promise<void> {
  try {
    const memDocRef = doc(db, 'user_memories', memory.id);
    await setDoc(memDocRef, {
      memoryId: memory.id,
      userId,
      text: memory.text || '',
      category: memory.category || 'preference',
      createdAt: typeof memory.createdAt === 'number' ? new Date(memory.createdAt).toISOString() : new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firestore save memory note:', e);
  }
}

export const saveMemoryToFirestore = saveMemoryToRealtimeDB;

/**
 * Load Memo Memories from Firestore
 */
export async function loadMemoriesFromRealtimeDB(userId: string): Promise<MemoMemoryItem[]> {
  try {
    const memsCol = collection(db, 'user_memories');
    const q = query(memsCol, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const memories: MemoMemoryItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      memories.push({
        id: data.memoryId || docSnap.id,
        userId: data.userId || userId,
        text: data.text || '',
        category: data.category || 'preference',
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || Date.now(),
      });
    });
    return memories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    console.warn('Firestore load memories note:', e);
  }
  return [];
}

export const loadMemoriesFromFirestore = loadMemoriesFromRealtimeDB;

/**
 * Subscribe to Firestore Chats Live Changes
 */
export function subscribeToRealtimeChats(
  userId: string,
  callback: (sessions: ChatSession[]) => void
): () => void {
  try {
    const sessionsCol = collection(db, 'chat_sessions');
    const q = query(sessionsCol, where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions: ChatSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          sessions.push({
            id: data.sessionId || docSnap.id,
            userId: data.userId || userId,
            title: data.title || 'Untitled Chat',
            messages: Array.isArray(data.messages) ? data.messages : [],
            createdAt: data.createdAt ? (typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || Date.now()) : Date.now(),
            updatedAt: data.updatedAt ? (typeof data.updatedAt === 'number' ? data.updatedAt : Date.parse(data.updatedAt) || Date.now()) : Date.now(),
            model: data.model || data.selectedModel || 'default',
          });
        });
        sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(sessions);
      },
      (err) => {
        console.warn('Firestore listener error:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore listener subscribe error:', err);
    return () => {};
  }
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
