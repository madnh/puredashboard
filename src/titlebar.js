// <puredashboard-titlebar> — a custom, draggable window titlebar for FRAMELESS
// desktop apps (Tauri, Wails, Electron with `frame:false`). Zero-dep, no build,
// CSP-safe. Extends plain HTMLElement (NOT Reactive) — like <puredashboard-form>,
// its whole job is to PRESERVE the author's light-DOM children while wrapping them
// into layout regions, so a Reactive render() that blows those children away is the
// wrong base.
//
// What it is: a ~38px bar pinned to the top of a frameless window. The bar itself
// is a DRAG REGION (CSS `-webkit-app-region: drag` + standard `app-region: drag`),
// so the OS moves the window when the user drags empty bar space; interactive
// descendants (buttons/links/inputs and anything tagged `.puredashboard-titlebar__nodrag`)
// are `no-drag` so they stay clickable.
//
// Three regions, built once on connect: LEADING (left), CENTER (title), TRAILING
// (right). Author children are moved into them: [data-titlebar-leading] →
// leading, [data-titlebar-center] → center, [data-titlebar-trailing] → trailing,
// and any UNMARKED child → trailing (the common case: trailing toolbar actions).
// A `title` property renders a text label in the center.
//
// Platform-aware. On macOS the OS paints the traffic-light buttons at top-left, so
// the bar reserves a left inset (--pd-titlebar-mac-inset) and CENTERS the title, and
// does NOT draw its own window buttons unless `controls` is set. On Windows/Linux the
// title is LEFT-aligned and the bar renders minimize / maximize-restore / close
// buttons at the right.
//
// The component NEVER calls an OS window API itself — it can't (it's just DOM). The
// control buttons emit BUBBLING (and composed) CustomEvents — "minimize",
// "maximizetoggle", "close" — that the host desktop app listens for and forwards to
// its window API (Tauri `appWindow.minimize()/toggleMaximize()/close()`, Wails
// `WindowMinimise()/WindowToggleMaximise()/Quit()`, Electron IPC, …). Reflect the
// window's real maximized state back with the `maximized` attribute to swap the
// maximize glyph for a restore glyph.
//
// Conventions mirror the rest of the library: fixed strings in a LABELS map + a
// `labels` override, BEM classes namespaced by the tag, script hooks as SEPARATE
// `js-…` classes / `data-*` attributes (never styled), inline self-contained SVG via
// a local svg() helper, and theming through the shared design tokens (--panel,
// --panel-2, --border, --text, --muted, --font-size-sm, --sp-*, --control-height-*,
// --duration-*) with a --pd-* fallback chain so it works with NO theme linked.
import { raw } from "./html.js";

// Trusted, self-contained window-control glyphs. Built with the same svg() helper
// shape as menu.js / upload.js (raw() marks the markup safe — it is authored here,
// never derived from user data), and inserted into a control button via innerHTML.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const minimizeGlyph = svg('<path d="M5 12h14"/>');
const maximizeGlyph = svg('<rect x="5.5" y="5.5" width="13" height="13" rx="1.5"/>');
const restoreGlyph  = svg('<rect x="7.5" y="7.5" width="11" height="11" rx="1.5"/><path d="M10 7.5V6a1.5 1.5 0 0 1 1.5-1.5H18A1.5 1.5 0 0 1 19.5 6v6.5A1.5 1.5 0 0 1 18 14h-1.5"/>');
const closeGlyph    = svg('<path d="M6 6 18 18"/><path d="M18 6 6 18"/>');

// All FIXED user-facing strings live here (English defaults). These are the
// aria-labels on the window-control buttons. Override any subset via the `labels`
// property — e.g. bar.labels = { close: "Đóng" }. Function-valued keys interpolate.
const LABELS = {
  minimize: "Minimize",
  maximize: "Maximize",
  restore: "Restore",
  close: "Close",
};

/**
 * A custom, draggable window titlebar for FRAMELESS desktop apps (Tauri / Wails /
 * Electron `frame:false`). Renders a ~38px bar whose empty space is an OS drag
 * region, arranges its light-DOM children into leading / center / trailing regions
 * (children are MOVED, never destroyed), optionally shows a centered/left title, and
 * — on Windows/Linux (or when `controls` is set) — draws minimize / maximize-restore
 * / close buttons on the right.
 *
 * It does NOT touch any OS window API (it can't — it's plain DOM). The control
 * buttons emit bubbling, composed CustomEvents the host app forwards to its window
 * API; reflect the real window state back via the `maximized` attribute.
 *
 * Place trailing toolbar actions as ordinary children; mark others with
 * `data-titlebar-leading` / `data-titlebar-center` / `data-titlebar-trailing` to
 * route them to a specific region. Configure via JS properties or attributes.
 *
 * @element puredashboard-titlebar
 *
 * @prop {string}  platform  - `"auto"` (default) | `"mac"` | `"windows"` | `"linux"`. `"auto"` detects via `navigator.userAgentData?.platform`, else `navigator.platform`.
 * @prop {string}  title     - Text rendered as the titlebar's title label (centered on mac, left on windows/linux). Default `""`.
 * @prop {boolean} controls  - Force-render the custom minimize/maximize/close buttons regardless of platform (mac hides them by default). Default `false`.
 * @prop {boolean} maximized - Reflected. When `true`, the maximize button shows a RESTORE glyph + label. Set this from the host to mirror the real window state. Default `false`.
 * @prop {Object}  labels    - Override the button aria-labels. Keys: `minimize`, `maximize`, `restore`, `close`. Unset keys keep the English default.
 *
 * @attr {string}  platform  - Declarative form of `platform`.
 * @attr {string}  title     - Declarative form of `title`.
 * @attr {boolean} controls  - Declarative form of `controls`.
 * @attr {boolean} maximized - Declarative form of `maximized`.
 *
 * @fires minimize      - `CustomEvent` (bubbles, composed) — the host should minimize the window.
 * @fires maximizetoggle - `CustomEvent` (bubbles, composed) — the host should toggle maximize/restore, then reflect the result via the `maximized` attribute.
 * @fires close         - `CustomEvent` (bubbles, composed) — the host should close the window.
 *
 * @cssprop [--pd-titlebar-height]    - Bar height (default `38px`).
 * @cssprop [--pd-titlebar-mac-inset] - Left inset reserved for the macOS traffic lights (default `78px`).
 * @cssprop [--pd-titlebar-bg]        - Bar background (defaults to `--panel`).
 *
 * @example
 * // <puredashboard-titlebar platform="windows" controls>
 * //   <span data-titlebar-center>My App</span>
 * // </puredashboard-titlebar>
 * const bar = document.querySelector("puredashboard-titlebar");
 * // Tauri v2:
 * import { getCurrentWindow } from "@tauri-apps/api/window";
 * const w = getCurrentWindow();
 * bar.addEventListener("minimize", () => w.minimize());
 * bar.addEventListener("maximizetoggle", async () => { await w.toggleMaximize(); bar.maximized = await w.isMaximized(); });
 * bar.addEventListener("close", () => w.close());
 */
class PuredashboardTitlebar extends HTMLElement {
  static get observedAttributes() { return ["platform", "title", "controls", "maximized"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._title = "";
    this._labels = null;
    this._leading = this._center = this._trailing = null;
    this._minBtn = this._maxBtn = this._closeBtn = null;
    this._resolved = "auto";
    // A template engine (or the story helper) may set properties before the element
    // upgrades, leaving own-properties that shadow these prototype accessors.
    // Reconcile them, as the rest of the library does.
    for (const p of ["platform", "title", "controls", "maximized", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reflected properties -------------------------------------------------
  get platform() { return this.getAttribute("platform") || "auto"; }
  set platform(v) { if (v == null) this.removeAttribute("platform"); else this.setAttribute("platform", String(v)); }

  // NOTE: this intentionally overrides HTMLElement.prototype.title (the advisory
  // tooltip) — for a titlebar the natural meaning of `title` is the window title.
  get title() { return this._title; }
  set title(v) { this._title = v == null ? "" : String(v); if (this._wrapped) this._renderTitle(); }

  get controls() { return this.hasAttribute("controls"); }
  set controls(v) { if (v) this.setAttribute("controls", ""); else this.removeAttribute("controls"); }

  get maximized() { return this.hasAttribute("maximized"); }
  set maximized(v) { if (v) this.setAttribute("maximized", ""); else this.removeAttribute("maximized"); }

  get labels() { return this._labels; }
  set labels(v) { this._labels = v || null; if (this._wrapped) this._syncLabels(); }

  attributeChangedCallback(name, _old, val) {
    if (name === "title") { this._title = val || ""; if (this._wrapped) this._renderTitle(); return; }
    if (!this._wrapped) return;
    if (name === "platform") { this._syncPlatform(); this._renderControls(); }
    else if (name === "controls") { this._renderControls(); }
    else if (name === "maximized") { this._renderControls(); this._updateMaxIcon(); }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this._labels && this._labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() { this._wrap(); }

  // Build the three regions and MOVE the author's current children into them,
  // preserving order. Guarded so it runs exactly once even across
  // disconnect/reconnect — moving children again would re-nest the wrappers.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    const leading = this._region("leading");
    const center = this._region("center");
    const trailing = this._region("trailing");

    // Re-read from a snapshot: appending into a region removes the node from `this`,
    // so iterate a captured array rather than the live childNodes.
    for (const node of [...this.childNodes]) {
      if (node.nodeType === 1) {
        if (node.hasAttribute("data-titlebar-leading")) leading.appendChild(node);
        else if (node.hasAttribute("data-titlebar-center")) center.appendChild(node);
        else if (node.hasAttribute("data-titlebar-trailing")) trailing.appendChild(node);
        else trailing.appendChild(node);                       // unmarked → trailing toolbar
      } else if (node.nodeType === 3 && node.textContent.trim() === "") {
        node.remove();                                          // drop layout whitespace
      } else {
        trailing.appendChild(node);                             // stray text/comment → trailing
      }
    }

    this.appendChild(leading);
    this.appendChild(center);
    this.appendChild(trailing);
    this._leading = leading; this._center = center; this._trailing = trailing;

    this._syncPlatform();
    this._renderTitle();
    this._renderControls();
  }

  _region(name) {
    const d = document.createElement("div");
    d.className = `puredashboard-titlebar__region puredashboard-titlebar__region--${name}`;
    return d;
  }

  // Resolve "auto" to a concrete platform. Guarded for the absence of navigator /
  // its fields (Node/jsdom, locked-down embeds) — falls back to "linux".
  _resolvePlatform() {
    const p = this.platform;
    if (p === "mac" || p === "windows" || p === "linux") return p;
    let s = "";
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      s = (nav && nav.userAgentData && nav.userAgentData.platform) || (nav && nav.platform) || "";
    } catch { s = ""; }
    s = String(s).toLowerCase();
    if (s.includes("mac") || s.includes("darwin") || s.includes("iphone") || s.includes("ipad")) return "mac";
    if (s.includes("win")) return "windows";
    return "linux";
  }

  _syncPlatform() {
    const p = this._resolvePlatform();
    this._resolved = p;
    this.classList.remove("puredashboard-titlebar--mac", "puredashboard-titlebar--windows", "puredashboard-titlebar--linux");
    this.classList.add(`puredashboard-titlebar--${p}`);
  }

  // Custom window buttons show on windows/linux, or whenever `controls` is forced.
  _showControls() { return this.controls || this._resolved !== "mac"; }

  _renderTitle() {
    if (!this._center) return;
    let label = this._center.querySelector(".js-puredashboard-titlebar__title");
    if (this._title) {
      if (!label) {
        label = document.createElement("span");
        label.className = "puredashboard-titlebar__title js-puredashboard-titlebar__title";
        this._center.insertBefore(label, this._center.firstChild);
      }
      label.textContent = this._title;                          // textContent only — never innerHTML
    } else if (label) {
      label.remove();
    }
  }

  _renderControls() {
    if (!this._trailing) return;
    let box = this._trailing.querySelector(".js-puredashboard-titlebar__controls");
    if (!this._showControls()) {
      if (box) box.remove();
      this._minBtn = this._maxBtn = this._closeBtn = null;
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.className = "puredashboard-titlebar__controls js-puredashboard-titlebar__controls";
      this._trailing.appendChild(box);                          // far right (trailing packs to the end)
      this._minBtn = this._ctrlBtn("minimize", minimizeGlyph, "minimize");
      this._maxBtn = this._ctrlBtn("maximize", maximizeGlyph, "maximizetoggle");
      this._closeBtn = this._ctrlBtn("close", closeGlyph, "close", true);
      box.appendChild(this._minBtn);
      box.appendChild(this._maxBtn);
      box.appendChild(this._closeBtn);
    }
    this._syncLabels();
    this._updateMaxIcon();
  }

  _ctrlBtn(labelKey, glyph, event, danger) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "puredashboard-titlebar__control puredashboard-titlebar__nodrag js-puredashboard-titlebar__control"
      + (danger ? " puredashboard-titlebar__control--close" : "");
    b.setAttribute("data-act", event);
    b.setAttribute("aria-label", this._label(labelKey));
    const ic = document.createElement("span");
    ic.className = "puredashboard-titlebar__control-icon";
    ic.innerHTML = String(glyph);                               // trusted self-contained SVG (raw)
    b.appendChild(ic);
    // The component never calls an OS API — it announces intent as a bubbling,
    // composed CustomEvent the host app wires to its window controller.
    b.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent(event, { bubbles: true, composed: true }));
    });
    return b;
  }

  // Keep the maximize button in sync with the reflected `maximized` state: swap the
  // glyph (maximize ↔ restore) and its aria-label.
  _updateMaxIcon() {
    if (!this._maxBtn) return;
    const max = this.maximized;
    this._maxBtn.setAttribute("data-act", "maximizetoggle");
    this._maxBtn.setAttribute("aria-label", this._label(max ? "restore" : "maximize"));
    const ic = this._maxBtn.querySelector(".puredashboard-titlebar__control-icon");
    if (ic) ic.innerHTML = String(max ? restoreGlyph : maximizeGlyph);
  }

  _syncLabels() {
    if (this._minBtn) this._minBtn.setAttribute("aria-label", this._label("minimize"));
    if (this._closeBtn) this._closeBtn.setAttribute("aria-label", this._label("close"));
    if (this._maxBtn) this._maxBtn.setAttribute("aria-label", this._label(this.maximized ? "restore" : "maximize"));
  }
}

customElements.define("puredashboard-titlebar", PuredashboardTitlebar);

export { PuredashboardTitlebar };
