import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaParent } from './t-media-parent.js';

/**
 * Type-safe view of the authBusy contract on t-media-parent:
 * `@property({ type: Boolean }) authBusy = false` (public, settable from
 * outside). Intersection cast stays valid before (RED) and after the
 * property exists — no `any`, no @ts-expect-error that would break later.
 */
type MediaParentAuth = MediaParent & { authBusy: boolean };

/**
 * Empty-state sign-in busy state on t-media-parent.
 *
 * While `authBusy === true` the empty-state "Sign in" area must show a
 * <t-loading> busy indicator, and the normal "Sign in" t-butt must either be
 * absent or disabled so a second click cannot re-dispatch
 * `sign-in-requested`. When authBusy returns to false, the normal button is
 * restored.
 */
describe('t-media-parent authBusy (empty-state sign-in busy state)', () => {
  let element: MediaParent;
  let authElement: MediaParentAuth;

  beforeEach(() => {
    // Skip the async _loadSongs() from connectedCallback (same pattern as
    // t-media-parent.test.ts) so the component renders without touching
    // localStorage or the Cache API.
    vi.spyOn(
      MediaParent.prototype as unknown as { _loadSongs: () => Promise<void> },
      '_loadSongs'
    ).mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);
    authElement = element as MediaParentAuth;

    // Empty library → the empty state (with the Sign in button) renders.
    (element as unknown as { songs: unknown[] }).songs = [];
    (element as unknown as { groups: unknown[] }).groups = [];
    element.currentFilter = 'tracks';
    element.signedIn = false;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getEmptyState(): Element | null {
    return element.shadowRoot?.querySelector('.empty-state') ?? null;
  }

  /** The empty-state "Sign in" t-butt (exact label match, ignores icons). */
  function findSignInButt(): Element | null {
    const butts = Array.from(
      element.shadowRoot?.querySelectorAll('.empty-state-actions t-butt') ?? []
    );
    return butts.find((b) => (b.textContent || '').trim() === 'Sign in') ?? null;
  }

  it('exposes authBusy defaulting to false', () => {
    expect(authElement.authBusy).toBe(false);
  });

  it('5. authBusy=true shows t-loading in the empty state with no active Sign in button', async () => {
    authElement.authBusy = true;
    await element.updateComplete;

    const emptyState = getEmptyState();
    expect(emptyState).toBeTruthy();
    expect(emptyState?.querySelector('t-loading')).toBeTruthy();

    const signIn = findSignInButt();
    if (signIn) {
      expect(signIn.hasAttribute('disabled')).toBe(true);
    }
  });

  it('6. authBusy=false restores the normal Sign in t-butt', async () => {
    authElement.authBusy = true;
    await element.updateComplete;
    expect(getEmptyState()?.querySelector('t-loading')).toBeTruthy();

    authElement.authBusy = false;
    await element.updateComplete;

    expect(getEmptyState()?.querySelector('t-loading')).toBeFalsy();

    const signIn = findSignInButt();
    expect(signIn).toBeTruthy();
    expect(signIn!.hasAttribute('disabled')).toBe(false);
  });

  /**
   * Extract the declaration block of a single class rule from the component's
   * static Lit styles (a css`` tagged template → one flat CSS string).
   */
  function getStyleRuleBlock(selector: string): string {
    const stylesText = String(MediaParent.styles);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = stylesText.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[1] ?? '';
  }

  it('7. busy container sits inside .empty-state-actions and is left-aligned (justify-content: flex-start)', async () => {
    authElement.authBusy = true;
    await element.updateComplete;

    // Structure: the busy div renders inside the actions column that holds
    // the left-aligned Sign in t-butt.
    const busy = element.shadowRoot?.querySelector(
      '.empty-state-actions .empty-state-auth-busy'
    );
    expect(busy).toBeTruthy();

    // The actions column stretches its children left-to-right, so the busy
    // row must start at the left edge — same as the Sign in button.
    const block = getStyleRuleBlock('.empty-state-auth-busy');
    expect(block).toContain('justify-content: flex-start');
    expect(block).not.toContain('justify-content: center');
  });
});
