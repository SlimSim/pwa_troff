import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getManifest } from '../../utils/manifestHelper.js';
import '../atom/t-butt.js';
import '../atom/t-slide-stepper.js';
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

@customElement('t-settings-panel')
export class SettingsPanel extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      bottom: -100%;
      left: 0;
      right: 0;
      background-color: var(--tertiary-color);
      color: var(--on-tertiary-color);
      z-index: 999;
      transition: transform 0.3s ease-in-out;
      height: 100%;
      overflow-y: auto;
      box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
    }

    :host([visible]) {
      transform: translateY(-100%);
    }

    .panel-content {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color, #333);
    }

    .panel-title {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--text-color, #000);
    }

    .close-button {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-color, #000);
      padding: 5px;
    }

    .settings-section {
      margin-bottom: 20px;
    }

    .settings-shell {
      display: grid;
      gap: 16px;
    }

    .settings-group {
      padding: 14px;
      border-radius: 10px;
      background-color: var(--item-background, rgba(255, 255, 255, 0.1));
      border: 1px solid var(--border-color, #333);
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

    .settings-section h3 {
      margin-bottom: 10px;
      color: var(--text-color, #000);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
    }

    .loop-buttons t-butt {
      width: 100%;
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

    .song-stepper-grid t-slide-stepper {
      min-width: 0;
    }

    .setting-item.song-stepper-item {
      align-items: stretch;
      justify-content: stretch;
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

    /* Responsive design */
    @media (min-width: 576px) {
      .panel-content {
        padding: 15px;
      }

      .settings-grid {
        grid-template-columns: 1fr;
      }

      .action-buttons {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .song-action-buttons {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .loop-buttons {
        grid-template-columns: repeat(10, minmax(0, 1fr));
      }
    }

    /* Hide Current Song controls in settings panel on wide screens — sidebar takes over */
    @media (min-width: 768px) {
      :host t-current-song-controls {
        display: none;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) visible = false;
  @property({ type: String }) versionNumber = '';
  @property({ type: Boolean }) signedIn = false;
  @property({ type: String }) userName = '';

  // Current Song Controls - forwarded to t-current-song-controls (for mobile settings panel)
  @property({ type: String }) loopTimesValue = '1';
  @property({ type: Boolean }) playFullSong = false;
  @property({ type: Number }) startBeforeValue = 0;
  @property({ type: Boolean }) startBeforeDisabled = false;
  @property({ type: Number }) stopAfterValue = 0;
  @property({ type: Boolean }) stopAfterDisabled = false;
  @property({ type: Number }) incrementUntillValue = 0;
  @property({ type: Boolean }) incrementUntillDisabled = false;

  // Global default song values (for advanced panel)
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

  // Global controls (app-wide settings)
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

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  async firstUpdated() {
    try {
      const manifest = await getManifest();
      console.log(manifest.version);
      this.versionNumber = manifest.version;
    } catch (error) {
      console.error('Failed to fetch manifest version:', error);
      this.versionNumber = 'Unknown';
    }

    const asdfStepper = this.renderRoot?.querySelector('#asdf');
    asdfStepper?.addEventListener('value-changed', (event: Event) => {
      const customEvent = event as CustomEvent<{ value: number; disabled?: boolean }>;
      console.log('asdf value:', customEvent.detail.value);
    });
  }

  private _handleSignInClick() {
    this.dispatchEvent(
      new CustomEvent('sign-in-requested', {
        detail: { action: this.signedIn ? 'sign-out' : 'sign-in' },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _handleClose() {
    this.visible = false;
    this.dispatchEvent(
      new CustomEvent('settings-panel-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

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
    console.log('_setSongNumericSetting: Setting', setting, 'Value:', value, 'Disabled:', disabled);
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

  private _handleCurrentSongSettingChange(event: CustomEvent) {
    const { setting, value } = event.detail;
    // Forward the event from t-current-song-controls
    this._handleSettingChange(setting, value);
  }

  private _handleCurrentSongAction(event: CustomEvent) {
    const { action } = event.detail;
    this._handleSongAction(action);
  }

  render() {
    return html`
      <div class="panel-content">
        <div class="panel-header">
          <h2 class="panel-title">Settings</h2>
          <div style="display:flex; gap:8px; align-items:center;">
            ${this.signedIn
              ? html`<span
                  style="font-size:0.9rem; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                  >${this.userName || 'Signed in'}</span
                >`
              : ''}
            <t-butt @click=${this._handleSignInClick}>
              ${this.signedIn ? 'Sign out' : 'Sign in'}
            </t-butt>
            <button class="close-button" @click=${this._handleClose}>×</button>
          </div>
        </div>

        <div class="settings-shell">
          <!-- Current Song Controls - now using the shared component -->
          <t-current-song-controls
            id="settingsCurrentSongControls"
            hideGlobalControls
            .loopTimesValue=${this.loopTimesValue}
            .playFullSong=${this.playFullSong}
            .startBeforeValue=${this.startBeforeValue}
            .startBeforeDisabled=${this.startBeforeDisabled}
            .stopAfterValue=${this.stopAfterValue}
            .stopAfterDisabled=${this.stopAfterDisabled}
            .incrementUntillValue=${this.incrementUntillValue}
            .incrementUntillDisabled=${this.incrementUntillDisabled}
            @setting-changed=${this._handleCurrentSongSettingChange}
            @song-action-requested=${this._handleCurrentSongAction}
          ></t-current-song-controls>

          <div class="settings-section" style="margin-top: 16px;">
            <t-help-tip h3="Global Controls">
              These key and button behaviors apply across Troff, not just this song.
            </t-help-tip>
          </div>
          <details class="advanced-panel">
            <summary class="advanced-summary">
              <div class="advanced-summary-copy">
                <p class="advanced-summary-title">Behaviour of keys and buttons</p>
                <p class="advanced-summary-text">
                  Configure what happens when you press the Enter key, Space key, or Play button.
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
                        @click=${() => this._toggleSetting('enterGoToMarker', this.enterGoToMarker)}
                      >
                        Go to marker
                      </t-butt>
                      <t-butt
                        toggle
                        ellipsis
                        .active=${this.enterUseTimer}
                        @click=${() => this._toggleSetting('enterUseTimer', this.enterUseTimer)}
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
                        @click=${() => this._toggleSetting('spaceGoToMarker', this.spaceGoToMarker)}
                      >
                        Go to marker
                      </t-butt>
                      <t-butt
                        toggle
                        ellipsis
                        .active=${this.spaceUseTimer}
                        @click=${() => this._toggleSetting('spaceUseTimer', this.spaceUseTimer)}
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
                        @click=${() => this._toggleSetting('playGoToMarker', this.playGoToMarker)}
                      >
                        Go to marker
                      </t-butt>
                      <t-butt
                        toggle
                        ellipsis
                        .active=${this.playUseTimer}
                        @click=${() => this._toggleSetting('playUseTimer', this.playUseTimer)}
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
                        this._toggleSetting('extendedMarkerColor', this.extendedMarkerColor)}
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
                  @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) => {
                    this.defaultStartBeforeValue = event.detail.value;
                    this._handleSettingChange('defaultStartBeforeValue', event.detail.value);
                    if (event.detail.disabled !== undefined) {
                      this.defaultStartBeforeOn = !event.detail.disabled;
                      this._handleSettingChange('defaultStartBeforeOn', !event.detail.disabled);
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
                  @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) => {
                    this.defaultStopAfterValue = event.detail.value;
                    this._handleSettingChange('defaultStopAfterValue', event.detail.value);
                    if (event.detail.disabled !== undefined) {
                      this.defaultStopAfterOn = !event.detail.disabled;
                      this._handleSettingChange('defaultStopAfterOn', !event.detail.disabled);
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
                  @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) => {
                    this.defaultPauseBeforeValue = event.detail.value;
                    this._handleSettingChange('defaultPauseBeforeValue', event.detail.value);
                    if (event.detail.disabled !== undefined) {
                      this.defaultPauseBeforeOn = !event.detail.disabled;
                      this._handleSettingChange('defaultPauseBeforeOn', !event.detail.disabled);
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
                  @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) => {
                    this.defaultWaitBetweenValue = event.detail.value;
                    this._handleSettingChange('defaultWaitBetweenValue', event.detail.value);
                    if (event.detail.disabled !== undefined) {
                      this.defaultWaitBetweenOn = !event.detail.disabled;
                      this._handleSettingChange('defaultWaitBetweenOn', !event.detail.disabled);
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
                  @value-changed=${(event: CustomEvent<{ value: number; disabled?: boolean }>) => {
                    this.defaultIncrementUntilValue = event.detail.value;
                    this._handleSettingChange('defaultIncrementUntilValue', event.detail.value);
                    if (event.detail.disabled !== undefined) {
                      this.defaultIncrementUntilOn = !event.detail.disabled;
                      this._handleSettingChange('defaultIncrementUntilOn', !event.detail.disabled);
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

        <div style="margin-top: 16px;">
          <span class="scope-badge">Version: ${this.versionNumber}</span>
        </div>
      </div>
    `;
  }
}
