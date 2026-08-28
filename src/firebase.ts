import {
  app,
  auth,
  db,
  googleProvider,
  OperationType,
  FirestoreErrorInfo,
  handleFirestoreError,
  loginWithGoogle as signInWithGoogle,
  logoutUser as signOutUser
} from './lib/firebase';

export {
  app,
  auth,
  db,
  googleProvider,
  OperationType,
  handleFirestoreError,
  signInWithGoogle,
  signOutUser
};
export const googleAuthProvider = googleProvider;
export type { FirestoreErrorInfo };


