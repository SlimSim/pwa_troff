import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TButt } from '../components/atom/t-butt.js';
import { Dial } from '../components/atom/t-dial.js';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * FOLLOW-UP SPEC: volume boost to 420% exists — danger styling needs fixes.
 *
 * - t-dial's `.value-display` is a <t-butt>; `class="... danger"` on the host
 *   does NOT style inside t-butt's shadow DOM. t-dial must set the `danger`
 *   ATTRIBUTE (?danger=${...}) on that t-butt, and t-butt must gain a `danger`
 *   property + its own CSS rule based on --danger-color.
 * - No `important` color/attribute for the badge (in some themes
 *   --important-button is not red). Dedicated --danger-color /
 *   --on-danger-color must be red-ish in EVERY theme block of
 *   stylesheets/variables-theme.css.
 * - volume-boost-badge: smaller than the old slim round t-butt (1.8rem), NOT a
 *   <t-butt> (plain div/span), but clicking it must toggle the speed dropdown
 *   exactly like pressing the speed dropdown button.
 *
 * Imports the ACTUAL components (never re-implementations); RED until fixed.
 */

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readSource(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

type CssRule = { selector: string; body: string };

type ButtWithDanger = TButt & { danger: boolean };

type DangerableElement = HTMLElement & { danger?: boolean };

/** Parse flat CSS text into { selector, body } rules (comments stripped). */
function rulesOf(cssText: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const m of cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();
    rules.push({ selector, body: m[2] });
  }
  return rules;
}

/** CSS embedded in a TS component: `static styles = css\`...\`` + portal <style>. */
function componentCssRules(src: string): CssRule[] {
  const chunks: string[] = [];
  const styles = src.match(/static styles = css`([\s\S]*?)`/);
  if (styles?.[1]) {
    chunks.push(styles[1]);
  }
  for (const m of src.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    if (m[1]) {
      chunks.push(m[1]);
    }
  }
  return chunks.flatMap((chunk) => rulesOf(chunk));
}

/** Only the rules that actually style a `.danger` / `[danger]` state. */
function dangerCssRules(src: string): CssRule[] {
  return componentCssRules(src).filter(
    (rule) => /\.danger\b/.test(rule.selector) || /:host\(\s*\[danger\s*\]/.test(rule.selector)
  );
}

/** Opening tag of the volume-boost badge in t-footer.ts source. */
function badgeMarkupTag(src: string): string {
  const idx = src.indexOf('data-testid="volume-boost-badge"');
  if (idx === -1) {
    return '';
  }
  const start = src.lastIndexOf('<', idx);
  const end = src.indexOf('>', idx);
  if (start === -1 || end === -1) {
    return '';
  }
  return src.slice(start, end + 1);
}

function hexToRgb(value: string): [number, number, number] | null {
  const match = value.trim().toLowerCase().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) {
    return null;
  }
  let h = match[1];
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Red-ish per spec: R >= 100 (dark reds like #8b0000 count) and R > G, R > B. */
function isRedIsh(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  return r >= 100 && r > g && r > b;
}

function dangerValueOf(cssBody: string): string | null {
  const match = cssBody.match(/--danger-color\s*:\s*([^;]+);/);
  return match ? match[1].trim() : null;
}

/** Length of a `width`/`height`/`font-size` declaration in rem (px / 16). */
function declaredRem(cssBody: string, prop: string): number | null {
  const match = cssBody.match(new RegExp(`${prop}\\s*:\\s*([\\d.]+)(rem|px)`));
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1]);
  return match[2] === 'px' ? value / 16 : value;
}

describe('t-butt supports danger', () => {
  let butt: TButt;

  beforeEach(() => {
    butt = new TButt();
    document.body.appendChild(butt);
  });

  afterEach(() => {
    if (document.body.contains(butt)) {
      document.body.removeChild(butt);
    }
  });

  it('reflects danger=true to host attribute OR inner .base danger class', async () => {
    const withDanger = butt as ButtWithDanger;
    withDanger.danger = true;
    await butt.updateComplete;

    const hostHasAttr = butt.hasAttribute('danger');
    const inner = butt.shadowRoot?.querySelector('.base');
    const innerHasClass = inner?.classList.contains('danger') ?? false;

    expect(
      hostHasAttr || innerHasClass,
      'expected <t-butt danger> to reflect: the host must carry the danger ' +
        'attribute, or the inner .base must carry the danger class ' +
        `(host attr=${hostHasAttr}, .base.danger=${innerHasClass})`
    ).toBe(true);
  });

  it('danger CSS rule exists and uses --danger-color (not --important-button)', () => {
    const src = readSource('components/atom/t-butt.ts');
    const rules = dangerCssRules(src);
    expect(
      rules.length,
      'expected t-butt.ts to contain a danger CSS rule ' +
        '(:host([danger]) ... or .base.danger), none found'
    ).toBeGreaterThan(0);

    for (const rule of rules) {
      expect(
        rule.body,
        `t-butt rule "${rule.selector}" must use the dedicated ` +
          'var(--danger-color) / var(--on-danger-color)'
      ).toContain('--danger-color');
      expect(
        rule.body,
        `t-butt rule "${rule.selector}" must NOT reuse --important-button ` +
          '(in some themes important is yellow/green, not red)'
      ).not.toContain('--important-button');
    }
  });
});

describe('t-dial value-display gets a real danger attribute', () => {
  let dial: Dial;

  beforeEach(() => {
    dial = new Dial();
    document.body.appendChild(dial);
  });

  afterEach(() => {
    if (document.body.contains(dial)) {
      document.body.removeChild(dial);
    }
  });

  function valueDisplay(): DangerableElement | null {
    return (dial.shadowRoot?.querySelector(
      't-butt.value-display'
    ) ?? null) as DangerableElement | null;
  }

  function valueDisplayIsDanger(): boolean {
    const display = valueDisplay();
    if (!display) {
      return false;
    }
    return display.hasAttribute('danger') || display.danger === true;
  }

  it('sets danger attribute on value-display t-butt when 150 > dangerWhenOver 100', async () => {
    dial.min = 0;
    dial.max = 420;
    dial.dangerWhenOver = 100;
    dial.value = 150;
    await dial.updateComplete;

    const display = valueDisplay();
    expect(
      display,
      't-dial must render value-display as <t-butt class="value-display">'
    ).not.toBeNull();
    expect(
      valueDisplayIsDanger(),
      'class="... danger" on the <t-butt> host cannot pierce its shadow DOM — ' +
        't-dial must set the danger ATTRIBUTE (?danger=${...}) on the ' +
        'value-display t-butt when 150 > dangerWhenOver 100'
    ).toBe(true);
  });

  it('does NOT set danger attribute on value-display when 80 <= 100', async () => {
    dial.min = 0;
    dial.max = 420;
    dial.dangerWhenOver = 100;
    dial.value = 80;
    await dial.updateComplete;

    expect(valueDisplay()).not.toBeNull();
    expect(
      valueDisplayIsDanger(),
      'value-display t-butt must NOT carry the danger attribute when 80 <= 100'
    ).toBe(false);
  });

  it('source binds ?danger on the value-display t-butt', () => {
    const src = readSource('components/atom/t-dial.ts');
    expect(
      src.includes('?danger'),
      'expected t-dial.ts to bind ?danger on the value-display t-butt ' +
        '(e.g. ?danger=${this.isDanger}) so styling reaches inside its shadow DOM'
    ).toBe(true);
  });

  it('knob + portal danger rules use --danger-color, never --accent-color-2', () => {
    const src = readSource('components/atom/t-dial.ts');
    const rules = dangerCssRules(src);
    expect(
      rules.length,
      'expected t-dial.ts .danger CSS rules for knob/value/portal'
    ).toBeGreaterThan(0);
    expect(
      rules.some((rule) => rule.selector.includes('.dial-knob.danger')),
      't-dial must keep a .dial-knob.danger rule'
    ).toBe(true);
    expect(
      rules.some(
        (rule) => rule.selector.includes('portal') && rule.selector.includes('.danger')
      ),
      't-dial must keep a danger rule for the floating portal'
    ).toBe(true);

    for (const rule of rules) {
      expect(
        rule.body,
        `t-dial rule "${rule.selector}" must use var(--danger-color) — dedicated ` +
          'danger vars, not accent/important vars'
      ).toContain('--danger-color');
      expect(
        rule.body,
        `t-dial rule "${rule.selector}" must not use --accent-color-2 ` +
          '(accent colors are not red in every theme)'
      ).not.toContain('--accent-color-2');
    }
  });
});

describe('volume-boost badge: plain small clickable danger element', () => {
  let footer: BottomNav;

  beforeEach(() => {
    footer = new BottomNav();
    document.body.appendChild(footer);
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  function findBadge(): Element | null {
    return footer.shadowRoot?.querySelector('[data-testid="volume-boost-badge"]') ?? null;
  }

  it('badge is a plain DIV/SPAN (not T-BUTT), no important, danger styled', async () => {
    footer.volume = 150;
    await footer.updateComplete;

    const badge = findBadge();
    expect(
      badge,
      'expected [data-testid="volume-boost-badge"] when volume 150 > 100'
    ).not.toBeNull();
    if (!badge) {
      return;
    }

    expect(
      badge.tagName,
      'volume-boost-badge must NOT be a <t-butt> (use a plain div/span)'
    ).not.toBe('T-BUTT');
    expect(
      ['DIV', 'SPAN'],
      `volume-boost-badge must be a plain div/span, got <${badge.tagName.toLowerCase()}>`
    ).toContain(badge.tagName);

    expect(
      badge.hasAttribute('important'),
      'badge must NOT use the important attribute (important is not red in all themes)'
    ).toBe(false);
    const props = badge as unknown as { important?: boolean };
    expect(props.important ?? false, 'badge must NOT use the important property').toBe(false);

    const markupTag = badgeMarkupTag(readSource('components/molecule/t-footer.ts'));
    const hasDangerClass = badge.classList.contains('danger');
    expect(
      hasDangerClass || markupTag.includes('danger') || markupTag.includes('--danger-color'),
      'badge markup must be danger styled (danger class and/or var(--danger-color)), ' +
        `got tag: "${markupTag}"`
    ).toBe(true);
  });

  it('badge markup has no important and declares a @click handler', () => {
    const src = readSource('components/molecule/t-footer.ts');
    const tag = badgeMarkupTag(src);
    expect(
      tag,
      'expected a volume-boost-badge element (data-testid="volume-boost-badge") in t-footer.ts'
    ).not.toBe('');
    expect(
      /\bimportant\b/.test(tag),
      'volume-boost-badge markup must not use `important` — use danger styling instead'
    ).toBe(false);
    expect(
      tag.includes('@click='),
      'badge must have a @click handler so clicking it toggles the speed dropdown, ' +
        `got tag: "${tag}"`
    ).toBe(true);
  });

  it('badge CSS is smaller than the old 1.8rem t-butt and is danger colored', () => {
    const src = readSource('components/molecule/t-footer.ts');
    const badgeRules = componentCssRules(src).filter((rule) =>
      rule.selector.includes('volume-boost-badge')
    );
    expect(
      badgeRules.length,
      'expected a .volume-boost-badge CSS rule in t-footer.ts'
    ).toBeGreaterThan(0);

    const cssBody = badgeRules.map((rule) => rule.body).join('\n');
    const dims = (['width', 'height', 'font-size'] as const)
      .map((prop) => ({ prop, value: declaredRem(cssBody, prop) }))
      .filter(
        (dim): dim is { prop: 'width' | 'height' | 'font-size'; value: number } =>
          dim.value !== null
      );

    expect(
      dims.length,
      'badge must declare its own width/height/font-size so it can be smaller ' +
        `than the old 1.8rem t-butt, got: "${cssBody.trim()}"`
    ).toBeGreaterThan(0);
    for (const dim of dims) {
      expect(
        dim.value,
        `badge ${dim.prop} must be <= 1.4rem (smaller than the old 1.8rem t-butt), ` +
          `got ${dim.value}rem in "${cssBody.trim()}"`
      ).toBeLessThanOrEqual(1.4);
    }

    const markupTag = badgeMarkupTag(src);
    const dangerStyled =
      cssBody.includes('--danger-color') ||
      (/\bdanger\b/.test(markupTag) && src.includes('--danger-color'));
    expect(
      dangerStyled,
      'badge must be styled with var(--danger-color) (not important/accent colors), ' +
        `badge css: "${cssBody.trim()}" markup: "${markupTag}"`
    ).toBe(true);
    expect(
      cssBody.includes('--important-button'),
      'badge CSS must not use --important-button (not red in every theme)'
    ).toBe(false);
    expect(
      /pointer-events\s*:\s*none/.test(cssBody),
      'badge must be clickable — .volume-boost-badge must not set pointer-events: none'
    ).toBe(false);
  });

  it('clicking the badge flips showSpeedDropdown like the speed button', async () => {
    footer.volume = 150;
    footer.showSpeedDropdown = false;
    await footer.updateComplete;

    const badge = findBadge() as HTMLElement | null;
    expect(badge, 'expected badge at volume 150 before the click test').not.toBeNull();
    if (!badge) {
      return;
    }

    // An implementation may forward the click to the speed dropdown button
    // instead of flipping the property itself — accept either outcome.
    const speedButton = footer.shadowRoot?.querySelector('t-butt[slot="button"]') ?? null;
    let forwarded = false;
    speedButton?.addEventListener('click', () => {
      forwarded = true;
    });

    badge.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await footer.updateComplete;

    expect(
      footer.showSpeedDropdown || forwarded,
      'clicking the badge must toggle the speed dropdown (showSpeedDropdown flips, ' +
        'same as pressing the speed dropdown button) — ' +
        `showSpeedDropdown=${footer.showSpeedDropdown}, forwarded=${forwarded}`
    ).toBe(true);

    if (footer.showSpeedDropdown) {
      badge.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await footer.updateComplete;
      expect(
        footer.showSpeedDropdown,
        'clicking the badge again must toggle the speed dropdown back to closed'
      ).toBe(false);
    }
  });

  it('control: pressing the speed dropdown button flips showSpeedDropdown', async () => {
    footer.volume = 150;
    footer.showSpeedDropdown = false;
    await footer.updateComplete;

    const dropdown = footer.shadowRoot?.querySelector('t-dropdown-button') ?? null;
    expect(dropdown, 'expected the speed t-dropdown-button in t-footer').not.toBeNull();
    // happy-dom does not route composed clicks through slots, so hit the same
    // wrapper div that a real click on the slotted button ends up on.
    const wrapper = dropdown?.shadowRoot?.querySelector('.button-wrapper') ?? null;
    expect(wrapper, 'expected .button-wrapper inside t-dropdown-button').not.toBeNull();
    if (!wrapper) {
      return;
    }

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await footer.updateComplete;

    expect(
      footer.showSpeedDropdown,
      'pressing the speed dropdown button must open the dropdown (baseline behaviour)'
    ).toBe(true);
  });

  it('badge is absent at volume 80', async () => {
    footer.volume = 80;
    await footer.updateComplete;

    expect(findBadge()).toBeNull();
  });
});

describe('theme danger colors are red-ish in all themes', () => {
  const themeCss = readSource('stylesheets/variables-theme.css');
  const themeRules = rulesOf(themeCss);

  function baseThemeRule(col: string): CssRule | undefined {
    // col = 'col3' -> base block selector ".theme-col3, [data-theme='col3']"
    const number = col.replace(/^col/, '');
    return themeRules.find((rule) => rule.selector.includes(`.theme-col${number}`));
  }

  for (const col of ['col1', 'col2', 'col3', 'col4', 'col5', 'col6']) {
    it(`${col} base block defines a red-ish --danger-color hex`, () => {
      const rule = baseThemeRule(col);
      expect(
        rule,
        `missing .theme-col${col.slice(3)} / [data-theme='${col}'] base block`
      ).toBeTruthy();

      const value = rule ? dangerValueOf(rule.body) : null;
      expect(
        value,
        `[data-theme='${col}'] must define --danger-color (red in every theme)`
      ).not.toBeNull();

      const rgb = hexToRgb(value ?? '');
      expect(
        rgb,
        `[data-theme='${col}'] --danger-color must be a red hex value, got '${value}'`
      ).not.toBeNull();
      if (rgb) {
        expect(
          isRedIsh(rgb),
          `[data-theme='${col}'] --danger-color must be red-ish ` +
            `(R>=100, R>G, R>B), got '${value}' -> R=${rgb[0]} G=${rgb[1]} B=${rgb[2]}`
        ).toBe(true);
      }
    });
  }

  it('--on-danger-color exists', () => {
    expect(
      themeCss.includes('--on-danger-color'),
      'expected stylesheets/variables-theme.css to define --on-danger-color'
    ).toBe(true);
  });

  it('every --danger-color definition in the file is red-ish (base + overrides)', () => {
    const values = [...themeCss.matchAll(/--danger-color\s*:\s*([^;]+);/g)].map((m) =>
      m[1].trim()
    );
    expect(
      values.length,
      'expected at least one --danger-color definition'
    ).toBeGreaterThan(0);

    for (const value of values) {
      const rgb = hexToRgb(value);
      expect(
        rgb,
        `--danger-color must be a red hex literal, got '${value}'`
      ).not.toBeNull();
      if (rgb) {
        expect(
          isRedIsh(rgb),
          `--danger-color '${value}' is not red-ish (R=${rgb[0]} G=${rgb[1]} B=${rgb[2]})`
        ).toBe(true);
      }
    }
  });

  it('blocks that override --accent-color-2 still resolve to a red danger color', () => {
    const accentRules = themeRules.filter((rule) => rule.body.includes('--accent-color-2'));
    expect(
      accentRules.length,
      'expected theme blocks that define --accent-color-2'
    ).toBeGreaterThan(0);

    for (const rule of accentRules) {
      const theme = rule.selector.match(/\[data-theme='(col\d)'\]/);
      expect(
        theme,
        `block "${rule.selector}" must belong to a theme (col1..col6)`
      ).not.toBeNull();
      if (!theme) {
        continue;
      }

      // The block may define --danger-color itself, otherwise it inherits the
      // red value from its base theme block (which the tests above guarantee).
      const own = dangerValueOf(rule.body);
      const inherited = dangerValueOf(baseThemeRule(theme[1])?.body ?? '');
      const value = own ?? inherited;

      expect(
        value,
        `block "${rule.selector}" must define --danger-color or inherit a red one ` +
          `from its ${theme[1]} base block`
      ).not.toBeNull();

      const rgb = hexToRgb(value ?? '');
      expect(
        rgb,
        `${theme[1]} danger color must be a red hex, got '${value}'`
      ).not.toBeNull();
      if (rgb) {
        expect(
          isRedIsh(rgb),
          `${theme[1]} danger color must stay red-ish when accents are overridden, ` +
            `got '${value}' -> R=${rgb[0]} G=${rgb[1]} B=${rgb[2]}`
        ).toBe(true);
      }
    }
  });
});

// bold = col5 (mapping confirmed in tests/countdown-overlay-theme-colors.test.ts)
describe('bold (col5) LIGHT mode uses a dark red danger color', () => {
  const themeRules = rulesOf(readSource('stylesheets/variables-theme.css'));

  const lightRule = themeRules.find((rule) =>
    rule.selector.includes("[data-theme='col5'][data-mode='light']")
  );

  const baseRule = themeRules.find(
    (rule) => rule.selector.includes("[data-theme='col5']") && !rule.selector.includes('data-mode')
  );

  it("[data-theme='col5'][data-mode='light'] defines --danger-color: #8b0000", () => {
    expect(
      lightRule,
      "missing [data-theme='col5'][data-mode='light'] override block in " +
        'stylesheets/variables-theme.css'
    ).toBeTruthy();

    const value = lightRule ? dangerValueOf(lightRule.body) : null;
    expect(
      value,
      'bold/light block must define --danger-color (too close to the footer color ' +
        'otherwise)'
    ).not.toBeNull();
    expect(
      (value ?? '').trim().toLowerCase(),
      "bold LIGHT --danger-color must be exactly #8b0000 (dark red, readable with " +
        'white --on-danger-color)'
    ).toBe('#8b0000');
  });

  it('col5 base block keeps --danger-color: #d42626 (override is light-only)', () => {
    expect(
      baseRule,
      "missing base .theme-col5 / [data-theme='col5'] block"
    ).toBeTruthy();

    const value = baseRule ? dangerValueOf(baseRule.body) : null;
    expect(
      (value ?? '').trim().toLowerCase(),
      "col5 base must keep --danger-color: #d42626 — #8b0000 belongs only in the " +
        `[data-mode='light'] override, got '${value}'`
    ).toBe('#d42626');
  });
});
