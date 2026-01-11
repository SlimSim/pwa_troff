# Troff PWA - AI Coding Agent Instructions

## Project Overview

Troff is a Progressive Web App for music training, allowing dancers/musicians to practice with loop sections, speed controls, and timeline markers.

**Tech Stack**: HTML, CSS, TypeScript, Web Components, npm, Workbox, ESLint  
**Backend**: Firebase (Firestore, Storage, Analytics)  
**Monitoring**: Sentry.IO  
**Deployment**: GitHub Pages via GitHub Actions (TS→JS compilation to dist/)

## AI Agent Ground Rules

1. **Explain all changes and reasoning before implementing**. Wait for user approval on significant changes.
2. **Search through code thoroughly** - check multiple files to understand context before suggesting changes.
3. **When multiple approaches exist**, present options with pros/cons and your recommendation, then wait for decision.
4. **Be thorough in code analysis** - accuracy over speed.
5. **Ensure WebKit + Chromium compatibility** (no Customized built-in elements or browser-specific features).

## Architecture & Key Patterns

### Component Architecture

- **Atomic Design**: Components organized in `components/{atom,molecule,legacy}/`
- **Web Components**: Uses Lit framework with `@customElement` decorator
- **Component Pattern**: `t-*` prefix for all custom elements (e.g., `t-main-layout`, `t-butt`, `t-icon`)
- **CSS-in-JS**: Component styles use Lit's `css` tagged template literals
- **Slots**: Layout components use named slots for flexible content composition

### Data Architecture

- **Local Storage**: `nDB` (New Database) wrapper in `assets/internal/db.ts` for IndexedDB-like operations
- **Firebase Integration**: Dual service pattern - `services/firebaseClient.ts` for connection, `services/firebase.ts` for business logic
- **Type Safety**: Comprehensive TypeScript types in `types/` directory, especially `troff.d.ts` for core data structures
- **Data Sync**: Local-first with Firebase sync for user songs and groups

### File Organization Patterns

- **Service Layer**: `services/` contains Firebase, file handling, analytics
- **Business Logic**: Root-level `script*.ts` files contain main app logic (legacy pattern)
- **Utilities**: `utils/` for cross-cutting concerns (logging, debugging, time helpers)
- **Types**: Centralized in `types/` directory with `.d.ts` files
- **Assets**: `assets/internal/` for app code, `assets/external/` for third-party libraries

## Development Workflows

### Build & Development

```bash
npm run dev          # Full development mode (build:watch + copy:watch + sw:watch + serve)
npm run build:check  # Composite: lint + typecheck + build (production validation)
npm run copy:watch   # Watches non-TS files, copies to dist/
npm run sw:watch     # Regenerates service worker on dist/ changes
```

### PWA Service Worker

- **Workbox Configuration**: `workbox-config.js` with environment-controlled caching
- **Cache Strategy**: StaleWhileRevalidate for runtime, NetworkFirst for Firebase auth
- **Environment Control**: `SW_CLIENTS_CLAIM` and `SW_SKIP_WAITING` env vars control SW behavior

### Styling Conventions

- **Mobile-First**: Base styles for mobile, `@media (min-width: 576px)` for larger screens only. **Never use max-width media queries**
- **CSS Variables**: Use variables defined in `stylesheets/variables.css` or `stylesheets/variables-theme.css` instead of hardcoded values. **Check existing variables before suggesting new ones**
- **No Inline Styles**: Always use CSS classes or Lit component styles
- **Icon Pattern**: SVG icons in `assets/icons/` directory with strict conventions:
  - Set `fill="currentColor"` AND `stroke="currentColor"` to inherit CSS color
  - Use `width="24" height="24" viewBox="0 0 24 24"` for consistency
  - Check existing files first to match style
  - Save with descriptive kebab-case names
  - Avoid external icon libraries (moving away from Fontello)

## Critical Integration Points

### Firebase Architecture

- **Authentication**: Google OAuth via `services/firebaseClient.ts`
- **Database**: Firestore collections for songs and user groups
- **Storage**: File uploads with automatic cleanup on song deletion
- **Real-time**: `onSnapshot` listeners for live data synchronization

### Audio/Media Handling

- **File Types**: Supports audio, video, and images via `script0.ts` utilities
- **Caching**: Song files cached separately from app assets (preserved across updates)
- **Playback**: Audio element controls with custom timeline markers and looping

### TypeScript Configuration

- **Module System**: ES2020 modules with `.js` imports (compiled output extensions)
- **Decorators**: Experimental decorators enabled for Lit components
- **Target**: ES2020 with DOM + jQuery types included

## Project-Specific Patterns

### Import Conventions

```typescript
// Always use .js extensions in imports (TS compilation target)
import './components/atom/t-butt.js';
import { nDB } from './assets/internal/db.js';
```

### Database Operations

```typescript
// Use nDB wrapper for consistent data operations
nDB.setOnSong(songId, 'propertyName', value);
nDB.setOnSong(songId, ['nested', 'path'], value);
```

### Component Creation

```typescript
@customElement('t-new-component')
export class NewComponent extends LitElement {
  static styles = css`
    /* Mobile-first styles */
  `;
  render() {
    return html`<slot></slot>`;
  }
}
```

## Common Issues & Solutions

- **Service Worker**: Use environment-specific scripts (`workbox:dev` vs `workbox:prod`)
- **TypeScript Imports**: Always `.js` extensions, never `.ts` in import statements
- **Firebase Auth**: Check authentication state before accessing user-specific features
- **PWA Caching**: Audio files require special cache handling to prevent bloat

## External Dependencies

- **Lit**: Web components framework (vendor-copied to `assets/external/vendor/`)
- **Firebase**: v9+ modular SDK via CDN imports
- **jQuery**: Legacy dependency for DataTables and some DOM manipulation
- **DataTables**: Table management for song lists
- **Workbox**: Service worker generation and PWA caching strategies
