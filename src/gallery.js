// <puredashboard-gallery> — a mini component explorer ("Storybook-lite").
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Give it a `stories` array and it renders a sidebar (grouped by story `title`
// prefix), a toolbar (theme / language / density), and a canvas that mounts each
// story's live element. Optional `overview` shows every component's first story in
// a contact-sheet grid; optional `route` mirrors the view into the URL query
// (?c=&s=&theme=&only=&overview=) so a single story can be linked or screenshotted.
//
// It is a plain gallery over WHATEVER components you feed it — nothing here is
// specific to PureDashboard, so you can reuse it to preview your own elements.
import { Reactive, html, repeat } from "./reactive.js";

const LABELS = {
  theme: "Theme", light: "light", dark: "dark",
  lang: "Lang", density: "Density", normal: "normal", compact: "compact",
  all: (n) => `All components (${n})`,
  empty: "No stories yet.",
  renderError: (m) => "render error: " + m,
};

/**
 * A component gallery / mini-Storybook. Feed it stories and it renders an explorer
 * UI; each story's `render()` returns a live element that is mounted as-is.
 *
 * @element puredashboard-gallery
 *
 * @prop {Array}   stories  - Story defs: `[{ tag, title:"Family/Name", stories:[{ name, render:()=>Element, notes? }] }]`.
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
    stories: {}, selected: {}, story: {}, theme: {}, lang: {}, density: {}, overview: {}, only: {}, route: {}, labels: {},
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
      if (p.get("overview") === "1") this.overview = true;
      if (p.get("only") === "1") this.only = true;
    }
    this.theme = this.theme || "dark";
    this.lang = this.lang || "en";
    this.density = this.density || "";
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

  _canvas() {
    if (this.overview) return this._overview();
    const def = this._current();
    if (!def) return html`<div class="puredashboard-gallery__empty">${this._label("empty")}</div>`;
    const stories = this.story ? def.stories.filter((s) => s.name === this.story) : def.stories;
    return repeat(stories, (s) => s.name, (s) => html`
      <div class="puredashboard-gallery__story">
        <div class="puredashboard-gallery__bar"><span class="puredashboard-gallery__name">${s.name}</span>${s.notes ? html`<span class="puredashboard-gallery__notes">${s.notes}</span>` : ""}</div>
        <div class="puredashboard-gallery__stage">${this._stage(s)}</div>
      </div>`);
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
        </div>
        <div class="puredashboard-gallery__canvas">${this._canvas()}</div>
      </div>`;
  }
}
PuredashboardGallery.define("puredashboard-gallery");

export { PuredashboardGallery };
