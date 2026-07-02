// <puredashboard-layout> family — an application layout frame (matching Antd's
// Layout). Zero-dep, no build, CSP-safe. FIVE custom elements defined together:
//   <puredashboard-layout>   — the flex frame (column by default; row when it has
//                              a direct <puredashboard-sider> child, via CSS :has)
//   <puredashboard-header>   — the top bar (brand / nav / actions)
//   <puredashboard-content>  — the scrollable main region (flex:1, overflow:auto)
//   <puredashboard-footer>   — a muted footer bar
//   <puredashboard-sider>    — a side panel (collapsible, breakpoint-aware)
//
// Family: these are STRUCTURAL containers, not form controls and not Reactive
// components — a Reactive render() would clobber the author's light-DOM children,
// and the whole job of a layout is to PRESERVE and arrange whatever you put
// inside it. So every element here extends plain HTMLElement (same pattern as
// form.js) and never rewrites its children through innerHTML/html``. The header,
// content and footer are pure CSS shells (their class does nothing but exist so
// the tag upgrades and the co-located stylesheet applies). The sider adds a
// little behaviour: on connect it wraps the author's children in an inner scroll
// region and, when collapsible, appends a collapse trigger — the children (your
// nav) stay intact, just relocated into the scroll region.
//
// Conventions (see docs/DEVELOPMENT.md): BEM classes namespaced by the tag; script
// hooks are SEPARATE js-… classes; all fixed strings live in a LABELS map with a
// `labels` override; theming flows through the shared design tokens (--panel,
// --panel-2, --border, --text, --muted, --sp-*, --shadow-1, --control-height-*,
// --duration-*, --ease-*) via a --pd-* fallback chain, so it works with NO theme
// linked. Width animates through the motion tokens (reduced-motion safe).

// Fixed user-facing strings (English defaults). Override any subset per instance
// via the `labels` property — e.g. sider.labels = { collapse: "Thu gọn" }. Only
// the sider surfaces strings (the collapse trigger's aria-label).
const LABELS = {
  expand: "Expand sidebar",
  collapse: "Collapse sidebar",
};

// Antd-style breakpoint widths (px). A sider auto-collapses BELOW its breakpoint.
const BREAKPOINTS = { sm: 576, md: 768, lg: 992 };

// Build the trigger chevron with createElementNS — pure DOM, no innerHTML, so it
// stays CSP-safe with zero trusted-markup surface. It points left (toward the
// sider); CSS rotates it 180° when the sider is collapsed so it points out.
function chevronIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "1em");
  svg.setAttribute("height", "1em");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.style.overflow = "visible"; // don't clip strokes at the viewBox edge
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "m15 18-6-6 6-6");
  svg.appendChild(path);
  return svg;
}

/**
 * The application layout frame. A flex container that arranges its direct
 * children. By default it stacks them vertically (`flex-direction: column`) so a
 * header / content / footer read top-to-bottom. When it has a DIRECT
 * `<puredashboard-sider>` child it flips to a horizontal row so the sider sits
 * beside the rest — done purely in CSS via `:has(> puredashboard-sider)`, no JS.
 * Set the `hasSider` boolean (attribute `has-sider`) to force the row layout
 * regardless (e.g. for a sider added asynchronously).
 *
 * Preserves author children untouched — place any of `<puredashboard-header>`,
 * `<puredashboard-content>`, `<puredashboard-footer>`, `<puredashboard-sider>`,
 * or your own markup inside it.
 *
 * @element puredashboard-layout
 *
 * @prop {boolean} hasSider - Force the horizontal (row) layout. Default `false`.
 * @attr {boolean} has-sider - Declarative form of `hasSider`.
 *
 * @cssprop [--pd-layout-bg] - Frame background (defaults to `--bg`, then transparent).
 *
 * @example
 * // <puredashboard-layout>
 * //   <puredashboard-header>…</puredashboard-header>
 * //   <puredashboard-layout>            <!-- nested: row, has a sider -->
 * //     <puredashboard-sider collapsible>…</puredashboard-sider>
 * //     <puredashboard-content>…</puredashboard-content>
 * //   </puredashboard-layout>
 * //   <puredashboard-footer>…</puredashboard-footer>
 * // </puredashboard-layout>
 */
class PuredashboardLayout extends HTMLElement {
  constructor() {
    super();
    this._upgrade("hasSider");
  }

  // Reconcile a property set BEFORE upgrade (a template engine may assign it),
  // which would otherwise shadow the prototype accessor.
  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  get hasSider() { return this.hasAttribute("has-sider"); }
  set hasSider(v) { if (v) this.setAttribute("has-sider", ""); else this.removeAttribute("has-sider"); }
}

/**
 * The top bar of a layout — a fixed-height horizontal flex row with `--panel`
 * background and a bottom border. Preserves author children (brand, nav,
 * actions); lay them out with the flex it provides (add `margin-inline-start:auto`
 * to a child to push it to the right).
 *
 * @element puredashboard-header
 *
 * @cssprop [--pd-header-height] - Bar height (defaults to `--control-height-lg` × 1.4).
 * @cssprop [--pd-header-bg]     - Background (defaults to `--panel`).
 *
 * @example
 * // <puredashboard-header>
 * //   <strong>Acme Admin</strong>
 * //   <nav style="margin-inline-start:auto">…</nav>
 * // </puredashboard-header>
 */
class PuredashboardHeader extends HTMLElement {}

/**
 * The scrollable main region of a layout. Flexes to fill the remaining space
 * (`flex: 1; min-height: 0`), pads its content, and scrolls its overflow. Holds
 * your page content unchanged.
 *
 * @element puredashboard-content
 *
 * @cssprop [--pd-content-pad] - Inner padding (defaults to `--sp-4`).
 * @cssprop [--pd-content-bg]  - Background (defaults to `--bg`, then transparent).
 *
 * @example
 * // <puredashboard-content><h1>Dashboard</h1>…</puredashboard-content>
 */
class PuredashboardContent extends HTMLElement {}

/**
 * A muted footer bar for a layout. Preserves author children (copyright, links).
 *
 * @element puredashboard-footer
 *
 * @cssprop [--pd-footer-bg] - Background (defaults to `--panel`).
 *
 * @example
 * // <puredashboard-footer>© 2026 Acme</puredashboard-footer>
 */
class PuredashboardFooter extends HTMLElement {}

/**
 * A side panel for a layout — typically holding a `<puredashboard-nav>`. On
 * connect it MOVES the author's children (order preserved) into an inner scroll
 * region and, when `collapsible`, appends a collapse trigger button at the
 * bottom. The panel width is driven by an inline `--pd-sider-w` custom property
 * that flips between `width` and `collapsedWidth`, and animates via the shared
 * motion tokens (reduced-motion safe). Its mere presence as a direct child makes
 * the parent `<puredashboard-layout>` a horizontal row.
 *
 * Configure via JS properties or declarative attributes. `collapsed` is reflected
 * to the `collapsed` attribute. When a `breakpoint` is set, a `matchMedia`
 * listener auto-collapses the sider below that width (feature-detected — a no-op
 * where `matchMedia` is unavailable).
 *
 * @element puredashboard-sider
 *
 * @prop {number}  width          - Expanded width in px. Default `220`.
 * @prop {number}  collapsedWidth - Collapsed width in px. Default `64`.
 * @prop {boolean} collapsible    - Render a collapse trigger button. Default `false`.
 * @prop {boolean} collapsed      - Collapsed state (reflected to the `collapsed` attribute). Default `false`.
 * @prop {string}  breakpoint     - `"sm"` | `"md"` | `"lg"` — auto-collapse below this width. Default `""` (off).
 * @prop {Object}  labels         - Override UI strings. Keys: `expand`, `collapse`. Unset keys keep the English default.
 * @attr {number}  width          - Declarative form of `width`.
 * @attr {number}  collapsed-width - Declarative form of `collapsedWidth`.
 * @attr {boolean} collapsible    - Declarative form of `collapsible`.
 * @attr {boolean} collapsed      - Declarative form of `collapsed`.
 * @attr {string}  breakpoint     - Declarative form of `breakpoint`.
 *
 * @fires collapse - `CustomEvent` (bubbles) when the collapsed state changes via the trigger, `toggle()`, or a breakpoint. `detail = { collapsed }`.
 *
 * @method toggle - `toggle() => void` — flip `collapsed` and emit `collapse`.
 *
 * @cssprop [--pd-sider-w]   - Current width (set inline by the element; do not override).
 * @cssprop [--pd-sider-bg]  - Background (defaults to `--panel`).
 *
 * @example
 * const sider = document.createElement("puredashboard-sider");
 * sider.collapsible = true; sider.breakpoint = "md";
 * sider.append(nav);
 * sider.addEventListener("collapse", (e) => console.log(e.detail.collapsed));
 */
class PuredashboardSider extends HTMLElement {
  static get observedAttributes() { return ["width", "collapsed-width", "collapsible", "collapsed", "breakpoint"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._inner = null;
    this._trigger = null;
    this._mql = null;
    this._onMedia = null;
    this._upgrade("width");
    this._upgrade("collapsedWidth");
    this._upgrade("collapsible");
    this._upgrade("collapsed");
    this._upgrade("breakpoint");
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reflected properties (attribute = source of truth) -------------------
  get width() { const v = parseInt(this.getAttribute("width"), 10); return Number.isFinite(v) ? v : 220; }
  set width(v) { this.setAttribute("width", String(v)); }

  get collapsedWidth() { const v = parseInt(this.getAttribute("collapsed-width"), 10); return Number.isFinite(v) ? v : 64; }
  set collapsedWidth(v) { this.setAttribute("collapsed-width", String(v)); }

  get collapsible() { return this.hasAttribute("collapsible"); }
  set collapsible(v) { if (v) this.setAttribute("collapsible", ""); else this.removeAttribute("collapsible"); }

  get collapsed() { return this.hasAttribute("collapsed"); }
  set collapsed(v) { if (!!v === this.hasAttribute("collapsed")) return; if (v) this.setAttribute("collapsed", ""); else this.removeAttribute("collapsed"); }

  get breakpoint() { return this.getAttribute("breakpoint") || ""; }
  set breakpoint(v) { if (v) this.setAttribute("breakpoint", v); else this.removeAttribute("breakpoint"); }

  // _label(key) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  attributeChangedCallback(name) {
    switch (name) {
      case "width":
      case "collapsed-width":
        this._applyWidth();
        break;
      case "collapsed":
        this._applyWidth();
        this._updateTriggerLabel();
        break;
      case "collapsible":
        this._syncTrigger();
        break;
      case "breakpoint":
        this._setupMedia();
        break;
    }
  }

  connectedCallback() {
    this._wrap();
    this._applyWidth();
    this._syncTrigger();
    this._setupMedia();
  }

  disconnectedCallback() {
    this._teardownMedia();
  }

  // Move the author's children into an inner scroll region (once). Re-reading
  // firstChild each pass handles the live child list as we append.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;
    const inner = document.createElement("div");
    inner.className = "puredashboard-sider__inner js-puredashboard-sider__inner";
    while (this.firstChild) inner.appendChild(this.firstChild);
    this.appendChild(inner);
    this._inner = inner;
  }

  // Drive the current width via an inline custom property the CSS reads.
  _applyWidth() {
    const w = this.collapsed ? this.collapsedWidth : this.width;
    this.style.setProperty("--pd-sider-w", w + "px");
  }

  // Add/remove the collapse trigger to match `collapsible`. Kept after the inner
  // region so it sits at the bottom of the flex column.
  _syncTrigger() {
    if (!this._wrapped) return;
    if (this.collapsible) {
      if (!this._trigger) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "puredashboard-sider__trigger js-puredashboard-sider__trigger";
        btn.appendChild(chevronIcon());
        btn.addEventListener("click", this._onTrigger);
        this.appendChild(btn);
        this._trigger = btn;
      }
      this._updateTriggerLabel();
    } else if (this._trigger) {
      this._trigger.removeEventListener("click", this._onTrigger);
      this._trigger.remove();
      this._trigger = null;
    }
  }

  _updateTriggerLabel() {
    if (!this._trigger) return;
    const collapsed = this.collapsed;
    this._trigger.setAttribute("aria-label", collapsed ? this._label("expand") : this._label("collapse"));
    this._trigger.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  _onTrigger = () => { this.toggle(); };

  // ---- breakpoint auto-collapse (feature-detected) --------------------------
  _setupMedia() {
    this._teardownMedia();
    const bp = this.breakpoint;
    const px = BREAKPOINTS[bp];
    if (!px) return;
    // jsdom (and any non-browser host) may lack matchMedia — feature-detect.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(max-width: ${px - 1}px)`);
    this._mql = mql;
    this._onMedia = (e) => {
      const collapse = !!e.matches;
      if (collapse === this.collapsed) return;
      this.collapsed = collapse;
      this._emitCollapse();
    };
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", this._onMedia);
    else if (typeof mql.addListener === "function") mql.addListener(this._onMedia); // legacy
    // Apply the current match immediately (quietly — this is initial sync, not a toggle).
    this.collapsed = !!mql.matches;
  }

  _teardownMedia() {
    if (!this._mql || !this._onMedia) return;
    if (typeof this._mql.removeEventListener === "function") this._mql.removeEventListener("change", this._onMedia);
    else if (typeof this._mql.removeListener === "function") this._mql.removeListener(this._onMedia);
    this._mql = null;
    this._onMedia = null;
  }

  _emitCollapse() {
    this.dispatchEvent(new CustomEvent("collapse", { bubbles: true, detail: { collapsed: this.collapsed } }));
  }

  // ---- public API -----------------------------------------------------------
  toggle() {
    this.collapsed = !this.collapsed;
    this._emitCollapse();
  }
}

customElements.define("puredashboard-layout", PuredashboardLayout);
customElements.define("puredashboard-header", PuredashboardHeader);
customElements.define("puredashboard-content", PuredashboardContent);
customElements.define("puredashboard-footer", PuredashboardFooter);
customElements.define("puredashboard-sider", PuredashboardSider);

export {
  PuredashboardLayout,
  PuredashboardHeader,
  PuredashboardContent,
  PuredashboardFooter,
  PuredashboardSider,
};
