// types/environment.d.ts

export interface Banner {
  show: boolean;
  text: string;
  showLogs: boolean;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string; // only present in prod
}

export interface Environment {
  banner: Banner;
  showHiddenInProd: boolean;
  firebaseConfig: FirebaseConfig;
}
