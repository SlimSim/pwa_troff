// Map Firebase CDN ESM URLs to the npm package's types so TypeScript can typecheck URL imports
// This preserves your current runtime (CDN) while providing types from the installed `firebase` package.

// firebase-app
declare module 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js' {
  export * from 'firebase/app';
}

// firebase-auth
declare module 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js' {
  export * from 'firebase/auth';
}

// firebase-firestore
declare module 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js' {
  export * from 'firebase/firestore';
}

// firebase-storage
declare module 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js' {
  export * from 'firebase/storage';
}
