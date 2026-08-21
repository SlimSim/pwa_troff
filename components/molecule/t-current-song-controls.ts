import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-details.js';
import '../atom/t-dial.js';
import '../atom/t-help-tip.js';
import '../atom/t-icon.js';
import { createTapTempoState, calculateTapTempo } from '../../utils/tap-tempo.js';
import type { TapTempoState } from '../../utils/tap-tempo.js';

type ToggleSetting = 'playFullSong';

type SongAction =
  | 'zoomOut'
  | 'zoom'
  | 'importExport'
  | 'copyMarkers'
  | 'moveMarkers'
  | 'deleteMarkers'
  | 'stretchMarkers'
  | 'shareSong';

type SongNumericSetting = 'startBefore' | 'stopAfter' | 'incrementUntill';

@customElement('t-current-song-controls')
export class CurrentSongControls extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }

    .controls-container {
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .settings-group {
      overflow: hidden;
      padding: 4px;
    }

    .settings-group-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }

    .share-song-button {
      width: var(--settings-column-width);
    }

    .share-song-button t-icon {
      padding-right: 8px;
    }

    .settings-group-title-block {
      display: grid;
      gap: 4px;
    }

    .settings-group-title {
      margin: 0;
      font-size: 1rem;
      color: var(--text-color, #000);
    }

    .settings-section {
      margin-bottom: 6px;
      width: var(--settings-column-width);
    }

    .settings-section h3 {
      margin-bottom: 10px;
      color: var(--text-color, #000);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .setting-item > * {
      width: 100%;
      min-width: 0;
    }

    .setting-label {
      font-size: 0.9rem;
      color: var(--text-color, #000);
    }

    .setting-value {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .loop-buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .setting-group-title {
      margin: 0 0 8px;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .setting-group-copy {
      margin: 0 0 10px;
      font-size: 0.82rem;
      opacity: 0.8;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }

    .action-buttons {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      width: 100%;
    }

    .action-buttons t-butt {
      width: 100%;
    }

    .song-action-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }

    .song-action-buttons t-butt {
      width: 100%;
    }

    .song-stepper-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .song-stepper-grid t-dial {
      min-width: 0;
    }

    .setting-item.song-stepper-item {
      align-items: stretch;
      justify-content: stretch;
    }

    /* Hide playback controls (pause before, wait between, volume, speed) on narrow screens
       — they live in the footer on mobile. Visible in sidebar on wide screens. */
    .playback-control-section {
      display: none;
    }

    @media (min-width: 768px) {
      .playback-control-section {
        display: block;
      }

      .settings-group {
        padding: 14px;
      }
    }

    .tap-tempo-butt {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Responsive design for wider screens within the sidebar */
    @media (min-width: 576px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }

      .action-buttons {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .song-action-buttons {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* Hide pause before/wait between help items on narrow screens (they're in the footer on mobile) */
    .loop-help-item-footer-only {
      display: none;
    }

    @media (min-width: 768px) {
      .loop-help-item-footer-only {
        display: list-item;
      }
    }

    /* Show where to find the wait control on narrow screens only (it's in the footer on mobile) */
    .loop-help-item-phone-only {
      display: list-item;
    }

    @media (min-width: 768px) {
      .loop-help-item-phone-only {
        display: none;
      }
    }
  `;

  @property({ type: String }) loopTimesValue = '1';
  @property({ type: Boolean }) playFullSong = false;
  @property({ type: Number }) startBeforeValue = 0;
  @property({ type: Boolean }) startBeforeDisabled = false;
  @property({ type: Number }) stopAfterValue = 0;
  @property({ type: Boolean }) stopAfterDisabled = false;
  @property({ type: Number }) incrementUntillValue = 0;
  @property({ type: Boolean }) incrementUntillDisabled = false;
  @property({ type: Number }) pauseBefore = 3;
  @property({ type: Number }) waitBetween = 1;
  @property({ type: Boolean }) disablePauseBefore = false;
  @property({ type: Boolean }) disableWaitBetween = false;
  @property({ type: Number }) volume = 75;
  @property({ type: Number }) speed = 100;
  @property({ type: Number }) tempo = 0;

  private _handleSettingChange(setting: string, value: unknown) {
    this.dispatchEvent(
      new CustomEvent('setting-changed', {
        detail: { setting, value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleSongAction(action: SongAction) {
    this.dispatchEvent(
      new CustomEvent('song-action-requested', {
        detail: { action },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _setSongNumericSetting(setting: SongNumericSetting, value: number, disabled?: boolean) {
    switch (setting) {
      case 'startBefore':
        this.startBeforeValue = value;
        if (disabled !== undefined) {
          this.startBeforeDisabled = disabled;
          this._handleSettingChange('startBeforeDisabled', disabled);
        }
        break;
      case 'stopAfter':
        this.stopAfterValue = value;
        if (disabled !== undefined) {
          this.stopAfterDisabled = disabled;
          this._handleSettingChange('stopAfterDisabled', disabled);
        }
        break;
      case 'incrementUntill':
        this.incrementUntillValue = value;
        if (disabled !== undefined) {
          this.incrementUntillDisabled = disabled;
          this._handleSettingChange('incrementUntillDisabled', disabled);
        }
        break;
      default:
        return;
    }

    this._handleSettingChange(setting, value);
  }

  private _toggleSetting(setting: ToggleSetting, currentValue: boolean) {
    const nextValue = !currentValue;

    switch (setting) {
      case 'playFullSong':
        this.playFullSong = nextValue;
        break;
      default:
        return;
    }

    this._handleSettingChange(setting, nextValue);
  }

  private _setLoopTimes(loopTimes: string) {
    this.loopTimesValue = loopTimes;
    this._handleSettingChange('loopTimes', loopTimes);
  }

  private _tapTempoState: TapTempoState = createTapTempoState();

  private _handleTapTempo() {
    const bpm = calculateTapTempo(this._tapTempoState, Date.now());
    if (bpm !== null) {
      this.tempo = bpm;
      this._handleSettingChange('tempo', bpm);
    }
  }

  private _isLoopButtonActive(loopTimes: string) {
    const current = this.loopTimesValue.trim().toLowerCase();
    if (loopTimes === 'Inf') {
      return current === 'inf' || current === 'infinite' || current === '∞';
    }

    return current === loopTimes;
  }

  private _renderSongActionButton(action: SongAction, label: string) {
    return html`
      <t-butt ellipsis @click=${() => this._handleSongAction(action)}>${label}</t-butt>
    `;
  }

  render() {
    return html`
      <div class="controls-container">
        <section class="settings-group">
          <div class="settings-group-header">
            <div class="settings-group-title-block">
              <t-butt
                class="share-song-button"
                special
                fullWidth
                title="Share this song to friends via link"
                @click=${() => this._handleSongAction('shareSong')}
              >
                <t-icon name="share"></t-icon>
                Share the song with a link!
              </t-butt>
              <t-help-tip h3="Marker" position="up">
                These options control how the song is played back.
                <ul>
                  <li>Play full song will select the first and last markers.</li>
                  <li>Zoom will zoom in to the active playing region.</li>
                  <li>
                    Start before and stop after determine how many seconds before and after the
                    selected markers is played back.
                  </li>
                </ul>
              </t-help-tip>
            </div>
          </div>

          <!-- 2. Play full song / Tap tempo -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item">
                <div class="song-action-buttons">
                  <t-butt
                    key="u"
                    ellipsis
                    .active=${this.playFullSong}
                    @click=${() => this._toggleSetting('playFullSong', this.playFullSong)}
                  >
                    Play full song
                  </t-butt>
                  <t-butt key="t" ellipsis @click=${this._handleTapTempo}>
                    <div class="tap-tempo-butt">
                      <t-icon name="metronome"></t-icon>
                      <span>Tap tempo: ${this.tempo || '--'} <br /> </span>
                    </div>
                  </t-butt>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Zoom out / Zoom -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item">
                <div class="song-action-buttons">
                  ${this._renderSongActionButton('zoomOut', 'Zoom out')}
                  ${this._renderSongActionButton('zoom', 'Zoom')}
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Start before -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    unit="s"
                    key="b"
                    label="Start before"
                    show-disable-button
                    defaultValue="4"
                    .value=${this.startBeforeValue}
                    .disabled=${this.startBeforeDisabled}
                    .min=${0}
                    .max=${999}
                    .step=${1}
                    @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) =>
                      this._setSongNumericSetting(
                        'startBefore',
                        event.detail.value,
                        event.detail.disabled
                      )}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Stop after -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    label="Stop after"
                    key="a"
                    show-disable-button
                    unit="s"
                    defaultValue="2"
                    .value=${this.stopAfterValue}
                    .disabled=${this.stopAfterDisabled}
                    .min=${0}
                    .max=${999}
                    .step=${1}
                    @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) =>
                      this._setSongNumericSetting(
                        'stopAfter',
                        event.detail.value,
                        event.detail.disabled
                      )}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Loop headline -->
          <div class="settings-section">
            <t-help-tip h3="Loop" position="up">
              <ul>
                <li class="loop-help-item-footer-only">
                  "Pause before" sets how long the player will wait before starting to play the song
                  when you press play.
                </li>
                <li class="loop-help-item-footer-only">
                  "Wait between" sets how long the player will wait between loops of the song.
                </li>
                <li>
                  "Increment until" will determine at what speed the song will play the final loop,
                  and it will increment every loop until it reaches that speed.
                </li>
                <li>The "1 - 9" buttons determine how many times the song will loop.</li>
                <li class="loop-help-item-phone-only">
                  On smaller screens the wait control ("Pause before" and "Wait between") and speed
                  and volume controls are available from the buttons with the
                  <t-icon name="time" slim></t-icon> and <t-icon name="speed" slim></t-icon>-icons
                  in the footer, respectively.
                </li>
              </ul>
            </t-help-tip>
          </div>

          <!-- 7. Pause before -->
          <div class="settings-section playback-control-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    key="p"
                    label="Pause before"
                    iconName="pause-before"
                    unit="s"
                    defaultValue="3"
                    show-disable-button
                    .value=${this.pauseBefore}
                    .disabled=${this.disablePauseBefore}
                    @value-changed=${(
                      event: CustomEvent<{ value: number; disabled?: boolean }>
                    ) => {
                      this.pauseBefore = event.detail.value;
                      if (event.detail.disabled !== undefined) {
                        this.disablePauseBefore = event.detail.disabled;
                        this._handleSettingChange('pauseBeforeDisabled', event.detail.disabled);
                      }
                      this._handleSettingChange('pauseBefore', event.detail.value);
                    }}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 8. Wait between -->
          <div class="settings-section playback-control-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    key="w"
                    label="Wait between"
                    iconName="wait-between"
                    unit="s"
                    defaultValue="1"
                    show-disable-button
                    .value=${this.waitBetween}
                    .disabled=${this.disableWaitBetween}
                    @value-changed=${(
                      event: CustomEvent<{ value: number; disabled?: boolean }>
                    ) => {
                      this.waitBetween = event.detail.value;
                      if (event.detail.disabled !== undefined) {
                        this.disableWaitBetween = event.detail.disabled;
                        this._handleSettingChange('waitBetweenDisabled', event.detail.disabled);
                      }
                      this._handleSettingChange('waitBetween', event.detail.value);
                    }}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 9. Increment until -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    label="Increment until"
                    unit="%"
                    show-disable-button
                    defaultValue="100"
                    .value=${this.incrementUntillValue}
                    .disabled=${this.incrementUntillDisabled}
                    .min=${50}
                    .max=${200}
                    .step=${1}
                    @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) =>
                      this._setSongNumericSetting(
                        'incrementUntill',
                        event.detail.value,
                        event.detail.disabled
                      )}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 10. Loop buttons (nr of loops) -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item">
                <div class="loop-buttons">
                  ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Inf'].map(
                    (loopTimes) => html`
                      <t-butt
                        toggle
                        .active=${this._isLoopButtonActive(loopTimes)}
                        @click=${() => this._setLoopTimes(loopTimes)}
                      >
                        ${loopTimes === 'Inf' ? '∞' : loopTimes}
                      </t-butt>
                    `
                  )}
                </div>
              </div>
            </div>
          </div>

          <!-- 11. Volume -->
          <div class="settings-section playback-control-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    key="v"
                    min="0"
                    max="100"
                    step="5"
                    label="Volume"
                    iconName="volume"
                    unit=""
                    defaultValue="75"
                    .value=${this.volume}
                    @value-changed=${(event: CustomEvent<{ value: number }>) => {
                      this.volume = event.detail.value;
                      this._handleSettingChange('volume', event.detail.value);
                    }}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 12. Speed -->
          <div class="settings-section playback-control-section">
            <div class="settings-grid">
              <div class="setting-item song-stepper-item">
                <div class="song-stepper-grid">
                  <t-dial
                    key="s"
                    min="50"
                    max="200"
                    step="5"
                    label="Speed"
                    iconName="speed"
                    unit="%"
                    defaultValue="100"
                    .value=${this.speed}
                    @value-changed=${(event: CustomEvent<{ value: number }>) => {
                      this.speed = event.detail.value;
                      this._handleSettingChange('speed', event.detail.value);
                    }}
                  ></t-dial>
                </div>
              </div>
            </div>
          </div>

          <!-- 1. Advanced -->
          <div class="settings-section">
            <t-details title="Advanced" text="Advanced marker actions!">
              <div class="song-action-buttons">
                ${this._renderSongActionButton('importExport', 'Import / export')}
                ${this._renderSongActionButton('copyMarkers', 'Copy markers')}
                ${this._renderSongActionButton('moveMarkers', 'Move markers')}
                ${this._renderSongActionButton('deleteMarkers', 'Delete markers')}
                ${this._renderSongActionButton('stretchMarkers', 'Stretch markers')}
              </div>
            </t-details>
          </div>
        </section>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-current-song-controls': CurrentSongControls;
  }
}
