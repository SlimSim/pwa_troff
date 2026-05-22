# Troff PWA - AI Coding Agent Instructions

## Project Overview

test-code: 6942

Troff is a Progressive Web App for music training, allowing dancers/musicians to practice with loop sections, speed controls, and timeline markers.

**Tech Stack**: HTML, CSS, TypeScript, Web Components, npm, Workbox, ESLint  
**Backend**: Firebase (Firestore, Storage, Analytics)  
**Monitoring**: Sentry.IO  
**Deployment**: GitHub Pages via GitHub Actions (TS→JS compilation to dist/)

## AI Agent Ground Rules

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask. 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

4. **Explain all changes and reasoning before implementing**. Wait for user approval on significant changes.
5. **Search through code thoroughly** - check multiple files to understand context before suggesting changes.
6. **When multiple approaches exist**, present options with pros/cons and your recommendation, then wait for decision.
7. **Be thorough in code analysis** - accuracy over speed.
8. **Ensure WebKit + Chromium compatibility** (no Customized built-in elements or browser-specific features).
9. **Check existing components and patterns first** - Before creating new components or using native HTML elements (like `<button>`, `<input>`), search for and use existing project components (e.g., use `<t-butt>` instead of `<button>`, check `components/` for reusable patterns).
10. **Never use the `any` type in TypeScript** - always find a more specific type.
11. **Always put functions where they belong** - check the `utils/` folder for existing files and use them if possible, otherwise create a new file in `utils/` or wherever the file structure dictates.

## Test Creation Guidelines for Regression Testing

**Core Principle: Test Actual Code, Not Reimplementations**

**CRITICAL RULE**: Never re-implement functions in test files. Always import and test the actual functions from the codebase.

Import the Actual Function

````javascript
// ✅ CORRECT - Import the actual function
import { withSafeNumber } from '../utils/numberUtils.js';

// ❌ WRONG - Re-implementing the function
const withSafeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

## Legacy Code — Do Not Touch

The following files contain legacy code. You may read them to understand how things were done before, but **NEVER modify, import or reference from these files!**.

- `utils/debugging.ts`
- `utils/timeHack.ts`
- `script.ts`
- `script0.ts`
- `scriptASimple.ts`
- `scriptDBClass.ts`
- `scriptErrorHandler.ts`
- `scriptRateClass.ts`
- `scriptTroffClass.ts`
- `songManagement.ts`
- `find.ts`
- `services/FileApiImplementation.ts`
- `services/analytics.ts`
- `services/file.ts`
- `services/firebase.ts`
- `services/firebaseClient.ts`
- `features/groupManagement.ts`
- Anything in `assets/internal/`

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
````

### PWA Service Worker

- **Workbox Configuration**: `workbox-config.js` with environment-controlled caching
- **Cache Strategy**: StaleWhileRevalidate for runtime, NetworkFirst for Firebase auth
- **Environment Control**: `SW_CLIENTS_CLAIM` and `SW_SKIP_WAITING` env vars control SW behavior

### Styling Conventions

- **Mobile-First**: Base styles for mobile, `@media (min-width: 576px)` for larger screens only. **Never use max-width media queries**
- **Avoid media queries by default**: Do not add responsive breakpoints or screen-size-dependent styles unless explicitly asked. The app is mobile-first and most UI should work the same across all screen sizes. Only reach for `@media (min-width: 576px)` when the user specifically requests different behavior on larger screens.
- **CSS Variables**: Use variables defined in `stylesheets/variables.css` or `stylesheets/variables-theme.css` instead of hardcoded values. **Check existing variables before suggesting new ones**
- **No Inline Styles**: Always use CSS classes or Lit component styles

### Icon Conventions

SVG icons live in `assets/icons/`. When creating new icons:

- Set `fill="currentColor"` AND `stroke="currentColor"` to inherit CSS color
- Use `width="24" height="24" viewBox="0 0 24 24"` for consistency
- Check existing files first to match the style
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

## Reference Docs — Load On Demand

Only load these when relevant to the current task:

- @docs/common-issues.md — when debugging, hitting build errors, or SW/Firebase issues
- @docs/dependencies.md — when adding/changing external dependencies
- @docs/component-patterns.md — when creating or modifying Web Components
