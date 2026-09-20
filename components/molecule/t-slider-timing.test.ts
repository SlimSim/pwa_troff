import { describe, it, expect } from 'vitest';
import type { CSSResult } from 'lit';
import { SettingsPanel } from './t-settings-panel.js';
import { MediaParent } from './t-media-parent.js';

interface StyledComponent {
  styles: CSSResult | CSSResult[];
}

function stylesToText(styles: CSSResult | CSSResult[]): string {
  const list: CSSResult[] = Array.isArray(styles) ? styles : [styles];
  return list.map((s: CSSResult) => s.cssText ?? String(s)).join('\n');
}

function getHostBlock(cssText: string): string {
  const match: RegExpMatchArray | null = cssText.match(/:host\s*\{([^}]*)\}/);
  if (!match || match[1] === undefined) {
    throw new Error('Expected a :host { ... } block in component styles');
  }
  return match[1];
}

function getHostTransition(hostBlock: string): string {
  const match: RegExpMatchArray | null = hostBlock.match(/transition\s*:\s*([^;]+);/);
  if (!match || match[1] === undefined) {
    throw new Error(`Expected a transition in :host block, got: ${hostBlock}`);
  }
  return match[1].trim();
}

function transitionDurationInSeconds(transition: string): number {
  const secondsMatch: RegExpMatchArray | null = transition.match(/(\d*\.?\d+)\s*s(?![a-z])/);
  if (secondsMatch && secondsMatch[1] !== undefined) {
    return parseFloat(secondsMatch[1]);
  }
  const msMatch: RegExpMatchArray | null = transition.match(/(\d*\.?\d+)\s*ms/);
  if (msMatch && msMatch[1] !== undefined) {
    return parseFloat(msMatch[1]) / 1000;
  }
  throw new Error(`Could not parse a duration from transition: ${transition}`);
}

function getHostTransitionDuration(component: StyledComponent): {
  transition: string;
  duration: number;
} {
  const cssText: string = stylesToText(component.styles);
  const hostBlock: string = getHostBlock(cssText);
  const transition: string = getHostTransition(hostBlock);
  return { transition, duration: transitionDurationInSeconds(transition) };
}

describe('full-screen slider timing (settings + songlist)', () => {
  it('t-settings-panel :host transition on transform is shorter than 0.3s', () => {
    const { transition, duration } = getHostTransitionDuration(
      SettingsPanel as unknown as StyledComponent
    );
    expect(transition).toContain('transform');
    expect(transition).toContain('ease-in-out');
    expect(duration).toBeLessThan(0.3);
  });

  it('t-media-parent :host transition on transform is shorter than 0.3s', () => {
    const { transition, duration } = getHostTransitionDuration(
      MediaParent as unknown as StyledComponent
    );
    expect(transition).toContain('transform');
    expect(transition).toContain('ease-in-out');
    expect(duration).toBeLessThan(0.3);
  });
});
