import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getManifest } from '../../utils/manifestHelper.js';
import '../atom/t-butt.js';

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
      padding: 10px;
      background-color: var(--item-background, rgba(255, 255, 255, 0.1));
      border-radius: 5px;
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

      .loop-buttons {
        grid-template-columns: repeat(10, minmax(0, 1fr));
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) visible = false;
  @property({ type: String }) versionNumber = '';
  @property({ type: String }) loopTimesValue = '1';
  @property({ type: Boolean }) enterUseTimer = false;
  @property({ type: Boolean }) enterResetCounter = false;
  @property({ type: Boolean }) enterGoToMarker = false;
  @property({ type: Boolean }) spaceUseTimer = false;
  @property({ type: Boolean }) spaceResetCounter = false;
  @property({ type: Boolean }) spaceGoToMarker = false;
  @property({ type: Boolean }) playUseTimer = false;
  @property({ type: Boolean }) playResetCounter = false;
  @property({ type: Boolean }) playGoToMarker = false;

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

  private _toggleSetting(setting: string, currentValue: boolean) {
    const nextValue = !currentValue;

    switch (setting) {
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

  render() {
    return html`
      <div class="panel-content">
        <div class="panel-header">
          <h2 class="panel-title">Settings</h2>
          <button class="close-button" @click=${this._handleClose}>×</button>
        </div>

        <div class="settings-section">
          <h3>Song Loop</h3>
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
                  @click=${() => this._toggleSetting('enterResetCounter', this.enterResetCounter)}
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
                  @click=${() => this._toggleSetting('spaceResetCounter', this.spaceResetCounter)}
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
                  @click=${() => this._toggleSetting('playResetCounter', this.playResetCounter)}
                >
                  Reset counter
                </t-butt>
              </div>
            </div>
          </div>
        </div>

        <div>Version: ${this.versionNumber}</div>
      </div>
    `;
  }
}
