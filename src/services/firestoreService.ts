import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { ChatSession, Message, UserProfile, MemoMemoryItem } from '../types';

export type Unsubscribe = () => void;

/**
 * User Profile Firestore Sync
 */
export async function syncUserProfile(user: UserProfile): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(
      userDocRef,
      {
        userId: user.uid,
        displayName: user.displayName || 'Leo Explorer',
        email: user.email || '',
        photoURL: user.photoURL || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Real-time Chat Sessions Subscription via Firestore
 */
export function subscribeToUserSessions(
  userId: string,
  onUpdate: (sessions: ChatSession[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = `chat_sessions`;
  try {
    const sessionsCol = collection(db, 'chat_sessions');
    const q = query(sessionsCol, where('userId', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions: ChatSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
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
        onUpdate(sessions);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Save or Update a Chat Session in Firestore
 */
export async function saveChatSession(session: ChatSession, userId: string): Promise<void> {
  const path = `chat_sessions/${session.id}`;
  try {
    const sessionDocRef = doc(db, 'chat_sessions', session.id);
    await setDoc(
      sessionDocRef,
      {
        sessionId: session.id,
        userId,
        title: session.title ? session.title.slice(0, 300) : 'New Chat',
        selectedModel: session.model || 'default',
        model: session.model || 'default',
        messages: session.messages || [],
        createdAt: typeof session.createdAt === 'number' ? new Date(session.createdAt).toISOString() : (session.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Load Messages for a specific Chat Session from Firestore
 */
export async function loadSessionMessages(sessionId: string): Promise<Message[]> {
  const path = `chat_sessions/${sessionId}`;
  try {
    const sessionDocRef = doc(db, 'chat_sessions', sessionId);
    const snap = await getDoc(sessionDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data?.messages) ? data.messages : [];
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  return [];
}

/**
 * Delete a Chat Session from Firestore
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const path = `chat_sessions/${sessionId}`;
  try {
    const sessionDocRef = doc(db, 'chat_sessions', sessionId);
    await deleteDoc(sessionDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Real-time User Memories Subscription in Firestore
 */
export function subscribeToUserMemories(
  userId: string,
  onUpdate: (memories: MemoMemoryItem[]) => void
): Unsubscribe {
  const path = `user_memories`;
  try {
    const memsCol = collection(db, 'user_memories');
    const q = query(memsCol, where('userId', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const memories: MemoMemoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          memories.push({
            id: data.memoryId || docSnap.id,
            userId: data.userId || userId,
            text: data.text || '',
            category: data.category || 'preference',
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || Date.now(),
          });
        });
        memories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        onUpdate(memories);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return unsubscribe;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}
