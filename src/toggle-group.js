// <puredashboard-toggle-group> — a set of <puredashboard-toggle> buttons that share one
// selection. Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) —
// the toggles ARE the author's light-DOM children, and a Reactive render() would blow
// them away (same reason splitter.js adopts its children instead of rendering them).
//
//   <puredashboard-toggle-group value="center" aria-label="Text alignment">
//     <puredashboard-toggle value="left"   icon="…" aria-label="Left"></puredashboard-toggle>
//     <puredashboard-toggle value="center" icon="…" aria-label="Center"></puredashboard-toggle>
//     <puredashboard-toggle value="right"  icon="…" aria-label="Right"></puredashboard-toggle>
//   </puredashboard-toggle-group>
//
// Single-select by default (`multiple` for a set of independent-but-related toggles, e.g.
// bold/italic/underline). The group owns the state: it presses/unpresses its children,
// swallows their individual `change` events and emits ONE `change` carrying the group
// value, so a caller listens in exactly one place.
//
// Keyboard follows the APG "toolbar" arrow-key model rather than Tab: the group is a
// single tab stop (roving tabindex — exactly one child tabbable) and Arrow keys move
// between the toggles, Home/End jump to the ends, wrapping unless `loop` is off. That is
// what `tabbable` + `focus()` on <puredashboard-toggle> exist for.
//
// Children are adopted live: a MutationObserver re-syncs when toggles are added or
// removed, so a data-driven list works without re-creating the group.
//
// Class naming (BEM, block = the component tag); the seams between attached toggles are
// styled from toggle-group.css. Themed through the shared tokens via a --pd-* chain.
// All fixed strings live in a LABELS map. See docs/DEVELOPMENT.md → "Definition of Done".

// All FIXED user-facing strings (English defaults), overridable per instance via the
// `labels` property — e.g. g.labels = { group: "Căn lề" }.
const LABELS = {
  // Fallback accessible name for the group when the author sets no aria-label.
  group: "Toggle group",
};

const TAG = "puredashboard-toggle";
const isToggle = (n) => n && n.nodeType === 1 && n.localName === TAG;

/**
 * A group of `<puredashboard-toggle>` buttons sharing one selection — text alignment,
 * a view mode, or a set of formatting toggles. The toggles are the host's **direct
 * element children**; the group presses them, keeps them consistent, and emits a single
 * `change` with the group's value.
 *
 * Single-select by default (`value` is a string, or `null` when nothing is selected);
 * set `multiple` for independent toggles (`value` is a string array). Renders
 * `role="group"` with a roving tabindex, so the whole group is ONE tab stop and Arrow /
 * Home / End move between the toggles.
 *
 * @element puredashboard-toggle-group
 *
 * @prop {string|string[]|null} value - The selection: a string (single mode) or an array of strings (`multiple`). Setting it presses the matching children. Default `null` / `[]`.
 * @prop {boolean} multiple      - Allow any number of toggles to be pressed at once. Default `false`.
 * @prop {boolean} disabled      - Disable every toggle in the group. Default `false`.
 * @prop {string}  orientation   - `"horizontal"` (default) or `"vertical"` — the layout and which arrow keys navigate.
 * @prop {boolean} loop          - Arrow keys wrap around at the ends. Default `true`.
 * @prop {boolean} deselectable  - Single mode: pressing the selected toggle again clears the selection. Default `true`; set `false` to always keep one selected.
 * @prop {boolean} attached      - Render the toggles joined into one control (shared borders, rounded ends). Default `true`; `false` leaves them as separate buttons with a gap.
 * @prop {Object}  labels        - Override UI strings. Keys: `group` (fallback accessible name). Unset keys keep the English default.
 *
 * @attr {string}  value        - Declarative form of `value` (space-separated in `multiple` mode).
 * @attr {boolean} multiple     - Declarative form of `multiple`.
 * @attr {boolean} disabled     - Declarative form of `disabled`.
 * @attr {string}  orientation  - Declarative form of `orientation`.
 * @attr {boolean} no-loop      - Declarative form of `loop = false`.
 * @attr {boolean} no-deselect  - Declarative form of `deselectable = false`.
 * @attr {boolean} detached     - Declarative form of `attached = false`.
 * @attr {string}  aria-label   - Accessible name for the group (the host carries `role="group"`, so the name stays here). Falls back to the `group` label.
 *
 * @fires change - Bubbling `CustomEvent` fired when the selection changes by user action. `detail` = `{ value }` — a string/`null` (single) or an array (`multiple`). Setting `.value` in JS does NOT fire it. The children's own `change` events are swallowed, so you listen in one place.
 *
 * @method focus - `focus() => void` — focus the group's current roving-tabindex toggle.
 *
 * @example
 * const g = document.createElement("puredashboard-toggle-group");
 * g.setAttribute("aria-label", "Text alignment");
 * for (const v of ["left", "center", "right"]) {
 *   const t = document.createElement("puredashboard-toggle");
 *   t.value = v; t.label = v;
 *   g.append(t);
 * }
 * g.value = "center";
 * g.addEventListener("change", (e) => console.log(e.detail.value));   // "left" | … | null
 * document.body.append(g);
 */
class PuredashboardToggleGroup extends HTMLElement {
  static get observedAttributes() {
    return ["value", "multiple", "disabled", "orientation", "no-loop", "no-deselect", "detached", "aria-label"];
  }

  constructor() {
    super();
    this._value = null;
    this._inited = false;
    this._forced = new Set();     // toggles WE disabled (so re-enabling restores the author's own)
    // A template engine may set properties before upgrade, leaving own-properties that
    // shadow the accessors. Reconcile them (same pattern as button.js / splitter.js).
    for (const p of ["value", "multiple", "disabled", "orientation", "loop", "deselectable", "attached", "labels"]) this._upgrade(p);
  }
  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reflected properties ---------------------------------------------------------
  get multiple() { return this.hasAttribute("multiple"); }
  set multiple(v) { this._bool("multiple", v); }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(v) { this._bool("disabled", v); }
  get orientation() { return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal"; }
  set orientation(v) { v == null ? this.removeAttribute("orientation") : this.setAttribute("orientation", v); }
  get loop() { return !this.hasAttribute("no-loop"); }
  set loop(v) { this._bool("no-loop", !v); }
  get deselectable() { return !this.hasAttribute("no-deselect"); }
  set deselectable(v) { this._bool("no-deselect", !v); }
  get attached() { return !this.hasAttribute("detached"); }
  set attached(v) { this._bool("detached", !v); }
  _bool(attr, v) { if (v) this.setAttribute(attr, ""); else this.removeAttribute(attr); }

  /** The selection: a string / null (single) or an array of strings (`multiple`). */
  get value() { return this.multiple ? (Array.isArray(this._value) ? this._value.slice() : []) : (this._value ?? null); }
  set value(v) { this._value = this._normalise(v); this._sync(); }

  // Accept either shape in either mode, so switching `multiple` never leaves junk state.
  _normalise(v) {
    if (this.multiple) return v == null ? [] : (Array.isArray(v) ? v.map(String) : String(v).split(/\s+/).filter(Boolean));
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v == null || v === "" ? null : String(v);
  }

  attributeChangedCallback(name, _old, val) {
    if (name === "value") { this._value = this._normalise(val); this._sync(); return; }
    if (name === "aria-label") { this._applyName(); return; }
    this._sync();
  }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // ---- lifecycle --------------------------------------------------------------------
  connectedCallback() {
    if (!this._inited) {
      this._inited = true;
      this.classList.add("puredashboard-toggle-group");
      this.setAttribute("role", "group");
      // A child toggle's own `change` is an implementation detail of the group: swallow
      // it and emit ONE event carrying the group's value instead.
      this.addEventListener("change", this._onChildChange, true);
      this.addEventListener("keydown", this._onKeydown);
      // Toggles can be added/removed at any time (a data-driven list) — re-sync then.
      this._observer = new MutationObserver(() => this._sync());
      this._observer.observe(this, { childList: true });
      if (this.hasAttribute("value")) this._value = this._normalise(this.getAttribute("value"));
    }
    this._applyName();
    this._sync();
  }
  disconnectedCallback() { this._observer?.disconnect(); this._observer = null; this._inited = false; this.removeEventListener("change", this._onChildChange, true); this.removeEventListener("keydown", this._onKeydown); }

  // ---- children ---------------------------------------------------------------------
  /** The group's toggles, in DOM order (direct children only). */
  get toggles() { return Array.from(this.children).filter(isToggle); }
  _enabled() { return this.toggles.filter((t) => !t.disabled); }

  focus() { (this.toggles.find((t) => t.tabbable !== false && !t.disabled) || this._enabled()[0])?.focus(); }

  _applyName() {
    // The HOST carries role="group", so the author's aria-label already names it; only
    // fill in a default when there is none (never overwrite — see the library-wide rule).
    if (this.hasAttribute("aria-labelledby")) return;
    const cur = this.getAttribute("aria-label");
    if (cur != null && cur !== this._ariaOwn) return;         // the author named it
    this._ariaOwn = this._label("group");
    // aria-label is OBSERVED, and writing it re-enters attributeChangedCallback even when
    // the value is unchanged — so only write when it actually differs, or this recurses.
    if (cur !== this._ariaOwn) this.setAttribute("aria-label", this._ariaOwn);
  }

  // Push the group's state onto the children: pressed-ness, the roving tabindex, and the
  // group's `disabled`. Called on connect, on any attribute change and on child changes.
  _sync() {
    if (!this._inited) return;
    const toggles = this.toggles;
    const selected = new Set(this.multiple ? (this._value || []) : (this._value == null ? [] : [this._value]));
    for (const t of toggles) {
      if (this.disabled) { if (!t.disabled) { t.disabled = true; this._forced.add(t); } }
      else if (this._forced.has(t)) { t.disabled = false; this._forced.delete(t); }
      const on = selected.has(String(t.value ?? ""));
      if (!!t.pressed !== on) t.pressed = on;
    }
    // Roving tabindex: the first selected enabled toggle owns the tab stop, else the
    // first enabled one — so the whole group is a single stop in the tab order.
    const enabled = toggles.filter((t) => !t.disabled);
    const owner = enabled.find((t) => t.pressed) || enabled[0] || null;
    for (const t of toggles) t.tabbable = t === owner;
  }

  // ---- interaction ------------------------------------------------------------------
  // Capture phase: the child's listeners have already run, but the event never leaves the
  // group — the group re-emits with its own value so callers listen in exactly one place.
  _onChildChange = (e) => {
    const t = e.target;
    if (t === this || !isToggle(t) || t.parentElement !== this) return;
    e.stopPropagation();
    const v = String(t.value ?? "");
    if (this.multiple) {
      const next = new Set(this._value || []);
      t.pressed ? next.add(v) : next.delete(v);
      this._value = [...next];
    } else if (t.pressed) {
      this._value = v;                        // selecting one deselects the rest (in _sync)
    } else if (this.deselectable) {
      this._value = null;
    } else {
      t.pressed = true;                       // must keep one selected — revert the press
      return;                                 // …and report nothing: the value didn't change
    }
    this._sync();
    this.dispatchEvent(new CustomEvent("change", { detail: { value: this.value }, bubbles: true }));
  };

  // APG toolbar keyboard: the group is one tab stop, arrows move between the toggles.
  _onKeydown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const vert = this.orientation === "vertical";
    const next = vert ? "ArrowDown" : "ArrowRight";
    const prev = vert ? "ArrowUp" : "ArrowLeft";
    if (![next, prev, "Home", "End"].includes(e.key)) return;
    const items = this._enabled();
    if (!items.length) return;
    const cur = items.findIndex((t) => t.contains(e.target) || t === e.target);
    let i;
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = items.length - 1;
    else {
      const step = e.key === next ? 1 : -1;
      i = cur < 0 ? 0 : cur + step;
      if (i < 0 || i >= items.length) { if (!this.loop) return; i = (i + items.length) % items.length; }
    }
    e.preventDefault();
    // Move the tab stop with the focus so Tab always returns to where the user left off.
    for (const t of this.toggles) t.tabbable = t === items[i];
    items[i].focus();
  };
}
customElements.define("puredashboard-toggle-group", PuredashboardToggleGroup);

export { PuredashboardToggleGroup };
