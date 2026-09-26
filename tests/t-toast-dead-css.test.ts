import { describe, it, expect, afterEach } from 'vitest';
import { Toast } from '../components/atom/t-toast.js';
import '../components/atom/t-butt.js';

/**
 * Regression test for dead `--butt-*` CSS cleanup in t-toast.ts.
 *
 * The static styles contain a `t-butt { ... }` override block setting
 * `--butt-bg-color`, `--butt-hover-bg-color`, `--butt-active-bg-color`,
 * `--butt-border` and `--butt-color`. Those custom properties are never read
 * by `components/atom/t-butt.ts`, so the block has zero visual effect.
 * The cleanup deletes that dead block; this test asserts it is gone.
 */

function getToastCssText(): string {
  const styles = (Toast as unknown as { styles: { cssText: string } }).styles;
  return styles.cssText;
}

describe('t-toast dead t-butt CSS cleanup', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not contain dead --butt-* custom properties in static styles', () => {
    const cssText = getToastCssText();
    const deadProps = [
      '--butt-bg-color',
      '--butt-hover-bg-color',
      '--butt-active-bg-color',
      '--butt-border',
      '--butt-color',
    ];
    for (const prop of deadProps) {
      expect(cssText, `dead CSS "${prop}" should be removed`).not.toContain(prop);
    }
  });

  it('behavioral guard: action button still renders and fires toast-action-clicked', async () => {
    const toast = document.createElement('t-toast') as Toast;
    toast.message = 'hello';
    toast.duration = 0;
    toast.actionLabel = 'Retry';
    document.body.appendChild(toast);
    await toast.updateComplete;

    const actionButton = toast.shadowRoot?.querySelector('t-butt') as HTMLElement | null;
    expect(actionButton).toBeTruthy();

    let fired = false;
    toast.addEventListener('toast-action-clicked', () => {
      fired = true;
    });
    actionButton?.click();
    expect(fired).toBe(true);
  });
});
