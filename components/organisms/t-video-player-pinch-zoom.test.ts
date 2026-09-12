import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TVideoPlayer } from './t-video-player.js';

/**
 * Pinch-to-zoom + 2-finger pan (RED — feature not implemented).
 *
 * Spec under test (see orchestrator brief):
 * 1. Two-finger pinch on `.video-frame` zooms the video picture
 *    (scale clamped 1x–4x, default 1x). Pinch-out zooms in, pinch-in zooms out.
 * 2. When zoomed (scale > 1), two-finger drag pans the picture (translate X/Y
 *    clamped so the picture covers the frame). At scale == 1 translation is 0
 *    and two-finger drag must NOT pan.
 * 3. Single-finger horizontal scrub / vertical speed keep working with exactly
 *    one pointer down. Starting a second pointer must cancel/pause the
 *    in-progress single-finger gesture (no scrub/speed events while pinched,
 *    no jump when returning to 1 finger).
 * 4. Pinch/pan must suppress the click-to-toggle-controls (and not trigger
 *    fullscreen).
 * 5. Zoom is resettable: scale back to 1 clears pan offsets (programmatic
 *    reset and/or double-tap). CSS transform on the slotted <video>.
 *
 * Implementation contract asserted here (follows existing Lit + PointerEvents
 * + CSS-transform patterns):
 * - readable `zoomScale` number property (default 1, clamped 1–4),
 * - readable pan offsets (checked via `video.style.transform` containing
 *   `scale(` / `translate`), never re-implemented here — always the actual
 *   component + slotted <video>),
 * - optional `resetZoom()` method that restores scale 1 + zero pan.
 */

type ZoomablePlayer = TVideoPlayer & {
  zoomScale?: number;
  zoomX?: number;
  zoomY?: number;
  panX?: number;
  panY?: number;
  resetZoom?: () => void;
};

describe('t-video-player pinch-to-zoom', () => {
  const freshElements: TVideoPlayer[] = [];

  beforeEach(() => {
    freshElements.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const el of freshElements) {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }
    freshElements.length = 0;
    vi.restoreAllMocks();
  });

  const createPlayerWithVideo = (): { el: TVideoPlayer; video: HTMLVideoElement } => {
    const el = new TVideoPlayer();
    const video = document.createElement('video');
    el.appendChild(video);
    document.body.appendChild(el);
    freshElements.push(el);
    return { el, video };
  };

  const frameOf = (el: TVideoPlayer): HTMLElement => {
    const frame = el.shadowRoot?.querySelector('.video-frame') as HTMLElement | null;
    if (!frame) throw new Error('Expected shadow root to contain <.video-frame>');
    return frame;
  };

  const dispatchPointer = (
    el: TVideoPlayer,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    clientX: number,
    clientY: number,
    pointerId = 1
  ) => {
    const frame = frameOf(el);
    const event = new PointerEvent(type, {
      pointerId,
      pointerType: 'touch',
      button: 0,
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    });
    frame.dispatchEvent(event);
    return event;
  };

  const zoomScaleOf = (el: TVideoPlayer): number =>
    (el as ZoomablePlayer).zoomScale as number;

  const defineDuration = (video: HTMLVideoElement, duration: number) => {
    Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  };

  const detailOf = <T>(spy: ReturnType<typeof vi.fn>, index = 0): T =>
    (spy.mock.calls[index][0] as CustomEvent).detail as T;

  it('defaults to scale 1x with no pan offset', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // RED today: `zoomScale` does not exist on the component (undefined !== 1).
    expect(zoomScaleOf(el), 'zoomScale must default to 1').toBe(1);
    // At scale 1 the video must carry no zoom/pan transform (mirror off).
    expect(video.style.transform).toBe('');
  });

  it('two-finger pinch-out zooms the picture in (scale > 1 via CSS transform)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // Two fingers down 100px apart, then spread to ~140px apart (pinch-out).
    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 90, 100, 1);
    dispatchPointer(el, 'pointermove', 230, 100, 2);
    await el.updateComplete;

    // RED today: no pinch handling — zoomScale stays undefined/1 and no
    // scale() transform is applied.
    expect(zoomScaleOf(el), 'pinch-out must increase zoomScale above 1').toBeGreaterThan(1);
    expect(video.style.transform, 'zoom must apply a CSS scale() on the video').toContain(
      'scale('
    );

    dispatchPointer(el, 'pointerup', 90, 100, 1);
    dispatchPointer(el, 'pointerup', 230, 100, 2);
  });

  it('two-finger pinch-in zooms back out and clamps at 1x with zero pan', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // Zoom in first.
    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 80, 100, 1);
    dispatchPointer(el, 'pointermove', 240, 100, 2);
    await el.updateComplete;
    expect(zoomScaleOf(el), 'precondition: pinch-out must zoom in').toBeGreaterThan(1);

    // Pinch back together — scale must fall and clamp at exactly 1 with no
    // residual translate.
    dispatchPointer(el, 'pointermove', 100, 100, 1);
    dispatchPointer(el, 'pointermove', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 110, 100, 1);
    dispatchPointer(el, 'pointermove', 190, 100, 2);
    await el.updateComplete;

    expect(zoomScaleOf(el), 'pinch-in must return scale to 1').toBe(1);
    expect(
      video.style.transform,
      'at scale 1 translation must be cleared (no translate residue)'
    ).not.toContain('translate');

    dispatchPointer(el, 'pointerup', 110, 100, 1);
    dispatchPointer(el, 'pointerup', 190, 100, 2);
  });

  it('clamps zoom scale to a maximum (e.g. 4x)', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    // Extreme spread — far beyond any reasonable max zoom.
    for (let i = 0; i < 5; i += 1) {
      dispatchPointer(el, 'pointermove', 0 - i * 50, 100, 1);
      dispatchPointer(el, 'pointermove', 300 + i * 50, 100, 2);
    }
    await el.updateComplete;

    // RED today: zoomScale is undefined; after the feature it must be capped.
    expect(zoomScaleOf(el), 'zoom must clamp at the 4x maximum').toBeLessThanOrEqual(4);

    dispatchPointer(el, 'pointerup', -200, 100, 1);
    dispatchPointer(el, 'pointerup', 500, 100, 2);
  });

  it('two-finger drag pans the picture when zoomed but not at 1x', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    // At 1x: two-finger drag must NOT translate the picture.
    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 120, 120, 1);
    dispatchPointer(el, 'pointermove', 220, 120, 2);
    await el.updateComplete;
    expect(
      video.style.transform,
      'at scale 1 a two-finger drag must not pan (no translate)'
    ).not.toContain('translate');
    dispatchPointer(el, 'pointerup', 120, 120, 1);
    dispatchPointer(el, 'pointerup', 220, 120, 2);
    await el.updateComplete;

    // Zoom in, then drag both fingers together — picture must pan.
    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 80, 100, 1);
    dispatchPointer(el, 'pointermove', 240, 100, 2);
    await el.updateComplete;
    expect(zoomScaleOf(el), 'precondition: must be zoomed before pan').toBeGreaterThan(1);
    const beforePan = video.style.transform;

    dispatchPointer(el, 'pointermove', 110, 130, 1);
    dispatchPointer(el, 'pointermove', 270, 130, 2);
    await el.updateComplete;
    // RED today: no pan handling — transform never gains translate.
    expect(video.style.transform, 'two-finger drag while zoomed must pan').toContain(
      'translate'
    );
    expect(video.style.transform).not.toBe(beforePan);

    dispatchPointer(el, 'pointerup', 110, 130, 1);
    dispatchPointer(el, 'pointerup', 270, 130, 2);
  });

  it('single-finger horizontal drag still scrubs when only one pointer is down', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;
    defineDuration(video, 120);
    video.currentTime = 0;

    const scrubSpy = vi.fn();
    el.addEventListener('video-scrub-requested', scrubSpy);

    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointermove', 160, 100, 1); // +60px horizontal
    await el.updateComplete;

    // Regression guard: single-finger scrub must keep working exactly as before.
    expect(scrubSpy, 'one-pointer horizontal drag must scrub').toHaveBeenCalled();
    expect(detailOf<{ time: number }>(scrubSpy).time).toBeGreaterThan(0);

    dispatchPointer(el, 'pointerup', 160, 100, 1);
    video.dispatchEvent(new Event('seeked'));
  });

  it('single-finger vertical drag still changes speed when only one pointer is down', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;
    (el as TVideoPlayer & { speed: number }).speed = 100;
    await el.updateComplete;

    const speedSpy = vi.fn();
    el.addEventListener('speed-changed', speedSpy);

    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointermove', 100, 25, 1); // 75px up
    await el.updateComplete;

    // Regression guard: single-finger speed gesture must keep working.
    expect(speedSpy, 'one-pointer vertical drag must dispatch speed-changed').toHaveBeenCalled();
    expect(Number.isInteger(detailOf<{ speed: number }>(speedSpy).speed)).toBe(true);

    dispatchPointer(el, 'pointerup', 100, 25, 1);
  });

  it('starting a second pointer cancels the in-progress single-finger scrub (no scrub while pinched)', async () => {
    vi.useFakeTimers();
    try {
      const { el, video } = createPlayerWithVideo();
      await el.updateComplete;
      defineDuration(video, 120);
      video.currentTime = 0;

      const scrubSpy = vi.fn();
      el.addEventListener('video-scrub-requested', scrubSpy);

      // Begin a horizontal scrub with one finger.
      dispatchPointer(el, 'pointerdown', 100, 100, 1);
      dispatchPointer(el, 'pointermove', 160, 100, 1); // +60px → 1 scrub event
      expect(scrubSpy, 'precondition: single-finger move must scrub').toHaveBeenCalledTimes(1);
      video.dispatchEvent(new Event('seeked'));

      // Open the 50ms seek cadence so the next committed seek is not hidden
      // by throttling — any further scrub event below is a genuine gesture
      // leak, not timing noise.
      vi.advanceTimersByTime(60);

      // Second finger lands — single-finger gesture must cancel; further
      // two-finger movement is pinch/pan, NOT scrub.
      dispatchPointer(el, 'pointerdown', 200, 100, 2);
      dispatchPointer(el, 'pointermove', 230, 100, 2);
      video.dispatchEvent(new Event('seeked'));
      vi.advanceTimersByTime(60);
      dispatchPointer(el, 'pointermove', 240, 100, 2);
      await el.updateComplete;

      // RED today: the second pointer just overwrites _dragPointerId and its
      // moves keep dispatching video-scrub-requested (no cancel/pause).
      expect(
        scrubSpy,
        'no additional scrub events may fire while two pointers are down (pinch must pause scrub)'
      ).toHaveBeenCalledTimes(1);

      dispatchPointer(el, 'pointerup', 160, 100, 1);
      dispatchPointer(el, 'pointerup', 240, 100, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pinch/pan suppresses the click-to-toggle-controls', async () => {
    const { el } = createPlayerWithVideo();
    await el.updateComplete;

    const mirrorBtn = el.shadowRoot?.querySelector('.mirror-btn') as HTMLElement | null;
    expect(mirrorBtn?.classList.contains('controls-hidden')).toBe(false);

    // Pinch gesture then a click (the browser fires click after pointerup):
    // the pinch must suppress the controls toggle.
    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 80, 100, 1);
    dispatchPointer(el, 'pointermove', 240, 100, 2);
    dispatchPointer(el, 'pointerup', 80, 100, 1);
    dispatchPointer(el, 'pointerup', 240, 100, 2);
    frameOf(el).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;

    // RED today (when combined with the pinch tests above): without pinch
    // tracking there is no pinch-aware suppression flag, so the click toggles.
    // Pinned to the zoom precondition so the test cannot pass vacuously when
    // pinch itself is missing.
    expect(zoomScaleOf(el), 'precondition: pinch must have zoomed').toBeGreaterThan(1);
    expect(
      mirrorBtn?.classList.contains('controls-hidden'),
      'click after pinch must not hide controls'
    ).toBe(false);
  });

  it('zoom state is resettable (programmatic reset clears scale + pan)', async () => {
    const { el, video } = createPlayerWithVideo();
    await el.updateComplete;

    dispatchPointer(el, 'pointerdown', 100, 100, 1);
    dispatchPointer(el, 'pointerdown', 200, 100, 2);
    dispatchPointer(el, 'pointermove', 80, 100, 1);
    dispatchPointer(el, 'pointermove', 240, 100, 2);
    await el.updateComplete;
    expect(zoomScaleOf(el), 'precondition: pinch must zoom').toBeGreaterThan(1);

    // RED today: no resetZoom method exists.
    const reset = (el as ZoomablePlayer).resetZoom;
    expect(typeof reset, 'component must expose a resetZoom() method').toBe('function');
    reset?.call(el);
    await el.updateComplete;

    expect(zoomScaleOf(el), 'reset must restore scale 1').toBe(1);
    expect(video.style.transform, 'reset must clear pan offsets').toBe('');
  });
});
