import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dial } from './t-dial.js';

// Type to access private _value for testing
type DialWithInternal = Dial & { _value: number };

describe('t-dial value setter behavior', () => {
  let element: DialWithInternal;

  beforeEach(() => {
    element = new Dial() as DialWithInternal;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should set _value when value property is set and not disabled', () => {
    element.value = 42;
    expect(element._value).toBe(42);
  });

  it('should still set _value when disabled', () => {
    element.disabled = true;
    element.value = 99;
    // Internal _value should be updated even when disabled
    expect(element._value).toBe(99);
  });

  it('should return 0 from value getter when disabled', () => {
    element.disabled = true;
    element.value = 77;
    // Getter returns 0 when disabled
    expect(element.value).toBe(0);
    // But internal _value preserves the actual value
    expect(element._value).toBe(77);
  });

  it('should return actual value from getter when not disabled', () => {
    element.value = 55;
    expect(element.value).toBe(55);
  });

  it('should clamp value to min when set', () => {
    element.min = 10;
    element.value = 5;
    expect(element._value).toBe(10);
  });

  it('should clamp value to max when set', () => {
    element.max = 100;
    element.value = 150;
    expect(element._value).toBe(100);
  });

  it('should preserve actual _value when disabling after setting value', () => {
    element.value = 33;
    element.disabled = true;
    expect(element._value).toBe(33);
    expect(element.value).toBe(0);
  });

  it('should update _value when value is set after disabling', () => {
    element.disabled = true;
    element.value = 25;
    expect(element._value).toBe(25);
    element.value = 60;
    expect(element._value).toBe(60);
  });
});
