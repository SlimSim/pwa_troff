// Centralized Firebase initialization and exports for both main app and admin
// v9 modular SDK via CDN

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getRedirectResult,
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

// Initialize app once per page
const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

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
  getRedirectResult,
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
};
