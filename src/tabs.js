// <puredashboard-tabs> — a tab list (WAI-ARIA APG "Tabs", automatic activation).
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is NOT a form control (no ElementInternals) — it's a navigation/selection
// widget. It renders only the tablist (role="tablist" + role="tab" buttons);
// the tab PANELS are author DOM elsewhere in the page. When a tab declares a
// `panelId`, the element manages that panel: sets role="tabpanel",
// aria-labelledby, and toggles `hidden` so only the active panel shows. It never
// renders panel content itself (which keeps untrusted content out of the engine).
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-tabs__<element>[--<modifier>]`. Script hooks are SEPARATE `js-…`
// classes / `data-*` attributes; don't style those.
//
// Keyboard (APG automatic activation): ArrowRight/ArrowLeft move to the next/prev
// enabled tab and activate it (wrapping); Home/End jump to the first/last enabled
// tab; disabled tabs are skipped. Roving tabindex: the selected tab is 0, the rest
// are -1. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. tabs.labels = { tablist: "Phần" }. The tab labels
// themselves are CONTENT and come from the `tabs` data, not from here.
const LABELS = {
  tablist: "Tabs",
};

let uid = 0;

/**
 * A tab list following the WAI-ARIA APG "Tabs" pattern with **automatic
 * activation** (activation follows focus). Renders a `role="tablist"` of
 * `role="tab"` buttons with roving `tabindex`, `aria-selected`, and full keyboard
 * support. The tab **panels are author DOM** elsewhere on the page — reference one
 * per tab via `panelId` and this element manages its `role`, `aria-labelledby`,
 * and `hidden` state so only the active panel shows. Configure via JS properties.
 *
 * @element puredashboard-tabs
 *
 * @prop {Array}   tabs   - Tab defs: `{ id: string, label: string, disabled?: boolean, panelId?: string }`.
 * @prop {string}  value  - Active tab id (get/set). Defaults to the first enabled tab.
 * @prop {Object}  labels - Override UI strings. Keys: `tablist`. Unset keys keep the English default.
 *
 * @fires tabchange - Bubbling `CustomEvent`; `detail`: `{ value }` — fired when the active tab changes.
 *
 * @cssprop [--pd-tabs-gap]      - Gap between tabs (defaults to `--sp-1`).
 * @cssprop [--pd-tabs-indicator] - Active-tab indicator thickness (defaults to `2px`).
 *
 * @example
 * const tabs = document.createElement("puredashboard-tabs");
 * tabs.tabs = [
 *   { id: "overview", label: "Overview", panelId: "panel-overview" },
 *   { id: "settings", label: "Settings", panelId: "panel-settings" },
 * ];
 * tabs.addEventListener("tabchange", (e) => console.log(e.detail.value));
 * container.append(tabs); // panels #panel-overview / #panel-settings live in the page
 */
class PuredashboardTabs extends Reactive {
  static properties = {
    tabs: {}, value: {}, labels: {},
  };

  constructor() {
    super();
    this._uid = ++uid;
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.on("click", "[data-tab]", (e, el) => this._activate(el.dataset.tab));
    this.on("keydown", ".js-puredashboard-tabs__list", (e) => this._onKeydown(e));
  }

  // Stable per-tab element id (for aria-controls/aria-labelledby wiring).
  _tabElId(id) { return `js-puredashboard-tabs__tab-${this._uid}-${id}`; }

  _enabled() { return (this.tabs || []).filter((t) => t && !t.disabled); }

  // Current active tab id, defaulting to the first enabled tab when unset/invalid.
  _current() {
    const tabs = this.tabs || [];
    const active = tabs.find((t) => t && t.id === this.value && !t.disabled);
    if (active) return active.id;
    const first = this._enabled()[0];
    return first ? first.id : undefined;
  }

  _activate(id) {
    const t = (this.tabs || []).find((x) => x && x.id === id);
    if (!t || t.disabled) return;
    if (this.value === id) return;
    this.value = id;
    this.emit("tabchange", { value: id });
  }

  _onKeydown(e) {
    const enabled = this._enabled();
    if (!enabled.length) return;
    const cur = this._current();
    let idx = enabled.findIndex((t) => t.id === cur);
    if (idx < 0) idx = 0;
    let next = null;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": next = enabled[(idx + 1) % enabled.length]; break;
      case "ArrowLeft":  case "ArrowUp":   next = enabled[(idx - 1 + enabled.length) % enabled.length]; break;
      case "Home": next = enabled[0]; break;
      case "End":  next = enabled[enabled.length - 1]; break;
      default: return;
    }
    e.preventDefault();
    if (next) { this._activate(next.id); this.$(`[data-tab="${next.id}"]`)?.focus(); }
  }

  // After each render, reflect the active tab onto the author-provided panels:
  // role, aria-labelledby, and hidden (only the active panel is shown). Panels are
  // located by document.getElementById(panelId) — guard null (a panel may be
  // absent or not yet in the DOM).
  updated() {
    const active = this._current();
    for (const t of this.tabs || []) {
      if (!t || !t.panelId) continue;
      const panel = document.getElementById(t.panelId);
      if (!panel) continue;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", this._tabElId(t.id));
      panel.hidden = t.id !== active;
    }
  }

  render() {
    const tabs = this.tabs || [];
    const active = this._current();
    return html`<div class="puredashboard-tabs__list js-puredashboard-tabs__list" role="tablist" aria-label="${this._label("tablist")}">
      ${tabs.map((t) => {
        const selected = t.id === active;
        return html`<button type="button" class="puredashboard-tabs__tab ${selected ? "puredashboard-tabs__tab--active" : ""} ${t.disabled ? "puredashboard-tabs__tab--disabled" : ""}" id="${this._tabElId(t.id)}" role="tab" data-tab="${t.id}" aria-selected="${selected ? "true" : "false"}" aria-controls="${t.panelId || ""}" tabindex="${selected ? "0" : "-1"}" ?disabled="${!!t.disabled}">${t.label}</button>`;
      })}
    </div>`;
  }
}
PuredashboardTabs.define("puredashboard-tabs");

export { PuredashboardTabs };
