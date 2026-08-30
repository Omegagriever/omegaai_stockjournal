import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with custom databaseId if configured
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Auth Helpers
export const signInWithGoogle = async (): Promise<User> => {
  try {
    localStorage.removeItem('aegis_guest_session');
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: unknown) {
    console.error('Google Sign-In failed or popup blocked:', error);
    throw error;
  }
};

export interface GuestUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

const GUEST_SESSION_KEY = 'aegis_guest_session';
const GUEST_AUTH_EVENT = 'aegis_guest_auth_change';

export const signInAsGuest = async (displayName: string = 'Demo Investor'): Promise<GuestUser> => {
  try {
    // Attempt Firebase Anonymous Auth first
    const result = await signInAnonymously(auth);
    localStorage.removeItem(GUEST_SESSION_KEY);
    return result.user;
  } catch (error: unknown) {
    // If anonymous auth is disabled on the Firebase project (auth/admin-restricted-operation),
    // provide a local guest session so user can test the app without being blocked.
    console.warn('Firebase Anonymous Auth not enabled on project. Initializing local guest session:', error);
    const guestUser: GuestUser = {
      uid: 'guest_demo_investor',
      email: 'guest@demo.local',
      displayName: displayName || 'Demo Portfolio Manager',
      photoURL: null,
      isAnonymous: true,
    };
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
    window.dispatchEvent(new CustomEvent(GUEST_AUTH_EVENT, { detail: guestUser }));
    return guestUser;
  }
};

export const logOut = async (): Promise<void> => {
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
    window.dispatchEvent(new CustomEvent(GUEST_AUTH_EVENT, { detail: null }));
    await firebaseSignOut(auth);
  } catch (error: unknown) {
    console.error('Sign Out failed:', error);
    throw error;
  }
};

export const subscribeAuthState = (callback: (user: User | GuestUser | null) => void) => {
  // Check if there is an active guest session
  const storedGuest = localStorage.getItem(GUEST_SESSION_KEY);
  if (storedGuest) {
    try {
      const parsed = JSON.parse(storedGuest) as GuestUser;
      callback(parsed);
    } catch {
      localStorage.removeItem(GUEST_SESSION_KEY);
    }
  }

  // Firebase auth state listener
  const unsubscribeFirebase = onAuthStateChanged(auth, (firebaseUser) => {
    const currentGuest = localStorage.getItem(GUEST_SESSION_KEY);
    if (firebaseUser) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      callback(firebaseUser);
    } else if (currentGuest) {
      try {
        const parsed = JSON.parse(currentGuest) as GuestUser;
        callback(parsed);
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });

  // Guest auth state listener
  const handleGuestAuthChange = (e: Event) => {
    const customEvent = e as CustomEvent<GuestUser | null>;
    callback(customEvent.detail);
  };
  window.addEventListener(GUEST_AUTH_EVENT, handleGuestAuthChange);

  return () => {
    unsubscribeFirebase();
    window.removeEventListener(GUEST_AUTH_EVENT, handleGuestAuthChange);
  };
};

export { onAuthStateChanged };
export type { User };
