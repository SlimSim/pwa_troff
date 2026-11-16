import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the widened `SentryCaptureException` context parameter in
 * utils/sentry.ts.
 *
 * Feature contract:
 *  - SentryCaptureException(error, context?) accepts PlaybackErrorContext OR
 *    PlaybackSkipContext.
 *  - When a context is provided AND the global Sentry.withScope is a function,
 *    the context is attached via scope.setExtra('errorContext', context) inside
 *    Sentry.withScope(...), and captureException is called from that scope.
 *  - When withScope is missing, keep the old behavior: attach errorContext to
 *    the error object and call captureException directly.
 *  - When no context is provided, call captureException directly (no withScope).
 *  - When the global Sentry is undefined, no-op and never throw.
 *
 * The real module is imported after installing a typed global Sentry mock;
 * the real SDK is never loaded. This suite pins the implemented withScope
 * behavior.
 */

interface SentryScopeMock {
  setExtra: ReturnType<typeof vi.fn>;
}

interface SentryMock {
  init: ReturnType<typeof vi.fn>;
  captureException: ReturnType<typeof vi.fn>;
  withScope?: ReturnType<typeof vi.fn>;
}

interface SkipContextLike {
  duration: number;
  currentTime: number;
  previousTime: number;
  seekableEnd: number;
  playbackStart: number;
  playbackStop: number;
  markerSliderMax: number;
  loopTimesLeft: number;
  fileSize: number;
  readyState: number;
  networkState: number;
  errorCode: number;
  wallClockDeltaMs: number;
  forwardSkipSeconds: number;
  volumePercent: number;
  gainValue: number;
  elementVolumeWorks: boolean;
  audioGraphEnabled: boolean;
  audioGraphCreated: boolean;
  audioContextState: 'none' | 'running' | 'suspended' | 'closed' | 'interrupted';
  audioContextSampleRate: number;
  waveformEnabled: boolean;
  waveformInProgress: boolean;
  waveformLastDurationMs: number;
  mediaKind: 'audio' | 'video';
  playbackRate: number;
  preservesPitch: boolean;
}

interface SentryModuleWithContext {
  SentryCaptureException: (error: Error, context?: SkipContextLike) => void;
}

function makeSkipContext(): SkipContextLike {
  return {
    duration: 132,
    currentTime: 5,
    previousTime: 0,
    seekableEnd: 132,
    playbackStart: 10,
    playbackStop: 60,
    markerSliderMax: 120,
    loopTimesLeft: 1,
    fileSize: 0,
    readyState: 4,
    networkState: 1,
    errorCode: 0,
    wallClockDeltaMs: 1000,
    forwardSkipSeconds: 4,
    volumePercent: 100,
    gainValue: 1,
    elementVolumeWorks: true,
    audioGraphEnabled: true,
    audioGraphCreated: false,
    audioContextState: 'none',
    audioContextSampleRate: 0,
    waveformEnabled: true,
    waveformInProgress: false,
    waveformLastDurationMs: 0,
    mediaKind: 'audio',
    playbackRate: 1,
    preservesPitch: true,
  };
}

function installSentryMock(options: {
  withScope?: boolean;
  order?: string[];
} = {}): { mock: SentryMock; scope: SentryScopeMock } {
  const order = options.order ?? [];
  const scope: SentryScopeMock = {
    setExtra: vi.fn((_key: string, _value: unknown) => {
      order.push('setExtra');
    }),
  };
  const mock: SentryMock = {
    init: vi.fn(),
    captureException: vi.fn((_error: Error) => {
      order.push('captureException');
    }),
  };
  if (options.withScope !== false) {
    mock.withScope = vi.fn((cb: (scope: SentryScopeMock) => void) => {
      cb(scope);
    });
  }
  Object.assign(globalThis, { Sentry: mock });
  return { mock, scope };
}

async function loadSentryModule(options: {
  withScope?: boolean;
  order?: string[];
} = {}): Promise<{
  module: SentryModuleWithContext;
  mock: SentryMock;
  scope: SentryScopeMock;
}> {
  vi.resetModules();
  const installed = installSentryMock(options);
  const module = (await import('../utils/sentry.js')) as unknown as SentryModuleWithContext;
  return { module, ...installed };
}

afterEach(() => {
  delete (globalThis as { Sentry?: unknown }).Sentry;
  vi.restoreAllMocks();
});

describe('SentryCaptureException — withScope context attachment', () => {
  it('attaches the exact skip context via scope.setExtra and captures the error', async () => {
    const { module, mock, scope } = await loadSentryModule();
    const error = new Error('skip detected');
    const context = makeSkipContext();

    module.SentryCaptureException(error, context);

    expect(mock.withScope).toHaveBeenCalledTimes(1);
    expect(scope.setExtra).toHaveBeenCalledWith('errorContext', context);
    expect(scope.setExtra.mock.calls[0]?.[1]).toBe(context);
    expect(mock.captureException).toHaveBeenCalledTimes(1);
    expect(mock.captureException).toHaveBeenCalledWith(error);
  });

  it('calls scope.setExtra before captureException', async () => {
    const order: string[] = [];
    const { module } = await loadSentryModule({ order });
    const error = new Error('skip detected');

    module.SentryCaptureException(error, makeSkipContext());

    expect(order).toEqual(['setExtra', 'captureException']);
  });
});

describe('SentryCaptureException — fallbacks', () => {
  it('without withScope, attaches errorContext to the error and captures directly', async () => {
    const { module, mock } = await loadSentryModule({ withScope: false });
    const error = new Error('skip detected');
    const context = makeSkipContext();

    module.SentryCaptureException(error, context);

    expect(mock.withScope).toBeUndefined();
    expect(mock.captureException).toHaveBeenCalledTimes(1);
    expect(mock.captureException).toHaveBeenCalledWith(error);
    expect((error as Error & { errorContext?: unknown }).errorContext).toBe(context);

    // Control: once withScope becomes available, the new scope path is used.
    const lateScope: SentryScopeMock = { setExtra: vi.fn() };
    mock.withScope = vi.fn((cb: (scope: SentryScopeMock) => void) => {
      cb(lateScope);
    });
    const laterContext = makeSkipContext();
    module.SentryCaptureException(new Error('skip again'), laterContext);

    expect(mock.withScope).toHaveBeenCalledTimes(1);
    expect(lateScope.setExtra).toHaveBeenCalledWith('errorContext', laterContext);
  });

  it('without a context, captures directly and never opens a scope', async () => {
    const { module, mock, scope } = await loadSentryModule();
    const error = new Error('plain failure');

    module.SentryCaptureException(error);

    expect(mock.withScope).not.toHaveBeenCalled();
    expect(mock.captureException).toHaveBeenCalledTimes(1);
    expect(mock.captureException).toHaveBeenCalledWith(error);

    // Control: providing a context opens the scope.
    const context = makeSkipContext();
    module.SentryCaptureException(new Error('skip detected'), context);

    expect(mock.withScope).toHaveBeenCalledTimes(1);
    expect(scope.setExtra).toHaveBeenCalledWith('errorContext', context);
  });

  it('is a no-op and never throws when the global Sentry is undefined', async () => {
    const { module, mock, scope } = await loadSentryModule();
    Object.assign(globalThis, { Sentry: undefined });

    expect(() => module.SentryCaptureException(new Error('skip'), makeSkipContext())).not.toThrow();

    expect(mock.withScope).not.toHaveBeenCalled();
    expect(mock.captureException).not.toHaveBeenCalled();

    // Control: restoring Sentry re-enables the context scope path.
    Object.assign(globalThis, { Sentry: mock });
    const context = makeSkipContext();
    module.SentryCaptureException(new Error('skip detected'), context);

    expect(mock.withScope).toHaveBeenCalledTimes(1);
    expect(scope.setExtra).toHaveBeenCalledWith('errorContext', context);
  });
});
