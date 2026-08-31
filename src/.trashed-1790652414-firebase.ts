import {
  app,
  auth,
  db,
  OperationType,
  FirestoreErrorInfo,
  handleFirestoreError,
  logoutUser as signOutUser
} from './lib/firebase';

export {
  app,
  auth,
  db,
  OperationType,
  handleFirestoreError,
  signOutUser
};
export type { FirestoreErrorInfo };


