// <puredashboard-menubar> — a desktop-style application menu bar (File · Edit · View …).
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// It is the horizontal PARENT of menu.js: the bar itself is the only custom element —
// each dropdown is opened by `menu()` (the same imperative top-layer overlay), so every
// menu feature comes along for free: icons in a reserved gutter, keyboard-shortcut
// hints, separators, labelled groups, checkbox / radio items, and nested submenus.
//
//   const bar = document.createElement("puredashboard-menubar");
//   bar.menus = [
//     { label: "File", items: [ { label: "New", value: "new", shortcut: "⌘N" } ] },
//     { label: "Edit", items: [ { label: "Undo", value: "undo", shortcut: "⌘Z" } ] },
//   ];
//   bar.addEventListener("select", (e) => run(e.detail.value));
//
// Implements the WAI-ARIA APG "Menubar" pattern: role=menubar + role=menuitem triggers
// with aria-haspopup/aria-expanded, roving tabindex (exactly one trigger tabbable),
// Arrow/Home/End on the bar, and — once a menu is open — hover to switch between menus
// and ArrowLeft/ArrowRight to walk to the neighbouring one (via menu()'s onEdgeNav hook).
//
// State lives in `static properties`; all FIXED strings live in a `LABELS` map; BEM
// classes are namespaced by the tag with SEPARATE `js-…`/`data-*` script hooks; theming
// flows through the shared design tokens via a --pd-* fallback chain, so it works with
// no theme linked. Trigger icons are optional, trusted inline SVG markup (raw()), like
// segmented.js / menu.js. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat } from "./reactive.js";
import { raw } from "./html.js";
import { menu } from "./menu.js";

// All FIXED user-facing strings (English defaults), overridable per instance via the
// `labels` property. A menu's own `label` is author CONTENT (from `menus`), not a
// fixed string, so it is never a LABELS key.
const LABELS = {
  bar: "Application menu",
};

/**
 * A desktop-style application menu bar: a row of menu titles that each open a dropdown
 * built by `menu()` — so items support icons (in a reserved gutter), shortcut hints,
 * separators, groups, checkbox / radio items and nested submenus. Follows the WAI-ARIA
 * APG "Menubar" pattern: `role=menubar` with `role=menuitem` triggers
 * (`aria-haspopup`/`aria-expanded`), roving tabindex, the Arrow/Home/End keyboard map,
 * hover-to-switch while open, and ArrowLeft/ArrowRight to move between open menus.
 *
 * @element puredashboard-menubar
 *
 * @prop {Array<{label:string,items:Array<Object>,icon?:string,disabled?:boolean,key?:string}>} menus - The bar's menus. `items` is a `menu()` item list (see menu.js: `label`, `value`, `href`, `icon`, `shortcut`, `danger`, `disabled`, `checked`, `separator`, nested `items`, `group`/`radio`). `icon` on a menu is trusted inline SVG markup shown in its trigger. Default `[]`.
 * @prop {string}  orientation - `"horizontal"` (default) or `"vertical"` — sets `aria-orientation`, the arrow-key axis, and where the dropdowns open (below vs. beside).
 * @prop {boolean} disabled    - Disable the whole bar. Default `false`.
 * @prop {number}  openIndex   - Index of the menu currently open, or `-1` when none (get/set — setting it opens/closes that menu).
 * @prop {Object}  labels      - Override UI strings. Keys: `bar` (the bar's accessible name). Unset keys keep the English default.
 * @attr {string}  orientation - Mirrors the `orientation` property.
 * @attr {boolean} disabled    - Mirrors the `disabled` property (presence = true).
 * @attr {string}  aria-label  - Accessible name for the bar (falls back to the `bar` label).
 *
 * @fires select - Bubbling `CustomEvent` fired when a menu item resolves a value. `detail` = `{ value, menu, index }` (`menu` is the menu definition, `index` its position in the bar).
 * @fires openchange - Bubbling `CustomEvent` fired when a menu opens or closes. `detail` = `{ open, index }`.
 *
 * @method open - `open(index) => void` — open the menu at `index` (no-op when disabled).
 * @method close - `close() => void` — close the open menu, if any.
 * @method focus - `focus() => void` — focus the bar's current roving-tabindex trigger.
 *
 * @cssprop [--pd-menubar-gap] - Gap between triggers (defaults to `2px`).
 *
 * @example
 * const bar = document.createElement("puredashboard-menubar");
 * bar.menus = [
 *   { label: "File", items: [
 *     { label: "New file", value: "new", shortcut: "⌘N" },
 *     { separator: true },
 *     { label: "Export as", items: [{ label: "JSON", value: "json" }] },   // submenu
 *   ] },
 *   { label: "View", items: [
 *     { label: "Sidebar", checked: true, onSelect: (it, on) => toggleSidebar(on) },
 *   ] },
 * ];
 * bar.addEventListener("select", (e) => console.log(e.detail.value));
 * document.body.append(bar);
 */
class PuredashboardMenubar extends Reactive {
  static properties = {
    menus: {}, orientation: {}, disabled: {}, labels: {}, openIndex: {},
  };

  static observedAttributes = ["orientation", "disabled", "aria-label"];
  attributeChangedCallback(name, _old, val) {
    if (name === "aria-label") { this.requestUpdate(); return; }   // read in render()
    this[name] = name === "disabled" ? val !== null : val;
  }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.menus == null) this.menus = [];
    if (this.openIndex == null) this.openIndex = -1;
    this._ctl = null;          // the open menu()'s controller (its promise)
    this._focusIdx = 0;        // roving tabindex owner
    this._closedIdx = -1;      // trigger whose menu just closed (click-toggle guard)
    this._closedAt = 0;
  }

  disconnectedCallback() { this.close(); super.disconnectedCallback?.(); }

  // ------------------------------------------------------------------- data
  _list() { return Array.isArray(this.menus) ? this.menus : []; }
  _enabled() { const l = this._list(); const out = []; for (let i = 0; i < l.length; i++) if (!this.disabled && !l[i].disabled) out.push(i); return out; }
  _trigger(i) { return this.$(`[data-idx="${i}"]`); }
  _vertical() { return this.orientation === "vertical"; }

  focus() { (this.$(`.js-puredashboard-menubar__trigger[tabindex="0"]`) || this.$(`.js-puredashboard-menubar__trigger`))?.focus(); }

  // ---------------------------------------------------------------- open/close
  /** Open the menu at `index`. */
  open(i) {
    const m = this._list()[i];
    if (!m || m.disabled || this.disabled) return;
    if (this._ctl && this.openIndex === i) return;      // already open
    this._closeCurrent();
    const btn = this._trigger(i);
    if (!btn) return;
    this.openIndex = i;
    this._focusIdx = i;
    const ctl = menu(btn, Array.isArray(m.items) ? m.items : [], {
      placement: this._vertical() ? "right-start" : "bottom-start",
      className: "puredashboard-menubar__menu",
      // Arrow{Left,Right} at the menu's root level walks the BAR instead (APG menubar).
      onEdgeNav: (dir) => { this._step(dir, true); return true; },
    });
    this._ctl = ctl;
    this.emit("openchange", { open: true, index: i });
    ctl.then((value) => {
      if (this._ctl !== ctl) return;                 // superseded by another open
      this._ctl = null;
      this._closedIdx = i;
      this._closedAt = Date.now();
      this.openIndex = -1;
      if (value != null) this.emit("select", { value, menu: m, index: i });
      this.emit("openchange", { open: false, index: i });
    });
  }

  /** Close the open menu, if any. */
  close() { this._closeCurrent(); }

  // `openIndex` is real state, so setting it from outside must actually open/close the
  // overlay (open()/close() keep it in sync themselves — this only catches direct sets).
  updated(changed) {
    if (!changed.has("openIndex")) return;
    if (this.openIndex >= 0 && !this._ctl) this.open(this.openIndex);
    else if (this.openIndex < 0 && this._ctl) this._closeCurrent();
  }

  _closeCurrent() {
    const ctl = this._ctl;
    if (!ctl) return;
    this._ctl = null;                                 // detach first: the .then() above no-ops
    this.openIndex = -1;
    ctl.close(null);
  }

  // Move `dir` menus along the bar. While a menu is open (`reopen`), the neighbouring
  // menu opens too — the classic menubar walk.
  _step(dir, reopen) {
    const enabled = this._enabled();
    if (!enabled.length) return;
    const at = enabled.indexOf(reopen ? this.openIndex : this._focusIdx);
    const next = enabled[(at + dir + enabled.length) % enabled.length];
    if (reopen) { this._closeCurrent(); this.open(next); return; }
    this._focusIdx = next;
    this.requestUpdate();                                    // move the roving tabindex …
    queueMicrotask(() => this._trigger(next)?.focus());   // … then the focus
  }

  // ------------------------------------------------------------- interaction
  _onClick(i) {
    if (this.disabled) return;
    if (this.openIndex === i) { this.close(); return; }
    // The Popover API light-dismisses on pointerdown, so a click on the OPEN menu's own
    // trigger already closed it before this handler runs — don't bounce it back open.
    if (this._closedIdx === i && Date.now() - this._closedAt < 300) { this._closedIdx = -1; return; }
    this.open(i);
  }

  // Hovering another title while a menu is open switches to it (desktop behaviour);
  // hovering with nothing open does nothing.
  _onEnter(i) { if (this.openIndex >= 0 && this.openIndex !== i) this.open(i); }

  _onKeydown(e, i) {
    if (this.disabled) return;
    const vert = this._vertical();
    const next = vert ? "ArrowDown" : "ArrowRight";
    const prev = vert ? "ArrowUp" : "ArrowLeft";
    const openKey = vert ? "ArrowRight" : "ArrowDown";
    const enabled = this._enabled();
    switch (e.key) {
      case next: e.preventDefault(); this._step(1, false); return;
      case prev: e.preventDefault(); this._step(-1, false); return;
      case "Home": e.preventDefault(); this._focusIdx = enabled[0] ?? 0; this.requestUpdate(); queueMicrotask(() => this._trigger(this._focusIdx)?.focus()); return;
      case "End": e.preventDefault(); this._focusIdx = enabled[enabled.length - 1] ?? 0; this.requestUpdate(); queueMicrotask(() => this._trigger(this._focusIdx)?.focus()); return;
      case openKey: case "Enter": case " ": case "Spacebar": e.preventDefault(); this.open(i); return;
      default: return;
    }
  }

  render() {
    const list = this._list();
    const enabled = this._enabled();
    if (!enabled.includes(this._focusIdx)) this._focusIdx = enabled[0] ?? 0;
    const label = this.getAttribute("aria-label");
    const vert = this._vertical();
    // A VERTICAL bar reads as a list, so it reserves the icon slot on every title once
    // any menu has an icon — titles line up like the menu items do. A horizontal bar is
    // a row of words: an empty slot would just add a gap, so icons stay optional there.
    const gutter = vert && list.some((m) => m.icon);
    return html`
      <div class="puredashboard-menubar__bar${vert ? " puredashboard-menubar__bar--vertical" : ""}${this.disabled ? " puredashboard-menubar__bar--disabled" : ""}" role="menubar" aria-orientation="${vert ? "vertical" : "horizontal"}" aria-label="${label ?? this._label("bar")}">
        ${repeat(list, (m, i) => m.key ?? (typeof m.label === "string" ? m.label : i), (m, i) => {
          const dis = !!(this.disabled || m.disabled);
          const open = this.openIndex === i;
          return html`<button type="button" class="puredashboard-menubar__trigger js-puredashboard-menubar__trigger${open ? " puredashboard-menubar__trigger--open" : ""}${dis ? " puredashboard-menubar__trigger--disabled" : ""}" role="menuitem" data-idx="${i}" aria-haspopup="menu" aria-expanded="${open ? "true" : "false"}" ?disabled="${dis}" tabindex="${i === this._focusIdx && !dis ? "0" : "-1"}" @click="${() => this._onClick(i)}" @pointerenter="${() => this._onEnter(i)}" @keydown="${(e) => this._onKeydown(e, i)}">${m.icon ? html`<span class="puredashboard-menubar__icon">${raw(m.icon)}</span>` : gutter ? html`<span class="puredashboard-menubar__icon"></span>` : ""}<span class="puredashboard-menubar__text">${m.label}</span></button>`;
        })}
      </div>`;
  }
}
PuredashboardMenubar.define("puredashboard-menubar");

export { PuredashboardMenubar };
