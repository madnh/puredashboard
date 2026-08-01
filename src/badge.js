// <puredashboard-badge> — a count / status overlay for a badged child.
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) — the
// whole point is to PRESERVE the author's badged element (icon, avatar, button)
// untouched. A Reactive render() would blow those light-DOM children away, so
// instead this component MOVES them, once, into an anchor wrapper and layers a
// small indicator over the top-right corner.
//
// Why plain HTMLElement (mirrors <puredashboard-form>): it is a container that
// wraps and preserves author children, not a value-bearing control and not an
// html`…` template. On connect it wraps the existing children in
// `.puredashboard-badge__anchor` (guarded so it runs exactly once) and appends a
// `.puredashboard-badge__indicator`. The indicator's text + visibility are then
// kept in sync reactively via observedAttributes + a tiny _sync().
//
// The indicator's number is written with textContent (never innerHTML) so an
// author-supplied count can never inject markup. It carries an aria-label
// (LABELS.count) and is otherwise aria-hidden decoration; consumers get the real
// meaning from the label. Follows the input-family conventions: fixed strings in
// a LABELS map + a `labels` override, BEM classes namespaced by the tag, script
// hooks as SEPARATE js-… classes, and theming through the shared --pd-* token
// chain so it works with no theme linked.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. badge.labels = { count: (n) => `${n} tin` }.
// Function-valued keys interpolate.
const LABELS = {
  // aria-label for a numeric badge, e.g. "5 notifications".
  count: (n) => `${n} notifications`,
  // aria-label for a dot (no number) badge.
  dot: "New notifications",
};

// The set of `color` variants that map to a BEM modifier class.
const COLORS = new Set(["red", "accent", "success", "warning", "neutral"]);

/**
 * A small count / status overlay pinned to the top-right corner of a badged
 * element (an icon, avatar or button). Write the badged element as ordinary
 * children — they are MOVED, once, into an internal anchor wrapper and left
 * otherwise untouched, then a decorative indicator is layered over the corner.
 *
 * Because it must preserve arbitrary author children, it extends plain
 * `HTMLElement` (NOT `Reactive`) — a reactive render would destroy those
 * children. The indicator text is written with `textContent`, never `innerHTML`.
 * Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-badge
 *
 * @prop {number}  count      - The number to display. `>max` renders `"{max}+"`. Default `0`.
 * @prop {number}  max        - Cap after which `"{max}+"` is shown. Default `99`.
 * @prop {boolean} dot        - Show a small dot with NO number (a status marker). Default `false`.
 * @prop {boolean} showZero   - Show the badge when `count === 0` (otherwise hidden unless `dot`). Default `false`.
 * @prop {string}  color      - Variant: `"red"` (default) | `"accent"` | `"success"` | `"warning"` | `"neutral"`.
 * @prop {boolean} standalone - Render just the indicator with NO wrapped child (e.g. inline status). Default `false`.
 * @prop {Object}  labels     - Override UI strings. Keys: `count(n)`, `dot`. Unset keys keep the English default.
 *
 * @attr {number}  count      - Declarative form of `count`.
 * @attr {number}  max        - Declarative form of `max`.
 * @attr {boolean} dot        - Declarative form of `dot`.
 * @attr {boolean} show-zero  - Declarative form of `showZero`.
 * @attr {string}  color      - Declarative form of `color`.
 * @attr {boolean} standalone - Declarative form of `standalone`.
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 *
 * @cssprop [--pd-badge-size]   - Diameter of the numeric badge (defaults to a small pill height).
 * @cssprop [--pd-badge-dot]    - Diameter of the dot (defaults to a fraction of the badge size).
 * @cssprop [--pd-badge-bg]     - Badge fill (defaults to `--red`; remapped per `color`).
 * @cssprop [--pd-badge-ring]   - Ring colour around the badge (defaults to `--panel`).
 *
 * @example
 * // <puredashboard-badge count="5"><button>Inbox</button></puredashboard-badge>
 * const b = document.querySelector("puredashboard-badge");
 * b.count = 12;            // "12"
 * b.max = 9;               // "9+"
 * b.dot = true;            // a dot, no number
 */
class PuredashboardBadge extends HTMLElement {
  static get observedAttributes() {
    return ["count", "max", "dot", "show-zero", "color", "standalone"];
  }

  constructor() {
    super();
    this._wrapped = false;
    this._indicator = null;
    // Reconcile properties a template engine may have set before upgrade, so an
    // early `.labels = …` (etc.) isn't shadowed by the accessor. (Parity with
    // the rest of the library.)
    for (const p of ["labels", "count", "max", "dot", "showZero", "color", "standalone"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reactive properties (backed by attributes where sensible) ------------
  // These are plain accessors (not the Reactive engine): each setter reflects to
  // an attribute, and attributeChangedCallback re-runs _sync(), so property and
  // attribute stay in lockstep and the indicator updates immediately.
  get count() { const n = Number(this.getAttribute("count")); return Number.isFinite(n) ? n : 0; }
  set count(v) { this.setAttribute("count", String(v)); }

  get max() { const n = Number(this.getAttribute("max")); return Number.isFinite(n) && this.hasAttribute("max") ? n : 99; }
  set max(v) { this.setAttribute("max", String(v)); }

  get dot() { return this.hasAttribute("dot"); }
  set dot(v) { this._reflectBool("dot", v); }

  get showZero() { return this.hasAttribute("show-zero"); }
  set showZero(v) { this._reflectBool("show-zero", v); }

  get color() { const c = this.getAttribute("color"); return COLORS.has(c) ? c : "red"; }
  set color(v) { if (v == null) this.removeAttribute("color"); else this.setAttribute("color", v); }

  get standalone() { return this.hasAttribute("standalone"); }
  set standalone(v) { this._reflectBool("standalone", v); }

  _reflectBool(attr, v) { if (v) this.setAttribute(attr, ""); else this.removeAttribute(attr); }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  attributeChangedCallback() {
    // Any observed change (count/max/dot/show-zero/color/standalone) just needs
    // the indicator re-synced; wrapping is idempotent and connect-driven.
    if (this._indicator) this._sync();
  }

  connectedCallback() {
    this._wrap();
    this._sync();
  }

  // Wrap the author's current children in an anchor and append the indicator.
  // Guarded to run EXACTLY once (across disconnect/reconnect too) — re-wrapping
  // would nest anchors or move the indicator into the anchor. In `standalone`
  // mode there is nothing to anchor: only the bare indicator is rendered.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    if (!this.standalone) {
      const anchor = document.createElement("span");
      anchor.className = "puredashboard-badge__anchor js-puredashboard-badge__anchor";
      // Move (NOT clone) so live nodes, listeners and any state on the badged
      // element are preserved. Re-reading firstChild handles the live list as we
      // append into the anchor.
      while (this.firstChild) anchor.appendChild(this.firstChild);
      this.appendChild(anchor);
    }

    const indicator = document.createElement("span");
    indicator.className = "puredashboard-badge__indicator js-puredashboard-badge__indicator";
    this.appendChild(indicator);
    this._indicator = indicator;
  }

  // Recompute the indicator's text, modifiers and visibility from current state.
  // - dot mode: a dot, no number (visible regardless of count).
  // - numeric: hidden when count === 0 unless showZero; count>max → "{max}+".
  // The number goes in via textContent so a hostile count can't inject markup.
  _sync() {
    const ind = this._indicator;
    if (!ind) return;

    const dot = this.dot;
    const count = this.count;
    const max = this.max;

    // Visibility: dot is always shown; a number hides at 0 unless showZero.
    const visible = dot || count !== 0 || this.showZero;

    // Color variant → single modifier class (default red carries no modifier).
    const color = this.color;

    // Reset then apply the (small, fixed) set of state modifier classes.
    ind.className = "puredashboard-badge__indicator js-puredashboard-badge__indicator";
    if (dot) ind.classList.add("puredashboard-badge__indicator--dot");
    if (color !== "red") ind.classList.add(`puredashboard-badge__indicator--${color}`);
    if (!visible) ind.classList.add("puredashboard-badge__indicator--hidden");

    // An aria-label on the HOST names the badge instead of the generated count string
    // (the host has no role, so it would otherwise be dropped) — same rule as button.js.
    const authored = this.getAttribute("aria-label");
    if (dot) {
      ind.textContent = "";                 // a dot shows no number
      ind.setAttribute("aria-label", authored ?? this._label("dot"));
    } else {
      const text = count > max ? `${max}+` : String(count);
      ind.textContent = text;               // textContent, never innerHTML
      ind.setAttribute("aria-label", authored ?? this._label("count", count));
    }
    // Decorative when hidden; otherwise the aria-label carries the meaning.
    ind.setAttribute("role", "status");
    ind.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  // The internal anchor holding the author's badged element (null in standalone).
  get anchor() { return this.querySelector(".js-puredashboard-badge__anchor"); }
  // The indicator node.
  get indicator() { return this._indicator; }
}

customElements.define("puredashboard-badge", PuredashboardBadge);

export { PuredashboardBadge };
