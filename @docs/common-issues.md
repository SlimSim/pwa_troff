## Common Issues & Solutions

- **Service Worker**: Use environment-specific scripts (`workbox:dev` vs `workbox:prod`)
- **TypeScript Imports**: Always `.js` extensions, never `.ts` in import statements
- **Firebase Auth**: Check authentication state before accessing user-specific features
- **PWA Caching**: Audio files require special cache handling to prevent bloat
