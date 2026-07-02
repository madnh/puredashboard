// <puredashboard-combobox> — a form-associated, editable single-select combobox
// (a text input with a filterable listbox popup). Zero-dep, no build, CSP-safe.
// Built on the Reactive base.
//
// This is input.js / select.js specialised to the WAI-ARIA APG "Combobox" pattern
// (editable, with listbox popup, manual selection). Unlike <puredashboard-select>
// (a real native <select> — the lowest-risk accessible choice) this control is the
// SEARCHABLE/FILTERABLE sibling that native HTML has no equivalent for: a text
// <input role="combobox"> whose typing filters a rendered role="listbox" of
// role="option" items. It therefore OWNS its popup and keyboard model by hand.
//
// Two invariants worth calling out:
//   1) The popup lives in the TOP LAYER via the Popover API (popover="manual"), so it
//      escapes overflow:hidden / z-index-stacked ancestors, with a fixed/high-z
//      fallback (mirrors menu.js) where Popover is unavailable. Light-dismiss on
//      outside pointerdown is wired by hand (manual popover has no auto-dismiss).
//   2) Per APG, keyboard focus STAYS in the text input the whole time. The "active"
//      option is tracked purely via aria-activedescendant (pointing at the option's
//      id) and a visual highlight class — options never receive DOM focus. Enter
//      commits the active option; typing filters; Escape closes (2nd Escape clears).
//
// Option labels are author CONTENT (from the `options` data / a custom typed value),
// so they render through the ESCAPING reactive html`` — never raw()/innerHTML. Only
// the FIXED UI string (the "no results" row) lives in LABELS and is `labels`-overridable.
//
// Class naming (BEM, block = the tag): every style class is `puredashboard-combobox__…`;
// script hooks are SEPARATE `js-…` classes. Themed through the shared design tokens
// (--panel/--panel-2/--panel-3, --border, --text, --muted, --accent, --focus-ring,
// --radius, --control-height-*, --control-pad-x, --shadow-2, --danger-bg, --z-dropdown,
// --disabled-opacity) via a --pd-* fallback chain, so it looks right with NO theme
// linked. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat } from "./reactive.js";

// All FIXED user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. cb.labels = { noResults: "Không có" }.
// Function-valued keys interpolate. NB: option labels and the placeholder are author
// CONTENT (from `options` / the `placeholder` property), NOT fixed strings.
const LABELS = {
  noResults: "No results",
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated, editable single-select combobox: a text `<input role="combobox">`
 * paired with a filterable `role="listbox"` popup, implementing the WAI-ARIA APG
 * "Combobox (editable, with listbox popup, manual selection)" pattern. Typing filters
 * the options (case-insensitive substring on their labels) and opens the list;
 * Arrow/Home/End move the active option via `aria-activedescendant` (keyboard focus
 * stays in the input, options never receive DOM focus); Enter commits the active
 * option; Escape closes, and a second Escape clears; Tab closes and commits any active
 * option. The popup renders in the top layer via the Popover API (fixed/high-z
 * fallback), so it escapes clipping ancestors, with light-dismiss on outside click.
 *
 * The visible input text shows the SELECTED option's label (or, with `allowCustom`, the
 * raw typed value); the underlying form value (submitted under `name`) is the option
 * `value`. Participates in a surrounding `<form>` natively via `ElementInternals` —
 * submits and validates like a built-in field. Configure via JS properties.
 *
 * @element puredashboard-combobox
 *
 * @prop {Array<{value:string,label:string,disabled?:boolean}>|string[]} options - The choices. A plain `string[]` is accepted too (then `value === label`). Default `[]`.
 * @prop {string}  value       - Current selected value (get/set); the underlying option `value` (or the custom string when `allowCustom`). Default `""`.
 * @prop {string}  placeholder - Placeholder text for the empty input. Default `""`.
 * @prop {boolean} disabled    - Disable the control. Default `false`.
 * @prop {boolean} required    - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {boolean} allowCustom - If `true`, a typed value with no matching option is accepted as the value (free text). Default `false`.
 * @prop {string}  error       - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels      - Override UI strings. Keys: `noResults`, `required`. Unset keys keep the English default.
 * @attr {string}  name        - Field name for native `<form>` submission (on the host).
 *
 * @fires change - Bubbling `CustomEvent` fired on commit (selecting an option or, with `allowCustom`, committing free text). `detail.value` is the newly committed value.
 *
 * @method focus - `focus() => void` — focus the text input.
 *
 * @cssprop [--pd-combobox-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-combobox-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const cb = document.createElement("puredashboard-combobox");
 * cb.options = [{ value: "us", label: "United States" }, { value: "vn", label: "Vietnam" }];
 * cb.placeholder = "Search a country"; cb.required = true;
 * cb.setAttribute("name", "country");
 * cb.addEventListener("change", (e) => console.log(e.detail.value));
 * form.append(cb);
 */
class PuredashboardCombobox extends Reactive {
  static formAssociated = true;
  static properties = {
    options: {}, value: {}, placeholder: {}, disabled: {}, required: {},
    allowCustom: {}, error: {}, labels: {},
    // Internal reactive state (not part of the public API): whether the popup is
    // open, the current filter query, and the active option index (-1 = none).
    _open: {}, _query: {}, _active: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    const n = ++uid;
    this._errId = `js-puredashboard-combobox__error-${n}`;
    this._listId = `js-puredashboard-combobox__list-${n}`;
    this._optId = (i) => `js-puredashboard-combobox__opt-${n}-${i}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control can be
  // configured the natural way inside a form — <puredashboard-combobox required name="x">
  // — not only via JS. Boolean attrs map by presence. (`options` are data, set via the
  // property, not an attribute.)
  static observedAttributes = ["value", "placeholder", "disabled", "required", "name"];
  attributeChangedCallback(name, _old, val) {
    if (name === "name") { this.requestUpdate(); return; } // used only for form submission
    const bool = name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // Normalise `options` into {value,label,disabled} objects, accepting a plain string[]
  // where value === label. Everything else coerces to a string.
  _options() {
    const list = Array.isArray(this.options) ? this.options : [];
    return list.map((o) => {
      if (o != null && typeof o === "object") {
        const value = String(o.value ?? "");
        return { value, label: String(o.label ?? value), disabled: !!o.disabled };
      }
      const s = String(o ?? "");
      return { value: s, label: s, disabled: false };
    });
  }

  // The option currently matching `value`, if any.
  _selected() { return this._options().find((o) => o.value === this.value) || null; }

  // The visible input text: the filter query while the list is open (the user is
  // typing), else the selected option's label, else (allowCustom) the raw value.
  _display() {
    if (this._open) return this._query ?? "";
    const sel = this._selected();
    if (sel) return sel.label;
    return this.allowCustom ? (this.value ?? "") : "";
  }

  // Options filtered by the current query (case-insensitive substring on the label).
  // An empty query shows every option.
  _filtered() {
    const q = (this._query ?? "").trim().toLowerCase();
    const all = this._options();
    if (!q) return all;
    return all.filter((o) => o.label.toLowerCase().includes(q));
  }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    if (this.options == null) this.options = [];
    if (this._open == null) this._open = false;
    if (this._query == null) this._query = "";
    if (this._active == null) this._active = -1;
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; this._close(); }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-combobox__input")?.focus(); }

  _input() { return this.$(".js-puredashboard-combobox__input"); }

  // ---- open / close (top-layer popup) --------------------------------------
  // Show the popup in the top layer via the Popover API (popover="manual", so we own
  // dismissal), with a fixed/high-z fallback where Popover is unavailable (mirrors
  // menu.js). Light-dismiss is wired by hand on document pointerdown.
  _open_() {
    if (this._open || this.disabled) return;
    this._query = ""; this._active = -1; this._open = true;
    document.addEventListener("pointerdown", this._onOutside, true);
  }
  _close() {
    if (!this._open) return;
    this._open = false; this._active = -1;
    document.removeEventListener("pointerdown", this._onOutside, true);
    const list = this.$(".js-puredashboard-combobox__list");
    try { if (list && list.matches && list.matches(":popover-open") && list.hidePopover) list.hidePopover(); } catch { /* */ }
  }
  _onOutside = (e) => { if (!this.contains(e.target)) { this._close(); this.requestUpdate(); } };

  // ---- selection / commit --------------------------------------------------
  // Commit an option: set the value, fill the input with its label, close, and emit
  // `change` when the value actually changed.
  _commit(o) {
    if (!o || o.disabled) return;
    const changed = this.value !== o.value;
    this.value = o.value;
    this._close();
    if (changed) this.emit("change", { value: o.value });
  }

  // Commit whatever the input currently holds. With an active option, commit it. Else,
  // an exact (case-insensitive) label match commits that option; otherwise allowCustom
  // takes the raw typed text as the value, and without it the input reverts to the
  // prior selection. Used on Enter and on Tab.
  _commitCurrent() {
    const list = this._filtered();
    if (this._active >= 0 && list[this._active]) { this._commit(list[this._active]); return; }
    const q = (this._query ?? "").trim();
    if (this._open && q) {
      const exact = this._options().find((o) => o.label.toLowerCase() === q.toLowerCase() && !o.disabled);
      if (exact) { this._commit(exact); return; }
      if (this.allowCustom) {
        const changed = this.value !== q;
        this.value = q; this._close();
        if (changed) this.emit("change", { value: q });
        return;
      }
    }
    this._close();
  }

  // ---- input / keyboard ----------------------------------------------------
  _onInput(e) {
    if (this.disabled) return;
    this._query = e.target.value;
    if (!this._open) { this._open = true; document.addEventListener("pointerdown", this._onOutside, true); }
    this._active = -1; // reset active option as the filtered set changes
  }

  // Keyboard: implements the APG editable-combobox map. Focus stays in the input; the
  // active option is tracked via _active (→ aria-activedescendant), never DOM focus.
  _onKeydown(e) {
    if (this.disabled) return;
    const list = this._filtered();
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!this._open) { this._open_(); return; }
        this._active = this._nextEnabled(list, this._active, +1); break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!this._open) { this._open_(); return; }
        this._active = this._nextEnabled(list, this._active, -1); break;
      }
      case "Home": { if (this._open) { e.preventDefault(); this._active = this._nextEnabled(list, -1, +1); } break; }
      case "End": { if (this._open) { e.preventDefault(); this._active = this._nextEnabled(list, list.length, -1); } break; }
      case "Enter": {
        if (this._open) { e.preventDefault(); this._commitCurrent(); }
        break;
      }
      case "Escape": {
        if (this._open) { e.preventDefault(); this._close(); }
        else if (this.value) { e.preventDefault(); this._clear(); } // 2nd Escape clears
        break;
      }
      case "Tab": {
        if (this._open) this._commitCurrent(); // let focus leave; just commit + close
        break;
      }
      default: return;
    }
  }

  // Next enabled option index in `dir` from `from` (no wrap; clamps at the ends).
  _nextEnabled(list, from, dir) {
    let i = from;
    for (;;) {
      i += dir;
      if (i < 0 || i >= list.length) return from >= 0 && from < list.length ? from : -1;
      if (!list[i].disabled) return i;
    }
  }

  // Clear the current selection (2nd Escape). Emits `change` when it actually clears.
  _clear() {
    if (!this.value) return;
    this.value = ""; this._query = "";
    this.emit("change", { value: "" });
  }

  // Push the current value + validity into the owning <form> after every render.
  // An explicit `error` → customError; required && empty → valueMissing; else valid.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? null);
    if (this.error) this._internals.setValidity({ customError: true }, this.error, this._input() || undefined);
    else if (this.required && !this.value) this._internals.setValidity({ valueMissing: true }, this._label("required"), this._input() || undefined);
    else this._internals.setValidity({});
  }

  render() {
    const invalid = !!this.error;
    const open = !!this._open && !this.disabled;
    const list = open ? this._filtered() : [];
    const activeId = open && this._active >= 0 && list[this._active] ? this._optId(this._active) : "";
    // Popover API support decides the popup strategy: promote to the top layer via
    // popover="manual" when available, else render a plain node the fallback positions.
    const usePopover = typeof HTMLElement.prototype.showPopover === "function";
    return html`
      <div class="puredashboard-combobox__control">
        <input class="puredashboard-combobox__input js-puredashboard-combobox__input" type="text" role="combobox" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-expanded="${open ? "true" : "false"}" aria-controls="${this._listId}" aria-activedescendant="${activeId}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}" .value="${this._display()}" placeholder="${this.placeholder || ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" @input="${(e) => this._onInput(e)}" @keydown="${(e) => this._onKeydown(e)}" @focus="${() => this._open_()}" @click="${() => this._open_()}">
        <svg class="puredashboard-combobox__chevron" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        <div class="puredashboard-combobox__list js-puredashboard-combobox__list${open ? " puredashboard-combobox__list--open" : ""}" id="${this._listId}" role="listbox" popover="${usePopover ? "manual" : null}" ?hidden="${!open}">
          ${open && list.length === 0 ? html`<div class="puredashboard-combobox__empty" role="option" aria-disabled="true">${this._label("noResults")}</div>` : ""}
          ${repeat(list, (o) => o.value, (o, i) => {
            const selected = o.value === this.value;
            const active = i === this._active;
            return html`<div class="puredashboard-combobox__option js-puredashboard-combobox__option${selected ? " puredashboard-combobox__option--selected" : ""}${active ? " puredashboard-combobox__option--active" : ""}${o.disabled ? " puredashboard-combobox__option--disabled" : ""}" id="${this._optId(i)}" role="option" aria-selected="${selected ? "true" : "false"}" aria-disabled="${o.disabled ? "true" : "false"}" @mousedown="${(e) => { e.preventDefault(); if (!o.disabled) this._commit(o); }}">${o.label}</div>`;
          })}
        </div>
      </div>
      ${this.error ? html`<div class="puredashboard-combobox__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }

  // After each render, show/hide the top-layer popover to match _open, and pin the
  // popup under the input (fixed positioning so it escapes clipping ancestors).
  firstUpdated() { this._syncPopup(); }
}

// The popover show/hide + positioning must run after DOM is committed each render.
// Hook updated() by wrapping — but keep the form-value logic above intact by calling
// _syncPopup from the same updated() cycle via a small override.
{
  const proto = PuredashboardCombobox.prototype;
  const origUpdated = proto.updated;
  proto.updated = function updated(changed) {
    origUpdated.call(this, changed);
    this._syncPopup();
  };
  // Show/hide the listbox in the top layer and position it under the input. Popover
  // API when available (top layer, escapes overflow); fixed/high-z fallback otherwise.
  proto._syncPopup = function _syncPopup() {
    const list = this.$(".js-puredashboard-combobox__list");
    const input = this._input();
    if (!list || !input) return;
    const open = !!this._open && !this.disabled;
    const usePopover = typeof list.showPopover === "function";
    if (open) {
      if (usePopover) { try { if (!(list.matches && list.matches(":popover-open"))) list.showPopover(); } catch { /* */ } }
      else { list.style.zIndex = String(this._zIndexFallback()); }
      this._position(list, input);
    } else if (!usePopover) {
      list.style.zIndex = "";
    }
  };
  proto._zIndexFallback = function _zIndexFallback() { return 1000; }; // --z-dropdown scale
  // Pin the popup under (or above, if it would overflow) the input, matching its width,
  // clamped to the viewport — same strategy as menu.js's position().
  proto._position = function _position(list, input) {
    const r = input.getBoundingClientRect();
    Object.assign(list.style, { position: "fixed", margin: "0", inset: "auto" });
    list.style.minWidth = r.width + "px";
    const lh = list.offsetHeight || 240, gap = 4;
    let top = r.bottom + gap;
    if (typeof window !== "undefined" && top + lh > window.innerHeight && r.top - gap - lh > 0) top = r.top - gap - lh;
    let left = r.left;
    if (typeof window !== "undefined") { left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8)); }
    list.style.top = top + "px";
    list.style.left = left + "px";
  };
}

PuredashboardCombobox.define("puredashboard-combobox");

export { PuredashboardCombobox };
