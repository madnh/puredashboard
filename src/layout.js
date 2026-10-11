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
// little behaviour: on connect it sorts the author's children into a sticky
// header (`slot="header"`), a scrollable middle and a sticky footer
// (`slot="footer"`), and, when collapsible, appends a collapse trigger — the
// children (your nav, brand, user menu) stay intact, just relocated. It also
// mirrors `collapsed` onto its <puredashboard-nav> descendants as `icon-only`,
// optionally toggles on Cmd/Ctrl+<key>, remembers its state in localStorage,
// adds an edge rail, and below its breakpoint opens as a drawer over the
// content instead of pushing it.
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
  rail: "Toggle sidebar",
};

// localStorage key prefix for `persist`.
const PERSIST_PREFIX = "puredashboard-sider:";

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
 * Beside a `variant="inset"` sider, the nested layout (or a bare content) becomes the
 * raised card. Mark that nested layout `plain` to keep IT on the page background: its
 * header then sheds the panel and border (a bare toolbar above the card) and what is
 * inside it is the card instead — a bare `<puredashboard-content>`, or a nested layout
 * that keeps its own header (title bar) and content within the card — the "toolbar
 * above the inset".
 *
 * Preserves author children untouched — place any of `<puredashboard-header>`,
 * `<puredashboard-content>`, `<puredashboard-footer>`, `<puredashboard-sider>`,
 * or your own markup inside it.
 *
 * @element puredashboard-layout
 *
 * @prop {boolean} hasSider - Force the horizontal (row) layout. Default `false`.
 * @prop {boolean} plain    - Beside an inset sider: this nested layout is NOT the card — its header is a bare toolbar and the content (or nested layout) inside becomes the card. Default `false`.
 * @attr {boolean} has-sider - Declarative form of `hasSider`.
 * @attr {boolean} plain    - Declarative form of `plain`.
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
    this._upgrade("plain");
  }

  // Reconcile a property set BEFORE upgrade (a template engine may assign it),
  // which would otherwise shadow the prototype accessor.
  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  get hasSider() { return this.hasAttribute("has-sider"); }
  set hasSider(v) { if (v) this.setAttribute("has-sider", ""); else this.removeAttribute("has-sider"); }

  get plain() { return this.hasAttribute("plain"); }
  set plain(v) { if (v) this.setAttribute("plain", ""); else this.removeAttribute("plain"); }
}

/**
 * The top bar of a layout — a fixed-height horizontal flex row with `--panel`
 * background and a bottom border. Preserves author children (brand, nav,
 * actions); lay them out with the flex it provides. To split the bar into sections,
 * wrap children in `puredashboard-header__start` (hugs the left: sider toggle,
 * breadcrumb), `puredashboard-header__center` (takes the slack and centres: search,
 * tabs) and `puredashboard-header__end` (hugs the right: actions, user menu) — any of
 * the three may be omitted; a bare child with `margin-inline-start:auto` still works.
 *
 * @element puredashboard-header
 *
 * @cssprop [--pd-header-height] - Bar height (defaults to `--control-height-lg` × 1.4).
 * @cssprop [--pd-header-bg]     - Background (defaults to `--panel`).
 *
 * @example
 * // <puredashboard-header>
 * //   <div class="puredashboard-header__start"><button aria-label="Toggle sidebar">☰</button><puredashboard-breadcrumb></puredashboard-breadcrumb></div>
 * //   <div class="puredashboard-header__center"><puredashboard-input type="search" placeholder="Search…"></puredashboard-input></div>
 * //   <div class="puredashboard-header__end"><puredashboard-badge count="3"><button>Inbox</button></puredashboard-badge><puredashboard-avatar name="Ada"></puredashboard-avatar></div>
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
 * A side panel for a layout — typically holding a `<puredashboard-nav>`. Modelled on
 * the shadcn Sidebar: on connect it sorts the author's children (order preserved) into
 * a sticky header (`slot="header"`: brand, workspace switcher), a scrollable middle
 * (everything else: the nav) and a sticky footer (`slot="footer"`: user menu), and,
 * when `collapsible`, appends a collapse trigger at the bottom. The panel width is
 * driven by an inline `--pd-sider-w` custom property that flips between `width` and
 * `collapsedWidth` (or `0` when `collapsible="offcanvas"`), and animates via the shared
 * motion tokens (reduced-motion safe). Its mere presence as a direct child makes the
 * parent `<puredashboard-layout>` a horizontal row.
 *
 * While `collapsed`, every `<puredashboard-nav>` inside gets the `icon-only` attribute
 * (icons centred, labels hidden but still the links' names and shown as `title`), and
 * any element carrying the `puredashboard-sider__expanded-only` class is hidden — put
 * it on the brand text beside a logo, or the name beside an avatar.
 *
 * Configure via JS properties or declarative attributes. `collapsed` is reflected to
 * the `collapsed` attribute. When a `breakpoint` is set, a `matchMedia` listener
 * auto-collapses the sider below that width (feature-detected — a no-op where
 * `matchMedia` is unavailable); expanding it again there (trigger, rail, shortcut or
 * `toggle()`) opens it as a DRAWER over the content (`overlay` attribute, set by the
 * element): the layout gets a backdrop, the sider's layout siblings become `inert`, and
 * clicking the backdrop, pressing Escape (unless something already handled it —
 * `defaultPrevented`, e.g. an open menu) or following a link inside closes the drawer.
 * Below the breakpoint the collapsed state is transient: `persist` is neither written
 * there nor overridden by it, and growing past the breakpoint restores the state held
 * before it matched (the persisted one when `persist` is set). `breakpoint-collapse=
 * "offcanvas"` makes the sider disappear entirely below the breakpoint (width `0`)
 * instead of leaving the icon rail — the usual "rail on desktop, hamburger + drawer on
 * phones" shell, with your header button calling `toggle()`.
 *
 * Whenever the sider is collapsed to width `0` (that mode, `collapsible="offcanvas"`,
 * or `collapsed-width="0"`) it carries the `closed` state attribute: its header, scroll
 * region, footer and trigger are `inert` and hidden, so nothing inside is reachable by
 * Tab or pointer, and the edge border is dropped. Only the `rail` (a pointer handle) and
 * the keyboard `shortcut` remain as ways back in — or your own button.
 *
 * @element puredashboard-sider
 *
 * @prop {number}  width          - Expanded width in px. Default `220`.
 * @prop {number}  collapsedWidth - Collapsed width in px (icon rail). Default `64`. Ignored by `collapsible="offcanvas"` (collapses to `0`).
 * @prop {boolean} collapsible    - Render a collapse trigger button (and allow collapsing). Default `false`.
 * @prop {string}  collapseMode   - Read-only: `"icon"` (collapses to the icon rail) or `"offcanvas"` (slides out completely; pair with `rail` or your own toggle). Set via the `collapsible` attribute's value; reads `"offcanvas"` while the breakpoint matches and `breakpointCollapse` is `"offcanvas"`.
 * @prop {boolean} collapsed      - Collapsed state (reflected to the `collapsed` attribute). Default `false`.
 * @prop {string}  breakpoint     - `"sm"` | `"md"` | `"lg"` — auto-collapse below this width; below it an expanded sider is a drawer. Default `""` (off).
 * @prop {boolean} breakpointMatches - Read-only: the viewport is currently below `breakpoint` (always `false` without one or without `matchMedia`).
 * @prop {string}  breakpointCollapse - How the sider collapses BELOW the breakpoint: `"icon"` (the icon rail, default) or `"offcanvas"` (width `0`, nothing shown; open it as a drawer with `toggle()` from a header button). Above the breakpoint the `collapsible` mode applies.
 * @prop {string}  variant        - `""` (flush panel with an edge border, default) | `"floating"` (a rounded, bordered, shadowed card inset from the layout edges) | `"inset"` (the sider sits on the layout background and the CONTENT beside it becomes the inset card).
 * @prop {string}  trigger        - How the collapse trigger looks: `"bar"` (a full-width strip with a top border, default) | `"button"` (a small centred icon button, no strip — reads right on a transparent or card sider). Unset, `variant="inset"` uses `"button"`, everything else `"bar"`.
 * @prop {boolean} rail           - Add a thin toggle handle along the sider's outer edge (shadcn SidebarRail): hover shows a line, click toggles. Default `false`.
 * @prop {string}  shortcut       - A key that toggles the sider with Cmd (macOS) / Ctrl held, e.g. `"b"`. Default `""` (off); the bare attribute means `"b"`.
 * @prop {string}  persist        - A name under which the collapsed state is remembered in `localStorage` (`puredashboard-sider:<name>`) and restored on connect. Default `""` (off). Only choices made ABOVE the breakpoint are stored; opening/closing the drawer below it leaves the stored value alone.
 * @prop {Object}  labels         - Override UI strings. Keys: `expand`, `collapse`, `rail`. Unset keys keep the English default.
 * @attr {number}  width          - Declarative form of `width`.
 * @attr {number}  collapsed-width - Declarative form of `collapsedWidth`.
 * @attr {boolean|string} collapsible - Declarative form of `collapsible`; the value `"offcanvas"` selects that collapse mode (`"icon"` or empty = the icon rail).
 * @attr {boolean} collapsed      - Declarative form of `collapsed`.
 * @attr {string}  breakpoint     - Declarative form of `breakpoint`.
 * @attr {string}  breakpoint-collapse - Declarative form of `breakpointCollapse` (`"icon"` | `"offcanvas"`).
 * @attr {string}  variant        - Declarative form of `variant`.
 * @attr {string}  trigger        - Declarative form of `trigger`.
 * @attr {boolean} rail           - Declarative form of `rail`.
 * @attr {string}  shortcut       - Declarative form of `shortcut`.
 * @attr {string}  persist        - Declarative form of `persist`.
 * @attr {boolean} overlay        - STATE, set by the element: the sider is open as a drawer below its breakpoint. Do not set it yourself.
 * @attr {boolean} closed         - STATE, set by the element: the sider is collapsed to width `0` (its regions are `inert` and hidden). Do not set it yourself.
 *
 * @fires collapse - `CustomEvent` (bubbles) when the collapsed state changes via the trigger, rail, shortcut, drawer dismissal, `toggle()`, or a breakpoint. `detail = { collapsed }`.
 * @fires breakpoint - `CustomEvent` (bubbles) on every media-query flip across `breakpoint` (not on the initial sync), whether or not `collapsed` changed. `detail = { matches, collapsed, collapseMode }` — read `collapseMode` here to show/hide desktop-only UI (a shortcut hint) without your own `matchMedia`.
 *
 * @method toggle - `toggle() => void` — flip `collapsed` and emit `collapse`. Below the breakpoint this opens / closes the drawer without touching `persist`.
 *
 * @cssprop [--pd-sider-w]   - Current width (set inline by the element; do not override).
 * @cssprop [--pd-sider-bg]  - Background (defaults to the theme's `--sidebar-bg`, then `--panel`). The theme's `--sidebar-text` / `--sidebar-muted` / `--sidebar-border` / `--sidebar-hover` / `--sidebar-active` tokens colour the sider and the nav inside it; define them to give the sidebar its own palette.
 * @cssprop [--pd-sider-nav-inset] - Padding around a `<puredashboard-nav>` child and inside the header/footer slots (defaults to `--sp-2`; `0` = edge to edge).
 * @cssprop [--pd-sider-drawer-w] - Drawer width below the breakpoint (defaults to the expanded `width`).
 *
 * @example
 * const sider = document.createElement("puredashboard-sider");
 * sider.collapsible = true; sider.breakpoint = "md"; sider.rail = true; sider.shortcut = "b";
 * brand.slot = "header"; userMenu.slot = "footer";
 * sider.append(brand, nav, userMenu);
 * sider.addEventListener("collapse", (e) => console.log(e.detail.collapsed));
 */
class PuredashboardSider extends HTMLElement {
  static get observedAttributes() { return ["width", "collapsed-width", "collapsible", "collapsed", "breakpoint", "breakpoint-collapse", "rail", "shortcut", "persist"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._inner = null;
    this._header = null;
    this._footer = null;
    this._trigger = null;
    this._rail = null;
    this._mql = null;
    this._onMedia = null;
    this._bpActive = false;     // the breakpoint currently matches (we collapsed for it)
    this._beforeBp = false;     // `collapsed` as it stood when the breakpoint last matched
    this._observer = null;
    this._overlayParent = null;
    this._inerted = [];         // layout siblings we made inert for the drawer
    for (const p of ["width", "collapsedWidth", "collapsible", "collapsed", "breakpoint", "breakpointCollapse", "variant", "trigger", "rail", "shortcut", "persist", "labels"]) this._upgrade(p);
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
  // `true` → bare attribute (icon mode); the string "offcanvas" keeps its value (the mode).
  set collapsible(v) { if (v) this.setAttribute("collapsible", typeof v === "string" ? v : ""); else this.removeAttribute("collapsible"); }

  get collapsed() { return this.hasAttribute("collapsed"); }
  set collapsed(v) { if (!!v === this.hasAttribute("collapsed")) return; if (v) this.setAttribute("collapsed", ""); else this.removeAttribute("collapsed"); }

  get breakpoint() { return this.getAttribute("breakpoint") || ""; }
  set breakpoint(v) { if (v) this.setAttribute("breakpoint", v); else this.removeAttribute("breakpoint"); }

  get breakpointCollapse() { return (this.getAttribute("breakpoint-collapse") || "").trim() === "offcanvas" ? "offcanvas" : "icon"; }
  set breakpointCollapse(v) { if (v && v !== "icon") this.setAttribute("breakpoint-collapse", String(v)); else this.removeAttribute("breakpoint-collapse"); }

  // `collapsible` stays a boolean (the attribute's presence); its VALUE picks the mode.
  // Below a matching breakpoint, `breakpoint-collapse` takes over.
  get collapseMode() {
    if (this._bpMatches() && this.breakpointCollapse === "offcanvas") return "offcanvas";
    return (this.getAttribute("collapsible") || "").trim() === "offcanvas" ? "offcanvas" : "icon";
  }
  _bpMatches() { return !!(this._mql && this._mql.matches); }
  get breakpointMatches() { return this._bpMatches(); }

  get variant() { return this.getAttribute("variant") || ""; }
  set variant(v) { if (v) this.setAttribute("variant", v); else this.removeAttribute("variant"); }

  // The trigger's look; the CSS applies the same default (inset → button) on its own.
  get trigger() { const v = (this.getAttribute("trigger") || "").trim(); return v === "button" || v === "bar" ? v : (this.variant === "inset" ? "button" : "bar"); }
  set trigger(v) { if (v) this.setAttribute("trigger", String(v)); else this.removeAttribute("trigger"); }

  get rail() { return this.hasAttribute("rail"); }
  set rail(v) { if (v) this.setAttribute("rail", ""); else this.removeAttribute("rail"); }

  // Bare attribute = "b" (the shadcn default); a value = that key.
  get shortcut() { if (!this.hasAttribute("shortcut")) return ""; return (this.getAttribute("shortcut") || "b").trim().toLowerCase(); }
  set shortcut(v) { if (v) this.setAttribute("shortcut", v === true ? "b" : String(v)); else this.removeAttribute("shortcut"); }

  get persist() { return this.getAttribute("persist") || ""; }
  set persist(v) { if (v) this.setAttribute("persist", v); else this.removeAttribute("persist"); }

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
        this._syncNavs();
        this._syncOverlay();
        break;
      case "collapsible":
        this._applyWidth();   // offcanvas ↔ icon changes the collapsed width
        this._syncTrigger();
        break;
      case "breakpoint-collapse":
        this._applyWidth();   // only matters while the breakpoint matches
        break;
      case "breakpoint":
        this._setupMedia();
        break;
      case "rail":
        this._syncRail();
        break;
      case "shortcut":
        this._setupShortcut();
        break;
      case "persist":
        this._restore();
        break;
    }
  }

  connectedCallback() {
    this._wrap();
    this._restore();        // persisted state first …
    this._applyWidth();
    this._syncTrigger();
    this._syncRail();
    this._setupMedia();     // … a matching breakpoint still collapses
    this._setupShortcut();
    this._syncNavs();
    this._syncOverlay();
    // A nav appended later (or swapped by a router) still gets `icon-only` while collapsed.
    if (typeof MutationObserver === "function" && !this._observer) {
      this._observer = new MutationObserver(() => this._syncNavs());
      this._observer.observe(this, { childList: true, subtree: true });
    }
  }

  disconnectedCallback() {
    this._teardownMedia();
    this._teardownShortcut();
    this._overlayOff();
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
  }

  // Sort the author's children (once) into header / inner scroll region / footer by their
  // `slot` attribute (plain light-DOM attributes — there is no shadow root; the name is
  // just the familiar one). Re-reading firstChild each pass handles the live child list.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;
    const inner = document.createElement("div");
    inner.className = "puredashboard-sider__inner js-puredashboard-sider__inner";
    let header = null, footer = null;
    const part = (cls) => { const d = document.createElement("div"); d.className = `puredashboard-sider__${cls} js-puredashboard-sider__${cls}`; return d; };
    while (this.firstChild) {
      const c = this.firstChild;
      const slot = c.nodeType === 1 ? c.getAttribute("slot") : null;
      if (slot === "header") (header ||= part("header")).appendChild(c);
      else if (slot === "footer") (footer ||= part("footer")).appendChild(c);
      else inner.appendChild(c);
    }
    if (header) this.appendChild(header);
    this.appendChild(inner);
    if (footer) this.appendChild(footer);
    this._header = header;
    this._inner = inner;
    this._footer = footer;
  }

  // Drive the current width via an inline custom property the CSS reads.
  _applyWidth() {
    const w = this.collapsed ? (this.collapseMode === "offcanvas" ? 0 : this.collapsedWidth) : this.width;
    this.style.setProperty("--pd-sider-w", w + "px");
    this._syncClosed(w === 0);
  }

  // `closed` = collapsed to nothing. A 0-wide panel must not keep its contents in the
  // Tab order (measured: 11 stops in a hidden sider) — every region except the pointer
  // rail is made `inert` (and hidden by CSS). Idempotent; the trigger/rail call it too.
  _syncClosed(on = this.style.getPropertyValue("--pd-sider-w") === "0px") {
    // Before _wrap the children are still the AUTHOR's nodes: marking them would leave a
    // stale `inert` on the nav once they move into the regions. connectedCallback re-runs.
    if (!this._wrapped) return;
    if (on !== this.hasAttribute("closed")) this.toggleAttribute("closed", on);
    for (const c of this.children) {
      if (c === this._rail) continue;
      if (c.hasAttribute("inert") !== on) c.toggleAttribute("inert", on);
    }
  }

  // Mirror `collapsed` onto every <puredashboard-nav> inside as `icon-only` (the nav's own
  // rail mode: centred icons, labels as titles). Idempotent — the observer calls it often.
  _syncNavs() {
    const on = this.collapsed;
    for (const nav of this.querySelectorAll("puredashboard-nav")) {
      if (nav.hasAttribute("icon-only") !== on) nav.toggleAttribute("icon-only", on);
    }
  }

  // ---- edge rail (shadcn SidebarRail) --------------------------------------
  _syncRail() {
    if (!this._wrapped) return;
    if (this.rail) {
      if (!this._rail) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "puredashboard-sider__rail js-puredashboard-sider__rail";
        btn.setAttribute("aria-label", this._label("rail"));
        btn.tabIndex = -1;   // the trigger / shortcut are the keyboard paths; the rail is a pointer handle
        btn.addEventListener("click", this._onTrigger);
        this.appendChild(btn);
        this._rail = btn;
      }
    } else if (this._rail) {
      this._rail.removeEventListener("click", this._onTrigger);
      this._rail.remove();
      this._rail = null;
    }
    this._syncClosed();
  }

  // ---- keyboard shortcut: Cmd/Ctrl + <key> toggles ---------------------------
  _setupShortcut() {
    this._teardownShortcut();
    if (!this.shortcut || !this.isConnected || typeof window === "undefined") return;
    this._onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if ((e.key || "").toLowerCase() !== this.shortcut) return;
      e.preventDefault();
      this.toggle();
    };
    window.addEventListener("keydown", this._onKey);
  }
  _teardownShortcut() {
    if (!this._onKey) return;
    window.removeEventListener("keydown", this._onKey);
    this._onKey = null;
  }

  // ---- persisted state (localStorage, guarded: private mode / no storage = no-op) ----
  _storage() {
    try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
  }
  // The stored choice: true / false, or null when there is none (no `persist`, nothing saved).
  _stored() {
    const key = this.persist;
    if (!key) return null;
    const st = this._storage();
    if (!st) return null;
    let v = null;
    try { v = st.getItem(PERSIST_PREFIX + key); } catch { /* blocked storage */ }
    return v === "collapsed" ? true : v === "expanded" ? false : null;
  }
  _restore() {
    if (!this._wrapped) return;
    const v = this._stored();
    if (v !== null) this.collapsed = v;
  }
  // Only a choice made ABOVE the breakpoint is worth remembering: below it the sider is a
  // drawer, and opening it once must not turn a desktop "collapsed" into "expanded".
  _save() {
    const key = this.persist;
    if (!key || this._bpMatches()) return;
    const st = this._storage();
    if (!st) return;
    try { st.setItem(PERSIST_PREFIX + key, this.collapsed ? "collapsed" : "expanded"); } catch { /* quota / blocked */ }
  }

  // ---- drawer below the breakpoint ---------------------------------------
  // `overlay` = (breakpoint currently matches) && !collapsed. While on, the parent layout
  // paints a backdrop; a click on it (the parent itself, not a child), Escape, or a link
  // inside the sider closes the drawer.
  _syncOverlay() {
    const on = !!(this._mql && this._mql.matches) && !this.collapsed;
    if (on === this.hasAttribute("overlay")) return;
    this.toggleAttribute("overlay", on);
    if (on) this._overlayOn(); else this._overlayOff();
  }
  _overlayOn() {
    const parent = this.parentElement;
    if (!parent) return;
    this._overlayParent = parent;
    parent.addEventListener("click", this._onBackdrop);
    document.addEventListener("keydown", this._onEsc);
    this.addEventListener("click", this._onInnerLink);
    // A drawer is modal: the content beside it is behind the backdrop, so take it out of
    // the Tab order and the accessibility tree too (only what we set is restored).
    for (const c of parent.children) {
      if (c === this || c.hasAttribute("inert")) continue;
      c.setAttribute("inert", "");
      this._inerted.push(c);
    }
  }
  _overlayOff() {
    const parent = this._overlayParent;
    if (!parent) return;
    parent.removeEventListener("click", this._onBackdrop);
    document.removeEventListener("keydown", this._onEsc);
    this.removeEventListener("click", this._onInnerLink);
    for (const c of this._inerted) c.removeAttribute("inert");
    this._inerted = [];
    this._overlayParent = null;
  }
  _closeDrawer() { if (this.hasAttribute("overlay") && !this.collapsed) { this.collapsed = true; this._emitCollapse(); } }
  _onBackdrop = (e) => { if (e.target === this._overlayParent) this._closeDrawer(); };
  // An Escape that something else already consumed (an open menu / popover) stays theirs.
  _onEsc = (e) => { if (e.key === "Escape" && !e.defaultPrevented) this._closeDrawer(); };
  _onInnerLink = (e) => { const a = e.target.closest && e.target.closest("a[href]"); if (a && this.contains(a)) this._closeDrawer(); };

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
    this._syncClosed();
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
      const want = e.matches ? this._enterBp() : this._leaveBp();
      if (want !== this.collapsed) {
        this.collapsed = want;
        this._emitCollapse();
      }
      this._applyWidth();    // `collapseMode` may differ on each side of the breakpoint
      this._syncOverlay();   // crossing the breakpoint while open turns the drawer on/off
      this.dispatchEvent(new CustomEvent("breakpoint", { bubbles: true, detail: { matches: !!e.matches, collapsed: this.collapsed, collapseMode: this.collapseMode } }));
    };
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", this._onMedia);
    else if (typeof mql.addListener === "function") mql.addListener(this._onMedia); // legacy
    // Apply the current match immediately (quietly — this is initial sync, not a toggle).
    // Only COLLAPSE on a match: above the breakpoint an author-set or persisted `collapsed` stands.
    if (mql.matches) this.collapsed = this._enterBp();
    this._applyWidth();
    this._syncOverlay();
  }

  // Entering the breakpoint remembers what the sider was (so leaving it can put that back
  // instead of always expanding — a desktop `collapsed` choice survives a phone-width
  // detour); below it the state is transient. Re-entering while already under it (the
  // breakpoint attribute changed) keeps the remembered value.
  _enterBp() {
    if (!this._bpActive) { this._bpActive = true; this._beforeBp = this.collapsed; }
    return true;
  }
  // Leaving it: the persisted choice when there is one, else the remembered state.
  _leaveBp() {
    this._bpActive = false;
    const stored = this._stored();
    return stored === null ? this._beforeBp : stored;
  }

  _teardownMedia() {
    if (!this._mql || !this._onMedia) return;
    if (typeof this._mql.removeEventListener === "function") this._mql.removeEventListener("change", this._onMedia);
    else if (typeof this._mql.removeListener === "function") this._mql.removeListener(this._onMedia);
    this._mql = null;
    this._onMedia = null;
    // `_bpActive` / `_beforeBp` deliberately survive: connectedCallback re-runs _setupMedia
    // after the attribute callbacks already collapsed us, and the remembered state must be
    // the one from BEFORE that (measured in Chrome: a reset here made "wide again" restore
    // `collapsed` for a sider that had been expanded).
  }

  _emitCollapse() {
    this.dispatchEvent(new CustomEvent("collapse", { bubbles: true, detail: { collapsed: this.collapsed } }));
  }

  // ---- public API -----------------------------------------------------------
  toggle() {
    this.collapsed = !this.collapsed;
    this._save();
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
