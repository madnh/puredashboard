// <puredashboard-collapse> — an accordion / disclosure group (WAI-ARIA APG
// "Accordion"). Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is NOT a form control (no ElementInternals) — it's a disclosure widget.
// Each item is a header <button aria-expanded aria-controls> that toggles its
// own region <div role="region" aria-labelledby> (native buttons give Enter /
// Space for free). The header AND the region content are author CONTENT supplied
// via the `items` data. Both are interpolated at CHILD position through the
// reactive.js parts engine, so each accepts EITHER a string (auto-escaped — an
// untrusted string can't inject markup) OR a DOM node / nested `html` template /
// array — pass a node or template to embed a custom element (e.g. a
// <puredashboard-table>). Nodes/templates are NOT escaped: you build them, so you
// own their safety (see the trust boundary in `src/_agents.md`). Only the fixed
// chrome strings (the group aria-label) live in LABELS.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-collapse__<element>[--<modifier>]`. Script hooks are SEPARATE
// `js-…` classes / `data-*` attributes; don't style those.
//
// State model: two modes selected by `multiple`.
//   - multiple=false (default) → ACCORDION: at most one item open; `value` is the
//     single open key (string | undefined); opening one closes the others.
//   - multiple=true            → independent disclosures; `value` is an ARRAY of
//     open keys; each header toggles on its own.
// Toggling emits a bubbling "change" CustomEvent whose detail.value mirrors the
// current shape (a key, or an array of keys).
//
// Keyboard (APG "Accordion"): native buttons handle Enter / Space. Additionally
// ArrowDown / ArrowUp move focus to the next / previous ENABLED header (wrapping),
// and Home / End jump to the first / last enabled header. Focus moves only — it
// does NOT toggle (matches the APG recommendation). See docs/DEVELOPMENT.md.
import { Reactive, html, repeat } from "./reactive.js";

// All user-facing FIXED strings (English defaults). Override any subset via the
// `labels` property to localise — e.g. c.labels = { group: "Phần" }. The item
// headers/content themselves are CONTENT and come from `items`, not from here.
const LABELS = {
  group: "Sections",
};

let uid = 0;

// Rotating chevron indicator — inline, self-contained SVG (no shared icon module).
const chevron = html`<svg class="puredashboard-collapse__chevron" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

/**
 * An accordion / disclosure group following the WAI-ARIA APG "Accordion" pattern.
 * Each item renders a header `<button aria-expanded aria-controls>` that toggles a
 * `role="region"` panel (`aria-labelledby` the header, `hidden` when collapsed). A
 * rotating chevron indicates state. Both the header label and the panel content are
 * author strings rendered through escaped interpolation (XSS-safe). Configure via
 * JS properties.
 *
 * @element puredashboard-collapse
 *
 * @prop {Array} items - Item defs: `{ key: string, header: string|Node, content: string|Node, disabled?: boolean }`. `header`/`content` each accept a string (auto-escaped) OR a DOM node / nested `html` template / array — pass a node or template to embed a custom element (you build it, you own its safety; plain strings stay escaped).
 * @prop {boolean} multiple - When `false` (default) the group is an ACCORDION: at most one item open, opening one closes the rest. When `true`, items open/close independently.
 * @prop {(string|string[])} value - Open state. In accordion mode a single open key (or `undefined`); in `multiple` mode an array of open keys. Get/set.
 * @prop {Object} labels - Override UI strings. Keys: `group` (the group `aria-label`). Unset keys keep the English default.
 *
 * @fires change - Bubbling `CustomEvent`; `detail`: `{ value }` — the open key (accordion mode) or array of open keys (`multiple` mode). Fired when an item toggles.
 *
 * @cssprop [--pd-collapse-gap] - Gap between items (defaults to `--sp-2`).
 * @cssprop [--pd-collapse-pad]  - Header / panel padding (defaults to `--sp-3`).
 *
 * @example
 * const c = document.createElement("puredashboard-collapse");
 * c.items = [
 *   { key: "a", header: "Billing", content: "Manage your plan and invoices." },
 *   { key: "b", header: "Security", content: "Two-factor and sessions." },
 * ];
 * c.multiple = false;                 // accordion (default)
 * c.value = "a";                      // open "Billing"
 * c.addEventListener("change", (e) => console.log(e.detail.value));
 * container.append(c);
 */
class PuredashboardCollapse extends Reactive {
  static properties = {
    items: {}, multiple: {}, value: {}, labels: {},
  };

  constructor() {
    super();
    this._uid = ++uid;
  }

  // Reflect the declarative `multiple` boolean attribute into the property, so the
  // group can be configured the natural way: <puredashboard-collapse multiple>.
  static observedAttributes = ["multiple"];
  attributeChangedCallback(name, _old, val) {
    if (name === "multiple") this.multiple = val !== null;
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.on("click", "[data-key]", (e, el) => this._toggle(el.dataset.key));
    this.on("keydown", "[data-key]", (e, el) => this._onKeydown(e, el));
  }

  // Stable per-item element ids (for the aria-controls / aria-labelledby wiring).
  _headerId(key) { return `js-puredashboard-collapse__header-${this._uid}-${key}`; }
  _panelId(key) { return `js-puredashboard-collapse__panel-${this._uid}-${key}`; }

  _enabled() { return (this.items || []).filter((it) => it && !it.disabled); }

  // Is `key` currently open? Reads the value in whichever shape the mode uses.
  _isOpen(key) {
    if (this.multiple) return Array.isArray(this.value) && this.value.includes(key);
    return this.value === key;
  }

  _toggle(key) {
    const item = (this.items || []).find((it) => it && it.key === key);
    if (!item || item.disabled) return;
    const open = this._isOpen(key);
    if (this.multiple) {
      const cur = Array.isArray(this.value) ? this.value : [];
      this.value = open ? cur.filter((k) => k !== key) : [...cur, key];
    } else {
      // accordion: opening a closed item makes it the sole open key; clicking the
      // open one closes it (leaving none open).
      this.value = open ? undefined : key;
    }
    this.emit("change", { value: this.value });
  }

  // APG "Accordion" header navigation: Arrow moves focus between enabled headers
  // (wrapping); Home/End jump to first/last. Focus only — no toggle.
  _onKeydown(e, el) {
    const enabled = this._enabled();
    if (!enabled.length) return;
    const cur = el.dataset.key;
    let idx = enabled.findIndex((it) => it.key === cur);
    if (idx < 0) idx = 0;
    let next = null;
    switch (e.key) {
      case "ArrowDown": next = enabled[(idx + 1) % enabled.length]; break;
      case "ArrowUp":   next = enabled[(idx - 1 + enabled.length) % enabled.length]; break;
      case "Home": next = enabled[0]; break;
      case "End":  next = enabled[enabled.length - 1]; break;
      default: return;
    }
    e.preventDefault();
    if (next) this.$(`[data-key="${next.key}"]`)?.focus();
  }

  render() {
    const items = this.items || [];
    return html`<div class="puredashboard-collapse__group" role="presentation" aria-label="${this._label("group")}">
      ${repeat(items, (it) => it.key, (it) => {
        const open = this._isOpen(it.key);
        const disabled = !!it.disabled;
        const headerId = this._headerId(it.key);
        const panelId = this._panelId(it.key);
        return html`<div class="puredashboard-collapse__item ${open ? "puredashboard-collapse__item--open" : ""} ${disabled ? "puredashboard-collapse__item--disabled" : ""}">
          <h3 class="puredashboard-collapse__heading">
            <button type="button" class="puredashboard-collapse__header" id="${headerId}" data-key="${it.key}" aria-expanded="${open ? "true" : "false"}" aria-controls="${panelId}" ?disabled="${disabled}"><span class="puredashboard-collapse__label">${it.header}</span>${chevron}</button>
          </h3>
          <div class="puredashboard-collapse__panel" id="${panelId}" role="region" aria-labelledby="${headerId}" ?hidden="${!open}"><div class="puredashboard-collapse__content">${it.content}</div></div>
        </div>`;
      })}
    </div>`;
  }
}
PuredashboardCollapse.define("puredashboard-collapse");

export { PuredashboardCollapse };
