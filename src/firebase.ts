import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
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
import firebaseConfig from '../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};
const rtdbUrl =
  metaEnv.VITE_FIREBASE_DATABASE_URL ||
  `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;

const config = {
  ...firebaseConfig,
  databaseURL: rtdbUrl,
};

// Initialize Firebase App
export const app: FirebaseApp = !getApps().length ? initializeApp(config) : getApps()[0];

// Initialize Realtime Database
export const database: Database = getDatabase(app, rtdbUrl);

// Initialize Auth
export const auth: Auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Realtime Database Note:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth Helpers
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    await fbSignOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
    throw error;
  }
}
