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

import { environment } from '../assets/internal/environment.js';
import { COOKIE_CONSENT_ACCEPTED } from '../assets/internal/cookie_consent.js';

// Initialize app once per page
const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics: any | null = null;
let eventLogger: any | null = null;

// Enable analytics if user has consented
enableAnalyticsIfConsented();

function hasUserGivenCookieConsent(): boolean {
  return localStorage.getItem(COOKIE_CONSENT_ACCEPTED) === 'true';
}

async function loadAnalytics(): Promise<any> {
  if (analytics) return analytics;

  if (!hasUserGivenCookieConsent()) {
    return null;
  }

  try {
    // Dynamically import analytics module
    const { initializeAnalytics, logEvent, setAnalyticsCollectionEnabled } = await import(
      //@ts-ignore
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js'
    );

    eventLogger = logEvent;

    // Initialize analytics with collection disabled by default
    analytics = initializeAnalytics(app, { automaticDataCollectionEnabled: false });

    // Enable only if consent was already given
    setAnalyticsCollectionEnabled(analytics, true);

    return analytics;
  } catch (error) {
    console.warn('Analytics not available (likely running on localhost or blocked region):', error);
    return null;
  }
}

// Function to enable analytics if consent is given
async function enableAnalyticsIfConsented(): Promise<void> {
  if (!hasUserGivenCookieConsent()) {
    // If no consent, ensure analytics is disabled if it was loaded
    if (analytics) {
      const { setAnalyticsCollectionEnabled } = await import(
        //@ts-ignore
        'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js'
      );
      setAnalyticsCollectionEnabled(analytics, false);
    }
    return;
  }

  // Load analytics if needed and enable collection
  const analyticsInstance = await loadAnalytics();
  if (analyticsInstance) {
    const { setAnalyticsCollectionEnabled } = await import(
      //@ts-ignore
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js'
    );
    setAnalyticsCollectionEnabled(analyticsInstance, true);
  }
}

async function initiateAllFirebaseGroups(firebaseUserEmail: string | null) {
  if (!firebaseUserEmail) {
    return;
  }
  const q = query(collection(db, 'Groups'), where('owners', 'array-contains', firebaseUserEmail));

  return await getDocs(q);
}

document.addEventListener('cookieConsentGiven', () => {
  // After user accepts, load and enable analytics
  enableAnalyticsIfConsented();
});

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
  loadAnalytics,
  eventLogger,
  hasUserGivenCookieConsent,
};
