import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dial } from './t-dial.js';

// Access private members for testing via cast
const dialInternal = (el: Dial): any => el;

describe('t-dial value setter behavior', () => {
  let element: Dial;

  beforeEach(() => {
    element = new Dial();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should set _value when value property is set and not disabled', () => {
    element.value = 42;
    expect(dialInternal(element)._value).toBe(42);
  });

  it('should still set _value when disabled', () => {
    element.disabled = true;
    element.value = 99;
    // Internal _value should be updated even when disabled
    expect(dialInternal(element)._value).toBe(99);
  });

  it('should return 0 from value getter when disabled', () => {
    element.disabled = true;
    element.value = 77;
    // Getter returns 0 when disabled
    expect(element.value).toBe(0);
    // But internal _value preserves the actual value
    expect(dialInternal(element)._value).toBe(77);
  });

  it('should return actual value from getter when not disabled', () => {
    element.value = 55;
    expect(element.value).toBe(55);
  });

  it('should clamp value to min when set', () => {
    element.min = 10;
    element.value = 5;
    expect(dialInternal(element)._value).toBe(10);
  });

  it('should clamp value to max when set', () => {
    element.max = 100;
    element.value = 150;
    expect(dialInternal(element)._value).toBe(100);
  });

  it('should preserve actual _value when disabling after setting value', () => {
    element.value = 33;
    element.disabled = true;
    expect(dialInternal(element)._value).toBe(33);
    expect(element.value).toBe(0);
  });

  it('should update _value when value is set after disabling', () => {
    element.disabled = true;
    element.value = 25;
    expect(dialInternal(element)._value).toBe(25);
    element.value = 60;
    expect(dialInternal(element)._value).toBe(60);
  });
});

describe('t-dial _roundToStep', () => {
  let element: Dial;

  beforeEach(() => {
    element = new Dial();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should round to 1 decimal when step is 0.1', () => {
    element.step = 0.1;
    expect(dialInternal(element)._roundToStep(0.1 + 0.1 + 0.1)).toBe(0.3);
    expect(dialInternal(element)._roundToStep(1.055)).toBe(1.1);
    expect(dialInternal(element)._roundToStep(2.34)).toBe(2.3);
  });

  it('should round to 0 decimals when step is 1', () => {
    element.step = 1;
    expect(dialInternal(element)._roundToStep(4.6)).toBe(5);
    expect(dialInternal(element)._roundToStep(3.2)).toBe(3);
    expect(dialInternal(element)._roundToStep(7)).toBe(7);
  });

  it('should round to 0 decimals when step is 5', () => {
    element.step = 5;
    // step=5 means 0 decimal places (no fractional part needed)
    expect(dialInternal(element)._roundToStep(7.8)).toBe(8);
    expect(dialInternal(element)._roundToStep(12.3)).toBe(12);
    expect(dialInternal(element)._roundToStep(15)).toBe(15);
  });

  it('should handle step 0.01 with 2 decimal precision', () => {
    element.step = 0.01;
    expect(dialInternal(element)._roundToStep(1.234)).toBe(1.23);
    expect(dialInternal(element)._roundToStep(1.235)).toBe(1.24);
  });

  it('should produce clean values without floating-point artifacts for step 0.1', () => {
    element.step = 0.1;

    // Simulate three increments from 0
    let value = 0;
    value = dialInternal(element)._roundToStep(value + 0.1);
    expect(value).toBe(0.1);

    value = dialInternal(element)._roundToStep(value + 0.1);
    expect(value).toBe(0.2);

    value = dialInternal(element)._roundToStep(value + 0.1);
    expect(value).toBe(0.3);

    // The classic floating-point problem: 0.1 + 0.1 + 0.1 in JS
    expect(dialInternal(element)._roundToStep(0.1 + 0.1 + 0.1)).toBe(0.3);
    // Verify it's NOT the infamous artifact
    expect(0.1 + 0.1 + 0.1).not.toBe(0.3); // raw JS is 0.30000000000000004
    expect(dialInternal(element)._roundToStep(0.1 + 0.1 + 0.1)).toBe(0.3); // rounded is clean
  });

  it('should round correctly with step 0.25 (quarter-step, 2 decimal precision)', () => {
    element.step = 0.25;
    // _roundToStep rounds to 2 decimal places (precision of 0.25)
    // It does NOT snap to 0.25 boundaries — it only ensures clean 2-decimal values
    expect(dialInternal(element)._roundToStep(0.245)).toBe(0.25);
    expect(dialInternal(element)._roundToStep(0.254)).toBe(0.25);
    expect(dialInternal(element)._roundToStep(0.50)).toBe(0.5);
    expect(dialInternal(element)._roundToStep(0.745)).toBe(0.75);
    expect(dialInternal(element)._roundToStep(0.754)).toBe(0.75);
    expect(dialInternal(element)._roundToStep(0.999)).toBe(1);
  });

  it('should round correctly with step 0.01 (two decimal places)', () => {
    element.step = 0.01;
    expect(dialInternal(element)._roundToStep(1.234)).toBe(1.23);
    expect(dialInternal(element)._roundToStep(1.236)).toBe(1.24);
    expect(dialInternal(element)._roundToStep(0.999)).toBe(1);
    expect(dialInternal(element)._roundToStep(0.005)).toBe(0.01);
  });

  it('should round negative values correctly', () => {
    element.step = 0.1;
    // Math.round(-1.5) = -1 in JS (rounds toward positive for .5)
    expect(dialInternal(element)._roundToStep(-0.16)).toBe(-0.2);
    expect(dialInternal(element)._roundToStep(-0.14)).toBe(-0.1);
    expect(dialInternal(element)._roundToStep(-0.36)).toBe(-0.4);
    expect(dialInternal(element)._roundToStep(-0.34)).toBe(-0.3);
  });

  it('should round negative values correctly with step 1', () => {
    element.step = 1;
    expect(dialInternal(element)._roundToStep(-0.6)).toBe(-1);
    expect(dialInternal(element)._roundToStep(-2.3)).toBe(-2);
    expect(dialInternal(element)._roundToStep(-2.7)).toBe(-3);
  });
});

describe('t-dial increment/decrement with step 0.1', () => {
  let element: Dial;

  beforeEach(() => {
    element = new Dial();
    element.step = 0.1;
    element.min = 0;
    element.max = 100;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should increment by 0.1 without floating-point artifacts', () => {
    dialInternal(element)._value = 0;

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.1);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.2);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.3);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.4);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.5);
  });

  it('should decrement by 0.1 without floating-point artifacts', () => {
    dialInternal(element)._value = 1;

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.9);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.8);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.7);
  });

  it('should clamp increment at max', () => {
    dialInternal(element)._value = 99.9;

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);
  });

  it('should clamp decrement at min', () => {
    dialInternal(element)._value = 0.1;

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);
  });

  it('should clamp increment when already at max', () => {
    dialInternal(element)._value = 100;

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);

    // Multiple increments should stay at max
    dialInternal(element)._handleIncrement();
    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);
  });

  it('should clamp decrement when already at min', () => {
    dialInternal(element)._value = 0;

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);

    // Multiple decrements should stay at min
    dialInternal(element)._handleDecrement();
    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);
  });

  it('should clamp increment at max from a value close to max', () => {
    dialInternal(element)._value = 99.5;

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(99.6);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(99.7);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(99.8);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(99.9);

    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);

    // One more should stay at 100
    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(100);
  });

  it('should clamp decrement at min from a value close to min', () => {
    dialInternal(element)._value = 0.5;

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.4);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.3);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.2);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0.1);

    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);

    // One more should stay at 0
    dialInternal(element)._handleDecrement();
    expect(dialInternal(element)._value).toBe(0);
  });
});

describe('t-dial max=0 should mean "no max" (unknown duration)', () => {
  let element: Dial;

  beforeEach(() => {
    element = new Dial();
    element.min = 0;
    element.max = 0;
    element.step = 0.1;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should NOT clamp value to 0 when max=0', () => {
    element.value = 6;
    expect(dialInternal(element)._value).toBe(6);
  });

  it('should NOT clamp value to 0 when max=0 and value is set via Lit property binding', () => {
    // Simulate Lit property binding: .value=${6} with .max=${0}
    element.max = 0;
    element.value = 6;
    expect(dialInternal(element)._value).toBe(6);
  });

  it('should still respect min when max=0', () => {
    element.value = -5;
    expect(dialInternal(element)._value).toBe(0); // clamped to min=0
  });

  it('increment should not be capped at 0 when max=0', () => {
    dialInternal(element)._value = 0;
    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(0.1);
  });

  it('increment should allow values above 0 when max=0', () => {
    dialInternal(element)._value = 5;
    dialInternal(element)._handleIncrement();
    expect(dialInternal(element)._value).toBe(5.1);
  });
});

describe('t-dial _formatDisplayValue', () => {
  let element: Dial;

  beforeEach(() => {
    element = new Dial();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('should show max 1 decimal when step is 1', () => {
    element.step = 1;
    dialInternal(element)._value = 5;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5');

    dialInternal(element)._value = 5.1;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5.1');

    dialInternal(element)._value = 5.12;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5.1');

    dialInternal(element)._value = 5.19;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5.2');
  });

  it('should show max 1 decimal when step is 2', () => {
    element.step = 2;
    dialInternal(element)._value = 10;
    expect(dialInternal(element)._formatDisplayValue()).toBe('10');

    dialInternal(element)._value = 10.1;
    expect(dialInternal(element)._formatDisplayValue()).toBe('10.1');

    dialInternal(element)._value = 10.16;
    expect(dialInternal(element)._formatDisplayValue()).toBe('10.2');
  });

  it('should show max 2 decimals when step is 0.1', () => {
    element.step = 0.1;
    dialInternal(element)._value = 3;
    expect(dialInternal(element)._formatDisplayValue()).toBe('3');

    dialInternal(element)._value = 3.1;
    expect(dialInternal(element)._formatDisplayValue()).toBe('3.1');

    dialInternal(element)._value = 3.12;
    expect(dialInternal(element)._formatDisplayValue()).toBe('3.12');

    dialInternal(element)._value = 3.126;
    expect(dialInternal(element)._formatDisplayValue()).toBe('3.13');
  });

  it('should show max 3 decimals when step is 0.01', () => {
    element.step = 0.01;
    dialInternal(element)._value = 1.5;
    expect(dialInternal(element)._formatDisplayValue()).toBe('1.5');

    dialInternal(element)._value = 1.55;
    expect(dialInternal(element)._formatDisplayValue()).toBe('1.55');

    dialInternal(element)._value = 1.555;
    expect(dialInternal(element)._formatDisplayValue()).toBe('1.555');

    dialInternal(element)._value = 1.5556;
    expect(dialInternal(element)._formatDisplayValue()).toBe('1.556');
  });

  it('should not add unnecessary trailing zeros', () => {
    element.step = 0.1;
    dialInternal(element)._value = 5;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5');

    dialInternal(element)._value = 5.2;
    expect(dialInternal(element)._formatDisplayValue()).toBe('5.2');
  });
});
