import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TInput } from './t-input.js';

describe('t-input clearable behavior', () => {
  let element: TInput;

  beforeEach(() => {
    element = new TInput();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should NOT render clear button when clearable is false (default)', async () => {
    element.value = 'some value';
    await element.updateComplete;
    const clearBtn = element.shadowRoot?.querySelector('.clear-btn');
    expect(clearBtn).toBeNull();
  });

  it('should NOT render clear button when clearable is true but value is empty', async () => {
    (element as any).clearable = true;
    element.value = '';
    await element.updateComplete;
    const clearBtn = element.shadowRoot?.querySelector('.clear-btn');
    expect(clearBtn).toBeNull();
  });

  it('should render clear button when clearable is true and value is non-empty', async () => {
    (element as any).clearable = true;
    element.value = 'hello';
    await element.updateComplete;
    const clearBtn = element.shadowRoot?.querySelector('.clear-btn');
    expect(clearBtn).not.toBeNull();
  });

  it('should clear value to empty string when clear button is clicked', async () => {
    (element as any).clearable = true;
    element.value = 'hello';
    await element.updateComplete;

    const clearBtn = element.shadowRoot?.querySelector('.clear-btn') as HTMLElement | null;
    expect(clearBtn).not.toBeNull();
    clearBtn!.click();
    await element.updateComplete;

    expect(element.value).toBe('');
  });

  it('should dispatch input event with detail.value = "" when clear button is clicked', async () => {
    (element as any).clearable = true;
    element.value = 'hello';
    await element.updateComplete;

    const inputSpy = vi.fn();
    element.addEventListener('input', inputSpy);

    const clearBtn = element.shadowRoot?.querySelector('.clear-btn') as HTMLElement | null;
    clearBtn!.click();
    await element.updateComplete;

    expect(inputSpy).toHaveBeenCalledTimes(1);
    const event = inputSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.value).toBe('');
  });

  it('should focus the native input when clear button is clicked', async () => {
    (element as any).clearable = true;
    element.value = 'hello';
    await element.updateComplete;

    const nativeInput = element.shadowRoot?.querySelector('input') as HTMLInputElement;
    const focusSpy = vi.spyOn(nativeInput, 'focus');

    const clearBtn = element.shadowRoot?.querySelector('.clear-btn') as HTMLElement | null;
    clearBtn!.click();
    await element.updateComplete;

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('should have aria-label "Clear input" on the clear button', async () => {
    (element as any).clearable = true;
    element.value = 'hello';
    await element.updateComplete;

    const clearBtn = element.shadowRoot?.querySelector('.clear-btn') as HTMLElement | null;
    expect(clearBtn).not.toBeNull();
    expect(clearBtn!.getAttribute('aria-label')).toBe('Clear input');
  });
});
