// import { COOKIE_CONSENT_ACCEPTED } from '../assets/internal/cookie_consent.js';

// Sentry.init({
//   dsn: 'https://44b623ba6268a114c45ccffad2af8c3b@o4510182185631744.ingest.de.sentry.io/4510182202277968',
//   // Optional: Add release/version for better tracking (e.g., from package.json)
//   release: '1.0.0', // Update as needed
//   // Optional: Environment (e.g., 'production' for live, 'development' for local)
//   environment: 'production',
//   // Setting this option to true will send default PII data to Sentry.
//   // For example, automatic IP address collection on events
//   sendDefaultPii: localStorage.getItem(COOKIE_CONSENT_ACCEPTED) === 'true',
// });

// TODO: flytta sentry-init till denna fil (men behåll script src"...." i index.html)

(window as any).Sentry.init({
  dsn: 'https://44b623ba6268a114c45ccffad2af8c3b@o4510182185631744.ingest.de.sentry.io/4510182202277968',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
