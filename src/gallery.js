// <puredashboard-gallery> — a mini component explorer ("Storybook-lite").
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Give it a `stories` array and it renders an app shell made of the library's own
// layout: a <puredashboard-sider> holding a filter box and a <puredashboard-nav> of the
// components (one titled section per story `title` prefix), a <puredashboard-header>
// toolbar (sidebar toggle · title · theme / language / density / viewport), and a
// <puredashboard-content> canvas. With nothing selected the canvas is an INDEX of every
// component (grouped cards); selecting one mounts each of its stories live. Optional
// `overview` shows every component's first story in a contact-sheet grid; optional
// `route` mirrors the view into the URL query (?c=&s=&q=&theme=&vp=&only=&overview=) so
// a page can be linked or screenshotted. A "Viewport" switch (toolbar for every card, or
// per card) stages a story in an <iframe> sized like a phone / tablet / desktop, so
// responsive behaviour shows for real.
//
// It is a plain gallery over WHATEVER components you feed it — nothing here is
// specific to PureDashboard, so you can reuse it to preview your own elements.
import { Reactive, html, repeat, renderResult } from "./reactive.js";
import { raw } from "./html.js";
// The gallery dogfoods the library: its shell is a layout + sider + nav + header, the
// filter is an input, the per-card viewport switch a segmented control.
import "./layout.js";
import "./nav.js";
import "./input.js";
import "./segmented.js";

// Inlined 16px icons for the viewport switch (rule: each component carries its own SVG).
const vpIcon = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${d}</svg>`;
const ICON_AUTO    = vpIcon('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>');
const ICON_PHONE   = vpIcon('<rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><path d="M7 12.5h2"/>');
const ICON_TABLET  = vpIcon('<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M7 12.5h2"/>');
const ICON_DESKTOP = vpIcon('<rect x="1.5" y="2.5" width="13" height="9" rx="1.5"/><path d="M8 11.5v3M5.5 14.5h5"/>');
const VP_ICONS = { auto: ICON_AUTO, phone: ICON_PHONE, tablet: ICON_TABLET, desktop: ICON_DESKTOP };
const ICON_MENU_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="overflow:visible"><path d="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>';

const LABELS = {
  theme: "Theme", light: "light", dark: "dark",
  lang: "Lang", density: "Density", normal: "normal", compact: "compact",
  viewport: "Viewport", auto: "Auto", phone: "Phone", tablet: "Tablet", desktop: "Desktop",
  all: (n) => `All components (${n})`,
  index: "Index", overview: "Overview",
  components: (n) => `Components (${n})`,
  stories: (n) => (n === 1 ? "1 story" : `${n} stories`),
  filter: "Filter components…", noMatch: (q) => `No component matches “${q}”.`,
  toggleSidebar: "Toggle sidebar",
  empty: "No stories yet.",
  renderError: (m) => "render error: " + m,
};

// Viewport presets (px). Widths are the ones that matter for breakpoints (an iPhone 14,
// an iPad Air, a small laptop); one shared height keeps the cards comparable. A custom
// size is "WxH".
const VIEWPORTS = {
  phone:   { width: 390,  height: 760 },
  tablet:  { width: 820,  height: 760 },
  desktop: { width: 1280, height: 760 },
};
function parseViewport(v) {
  if (!v || v === "auto") return null;
  if (VIEWPORTS[v]) return VIEWPORTS[v];
  const m = /^(\d+)x(\d+)$/.exec(String(v));
  return m ? { width: +m[1], height: +m[2] } : null;
}

/**
 * A component gallery / mini-Storybook. Feed it stories and it renders an explorer
 * UI; each story's `render()` returns a live element that is mounted as-is.
 *
 * The chrome is built from the library itself: a `<puredashboard-layout>` with a
 * `<puredashboard-sider>` (filter box in its header slot, a `<puredashboard-nav>` of the
 * components grouped into sections by `title` prefix; collapsible off-canvas, a drawer
 * below `md`, remembered in `localStorage`), a `<puredashboard-header>` toolbar and a
 * `<puredashboard-content>` canvas. Nav rows and index cards are real links (`?c=<tag>`),
 * so Cmd/Ctrl-click opens a component in a new tab; a plain click switches in place.
 * Press `/` to focus the filter.
 *
 * @element puredashboard-gallery
 *
 * @prop {Array}   stories  - Story defs: `[{ tag, title:"Family/Name", description?, stories:[{ name, render:()=>Element, notes?, viewport? }] }]`. A story's own `viewport` (`"phone"` | `"tablet"` | `"desktop"` | `"WxH"` | `{ width, height }`) is the size it is framed at by default; a def's `description` shows on its index card (else its first story's `notes`).
 * @prop {string}  viewport - Frame EVERY card of the current component in an `<iframe>` of this size: `"phone"` (390px) | `"tablet"` (820px) | `"desktop"` (1280px) | `"WxH"`; `""` (default) = each story's own `viewport`, else inline. The frame loads this page in `only` mode (needs `route`), so the story gets a REAL viewport — breakpoints, media queries and `100vh` behave as on that device (a framed `render()` should fill `100vh`). Each card also has its own Auto / Phone / Tablet / Desktop switch (`frames`, keyed by story name) that overrides this.
 * @prop {Object}  frames   - Per-card viewport overrides `{ [storyName]: "auto" | "phone" | "tablet" | "desktop" | "WxH" }`, set by the card switches (a `<puredashboard-segmented>` with icons; `"auto"` = the story's own `viewport` or inline).
 * @prop {string}  selected - Active component `tag`. Default `""` = the index page listing every component.
 * @prop {string}  story    - Active story `name` (show just one). Default: all of the component's stories.
 * @prop {string}  filter   - Text that narrows the sidebar and the index to components whose short name (the tag without `puredashboard-`) or title contains it (case-insensitive). Typed into the sidebar's filter box.
 * @prop {string}  theme    - `"dark"` | `"light"` — written to `<html data-theme>` so the token palette switches.
 * @prop {string}  lang     - Document language (written to `<html lang>`).
 * @prop {string}  density  - `""` | `"compact"` — written to `<body data-density>`.
 * @prop {boolean} overview - Show every component's first story in one grid (contact sheet).
 * @prop {boolean} only     - Render just the selected story full-bleed (no chrome) — for screenshots and viewport frames.
 * @prop {boolean} route    - Mirror state into the URL query string.
 * @prop {Object}  labels   - Override UI strings.
 *
 * @fires puredashboard-gallery#select - Active component changed. `detail`: `{ tag }` (`""` = the index).
 *
 * @example
 * import "./gallery.js";
 * import { STORIES } from "./stories/index.js";
 * const g = document.createElement("puredashboard-gallery");
 * g.route = true; g.stories = STORIES;
 * document.body.append(g);
 */
class PuredashboardGallery extends Reactive {
  static properties = {
    stories: {}, selected: {}, story: {}, filter: {}, theme: {}, lang: {}, density: {}, viewport: {}, frames: {}, overview: {}, only: {}, route: {}, labels: {},
  };

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.stories = this.stories || [];
    if (this.route) {
      const p = new URLSearchParams(location.search);
      this.selected = this.selected || p.get("c") || "";
      this.story = this.story || p.get("s") || null;
      this.filter = this.filter || p.get("q") || "";
      this.theme = this.theme || p.get("theme") || document.documentElement.dataset.theme || "dark";
      this.lang = this.lang || p.get("lang") || "en";
      this.density = this.density || p.get("density") || "";
      this.viewport = this.viewport || p.get("vp") || "";
      if (p.get("overview") === "1") this.overview = true;
      if (p.get("only") === "1") this.only = true;
    }
    this.selected = this.selected || "";
    this.filter = this.filter || "";
    this.theme = this.theme || "dark";
    this.lang = this.lang || "en";
    this.density = this.density || "";
    this.viewport = this.viewport || "";
    this.frames = this.frames || {};
    this._staged = new Map();      // "tag\u0000story" → mounted node, so a re-render never remounts a story
    this._stagedFor = null;
    // "/" focuses the filter (unless the user is typing somewhere).
    this._onSlash = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || this.only || !this._ui) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      this._ui.filter.focus();
    };
    document.addEventListener("keydown", this._onSlash);
  }

  // setup() runs once, but disconnectedCallback drops the "/" listener — re-add it on every
  // re-attach (adding the same function twice is a no-op).
  connectedCallback() {
    super.connectedCallback();
    if (this._onSlash) document.addEventListener("keydown", this._onSlash);
  }

  disconnectedCallback() { if (this._onSlash) document.removeEventListener("keydown", this._onSlash); }

  _list() { return this.stories || []; }
  // The selected def, or null on the index / overview.
  _current() { return (this.selected && this._list().find((d) => d.tag === this.selected)) || null; }
  _short(d) { return d.tag.replace(/^puredashboard-/, ""); }
  _group(d) { return (d.title || "Other").split("/")[0]; }
  _matches(d) {
    const q = (this.filter || "").trim().toLowerCase();
    if (!q) return true;
    return this._short(d).toLowerCase().includes(q) || (d.title || "").toLowerCase().includes(q);
  }
  // [[group, defs]] in story order, filtered.
  _groups() {
    const groups = new Map();
    for (const d of this._list()) {
      if (!this._matches(d)) continue;
      const g = this._group(d);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(d);
    }
    return [...groups.entries()];
  }

  _select(tag) {
    if (tag === this.selected && !this.overview) return;
    this.overview = false;
    this.selected = tag; this.story = null;
    this.emit("select", { tag });
  }

  // Links the gallery owns (nav rows, index cards, the brand) carry `?…` hrefs; a plain
  // click switches in place, a modified click (new tab / window) is left to the browser.
  _onGoto = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || !this._ui) return;
    const ours = a.classList.contains("js-puredashboard-gallery__goto") || this._ui.nav.contains(a);
    if (!ours) return;
    const href = a.getAttribute("href") || "";
    if (!href.startsWith("?")) return;
    e.preventDefault();
    const q = new URLSearchParams(href.slice(1));
    if (q.get("overview") === "1") { this.overview = true; this.selected = ""; this.story = null; return; }
    this._select(q.get("c") || "");
  };

  updated() {
    // Preview controls act on the page so the token palette actually switches.
    document.documentElement.dataset.theme = this.theme;
    if (this.lang) document.documentElement.lang = this.lang;
    if (document.body) document.body.dataset.density = this.density || "";
    if (!this.only && this._ui) this._paint();
    if (this.route) {
      const u = new URLSearchParams();
      const cur = this._current();
      if (cur) u.set("c", cur.tag);
      if (this.story) u.set("s", this.story);
      if (this.filter) u.set("q", this.filter);
      u.set("theme", this.theme); u.set("lang", this.lang);
      if (this.density) u.set("density", this.density);
      if (this.viewport) u.set("vp", this.viewport);
      if (this.overview) u.set("overview", "1");
      if (this.only) u.set("only", "1");
      history.replaceState(null, "", "?" + u.toString());
    }
    // signal readiness for a screenshot driver
    this.dataset.ready = "1";
  }

  // A story's live node, rendered ONCE per (component, story) while that component is
  // shown — typing in the filter or switching theme re-renders the canvas without
  // remounting (and so resetting) every story.
  _stage(def, story) {
    const key = (def ? def.tag : "") + "\u0000" + story.name;
    if (this._staged.has(key)) return this._staged.get(key);
    let node;
    try { node = story.render() || ""; }
    catch (e) { node = document.createElement("pre"); node.className = "puredashboard-gallery__err"; node.textContent = this._label("renderError", (e && e.message) || String(e)); }
    this._staged.set(key, node);
    return node;
  }

  // ---- the shell: built ONCE from library components, then only updated ----------
  // The sider moves its children into its own regions, so it must never be diffed by the
  // parts engine; the shell is a node the template just holds, and each region is painted
  // separately (nav via properties, header and canvas via renderResult into the shells).
  _buildShell() {
    const mk = (tag, cls, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    const layout = mk("puredashboard-layout", "puredashboard-gallery__shell");
    const sider = mk("puredashboard-sider", "puredashboard-gallery__sider", { collapsible: "offcanvas", breakpoint: "md", "breakpoint-collapse": "offcanvas", persist: "puredashboard-gallery", width: "260" });
    const top = mk("div", "puredashboard-gallery__side-head", { slot: "header" });
    const brand = mk("a", "puredashboard-gallery__brand js-puredashboard-gallery__goto", { href: "?" });
    brand.textContent = "PureBook";
    const filter = mk("puredashboard-input", "puredashboard-gallery__filter js-puredashboard-gallery__filter", { type: "search", size: "sm" });
    filter.addEventListener("input", (e) => { const v = e.target && "value" in e.target ? e.target.value : filter.value; if (v !== this.filter) this.filter = v ?? ""; });
    top.append(brand, filter);
    const nav = mk("puredashboard-nav", "puredashboard-gallery__nav", { subtle: "" });
    sider.append(top, nav);
    const main = mk("puredashboard-layout", "puredashboard-gallery__main");
    const header = mk("puredashboard-header", "puredashboard-gallery__toolbar");
    const canvas = mk("puredashboard-content", "puredashboard-gallery__canvas");
    main.append(header, canvas);
    layout.append(sider, main);
    layout.addEventListener("click", this._onGoto);
    this._ui = { layout, sider, filter, nav, header, canvas };
  }

  _navItems() {
    const top = [{ label: this._label("index"), href: "?" }, { label: this._label("overview"), href: "?overview=1" }];
    return [...top, ...this._groups().map(([g, defs]) => ({ heading: g, children: defs.map((d) => ({ label: this._short(d), href: "?c=" + d.tag })) }))];
  }

  _paint() {
    const ui = this._ui, cur = this._current();
    ui.filter.setAttribute("placeholder", this._label("filter"));
    if (ui.filter.value !== this.filter) ui.filter.value = this.filter;
    ui.nav.items = this._navItems();
    ui.nav.current = this.overview ? "?overview=1" : cur ? "?c=" + cur.tag : "?";
    renderResult(this._toolbar(), ui.header);
    renderResult(html`${this._canvas()}`, ui.canvas);
  }

  _toolbar() {
    const cur = this._current();
    const title = this.overview ? this._label("all", this._list().length) : cur ? (cur.title || cur.tag) : this._label("components", this._list().length);
    return html`
      <div class="puredashboard-header__start">
        <button type="button" class="puredashboard-gallery__burger js-puredashboard-gallery__burger" aria-label="${this._label("toggleSidebar")}" @click="${() => this._ui.sider.toggle()}">${raw(ICON_MENU_SVG)}</button>
        <h1 class="puredashboard-gallery__title">${title}</h1>
      </div>
      <div class="puredashboard-header__end puredashboard-gallery__controls">
        <label>${this._label("theme")} <select class="js-pb-theme" @change="${(e) => { this.theme = e.target.value; }}">
          <option value="dark" ?selected="${this.theme === "dark"}">${this._label("dark")}</option>
          <option value="light" ?selected="${this.theme === "light"}">${this._label("light")}</option>
        </select></label>
        <label>${this._label("lang")} <select @change="${(e) => { this.lang = e.target.value; }}">
          <option value="en" ?selected="${this.lang === "en"}">en</option>
          <option value="vi" ?selected="${this.lang === "vi"}">vi</option>
        </select></label>
        <label>${this._label("density")} <select @change="${(e) => { this.density = e.target.value; }}">
          <option value="" ?selected="${!this.density}">${this._label("normal")}</option>
          <option value="compact" ?selected="${this.density === "compact"}">${this._label("compact")}</option>
        </select></label>
        <label>${this._label("viewport")} <select class="js-pb-viewport" @change="${(e) => { this.viewport = e.target.value; this.frames = {}; }}">
          <option value="" ?selected="${!this.viewport}">${this._label("auto")}</option>
          ${repeat(Object.keys(VIEWPORTS), (k) => k, (k) => html`<option value="${k}" ?selected="${this.viewport === k}">${this._label(k)} · ${VIEWPORTS[k].width}px</option>`)}
        </select></label>
      </div>`;
  }

  // ---- index: every component as a card, grouped like the sidebar ----------------
  _index() {
    const groups = this._groups();
    if (!groups.length) return html`<div class="puredashboard-gallery__empty">${this.filter ? this._label("noMatch", this.filter) : this._label("empty")}</div>`;
    return html`<div class="puredashboard-gallery__index">${repeat(groups, (e) => e[0], ([g, defs]) => html`
      <section class="puredashboard-gallery__index-group">
        <h2 class="puredashboard-gallery__index-heading">${g} <span class="puredashboard-gallery__index-count">${defs.length}</span></h2>
        <div class="puredashboard-gallery__index-grid">${repeat(defs, (d) => d.tag, (d) => {
          const n = (d.stories || []).length;
          const desc = d.description || (d.stories && d.stories[0] && d.stories[0].notes) || "";
          return html`<a class="puredashboard-gallery__index-card js-puredashboard-gallery__goto" href="${"?c=" + d.tag}">
            <span class="puredashboard-gallery__index-name">${this._short(d)}</span>
            <span class="puredashboard-gallery__index-meta">${d.title || d.tag} · ${this._label("stories", n)}</span>
            ${desc ? html`<span class="puredashboard-gallery__index-desc">${desc}</span>` : ""}
          </a>`;
        })}</div>
      </section>`)}</div>`;
  }

  _overview() {
    return html`<div class="puredashboard-gallery__overview">${repeat(this._list().filter((d) => this._matches(d)), (d) => d.tag, (d) => html`
      <div class="puredashboard-gallery__cell">
        <div class="puredashboard-gallery__cell-label">${this._short(d)}</div>
        <div class="puredashboard-gallery__cell-stage">${d.stories && d.stories[0] ? this._stage(d, d.stories[0]) : ""}</div>
      </div>`)}</div>`;
  }
  // A framed story is staged in an <iframe> of the chosen size that loads THIS page in
  // `only` mode (needs `route`) — the story then has a real viewport of its own, so media
  // queries, breakpoints and `100vh` behave as on that device. Inside the frame (`only` is
  // set) the story renders inline and fills the frame. Precedence: the card's own switch,
  // then the toolbar `viewport`, then the story's declared `viewport`, else inline.
  _vpKey(s) {
    const o = this.frames && this.frames[s.name];
    if (o) return o;
    return this.viewport || "auto";
  }
  _vpFor(s) {
    if (this.only) return null;
    const key = this._vpKey(s);
    if (key === "auto") {
      const own = s.viewport;
      return own && typeof own === "object" ? own : parseViewport(own);
    }
    return parseViewport(key);
  }
  _setFrame(name, key) { if ((this.frames || {})[name] !== key) this.frames = { ...(this.frames || {}), [name]: key }; }
  // One shared options array (rebuilt only when `labels` changes) so the segmented
  // controls don't re-render on every gallery render.
  _vpOptions() {
    if (!this._vpOpts || this._vpOptsFor !== this.labels) {
      this._vpOptsFor = this.labels;
      this._vpOpts = ["auto", ...Object.keys(VIEWPORTS)].map((k) => ({ value: k, label: this._label(k), icon: VP_ICONS[k] }));
    }
    return this._vpOpts;
  }
  _frameSrc(def, s) {
    const u = new URLSearchParams();
    u.set("c", def.tag); u.set("s", s.name);
    u.set("theme", this.theme); u.set("lang", this.lang);
    if (this.density) u.set("density", this.density);
    u.set("only", "1");
    return (typeof location !== "undefined" ? location.pathname : "") + "?" + u.toString();
  }

  _canvas() {
    // Leaving a view drops its staged stories, so coming back renders them afresh.
    const view = this.overview ? "\u0000overview" : this.selected || "";
    if (this._stagedFor !== view) { this._staged.clear(); this._stagedFor = view; }
    if (this.overview) return this._overview();
    const def = this._current();
    if (!def) return this._index();
    const stories = this.story ? def.stories.filter((s) => s.name === this.story) : def.stories;
    const fill = (s) => this.only && (s.viewport || this.story);   // inside a frame: fill it
    return repeat(stories, (s) => s.name, (s) => {
      const vp = this._vpFor(s);
      const key = this._vpKey(s);
      return html`
      <div class="puredashboard-gallery__story${fill(s) ? " puredashboard-gallery__story--fill" : ""}">
        <div class="puredashboard-gallery__bar"><span class="puredashboard-gallery__name">${s.name}</span>${vp ? html`<span class="puredashboard-gallery__viewport">${vp.width} × ${vp.height}</span>` : ""}${s.notes ? html`<span class="puredashboard-gallery__notes">${s.notes}</span>` : ""}
          ${this.only ? "" : html`<puredashboard-segmented class="puredashboard-gallery__vp js-puredashboard-gallery__vp" size="sm" aria-label="${this._label("viewport")}" .options="${this._vpOptions()}" .value="${key}" @change="${(e) => this._setFrame(s.name, e.detail.value)}"></puredashboard-segmented>`}
        </div>
        ${vp
          ? html`<div class="puredashboard-gallery__stage puredashboard-gallery__stage--viewport"><iframe class="puredashboard-gallery__frame" title="${s.name}" src="${this._frameSrc(def, s)}" style="width:${vp.width}px;height:${vp.height}px"></iframe></div>`
          : html`<div class="puredashboard-gallery__stage${fill(s) ? " puredashboard-gallery__stage--fill" : ""}">${this._stage(def, s)}</div>`}
      </div>`;
    });
  }

  render() {
    if (this.only) return html`<div class="puredashboard-gallery__only">${this._canvas()}</div>`;
    if (!this._ui) this._buildShell();
    return html`${this._ui.layout}`;
  }
}
PuredashboardGallery.define("puredashboard-gallery");

export { PuredashboardGallery };
