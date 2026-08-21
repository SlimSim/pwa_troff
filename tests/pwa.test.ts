import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Contract tests for the v2 PWA support module (utils/pwa.ts).
 *
 * These tests pin down the public API contract:
 *   getInstallState / subscribeToInstallState / promptInstall / initPwa
 */

// Type-only import — erased at runtime, so it does not trigger the resolution error.
type PwaModule = typeof import('../utils/pwa.js');

type MockWorker = {
  addEventListener: ReturnType<typeof vi.fn>;
  state: string;
};

type MockRegistration = {
  addEventListener: ReturnType<typeof vi.fn>;
  installing: MockWorker | null;
};

type MockServiceWorkerContainer = {
  register: ReturnType<typeof vi.fn>;
  controller: unknown;
};

/** Minimal stand-in for the browser's BeforeInstallPromptEvent. */
class MockBeforeInstallPromptEvent extends Event {
  preventDefault = vi.fn();
  prompt = vi.fn(() => Promise.resolve());
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt');
    this.userChoice = Promise.resolve({ outcome });
  }
}

let savedServiceWorkerDescriptor: PropertyDescriptor | undefined;

/** Installs a mock navigator.serviceWorker and returns the mocks it exposes. */
function installMockServiceWorker(controllerValue: unknown = null) {
  const workerStub: MockWorker = { addEventListener: vi.fn(), state: 'installing' };
  const registration: MockRegistration = { addEventListener: vi.fn(), installing: null };
  const mockSw: MockServiceWorkerContainer = {
    register: vi.fn(() => Promise.resolve(registration)),
    controller: controllerValue,
  };
  savedServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  Object.defineProperty(navigator, 'serviceWorker', {
    value: mockSw,
    configurable: true,
  });
  return { mockSw, registration, workerStub };
}

/**
 * Captures the listener that a mock addEventListener() is called with for
 * `eventName` (via mockImplementation), so tests can invoke it directly.
 * `registered` resolves once the real code has attached that listener.
 */
function captureListener(listenerMock: ReturnType<typeof vi.fn>, eventName: string) {
  let captured: (() => void) | undefined;
  let resolveRegistered: () => void = () => {};
  const registered = new Promise<void>((resolve) => {
    resolveRegistered = resolve;
  });
  listenerMock.mockImplementation((name: string, cb: () => void) => {
    if (name === eventName && !captured) {
      captured = cb;
      resolveRegistered();
    }
  });
  return {
    registered,
    fire: () => {
      if (!captured) {
        throw new Error(`No '${eventName}' listener was registered`);
      }
      captured();
    },
  };
}

describe('utils/pwa.js', () => {
  let pwa: PwaModule;

  beforeEach(async () => {
    vi.resetModules();
    // RED until utils/pwa.ts exists — throws "Failed to resolve import ../utils/pwa.js"
    pwa = await import('../utils/pwa.js');
  });

  afterEach(() => {
    if (savedServiceWorkerDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', savedServiceWorkerDescriptor);
      savedServiceWorkerDescriptor = undefined;
    } else if ('serviceWorker' in navigator) {
      delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    }
    vi.restoreAllMocks();
  });

  describe('getInstallState', () => {
    it("returns 'unavailable' before anything happens", () => {
      expect(pwa.getInstallState()).toBe('unavailable');
    });
  });

  describe('subscribeToInstallState', () => {
    it("notifies the listener only when the state changes (no duplicates for the same state)", () => {
      const listener = vi.fn();
      pwa.subscribeToInstallState(listener);
      pwa.initPwa();

      window.dispatchEvent(new MockBeforeInstallPromptEvent('accepted'));
      expect(pwa.getInstallState()).toBe('available');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('available');

      // Same state again → no duplicate notification
      window.dispatchEvent(new MockBeforeInstallPromptEvent('accepted'));
      expect(pwa.getInstallState()).toBe('available');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after the returned unsubscribe function is called', () => {
      const listener = vi.fn();
      const unsubscribe = pwa.subscribeToInstallState(listener);
      pwa.initPwa();

      unsubscribe();
      window.dispatchEvent(new Event('appinstalled'));
      expect(pwa.getInstallState()).toBe('installed');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('initPwa', () => {
    it('registers the service worker only once across two initPwa() calls', async () => {
      const { mockSw } = installMockServiceWorker();

      pwa.initPwa();
      pwa.initPwa();
      expect(mockSw.register).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('load'));
      await vi.waitFor(() => expect(mockSw.register).toHaveBeenCalledTimes(1));
      expect(mockSw.register).toHaveBeenCalledWith('/service-worker.js');
    });

    it('adds a beforeinstallprompt listener on window that calls preventDefault', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      pwa.initPwa();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );

      const event = new MockBeforeInstallPromptEvent('accepted');
      window.dispatchEvent(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(pwa.getInstallState()).toBe('available');
    });

    it('registers the service worker on window load, not at call time', async () => {
      const { mockSw } = installMockServiceWorker();

      pwa.initPwa();
      expect(mockSw.register).not.toHaveBeenCalled();

      window.dispatchEvent(new Event('load'));
      await vi.waitFor(() => expect(mockSw.register).toHaveBeenCalledTimes(1));
      expect(mockSw.register).toHaveBeenCalledWith('/service-worker.js');
    });

    it("becomes 'installed' when an appinstalled event is dispatched on window", () => {
      pwa.initPwa();
      window.dispatchEvent(new Event('appinstalled'));
      expect(pwa.getInstallState()).toBe('installed');
    });

    it('does not throw when navigator.serviceWorker does not exist', () => {
      // happy-dom has no navigator.serviceWorker by default
      expect(() => pwa.initPwa()).not.toThrow();
      expect(pwa.getInstallState()).toBe('unavailable');
    });
  });

  describe('promptInstall', () => {
    it("calls prompt() and becomes 'installed' when the user accepts", async () => {
      pwa.initPwa();
      const event = new MockBeforeInstallPromptEvent('accepted');
      window.dispatchEvent(event);
      expect(pwa.getInstallState()).toBe('available');

      pwa.promptInstall();
      expect(event.prompt).toHaveBeenCalledTimes(1);

      await vi.waitFor(() => expect(pwa.getInstallState()).toBe('installed'));
    });

    it("becomes 'unavailable' when the user dismisses the prompt", async () => {
      pwa.initPwa();
      window.dispatchEvent(new MockBeforeInstallPromptEvent('dismissed'));
      expect(pwa.getInstallState()).toBe('available');

      pwa.promptInstall();
      await vi.waitFor(() => expect(pwa.getInstallState()).toBe('unavailable'));
    });

    it('is a no-op (does not throw) when no beforeinstallprompt was received', () => {
      expect(() => pwa.promptInstall()).not.toThrow();
      expect(pwa.getInstallState()).toBe('unavailable');
    });
  });

  describe('service worker update detection', () => {
    it('calls onNewVersionAvailable when the new worker installs while a controller exists', async () => {
      const { registration, workerStub } = installMockServiceWorker({ controlled: true });
      const onNewVersionAvailable = vi.fn();
      const onFirstInstall = vi.fn();

      pwa.initPwa({ onNewVersionAvailable, onFirstInstall });
      window.dispatchEvent(new Event('load'));

      // updatefound fires → installing worker attached → statechange listener registered
      const updatefound = captureListener(registration.addEventListener, 'updatefound');
      await updatefound.registered;
      registration.installing = workerStub;
      updatefound.fire();

      const statechange = captureListener(workerStub.addEventListener, 'statechange');
      await statechange.registered;
      workerStub.state = 'installed';
      statechange.fire();

      expect(onNewVersionAvailable).toHaveBeenCalledTimes(1);
      expect(onFirstInstall).not.toHaveBeenCalled();
    });

    it('calls onFirstInstall when the new worker installs with no controller (first install)', async () => {
      const { registration, workerStub } = installMockServiceWorker(null);
      const onNewVersionAvailable = vi.fn();
      const onFirstInstall = vi.fn();

      pwa.initPwa({ onNewVersionAvailable, onFirstInstall });
      window.dispatchEvent(new Event('load'));

      const updatefound = captureListener(registration.addEventListener, 'updatefound');
      await updatefound.registered;
      registration.installing = workerStub;
      updatefound.fire();

      const statechange = captureListener(workerStub.addEventListener, 'statechange');
      await statechange.registered;
      workerStub.state = 'installed';
      statechange.fire();

      expect(onFirstInstall).toHaveBeenCalledTimes(1);
      expect(onNewVersionAvailable).not.toHaveBeenCalled();
    });

    it('does not call any callback when the worker state changes to something other than installed', async () => {
      const { registration, workerStub } = installMockServiceWorker(null);
      const onNewVersionAvailable = vi.fn();
      const onFirstInstall = vi.fn();

      pwa.initPwa({ onNewVersionAvailable, onFirstInstall });
      window.dispatchEvent(new Event('load'));

      const updatefound = captureListener(registration.addEventListener, 'updatefound');
      await updatefound.registered;
      registration.installing = workerStub;
      updatefound.fire();

      const statechange = captureListener(workerStub.addEventListener, 'statechange');
      await statechange.registered;
      workerStub.state = 'activating';
      statechange.fire();

      expect(onNewVersionAvailable).not.toHaveBeenCalled();
      expect(onFirstInstall).not.toHaveBeenCalled();
    });
  });
});
