import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CSSResult } from 'lit';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

// Feature spec — Copy/Clear logs row expands to full width (v2, surgical, CSS only):
// Copy logs + Clear logs <t-butt> already share one row in Advanced settings
// (see components/molecule/t-settings-panel.ts — do NOT move/reorder buttons).
// Request: make them expand so both together take full width
// (e.g. flex row with flex:1 each, equal share, no overflow).
// Mobile-first, no max-width media queries, use existing CSS vars,
// no inline-style abuse beyond matching existing pattern (prefer class in static styles).
//
// These tests are RED until the panel adds the expanding flex-row CSS.
// They import the ACTUAL panel — never re-implement layout logic here.

vi.mock('../utils/notification.js', () => ({
  showToast: vi.fn(),
}));

type SettingsPanelCtor = typeof SettingsPanel;

async function mountPanel(): Promise<SettingsPanel> {
  const mod = await import('../components/molecule/t-settings-panel.js');
  const panel = new mod.SettingsPanel() as SettingsPanel;
  document.body.appendChild(panel);
  await panel.updateComplete;
  return panel;
}

function getAdvancedDetails(panel: SettingsPanel): Element | null {
  const all = Array.from(panel.shadowRoot?.querySelectorAll('t-details') ?? []);
  return all.find((d) => d.getAttribute('title') === 'Advanced Settings') ?? null;
}

function findButtByLabel(root: ParentNode, re: RegExp): Element | null {
  const butts = Array.from(root.querySelectorAll('t-butt'));
  return butts.find((b) => re.test(b.textContent ?? '')) ?? null;
}

function getPanelCssText(ctor: SettingsPanelCtor): string {
  const styles = (ctor as unknown as { styles: CSSResult | CSSResult[] }).styles;
  const list = Array.isArray(styles) ? styles : [styles];
  return list
    .map((s) => (typeof s?.cssText === 'string' ? s.cssText : ''))
    .join('\n');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ruleBlocksFor(cssText: string, selector: string): string {
  const escaped = escapeRegExp(selector);
  const re = new RegExp(`${escaped}\\s*\\{[^}]*\\}`, 'g');
  return cssText.match(re)?.join('\n') ?? '';
}

function hasExpandDecl(block: string): boolean {
  const lower = block.toLowerCase();
  return (
    /flex\s*:\s*1(\s+1(\s+0%?)?)?\s*;/.test(lower) ||
    /flex-grow\s*:\s*1\s*;/.test(lower) ||
    /width\s*:\s*50%\s*;/.test(lower) ||
    /flex\s*:\s*1\s+1\s+0/.test(lower)
  );
}

/**
 * Find ANY static rule that both mentions one of the given class names
 * in its selector AND carries an expanding declaration.
 * Scoped to the actual logs row / its buttons so unrelated rules
 * (e.g. `.theme-selector t-butt { flex-grow: 1 }`) do not count.
 */
function hasScopedExpandRule(
  cssText: string,
  classNames: string[],
  requireButtInSelector: boolean,
): boolean {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(cssText)) !== null) {
    const selector = (match[1] ?? '').toLowerCase();
    const body = (match[2] ?? '').toLowerCase();
    const mentionsClass = classNames.some((cls) =>
      selector.includes(`.${cls.toLowerCase()}`),
    );
    if (!mentionsClass) continue;
    if (requireButtInSelector) {
      const targetsButt =
        selector.includes('t-butt') ||
        selector.includes('.flex-grow') ||
        selector.includes('butt');
      if (!targetsButt) continue;
    }
    if (hasExpandDecl(body)) return true;
  }
  return false;
}

describe('Advanced settings Copy/Clear logs row expands to full width', () => {
  let panel: SettingsPanel | null = null;
  let panelCtor: SettingsPanelCtor | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    panel = null;
    panelCtor = null;
    vi.restoreAllMocks();
  });

  async function mountAndLocate(): Promise<{
    row: Element;
    copyButt: Element;
    clearButt: Element;
    cssText: string;
  }> {
    panel = await mountPanel();
    await panel.updateComplete;
    const modCtor = (
      panel.constructor as unknown as { styles: CSSResult | CSSResult[] }
    ).constructor;
    void modCtor;
    const ctor = panel.constructor as unknown as SettingsPanelCtor;
    panelCtor = ctor;
    const cssText = getPanelCssText(ctor);
    const advanced = getAdvancedDetails(panel);
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    const copyButt = findButtByLabel(advanced as Element, /copy.*log/i);
    const clearButt = findButtByLabel(advanced as Element, /clear.*log/i);
    expect(copyButt, 'expected existing "Copy logs" t-butt').toBeTruthy();
    expect(clearButt, 'expected existing "Clear logs" t-butt').toBeTruthy();
    const row = copyButt?.parentElement;
    expect(row, 'expected Copy/Clear buttons to share a parent row').toBeTruthy();
    return { row: row as Element, copyButt: copyButt as Element, clearButt: clearButt as Element, cssText };
  }

  it('places Copy logs + Clear logs in the SAME parent row (do not move/reorder)', async () => {
    const { row, copyButt, clearButt } = await mountAndLocate();
    expect(clearButt.parentElement).toBe(row);
    expect(copyButt.parentElement).toBe(row);
    expect(row.tagName.toLowerCase()).not.toBe('t-butt');
  });

  it('row is a flex row via a static-styles class (not inline style alone)', async () => {
    const { row, cssText } = await mountAndLocate();
    const rowClasses = Array.from(row.classList);
    expect(rowClasses.length, 'expected logs row to carry at least one class').toBeGreaterThan(0);

    const flexViaClass = rowClasses.some((cls) =>
      /display\s*:\s*flex/.test(ruleBlocksFor(cssText, `.${cls}`).toLowerCase()),
    );

    expect(
      flexViaClass,
      `expected SettingsPanel static styles to define "display: flex" for one of the logs-row classes [${rowClasses.join(', ')}]; ` +
        `prefer a dedicated class in static styles over inline style. ` +
        `Row outerHTML was: ${(row as HTMLElement).outerHTML.slice(0, 300)}`,
    ).toBe(true);
  });

  it('each button expands to share full width (flex:1 / flex-grow:1 / width:50% via static styles)', async () => {
    const { row, copyButt, clearButt, cssText } = await mountAndLocate();
    const rowClasses = Array.from(row.classList);
    const buttClasses = Array.from(
      new Set([...Array.from(copyButt.classList), ...Array.from(clearButt.classList)]),
    );

    // Either: a button-level class (e.g. .flex-grow) carries the expand decl,
    // OR a row-scoped descendant rule (e.g. .logs-row t-butt) carries it.
    const buttonClassExpand = hasScopedExpandRule(cssText, buttClasses, false);
    const rowDescendantExpand = hasScopedExpandRule(cssText, rowClasses, true);

    expect(
      buttonClassExpand || rowDescendantExpand,
      `expected SettingsPanel static styles to expand BOTH logs buttons equally (flex:1 / flex-grow:1 / width:50%). ` +
        `Looked for expand decl on button classes [${buttClasses.join(', ')}] ` +
        `or row-scoped t-butt rule for row classes [${rowClasses.join(', ')}]. ` +
        `Row outerHTML was: ${(row as HTMLElement).outerHTML.slice(0, 300)}`,
    ).toBe(true);

    // Equal share: both buttons must be covered by the same mechanism —
    // same parent (above) plus both carrying the expanding class or both
    // matched by the row-descendant rule.
    if (buttonClassExpand && !rowDescendantExpand) {
      const expandingClasses = buttClasses.filter((cls) =>
        hasExpandDecl(ruleBlocksFor(cssText, `.${cls}`).toLowerCase()),
      );
      const copyHas = Array.from(copyButt.classList).some((c) =>
        expandingClasses.includes(c),
      );
      const clearHas = Array.from(clearButt.classList).some((c) =>
        expandingClasses.includes(c),
      );
      expect(copyHas && clearHas, 'expected BOTH buttons to carry the expanding class').toBe(
        true,
      );
    }
  });

  it('mobile-first guard: no max-width media query drives the logs-row layout', async () => {
    const { cssText } = await mountAndLocate();
    expect(
      /@media[^{]*max-width/.test(cssText),
      'expected no @media (max-width: ...) in SettingsPanel static styles (mobile-first, min-width only)',
    ).toBe(false);
  });
});
