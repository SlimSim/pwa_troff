import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../atom/t-butt.js';
import '../atom/t-icon.js';
import '../atom/t-input.js';
import '../atom/t-dropdown-button.js';

/**
 * Reusable action buttons for headers: add, sort, find, search, edit.
 *
 * Parent manages all state and event handlers.
 * The `isSearchFocused` prop drives CSS classes for mobile collapse.
 *
 * @slot sort – Place a `t-dropdown-button` here for sort controls.
 */
@customElement('t-header-actions')
export class HeaderActions extends LitElement {
  static styles = css`
    :host {
      display: block;
      flex: 0 1 auto;
      min-width: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      transition: gap 0.2s ease;
    }

    /* Mobile: when search is collapsed (narrow), constrain the right area
       so the buttons wrap to 2 rows much sooner */
    .header-actions.narrow:not(.search-expanded) {
      max-width: 90px;
    }

    .header-actions.search-expanded {
      max-width: 120px;
    }

    .header-actions.search-expanded {
      gap: 0;
    }

    /* Search compact input */
    .search-compact-wrap {
      position: relative;
      display: flex;
      align-items: center;
      overflow: hidden;
      transition: none;
      width: 42px;
      flex-shrink: 0;
    }

    .search-compact-wrap.search-expanded {
      transition: width 0.3s ease;
      width: 120px;
      flex-shrink: 1;
    }

    .search-compact-wrap.search-expanded .search-compact-icon {
      opacity: 0;
    }

    .search-compact-wrap:not(.search-expanded) .search-input {
      --t-input-placeholder-color: transparent;
      --t-input-clearable-padding-right: 0px;
    }

    .search-compact-icon {
      position: absolute;
      z-index: 1;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 18px;
      height: 18px;
      color: var(--on-gray-out, #595959);
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .search-input {
      display: block;
      width: 100%;
      --t-input-slim-height: 35px;
      --t-input-border: 2px solid var(--regular-button-color, #b0bec5);
    }

    /* Buttons that collapse when search is focused */
    .action-btn {
      flex-shrink: 0;
      transition:
        opacity 0.2s ease,
        width 0.2s ease,
        margin 0.2s ease;
    }

    .action-btn.search-expanded {
      opacity: 0;
      width: 0;
      margin: 0;
      overflow: hidden;
      pointer-events: none;
    }

    /* Hide sort slot when search is expanded on mobile */
    .header-actions.search-expanded > slot[name='sort'] {
      display: none;
    }

    /* Desktop: search always expanded, buttons always visible */
    @media (min-width: 576px) {
      .header-actions:not(.search-expanded),
      .header-actions.search-expanded {
        max-width: none;
      }
      .header-actions.narrow:not(.search-expanded) {
        max-width: none;
      }

      .header-actions.search-expanded {
        gap: 6px;
      }

      .search-compact-wrap {
        width: 200px;
      }

      .search-compact-wrap.search-expanded {
        width: 200px;
      }

      .search-compact-icon {
        display: none;
      }

      .search-compact-wrap:not(.search-expanded) .search-input {
        --t-input-placeholder-color: var(--on-gray-out, #595959);
        --t-input-clearable-padding-right: 40px;
      }

      .action-btn.search-expanded {
        opacity: 1;
        width: auto;
        margin: initial;
        overflow: visible;
        pointer-events: auto;
      }

      .header-actions.search-expanded > slot[name='sort'] {
        display: contents;
      }
    }
  `;

  /** Icon name for the add button. If empty, the add button is hidden. */
  @property({ type: String }) addIcon = '';

  /** Title/tooltip for the add button. */
  @property({ type: String }) addTitle = 'Add';

  /** Show the "find songs" button. */
  @property({ type: Boolean }) showFind = false;

  /** Show the edit button. */
  @property({ type: Boolean }) showEdit = false;

  /** Title/tooltip for the edit button. */
  @property({ type: String }) editTitle = 'Edit';

  /** Placeholder text for the search input. */
  @property({ type: String }) searchPlaceholder = 'Search…';

  /** Current search value. */
  @property({ type: String }) searchValue = '';

  /** Whether the search input is focused (drives mobile button collapse). */
  @property({ type: Boolean, reflect: true }) isSearchFocused = false;

  @property({ type: Boolean }) narrow = false;

  render() {
    const cls =
      `${this.isSearchFocused ? 'search-expanded' : ''} ${this.narrow ? 'narrow' : ''}`.trim();

    return html`
      <div class="header-actions ${cls}">
        <!-- Add button -->
        ${this.addIcon
          ? html`
              <t-butt
                class="action-btn ${cls}"
                icon
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('add-click', { bubbles: true, composed: true })
                  )}
                title=${this.addTitle}
              >
                <t-icon name=${this.addIcon}></t-icon>
              </t-butt>
            `
          : ''}

        <!-- Sort (slot) -->
        <slot name="sort"></slot>

        <!-- Find button -->
        ${this.showFind
          ? html`
              <t-butt
                class="action-btn ${cls}"
                icon
                href="/find.html"
                target="_blank"
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('find-click', { bubbles: true, composed: true })
                  )}
                title="Find new songs!"
              >
                <t-icon name="note-search"></t-icon>
              </t-butt>
            `
          : ''}

        <!-- Search input -->
        <div class="search-compact-wrap ${cls}">
          <t-icon class="search-compact-icon" name="search" aria-hidden="true"></t-icon>
          <t-input
            class="search-input"
            slim
            clearable
            placeholder=${this.searchPlaceholder}
            aria-label=${this.searchPlaceholder}
            .value=${this.searchValue}
            @input=${(e: Event) => {
              const target = e.target as HTMLInputElement;
              this.dispatchEvent(
                new CustomEvent('search-input', {
                  detail: { value: target.value },
                  bubbles: true,
                  composed: true,
                })
              );
            }}
            @keydown=${(e: KeyboardEvent) =>
              this.dispatchEvent(
                new CustomEvent('search-keydown', {
                  detail: { key: e.key, originalEvent: e },
                  bubbles: true,
                  composed: true,
                })
              )}
            @focus=${() =>
              this.dispatchEvent(
                new CustomEvent('search-focus', { bubbles: true, composed: true })
              )}
            @blur=${() =>
              this.dispatchEvent(new CustomEvent('search-blur', { bubbles: true, composed: true }))}
          ></t-input>
        </div>

        <!-- Edit button -->
        ${this.showEdit
          ? html`
              <t-butt
                class="action-btn ${cls}"
                icon
                @click=${() =>
                  this.dispatchEvent(
                    new CustomEvent('edit-click', { bubbles: true, composed: true })
                  )}
                title=${this.editTitle}
              >
                <t-icon name="edit"></t-icon>
              </t-butt>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    't-header-actions': HeaderActions;
  }
}
