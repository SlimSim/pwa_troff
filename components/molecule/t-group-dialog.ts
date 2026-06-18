/**
 * Group edit dialog (V2).
 *
 * A modal overlay for editing a group's name, info, icon, color, and owners.
 * Song management is done directly in the group detail view.
 * Does NOT import Firebase — all persistence is handled by the parent via events.
 *
 * Events (bubbles, composed):
 *   - `group-saved`: detail = { group: TroffFirebaseGroupIdentifyer }
 *   - `group-deleted`: detail = { groupId: string }
 *   - `dialog-cancelled`: no detail
 */

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../atom/t-input.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-color-picker.js';
import '../atom/t-icon-picker.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.d.js';

@customElement('t-group-dialog')
export class GroupDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* Overlay */
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .overlay.open {
      display: flex;
    }

    /* Dialog box */
    .dialog {
      background: var(--on-theme-color, #fff);
      color: var(--theme-color, #000);
      border-radius: 8px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .dialog-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .dialog-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    }

    .dialog-footer {
      display: flex;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    /* Section labels */
    .section-label {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
      opacity: 0.8;
    }

    /* Owners section */
    .owner-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .owner-row t-input {
      flex: 1;
    }

    .add-owner-btn {
      margin-top: 4px;
    }

    /* Empty state */
    .empty-text {
      font-size: 0.85rem;
      opacity: 0.6;
      font-style: italic;
    }

    /* Buttons */
    .btn-danger {
      --butt-bg-color: var(--accent-color-2, #dd2c00);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  /** The group being edited. When `null`, a new group is being created. */
  @property({ type: Object }) group: TroffFirebaseGroupIdentifyer | null = null;

  // ── Internal editing state (cloned from `group` when opened) ───────────────

  @state() private _editName = '';
  @state() private _editInfo = '';
  @state() private _editColor = '';
  @state() private _editIcon = '';
  @state() private _editOwners: string[] = [];

  /** Whether this group has a Firebase backing. */
  private get _isFirebaseGroup(): boolean {
    return !!this.group?.firebaseGroupDocId;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('open') && this.open) {
      this._cloneGroupForEditing();
    }
  }

  private _cloneGroupForEditing() {
    const g = this.group;
    this._editName = g?.name ?? '';
    this._editInfo = g?.info ?? '';
    this._editColor = g?.color ?? '';
    this._editIcon = g?.icon ?? '';
    this._editOwners = g?.owners ? [...g.owners] : [];
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private _handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this._cancel();
    }
  }

  private _cancel() {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('dialog-cancelled', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private _save() {
    // Preserve original songs (song management is done in the group detail view)
    const updatedGroup: TroffFirebaseGroupIdentifyer = {
      name: this._editName,
      info: this._editInfo,
      color: this._editColor,
      icon: this._editIcon,
      owners: this._editOwners,
      songs: this.group?.songs ?? [],
      firebaseGroupDocId: this.group?.firebaseGroupDocId,
      id: this.group?.id,
    };

    this.open = false;
    this.dispatchEvent(
      new CustomEvent('group-saved', {
        detail: { group: updatedGroup },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _delete() {
    if (!this.group) return;

    const groupId = String(this.group.firebaseGroupDocId ?? this.group.id ?? '');
    if (!groupId) return;

    this.open = false;
    this.dispatchEvent(
      new CustomEvent('group-deleted', {
        detail: { groupId, group: this.group },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Name handler ───────────────────────────────────────────────────────────

  private _handleNameInput(event: CustomEvent) {
    // Only accept the custom event from t-input (has detail.value);
    // ignore the native InputEvent that also bubbles through the shadow DOM.
    if (event.detail && typeof event.detail.value === 'string') {
      this._editName = event.detail.value;
    }
  }

  // ── Icon handler ───────────────────────────────────────────────────────────

  private _handleIconChange(event: CustomEvent) {
    this._editIcon = event.detail.value ?? '';
  }

  // ── Info handler ───────────────────────────────────────────────────────────

  private _handleInfoInput(event: Event) {
    const target = event.target as HTMLTextAreaElement | null;
    this._editInfo = target?.value ?? '';
  }

  // ── Owners handlers ────────────────────────────────────────────────────────

  private _handleOwnerInput(index: number, event: CustomEvent) {
    if (event.detail && typeof event.detail.value === 'string') {
      this._editOwners = [
        ...this._editOwners.slice(0, index),
        event.detail.value,
        ...this._editOwners.slice(index + 1),
      ];
    }
  }

  private _addOwner() {
    this._editOwners = [...this._editOwners, ''];
  }

  private _removeOwner(index: number) {
    this._editOwners = this._editOwners.filter((_, i) => i !== index);
  }

  // ── Color handler ──────────────────────────────────────────────────────────

  private _handleColorChange(event: CustomEvent) {
    this._editColor = event.detail.value;
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  private _renderOwners() {
    return html`
      <div>
        <div class="section-label">Owners (email addresses)</div>
        ${this._editOwners.length === 0
          ? html`<div class="empty-text">No owners yet</div>`
          : ''}
        ${this._editOwners.map(
          (owner, i) => html`
            <div class="owner-row">
              <t-input
                type="email"
                .value=${owner}
                placeholder="email@example.com"
                slim
                @input=${(e: CustomEvent) => this._handleOwnerInput(i, e)}
              ></t-input>
              <t-butt icon @click=${() => this._removeOwner(i)} title="Remove owner">
                <t-icon name="delete"></t-icon>
              </t-butt>
            </div>
          `
        )}
        <t-butt class="add-owner-btn" @click=${this._addOwner} title="Add owner">
          + Add owner
        </t-butt>
      </div>
    `;
  }

  private _renderColorPicker() {
    return html`
      <t-color-picker
        label="Group color"
        .value=${this._editColor}
        @change=${this._handleColorChange}
      ></t-color-picker>
    `;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div class="overlay ${this.open ? 'open' : ''}" @click=${this._handleOverlayClick}>
        <div class="dialog">
          <div class="dialog-header">
            <h2 class="dialog-title">${this.group ? `Edit "${this.group.name}"` : 'New Group'}</h2>
            <t-butt icon @click=${this._cancel} title="Close">
              <t-icon name="delete"></t-icon>
            </t-butt>
          </div>

          <div class="dialog-body">
            <!-- Name -->
            <t-input
              .value=${this._editName}
              label="Group name"
              placeholder="My Group"
              @input=${this._handleNameInput}
            ></t-input>

            <!-- Info -->
            <div>
              <div class="section-label">Info</div>
              <textarea
                style="width: 100%; min-height: 60px; padding: 8px; border: 1px solid rgba(0,0,0,0.2); border-radius: 4px; font-family: sans-serif; font-size: 0.9rem; box-sizing: border-box; background: var(--text-area, lightblue); color: var(--on-text-area, inherit);"
                .value=${this._editInfo}
                placeholder="Optional description..."
                @input=${this._handleInfoInput}
              ></textarea>
            </div>

            <!-- Icon -->
            <t-icon-picker
              .value=${this._editIcon}
              label="Group icon"
              @change=${this._handleIconChange}
            ></t-icon-picker>

            <!-- Owners -->
            ${this._isFirebaseGroup ? this._renderOwners() : ''}

            <!-- Color -->
            ${this._renderColorPicker()}
          </div>

          <div class="dialog-footer">
            ${this.group
              ? html`
                  <t-butt
                    class="btn-danger"
                    @click=${this._delete}
                    title="Delete group"
                  >
                    Delete group
                  </t-butt>
                `
              : ''}
            <t-butt @click=${this._cancel}>Cancel</t-butt>
            <t-butt @click=${this._save}>Save</t-butt>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-group-dialog': GroupDialog;
  }
}
