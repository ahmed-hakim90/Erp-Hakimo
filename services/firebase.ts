/**
 * Firebase Core Initialization
 * Reads config from VITE_ environment variables.
 * Supports Email/Password authentication.
 */
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** true when at least the API key is present */
const isConfigured =
  !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  console.warn(
    '⚠ Firebase not configured. Add VITE_FIREBASE_* variables to .env.local'
  );
}

export { db, auth, isConfigured };

/**
 * Sign in with email and password — returns the UserCredential.
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  if (!isConfigured || !auth) throw new Error('Firebase not configured');
  return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Create a new user with email and password (admin action).
 * Returns the UserCredential.
 */
export const createUserWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  if (!isConfigured || !auth) throw new Error('Firebase not configured');
  return createUserWithEmailAndPassword(auth, email, password);
};

/**
 * Sign out the current user.
 */
export const signOut = async (): Promise<void> => {
  if (!isConfigured || !auth) return;
  await firebaseSignOut(auth);
};

/**
 * Send a password reset email.
 */
export const resetPassword = async (email: string): Promise<void> => {
  if (!isConfigured || !auth) throw new Error('Firebase not configured');
  await sendPasswordResetEmail(auth, email);
};

/**
 * Listen for auth state changes.
 * Returns an unsubscribe function.
 */
export const onAuthChange = (
  callback: (user: User | null) => void
): (() => void) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};
