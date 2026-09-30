import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-button-group.js';

@customElement('t-media-footer')
export class MediaFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: sticky;
      bottom: 0;
      background-color: var(--theme-color, #003366);
      color: var(--on-theme-color, #ffffff);
      z-index: 998;
      border-top: 1px solid var(--on-theme-color, #ffffff);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
      user-select: none;
      overscroll-behavior: none;
      touch-action: pan-x pan-y;
    }

    .footer-container {
      padding: 8px 0;
      overscroll-behavior: none;
      touch-action: pan-x pan-y;
    }

    /* Mobile responsive adjustments */
    @media (min-width: 576px) {
      .footer-container {
        padding: 12px 0;
      }
    }
  `;

  @property({ type: String }) selected: string = 'tracks';

  private _footerSwipeStartX = 0;
  private _footerSwipeStartY = 0;
  private _footerSwipeTracking = false;

  private filterOptions = [
    { id: 'tracks', label: 'Tracks' },
    { id: 'groups', label: 'Groups' },
    { id: 'artists', label: 'Artists' },
    { id: 'genre', label: 'Genre' },
  ];

  private _handleFilterSelected(event: CustomEvent) {
    this.selected = event.detail.selectedId;
    this.dispatchEvent(
      new CustomEvent('filter-changed', {
        detail: { filter: event.detail.selectedId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _footerSwipePointFromEvent(event: Event): { clientX: number; clientY: number } | null {
    const touchEvent = event as unknown as {
      changedTouches?: Array<{ clientX: number; clientY: number }>;
      touches?: Array<{ clientX: number; clientY: number }>;
    };
    const touch = touchEvent.changedTouches?.[0] ?? touchEvent.touches?.[0];
    if (touch) return { clientX: touch.clientX, clientY: touch.clientY };
    if (event instanceof PointerEvent || event instanceof MouseEvent) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    return null;
  }

  private _handleFooterSwipeStart(event: Event) {
    const point = this._footerSwipePointFromEvent(event);
    if (!point) return;
    this._footerSwipeStartX = point.clientX;
    this._footerSwipeStartY = point.clientY;
    this._footerSwipeTracking = true;
  }

  private _handleFooterSwipeMove(event: Event) {
    if (!this._footerSwipeTracking) return;
    const point = this._footerSwipePointFromEvent(event);
    if (!point) return;
    const dy = point.clientY - this._footerSwipeStartY;
    const dx = point.clientX - this._footerSwipeStartX;
    if (dy < 0) {
      event.preventDefault();
    }
    if (dy <= -50 && Math.abs(dy) > Math.abs(dx)) {
      this._footerSwipeTracking = false;
      this.dispatchEvent(
        new CustomEvent('footer-swipe-up', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleFooterSwipeEnd() {
    this._footerSwipeTracking = false;
  }

  render() {
    return html`
      <div
        class="footer-container"
        @touchstart=${this._handleFooterSwipeStart}
        @touchmove=${this._handleFooterSwipeMove}
        @touchend=${this._handleFooterSwipeEnd}
        @touchcancel=${this._handleFooterSwipeEnd}
        @pointerdown=${this._handleFooterSwipeStart}
        @pointermove=${this._handleFooterSwipeMove}
        @pointerup=${this._handleFooterSwipeEnd}
        @pointercancel=${this._handleFooterSwipeEnd}
      >
        <t-button-group
          .options=${this.filterOptions}
          .selected=${this.selected}
          @button-group-selected=${this._handleFilterSelected}
        ></t-button-group>
      </div>
    `;
  }
}
