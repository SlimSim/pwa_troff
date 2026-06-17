/**
 * Minimal Firebase initialiser for the v2 app.
 *
 * Instead of importing `services/firebaseClient.js` (which pulls in
 * `cookie_consent.js` → jQuery → crashes on the v2 page), this module loads
 * the Firebase Firestore SDK directly from the CDN and creates a dedicated app.
 *
 * Extract into its own module so tests can mock it without loading CDN modules.
 */

// ---------------------------------------------------------------------------
// Firebase config — mirrors the hostname-based selection in
// `assets/internal/environment.ts` (legacy). These values are public-facing
// identifiers used to configure the Firebase SDK in the browser.
// ---------------------------------------------------------------------------

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function getFirebaseConfig(): FirebaseConfig {
  const hostname = window.location.hostname;
  switch (hostname) {
    case 'localhost':
      return {
        apiKey: 'AIzaSyCo1r8aMFCPHdfNu_V-hqF1GMa4A9rU7ww',
        authDomain: 'pwa-troff-dev.firebaseapp.com',
        projectId: 'pwa-troff-dev',
        storageBucket: 'pwa-troff-dev.appspot.com',
        messagingSenderId: '245960461240',
        appId: '1:245960461240:web:7969954a2707709f13dd4d',
      };
    case 'slimsim.github.io':
    case 'beta.troff.app':
      return {
        apiKey: 'AIzaSyCEO1gRovzs8OX7iVrLcOhjyosnYjeKRtM',
        authDomain: 'troff-test.firebaseapp.com',
        projectId: 'troff-test',
        storageBucket: 'troff-test.appspot.com',
        messagingSenderId: '512336951689',
        appId: '1:512336951689:web:8b47596c7f3edd26878958',
      };
    case 'troff.app':
    case 'ios.troff.app':
    case 'troff.slimsim.heliohost.org':
    case 'troff.ternsjo-it.heliohost.us':
      return {
        apiKey: 'AIzaSyCuXb4zPlM50HMJGilbgM9DxvZuMGxG7yw',
        authDomain: 'troff-prod.firebaseapp.com',
        projectId: 'troff-prod',
        storageBucket: 'troff-prod.appspot.com',
        messagingSenderId: '681700603804',
        appId: '1:681700603804:web:94fe1e2ec88590ed147a59',
      };
    default:
      throw new Error(
        `No Firebase config for hostname "${hostname}". ` +
          'Downloading songs from server links is not supported on this domain.'
      );
  }
}

type FirestoreHandle = {
  db: unknown;
  doc: (...args: unknown[]) => unknown;
  getDoc: (
    ...args: unknown[]
  ) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
};

let cachedPromise: Promise<FirestoreHandle> | null = null;

/**
 * Lazily initialise Firebase Firestore and return its core API.
 * The first call loads the Firebase SDK modules from the CDN; subsequent calls
 * reuse the cached handle.
 */
export async function getFirestore(): Promise<FirestoreHandle> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const config = getFirebaseConfig();

    // Dynamic import of Firebase SDK modules from CDN.
    // These modules have no TS types available, so we cast to unknown
    // and treat the result as the expected object shape.
    type FirebaseAppModule = { initializeApp: (...args: unknown[]) => unknown };
    type FirebaseFirestoreModule = {
      getFirestore: (...args: unknown[]) => unknown;
      doc: (...args: unknown[]) => unknown;
      getDoc: (...args: unknown[]) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>;
    };

    const firebaseApp = (await import(
      'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'
    )) as unknown as FirebaseAppModule;
    const firebaseFirestore = (await import(
      'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'
    )) as unknown as FirebaseFirestoreModule;

    const initializeApp = firebaseApp.initializeApp as (config: FirebaseConfig, name: string) => unknown;
    const getFirestoreFn = firebaseFirestore.getFirestore as (
      app: unknown
    ) => unknown;
    const app = initializeApp(config, 'troff-hash-download');
    const db = getFirestoreFn(app);
    return {
      doc: firebaseFirestore.doc,
      getDoc: firebaseFirestore.getDoc,
      db,
    };
  })();

  // cachedPromise was just assigned above, so it's definitely not null
  return cachedPromise!;
}
