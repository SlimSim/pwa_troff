// Centralized Firebase initialization and exports for both main app and admin
// v9 modular SDK via CDN

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  addDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  listAll,
  deleteObject,
  uploadBytesResumable,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import {
  initializeAnalytics,
  setAnalyticsCollectionEnabled,
  logEvent,
  //@ts-ignore
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';

import { environment } from '../assets/internal/environment.js';
import { COOKIE_CONSENT_ACCEPTED } from '../assets/internal/cookie_consent.js';

// Initialize app once per page
const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics: any | null = tryGetAnal(app);

// Enable analytics if user has consented
enableAnalyticsIfConsented();

function tryGetAnal(app: any): any | null {
  let anal: any | null;
  try {
    anal = initializeAnalytics(app, { automaticDataCollectionEnabled: false });
  } catch (error) {
    console.warn('Analytics not available (likely running on localhost or blocked region):', error);
    anal = null;
  }
  return anal;
}

function enableAnalyticsIfConsented(): void {
  if (analytics) {
    const consent = localStorage.getItem(COOKIE_CONSENT_ACCEPTED);
    if (consent === 'true') {
      setAnalyticsCollectionEnabled(analytics, true);
    }
  }
}

async function initiateAllFirebaseGroups(firebaseUserEmail: string | null) {
  if (!firebaseUserEmail) {
    return;
  }
  const q = query(collection(db, 'Groups'), where('owners', 'array-contains', firebaseUserEmail));

  return await getDocs(q);
}

export {
  app,
  auth,
  db,
  storage,
  // Auth helpers
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  // Firestore helpers
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc,
  addDoc,
  // Storage helpers
  ref,
  listAll,
  deleteObject,
  uploadBytesResumable,
  getDownloadURL,
  initiateAllFirebaseGroups,
  // Analytics
  analytics,
  logEvent,
  enableAnalyticsIfConsented,
};
