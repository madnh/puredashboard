// <puredashboard-gallery> — a mini component explorer ("Storybook-lite").
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Give it a `stories` array and it renders a sidebar (grouped by story `title`
// prefix), a toolbar (theme / language / density), and a canvas that mounts each
// story's live element. Optional `overview` shows every component's first story in
// a contact-sheet grid; optional `route` mirrors the view into the URL query
// (?c=&s=&theme=&vp=&only=&overview=) so a single story can be linked or screenshotted.
// A "Viewport" switch (toolbar for every card, or per card) stages a story in an
// <iframe> sized like a phone / tablet / desktop, so responsive behaviour shows for real.
//
// It is a plain gallery over WHATEVER components you feed it — nothing here is
// specific to PureDashboard, so you can reuse it to preview your own elements.
import { Reactive, html, repeat } from "./reactive.js";
import "./segmented.js";   // the per-card viewport switch is the library's own segmented control

// Inlined 16px icons for the viewport switch (rule: each component carries its own SVG).
const vpIcon = (d) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${d}</svg>`;
const ICON_AUTO    = vpIcon('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>');
const ICON_PHONE   = vpIcon('<rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><path d="M7 12.5h2"/>');
const ICON_TABLET  = vpIcon('<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M7 12.5h2"/>');
const ICON_DESKTOP = vpIcon('<rect x="1.5" y="2.5" width="13" height="9" rx="1.5"/><path d="M8 11.5v3M5.5 14.5h5"/>');
const VP_ICONS = { auto: ICON_AUTO, phone: ICON_PHONE, tablet: ICON_TABLET, desktop: ICON_DESKTOP };

const LABELS = {
  theme: "Theme", light: "light", dark: "dark",
  lang: "Lang", density: "Density", normal: "normal", compact: "compact",
  viewport: "Viewport", auto: "Auto", phone: "Phone", tablet: "Tablet", desktop: "Desktop",
  all: (n) => `All components (${n})`,
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
 * @element puredashboard-gallery
 *
 * @prop {Array}   stories  - Story defs: `[{ tag, title:"Family/Name", stories:[{ name, render:()=>Element, notes?, viewport? }] }]`. A story's own `viewport` (`"phone"` | `"tablet"` | `"desktop"` | `"WxH"` | `{ width, height }`) is the size it is framed at by default.
 * @prop {string}  viewport - Frame EVERY card of the current component in an `<iframe>` of this size: `"phone"` (390px) | `"tablet"` (820px) | `"desktop"` (1280px) | `"WxH"`; `""` (default) = each story's own `viewport`, else inline. The frame loads this page in `only` mode (needs `route`), so the story gets a REAL viewport — breakpoints, media queries and `100vh` behave as on that device (a framed `render()` should fill `100vh`). Each card also has its own Auto / Phone / Tablet / Desktop switch (`frames`, keyed by story name) that overrides this.
 * @prop {Object}  frames   - Per-card viewport overrides `{ [storyName]: "auto" | "phone" | "tablet" | "desktop" | "WxH" }`, set by the card switches (a `<puredashboard-segmented>` with icons; `"auto"` = the story's own `viewport` or inline).
 * @prop {string}  selected - Active component `tag`. Defaults to the first story.
 * @prop {string}  story    - Active story `name` (show just one). Default: all of the component's stories.
 * @prop {string}  theme    - `"dark"` | `"light"` — written to `<html data-theme>` so the token palette switches.
 * @prop {string}  lang     - Document language (written to `<html lang>`).
 * @prop {string}  density  - `""` | `"compact"` — written to `<body data-density>`.
 * @prop {boolean} overview - Show every component's first story in one grid (contact sheet).
 * @prop {boolean} only     - Render just the selected story full-bleed (no chrome) — for screenshots.
 * @prop {boolean} route    - Mirror state into the URL query string.
 * @prop {Object}  labels   - Override UI strings.
 *
 * @fires puredashboard-gallery#select - Active component changed. `detail`: `{ tag }`.
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
    stories: {}, selected: {}, story: {}, theme: {}, lang: {}, density: {}, viewport: {}, frames: {}, overview: {}, only: {}, route: {}, labels: {},
  };

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.stories = this.stories || [];
    if (this.route) {
      const p = new URLSearchParams(location.search);
      this.selected = this.selected || p.get("c") || undefined;
      this.story = this.story || p.get("s") || null;
      this.theme = this.theme || p.get("theme") || document.documentElement.dataset.theme || "dark";
      this.lang = this.lang || p.get("lang") || "en";
      this.density = this.density || p.get("density") || "";
      this.viewport = this.viewport || p.get("vp") || "";
      if (p.get("overview") === "1") this.overview = true;
      if (p.get("only") === "1") this.only = true;
    }
    this.theme = this.theme || "dark";
    this.lang = this.lang || "en";
    this.density = this.density || "";
    this.viewport = this.viewport || "";
    this.frames = this.frames || {};
  }

  _list() { return this.stories || []; }
  _current() { return this._list().find((d) => d.tag === this.selected) || this._list()[0] || null; }

  _select(tag) {
    if (tag === this.selected) return;
    this.selected = tag; this.story = null;
    this.emit("select", { tag });
  }

  updated() {
    // Preview controls act on the page so the token palette actually switches.
    document.documentElement.dataset.theme = this.theme;
    if (this.lang) document.documentElement.lang = this.lang;
    if (document.body) document.body.dataset.density = this.density || "";
    if (this.route) {
      const u = new URLSearchParams();
      const cur = this._current();
      if (cur) u.set("c", cur.tag);
      if (this.story) u.set("s", this.story);
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

  _stage(story) {
    try { const node = story.render(); return node || ""; }
    catch (e) { const pre = document.createElement("pre"); pre.className = "puredashboard-gallery__err"; pre.textContent = this._label("renderError", (e && e.message) || String(e)); return pre; }
  }

  _nav() {
    const groups = new Map();
    for (const d of this._list()) {
      const g = (d.title || "Other").split("/")[0];
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(d);
    }
    const cur = this._current();
    return repeat([...groups.entries()], (e) => e[0], ([g, defs]) => html`
      <div class="puredashboard-gallery__group">${g}</div>
      ${repeat(defs, (d) => d.tag, (d) => html`<button type="button" class="puredashboard-gallery__item js-puredashboard-gallery__item" data-tag="${d.tag}" aria-current="${cur && d.tag === cur.tag ? "true" : "false"}">${d.tag.replace(/^puredashboard-/, "")}</button>`)}
    `);
  }

  _overview() {
    return html`<div class="puredashboard-gallery__overview">${repeat(this._list(), (d) => d.tag, (d) => html`
      <div class="puredashboard-gallery__cell">
        <div class="puredashboard-gallery__cell-label">${d.tag.replace(/^puredashboard-/, "")}</div>
        <div class="puredashboard-gallery__cell-stage">${d.stories && d.stories[0] ? this._stage(d.stories[0]) : ""}</div>
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
    if (this.overview) return this._overview();
    const def = this._current();
    if (!def) return html`<div class="puredashboard-gallery__empty">${this._label("empty")}</div>`;
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
          : html`<div class="puredashboard-gallery__stage${fill(s) ? " puredashboard-gallery__stage--fill" : ""}">${this._stage(s)}</div>`}
      </div>`;
    });
  }

  render() {
    const def = this._current();
    const title = this.overview ? this._label("all", this._list().length) : (def ? (def.title || def.tag) : "—");
    if (this.only) return html`<div class="puredashboard-gallery__only">${this._canvas()}</div>`;
    return html`
      <aside class="puredashboard-gallery__side">
        <div class="puredashboard-gallery__brand">PureBook</div>
        <nav class="puredashboard-gallery__nav" @click="${(e) => { const b = e.target.closest(".js-puredashboard-gallery__item"); if (b) this._select(b.dataset.tag); }}">${this._nav()}</nav>
      </aside>
      <div class="puredashboard-gallery__main">
        <div class="puredashboard-gallery__toolbar">
          <h1 class="puredashboard-gallery__title">${title}</h1>
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
        </div>
        <div class="puredashboard-gallery__canvas">${this._canvas()}</div>
      </div>`;
  }
}
PuredashboardGallery.define("puredashboard-gallery");

export { PuredashboardGallery };
