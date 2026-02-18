import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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

    /* Responsive design */
    @media (max-width: 768px) {
      .panel-content {
        padding: 15px;
      }

      .settings-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) visible = false;

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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

  private _handleSettingChange(setting: string, value: any) {
    this.dispatchEvent(
      new CustomEvent('setting-changed', {
        detail: { setting, value },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="panel-content">
        <div class="panel-header">
          <h2 class="panel-title">Settings</h2>
          <button class="close-button" @click=${this._handleClose}>×</button>
        </div>
        <span>To be implemented...</span>

        <!--div class="settings-section">
          <h3>Audio Settings</h3>
          <div class="settings-grid">
            <div class="setting-item">
              <span class="setting-label">Volume</span>
              <div class="setting-value">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value="75"
                  @change=${(e: Event) =>
          this._handleSettingChange('volume', (e.target as HTMLInputElement).value)}
                />
                <span>75%</span>
              </div>
            </div>
            <div class="setting-item">
              <span class="setting-label">Loop Mode</span>
              <div class="setting-value">
                <t-butt toggle>Enabled</t-butt>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Display Settings</h3>
          <div class="settings-grid">
            <div class="setting-item">
              <span class="setting-label">Theme</span>
              <div class="setting-value">
                <select
                  @change=${(e: Event) =>
          this._handleSettingChange('theme', (e.target as HTMLSelectElement).value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
            </div>
            <div class="setting-item">
              <span class="setting-label">Show Markers</span>
              <div class="setting-value">
                <t-butt toggle active>Enabled</t-butt>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Practice Settings</h3>
          <div class="settings-grid">
            <div class="setting-item">
              <span class="setting-label">Default Tempo</span>
              <div class="setting-value">
                <input
                  type="number"
                  min="40"
                  max="200"
                  value="120"
                  @change=${(e: Event) =>
          this._handleSettingChange('tempo', (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>
            <div class="setting-item">
              <span class="setting-label">Metronome</span>
              <div class="setting-value">
                <t-butt toggle>Enabled</t-butt>
              </div>
            </div>
          </div>
        </div>

        <div-- class="settings-section">
          <h3>Actions</h3>
          <div class="settings-grid">
            <div class="setting-item">
              <t-butt @click=${() => this._handleSettingChange('reset', 'all')}
                >Reset All Settings</t-butt
              >
            </div>
            <div class="setting-item">
              <t-butt @click=${() => this._handleSettingChange('export', 'settings')}
                >Export Settings</t-butt
              >
            </div>
          </div>
        </div-->
      </div>
    `;
  }
}
