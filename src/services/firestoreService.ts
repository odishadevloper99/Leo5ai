import {
  ref,
  set,
  get,
  remove,
  onValue,
  off
} from 'firebase/database';
import { database, auth, handleFirestoreError, OperationType } from '../firebase';
import { ChatSession, Message, UserProfile, MemoMemoryItem } from '../types';

export type Unsubscribe = () => void;

/**
 * User Profile Realtime Database Sync
 */
export async function syncUserProfile(user: UserProfile): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userRef = ref(database, path);
    await set(userRef, {
      uid: user.uid,
      displayName: user.displayName || 'Leo Explorer',
      email: user.email || '',
      photoURL: user.photoURL || '',
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Real-time Chat Sessions Subscription via Realtime Database
 */
export function subscribeToUserSessions(
  userId: string,
  onUpdate: (sessions: ChatSession[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = `chats/${userId}`;
  try {
    const chatsRef = ref(database, path);
    const listener = onValue(
      chatsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const sessions: ChatSession[] = Object.values(data);
          sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          onUpdate(sessions);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );

    return () => {
      off(chatsRef, 'value', listener);
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

/**
 * Save or Update a Chat Session in Realtime Database
 */
export async function saveChatSession(session: ChatSession, userId: string): Promise<void> {
  const path = `chats/${userId}/${session.id}`;
  try {
    const sessionRef = ref(database, path);
    await set(sessionRef, {
      ...session,
      userId,
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Load Messages for a specific Chat Session from Realtime Database
 */
export async function loadSessionMessages(sessionId: string): Promise<Message[]> {
  return [];
}

/**
 * Delete a Chat Session from Realtime Database
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const userId = auth.currentUser?.uid || 'default-user';
  const path = `chats/${userId}/${sessionId}`;
  try {
    const chatRef = ref(database, path);
    await remove(chatRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Real-time User Memories Subscription in Realtime Database
 */
export function subscribeToUserMemories(
  userId: string,
  onUpdate: (memories: MemoMemoryItem[]) => void
): Unsubscribe {
  const path = `memories/${userId}`;
  try {
    const memsRef = ref(database, path);
    const listener = onValue(
      memsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const memories: MemoMemoryItem[] = Object.values(data);
          memories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          onUpdate(memories);
        } else {
          onUpdate([]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => {
      off(memsRef, 'value', listener);
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}
