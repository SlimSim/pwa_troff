import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-dial.js';
import '../atom/t-help-tip.js';
import '../atom/t-icon.js';

type ToggleSetting =
  | 'playFullSong'
  | 'enterUseTimer'
  | 'enterResetCounter'
  | 'enterGoToMarker'
  | 'spaceUseTimer'
  | 'spaceResetCounter'
  | 'spaceGoToMarker'
  | 'playUseTimer'
  | 'playResetCounter'
  | 'playGoToMarker'
  | 'extendedMarkerColor'
  | 'extraExtendedMarkerColor';

type SongAction =
  | 'zoomOut'
  | 'zoom'
  | 'importExport'
  | 'copyMarkers'
  | 'moveMarkers'
  | 'deleteMarkers'
  | 'stretchMarkers';

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
      padding: 14px;

      background-color: var(--item-background, rgba(255, 255, 255, 0.1));
    }

    .settings-group-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
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

    .settings-group-copy {
      margin: 0;
      font-size: 0.85rem;
      color: var(--text-color, #000);
      opacity: 0.8;
    }

    .scope-badge {
      padding: 4px 8px;
      border-radius: 999px;
      background: var(--secondary-color, rgba(0, 0, 0, 0.08));
      color: var(--on-secondary-color, #000);
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .settings-section {
      margin-bottom: 6px;
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
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
      container-type: inline-size;
    }

    .loop-buttons t-butt {
      width: 100%;
    }

    @container (min-width: 450px) {
      .loop-buttons {
        grid-template-columns: repeat(10, minmax(0, 1fr));
      }
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
    }

    details.advanced-panel {
      border: 1px solid var(--border-color, #333);
      border-radius: 8px;
      background-color: var(--item-background, rgba(255, 255, 255, 0.06));
      overflow: hidden;
    }

    details.advanced-panel[open] {
      background-color: var(--item-background, rgba(255, 255, 255, 0.1));
    }

    .advanced-summary {
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
      padding: 12px 14px;
    }

    .advanced-summary::-webkit-details-marker {
      display: none;
    }

    .advanced-summary-copy {
      display: grid;
      gap: 2px;
    }

    .advanced-summary-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-color, #000);
    }

    .advanced-summary-text {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-color, #000);
      opacity: 0.8;
    }

    .advanced-chevron {
      font-size: 1rem;
      transition: transform 0.3s ease-in-out;
      transform-style: preserve-3d;
    }

    details.advanced-panel[open] .advanced-chevron {
      transform: rotateX(180deg) translateY(-1px);
    }

    .advanced-content {
      padding: 0 14px 14px;
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
  @property({ type: Boolean }) enterUseTimer = false;
  @property({ type: Boolean }) enterResetCounter = false;
  @property({ type: Boolean }) enterGoToMarker = false;
  @property({ type: Boolean }) spaceUseTimer = false;
  @property({ type: Boolean }) spaceResetCounter = false;
  @property({ type: Boolean }) spaceGoToMarker = false;
  @property({ type: Boolean }) playUseTimer = false;
  @property({ type: Boolean }) playResetCounter = false;
  @property({ type: Boolean }) playGoToMarker = false;
  @property({ type: Boolean }) extendedMarkerColor = false;
  @property({ type: Boolean }) extraExtendedMarkerColor = false;

  // Global default song values
  @property({ type: Number }) defaultStartBeforeValue = 4;
  @property({ type: Boolean }) defaultStartBeforeOn = false;
  @property({ type: Number }) defaultStopAfterValue = 2;
  @property({ type: Boolean }) defaultStopAfterOn = false;
  @property({ type: Number }) defaultPauseBeforeValue = 3;
  @property({ type: Boolean }) defaultPauseBeforeOn = true;
  @property({ type: Number }) defaultWaitBetweenValue = 1;
  @property({ type: Boolean }) defaultWaitBetweenOn = true;
  @property({ type: Number }) defaultIncrementUntilValue = 100;
  @property({ type: Boolean }) defaultIncrementUntilOn = false;
  @property({ type: Number }) defaultNrLoopsValue = 1;
  @property({ type: Boolean }) defaultNrLoopsInfiniteOn = false;
  @property({ type: Number }) defaultVolumeValue = 75;
  @property({ type: Number }) defaultSpeedValue = 100;

  @property({ type: Boolean }) hideGlobalControls = false;

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
      case 'enterUseTimer':
        this.enterUseTimer = nextValue;
        break;
      case 'enterResetCounter':
        this.enterResetCounter = nextValue;
        break;
      case 'enterGoToMarker':
        this.enterGoToMarker = nextValue;
        break;
      case 'spaceUseTimer':
        this.spaceUseTimer = nextValue;
        break;
      case 'spaceResetCounter':
        this.spaceResetCounter = nextValue;
        break;
      case 'spaceGoToMarker':
        this.spaceGoToMarker = nextValue;
        break;
      case 'playUseTimer':
        this.playUseTimer = nextValue;
        break;
      case 'playResetCounter':
        this.playResetCounter = nextValue;
        break;
      case 'playGoToMarker':
        this.playGoToMarker = nextValue;
        break;
      case 'extendedMarkerColor':
        this.extendedMarkerColor = nextValue;
        break;
      case 'extraExtendedMarkerColor':
        this.extraExtendedMarkerColor = nextValue;
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
              <t-help-tip h3="Marker">
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

          <!-- 1. Advanced -->
          <div class="settings-section">
            <details class="advanced-panel">
              <summary class="advanced-summary">
                <div class="advanced-summary-copy">
                  <p class="advanced-summary-title">Advanced</p>
                </div>
                <t-icon name="chevron-up" class="advanced-chevron"></t-icon>
              </summary>
              <div class="advanced-content">
                <p class="advanced-summary-text">TO BE IMPLEMENTED: Advanced marker actions!</p>
                <div class="song-action-buttons">
                  ${this._renderSongActionButton('importExport', 'Import / export')}
                  ${this._renderSongActionButton('copyMarkers', 'Copy markers')}
                  ${this._renderSongActionButton('moveMarkers', 'Move markers')}
                  ${this._renderSongActionButton('deleteMarkers', 'Delete markers')}
                  ${this._renderSongActionButton('stretchMarkers', 'Stretch markers')}
                </div>
              </div>
            </details>
          </div>

          <!-- 2. Play full song -->
          <div class="settings-section">
            <div class="settings-grid">
              <div class="setting-item">
                <div class="action-buttons">
                  <t-butt
                    ellipsis
                    .active=${this.playFullSong}
                    @click=${() => this._toggleSetting('playFullSong', this.playFullSong)}
                  >
                    Play full song
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
            <t-help-tip h3="Loop">
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
        </section>

        ${!this.hideGlobalControls
          ? html`
              <details class="advanced-panel" style="margin-top: 16px;">
                <summary class="advanced-summary">
                  <div class="advanced-summary-copy">
                    <p class="advanced-summary-title">Global Controls</p>
                    <p class="advanced-summary-text">
                      These key and button behaviors apply across Troff, not just this song.
                    </p>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <span class="scope-badge">App-wide</span>
                    <t-icon name="chevron-up" class="advanced-chevron"></t-icon>
                  </div>
                </summary>
                <div class="advanced-content">
                  <details class="advanced-panel">
                    <summary class="advanced-summary">
                      <div class="advanced-summary-copy">
                        <p class="advanced-summary-title">Behaviour of keys and buttons</p>
                        <p class="advanced-summary-text">
                          Configure what happens when you press the Enter key, Space key, or Play
                          button.
                        </p>
                      </div>
                      <t-icon name="chevron-up" class="advanced-chevron"></t-icon>
                    </summary>
                    <div class="advanced-content">
                      <div class="settings-section">
                        <h3>Enter Key</h3>
                        <div class="settings-grid">
                          <div class="setting-item">
                            <div class="action-buttons">
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.enterGoToMarker}
                                @click=${() =>
                                  this._toggleSetting('enterGoToMarker', this.enterGoToMarker)}
                              >
                                Go to marker
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.enterUseTimer}
                                @click=${() =>
                                  this._toggleSetting('enterUseTimer', this.enterUseTimer)}
                              >
                                Use timer
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.enterResetCounter}
                                @click=${() =>
                                  this._toggleSetting('enterResetCounter', this.enterResetCounter)}
                              >
                                Reset counter
                              </t-butt>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="settings-section">
                        <h3>Space Key</h3>
                        <div class="settings-grid">
                          <div class="setting-item">
                            <div class="action-buttons">
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.spaceGoToMarker}
                                @click=${() =>
                                  this._toggleSetting('spaceGoToMarker', this.spaceGoToMarker)}
                              >
                                Go to marker
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.spaceUseTimer}
                                @click=${() =>
                                  this._toggleSetting('spaceUseTimer', this.spaceUseTimer)}
                              >
                                Use timer
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.spaceResetCounter}
                                @click=${() =>
                                  this._toggleSetting('spaceResetCounter', this.spaceResetCounter)}
                              >
                                Reset counter
                              </t-butt>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="settings-section">
                        <h3>Play Button</h3>
                        <div class="settings-grid">
                          <div class="setting-item">
                            <div class="action-buttons">
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.playGoToMarker}
                                @click=${() =>
                                  this._toggleSetting('playGoToMarker', this.playGoToMarker)}
                              >
                                Go to marker
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.playUseTimer}
                                @click=${() =>
                                  this._toggleSetting('playUseTimer', this.playUseTimer)}
                              >
                                Use timer
                              </t-butt>
                              <t-butt
                                toggle
                                ellipsis
                                .active=${this.playResetCounter}
                                @click=${() =>
                                  this._toggleSetting('playResetCounter', this.playResetCounter)}
                              >
                                Reset counter
                              </t-butt>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  <details class="advanced-panel" style="margin-top: 16px;">
                    <summary class="advanced-summary">
                      <div class="advanced-summary-copy">
                        <p class="advanced-summary-title">Marker color</p>
                        <p class="advanced-summary-text">
                          Control how markers extend their color across the timeline.
                        </p>
                      </div>
                      <t-icon name="chevron-up" class="advanced-chevron"></t-icon>
                    </summary>
                    <div class="advanced-content">
                      <div class="settings-grid">
                        <div class="setting-item">
                          <div class="action-buttons">
                            <t-butt
                              toggle
                              ellipsis
                              .active=${this.extendedMarkerColor}
                              @click=${() =>
                                this._toggleSetting(
                                  'extendedMarkerColor',
                                  this.extendedMarkerColor
                                )}
                            >
                              Fill to next marker
                            </t-butt>
                            <t-butt
                              toggle
                              ellipsis
                              .active=${this.extraExtendedMarkerColor}
                              @click=${() =>
                                this._toggleSetting(
                                  'extraExtendedMarkerColor',
                                  this.extraExtendedMarkerColor
                                )}
                            >
                              Fill to next colored marker
                            </t-butt>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>

                  <details class="advanced-panel" style="margin-top: 16px;">
                    <summary class="advanced-summary">
                      <div class="advanced-summary-copy">
                        <p class="advanced-summary-title">Default Song Values</p>
                        <p class="advanced-summary-text">
                          When loading a new song, these values will be the ones that the song get.
                        </p>
                      </div>
                      <t-icon name="chevron-up" class="advanced-chevron"></t-icon>
                    </summary>
                    <div class="advanced-content">
                      <div class="song-stepper-grid">
                        <t-dial
                          label="Start before"
                          unit="s"
                          show-disable-button
                          defaultValue="4"
                          .value=${this.defaultStartBeforeValue}
                          .disabled=${!this.defaultStartBeforeOn}
                          .min=${0}
                          .max=${999}
                          .step=${1}
                          @value-changed=${(
                            event: CustomEvent<{ value: number; disabled?: boolean }>
                          ) => {
                            this.defaultStartBeforeValue = event.detail.value;
                            this._handleSettingChange(
                              'defaultStartBeforeValue',
                              event.detail.value
                            );
                            if (event.detail.disabled !== undefined) {
                              this.defaultStartBeforeOn = !event.detail.disabled;
                              this._handleSettingChange(
                                'defaultStartBeforeOn',
                                !event.detail.disabled
                              );
                            }
                          }}
                        ></t-dial>
                        <t-dial
                          label="Stop after"
                          unit="s"
                          show-disable-button
                          defaultValue="2"
                          .value=${this.defaultStopAfterValue}
                          .disabled=${!this.defaultStopAfterOn}
                          .min=${0}
                          .max=${999}
                          .step=${1}
                          @value-changed=${(
                            event: CustomEvent<{ value: number; disabled?: boolean }>
                          ) => {
                            this.defaultStopAfterValue = event.detail.value;
                            this._handleSettingChange('defaultStopAfterValue', event.detail.value);
                            if (event.detail.disabled !== undefined) {
                              this.defaultStopAfterOn = !event.detail.disabled;
                              this._handleSettingChange(
                                'defaultStopAfterOn',
                                !event.detail.disabled
                              );
                            }
                          }}
                        ></t-dial>
                        <t-dial
                          label="Pause before"
                          unit="s"
                          show-disable-button
                          defaultValue="3"
                          .value=${this.defaultPauseBeforeValue}
                          .disabled=${!this.defaultPauseBeforeOn}
                          .min=${0}
                          .max=${999}
                          .step=${1}
                          @value-changed=${(
                            event: CustomEvent<{ value: number; disabled?: boolean }>
                          ) => {
                            this.defaultPauseBeforeValue = event.detail.value;
                            this._handleSettingChange(
                              'defaultPauseBeforeValue',
                              event.detail.value
                            );
                            if (event.detail.disabled !== undefined) {
                              this.defaultPauseBeforeOn = !event.detail.disabled;
                              this._handleSettingChange(
                                'defaultPauseBeforeOn',
                                !event.detail.disabled
                              );
                            }
                          }}
                        ></t-dial>
                        <t-dial
                          label="Wait between"
                          unit="s"
                          show-disable-button
                          defaultValue="1"
                          .value=${this.defaultWaitBetweenValue}
                          .disabled=${!this.defaultWaitBetweenOn}
                          .min=${0}
                          .max=${999}
                          .step=${1}
                          @value-changed=${(
                            event: CustomEvent<{ value: number; disabled?: boolean }>
                          ) => {
                            this.defaultWaitBetweenValue = event.detail.value;
                            this._handleSettingChange(
                              'defaultWaitBetweenValue',
                              event.detail.value
                            );
                            if (event.detail.disabled !== undefined) {
                              this.defaultWaitBetweenOn = !event.detail.disabled;
                              this._handleSettingChange(
                                'defaultWaitBetweenOn',
                                !event.detail.disabled
                              );
                            }
                          }}
                        ></t-dial>
                        <t-dial
                          label="Increment until"
                          unit="%"
                          show-disable-button
                          defaultValue="100"
                          .value=${this.defaultIncrementUntilValue}
                          .disabled=${!this.defaultIncrementUntilOn}
                          .min=${50}
                          .max=${200}
                          .step=${1}
                          @value-changed=${(
                            event: CustomEvent<{ value: number; disabled?: boolean }>
                          ) => {
                            this.defaultIncrementUntilValue = event.detail.value;
                            this._handleSettingChange(
                              'defaultIncrementUntilValue',
                              event.detail.value
                            );
                            if (event.detail.disabled !== undefined) {
                              this.defaultIncrementUntilOn = !event.detail.disabled;
                              this._handleSettingChange(
                                'defaultIncrementUntilOn',
                                !event.detail.disabled
                              );
                            }
                          }}
                        ></t-dial>
                        <t-dial
                          label="Nr loops"
                          unit=""
                          defaultValue="1"
                          .value=${this.defaultNrLoopsValue}
                          .disabled=${false}
                          .min=${1}
                          .max=${999}
                          .step=${1}
                          @value-changed=${(event: CustomEvent<{ value: number }>) => {
                            this.defaultNrLoopsValue = event.detail.value;
                            this._handleSettingChange('defaultNrLoopsValue', event.detail.value);
                          }}
                        ></t-dial>
                        <t-dial
                          label="Volume"
                          unit="%"
                          defaultValue="75"
                          .value=${this.defaultVolumeValue}
                          .disabled=${false}
                          .min=${0}
                          .max=${100}
                          .step=${1}
                          @value-changed=${(event: CustomEvent<{ value: number }>) => {
                            this.defaultVolumeValue = event.detail.value;
                            this._handleSettingChange('defaultVolumeValue', event.detail.value);
                          }}
                        ></t-dial>
                        <t-dial
                          label="Speed"
                          unit="%"
                          defaultValue="100"
                          .value=${this.defaultSpeedValue}
                          .disabled=${false}
                          .min=${25}
                          .max=${400}
                          .step=${5}
                          @value-changed=${(event: CustomEvent<{ value: number }>) => {
                            this.defaultSpeedValue = event.detail.value;
                            this._handleSettingChange('defaultSpeedValue', event.detail.value);
                          }}
                        ></t-dial>
                      </div>
                      <div class="setting-item" style="margin-top: 12px;">
                        <t-butt
                          toggle
                          ellipsis
                          .active=${this.defaultNrLoopsInfiniteOn}
                          @click=${() => {
                            this.defaultNrLoopsInfiniteOn = !this.defaultNrLoopsInfiniteOn;
                            this._handleSettingChange(
                              'defaultNrLoopsInfiniteOn',
                              this.defaultNrLoopsInfiniteOn
                            );
                          }}
                        >
                          Infinite loops default
                        </t-butt>
                      </div>
                    </div>
                  </details>
                </div>
              </details>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-current-song-controls': CurrentSongControls;
  }
}
