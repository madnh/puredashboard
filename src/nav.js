// <puredashboard-nav> — a vertical sidebar navigation. Zero-dep, no build, CSP-safe.
// Built on the Reactive base.
//
// Family: a Reactive custom element whose render() returns a reactive.js html`` tree
// (it's not a form control and holds no submittable value). Leaf items are REAL
// <a href> links so open-in-new-tab, middle-click, keyboard activation and copy-link
// all work natively — the surrounding router only REACTS to navigation, so we never
// hijack link clicks. Group items are native <button aria-expanded> that toggle a
// nested <ul> region; a native button gives Enter/Space activation for free.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-nav__<element>[--<modifier>]`. Script hooks are SEPARATE `js-…`
// classes / data-* attributes — don't style those. Icons are author-provided inline
// SVG markup, treated as TRUSTED (same contract as menu.js item icons): rendered via
// raw() from html.js. Everything else (labels, badges) is escaped html`` interpolation.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// All user-facing UI strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. n.labels = { ariaLabel: "Điều hướng" }. NB: item labels
// are CONTENT (they live on each node), not here. Function-valued keys interpolate.
const LABELS = {
  ariaLabel: "Main",
  expand: (group) => `Expand ${group}`,
  collapse: (group) => `Collapse ${group}`,
  loading: "Loading navigation",
};

const chevron = raw('<svg class="puredashboard-nav__chevron" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>');

let uid = 0;

/**
 * Vertical sidebar navigation. Renders a `<nav>` containing a nested list built from a
 * tree of `items`. Leaf items (a node with `href` and no `children`) become real
 * `<a href>` links; the item whose `href` matches `current` gets `aria-current="page"`
 * and an active BEM modifier. Group items (a node with `children`) become a native
 * `<button aria-expanded>` that toggles a collapsible nested list; a group that
 * contains the current item starts expanded. Configure entirely via JS properties.
 *
 * Not a form control — it holds no submittable value. Navigation is native (`<a href>`),
 * so the router only needs to react to URL changes; nothing is intercepted.
 *
 * @element puredashboard-nav
 *
 * @prop {Array}  items   - Tree of nodes. Three node kinds:
 *   LEAF `{ label, href, icon?, badge?, action? }` — a real `<a href>` link. `label` (string|Node,
 *   required) is the visible text — a string OR a DOM node / nested `html` template. `icon` (string
 *   of trusted SVG markup) renders before the label; `badge` (string|Node) shows a small count/status
 *   chip (a string is auto-escaped; a node / nested `html` template / array embeds a custom element —
 *   you build it, you own its safety). `action` `{ icon, label }` adds a secondary button at the row's
 *   end (shown on hover / focus / when the row is active; always on touch screens) that fires `action`.
 *   GROUP `{ label, children, icon?, badge?, action? }` — a native `<button aria-expanded>` that toggles
 *   a nested, indented list; a group holding the current item starts open. A group label also feeds
 *   the button's `aria-label` (via `expand`/`collapse`), where a node would stringify to
 *   `[object Object]` — keep it a plain string when the accessible name matters.
 *   SECTION `{ heading, children, collapsible? }` — a titled block (shadcn "group"): a small muted
 *   heading over a flat, un-indented list; `collapsible: true` makes the heading a toggle button.
 *   Sections start open and sit flush with the nav edge; in `icon-only` mode the heading is replaced
 *   by a separator line.
 * @prop {string} current - The `href` (or id) of the active item; the matching leaf gets `aria-current="page"`. Default `""`.
 * @prop {number|boolean} loading - Render skeleton rows instead of `items` (`true` = 5 rows, a number = that many) and mark the nav `aria-busy`. Default `false`.
 * @prop {Object} [labels] - Override UI strings (English defaults). Keys: `ariaLabel`, `expand(group)`, `collapse(group)`, `loading`.
 *
 * @attr {boolean} subtle     - Subtle active style: the current item keeps the text colour on a panel fill with an accent bar at its start edge, instead of the solid accent block.
 * @attr {boolean} icon-only  - Rail mode: rows show only their icon, centred; labels are visually hidden (still each link's accessible name) and copied to the link's `title` so hovering reveals them; badges, chevrons, actions, nested lists and section headings are hidden (a section keeps a separator line). `<puredashboard-sider>` sets this on its navs while `collapsed`.
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @fires puredashboard-nav#toggle - When a group or collapsible section is expanded/collapsed. `detail`: `{ label, expanded }` (`label` is the section's `heading` for a section).
 * @fires puredashboard-nav#action - When a row's `action` button is clicked. `detail`: `{ item, label, href }` (`item` is the node object).
 *
 * @cssprop [--pd-nav-item-height] - Row height (defaults to `--control-height-md`).
 * @cssprop [--pd-nav-indent]      - Nested-level indent (defaults to `--sp-4`).
 * @cssprop [--pd-nav-icon-size]   - Width and height of an item's icon SVG (defaults to `16px`).
 * @cssprop [--pd-nav-radius]      - Row corner radius (defaults to `0`, square rows; also used by section headings and action buttons).
 * @cssprop [--pd-nav-text]        - Row text colour (defaults to `--text`). `--pd-nav-muted`, `--pd-nav-hover`, `--pd-nav-active-bg`, `--pd-nav-border` follow the same pattern (muted ink, hover fill, subtle active fill, guide/separator lines); a `<puredashboard-sider>` maps the theme's `--sidebar-*` tokens onto them.
 *
 * @example
 * const nav = document.createElement("puredashboard-nav");
 * nav.items = [
 *   { heading: "Platform", children: [
 *     { label: "Dashboard", href: "#/", icon: "<svg …/>" },
 *     { label: "Nodes", icon: "<svg …/>", children: [
 *       { label: "Web", href: "#/nodes/web", badge: "3" },
 *       { label: "DB",  href: "#/nodes/db" },
 *     ] },
 *   ] },
 *   { heading: "Projects", collapsible: true, children: [
 *     { label: "Acme", href: "#/p/acme", action: { icon: "<svg …/>", label: "More" } },
 *   ] },
 * ];
 * nav.addEventListener("action", (e) => console.log(e.detail.item));
 * nav.current = "#/nodes/web";
 * document.querySelector("aside").append(nav);
 */
class PuredashboardNav extends Reactive {
  static properties = { items: {}, current: {}, labels: {}, loading: {} };
  // `icon-only` is author/sider-owned; re-render so the links gain/lose their title.
  static observedAttributes = ["icon-only"];
  attributeChangedCallback() { this.requestUpdate(); }

  constructor() {
    super();
    this._uid = ++uid;         // unique per instance → collision-free aria-controls ids
    this._expanded = null;     // Set of group ids the user has toggled open/closed
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    // One delegated listener survives every re-render; group <button>s carry data-group
    // (their id) so the handler flips just that group's expanded state.
    this.on("click", "[data-group]", (e, el) => this._toggle(el.dataset.group));
    // Row action buttons carry data-action (the node's tree path); emit `action` with the node.
    this.on("click", "[data-action]", (e, el) => {
      const node = this._at(el.dataset.action.split("-").map(Number));
      if (node) this.emit("action", { item: node, label: node.label, href: node.href });
    });
  }

  // Stable per-node group id from its position in the tree (path of child indices), so a
  // group's expanded state and aria-controls id stay put across re-renders.
  _gid(path) { return `js-puredashboard-nav__group-${this._uid}-${path.join("-")}`; }

  // A node is a section when it declares a heading; a group when it declares children.
  _isSection(node) { return !!(node && node.heading != null); }
  _isGroup(node) { return !!(node && !this._isSection(node) && node.children && node.children.length); }

  // The node at a tree path (array of child indices).
  _at(path, nodes = this.items || []) {
    let n = null;
    for (const i of path) { n = nodes && nodes[i]; if (!n) return null; nodes = n.children; }
    return n;
  }

  // Does the subtree rooted at `node` contain a leaf whose href === current? Used to
  // decide the DEFAULT expanded state (a group holding the active item starts open).
  _hasCurrent(node) {
    if (!node) return false;
    if (node.href != null && node.href === this.current) return true;
    return (node.children || []).some((c) => this._hasCurrent(c));
  }

  // Expanded? User's explicit toggle wins; otherwise a group opens iff it holds current and a
  // section is always open.
  _isOpen(node, gid) {
    if (this._expanded && this._expanded.has(gid)) return this._expanded.get(gid);
    return this._isSection(node) || this._hasCurrent(node);
  }

  _toggle(gid) {
    if (!this._expanded) this._expanded = new Map();
    const cur = this._expanded.has(gid) ? this._expanded.get(gid) : this._openByDefault(gid);
    const next = !cur;
    this._expanded.set(gid, next);
    this.requestUpdate();
    this.emit("toggle", { label: this._labelForGid(gid), expanded: next });
  }

  // Helpers for _toggle: recompute a group's default-open state and find its label by id.
  _openByDefault(gid) { const f = this._find(gid); return f ? this._isSection(f) || this._hasCurrent(f) : false; }
  _labelForGid(gid) { const f = this._find(gid); return f ? (this._isSection(f) ? f.heading : f.label) : ""; }
  _find(gid, nodes = this.items || [], path = []) {
    for (let i = 0; i < nodes.length; i++) {
      const p = [...path, i];
      if (this._gid(p) === gid) return nodes[i];
      if (nodes[i] && nodes[i].children) { const r = this._find(gid, nodes[i].children, p); if (r) return r; }
    }
    return null;
  }

  // Shared row content: icon, label, optional badge. `title` carries the label in icon-only mode
  // (only a string label can be a title; a node label keeps its visually-hidden text as the name).
  _rowTitle(node) { return this.hasAttribute("icon-only") && typeof node.label === "string" ? node.label : null; }
  _rowInner(node) {
    return html`${node.icon ? html`<span class="puredashboard-nav__icon">${raw(node.icon)}</span>` : ""}<span class="puredashboard-nav__label">${node.label}</span>${node.badge != null && node.badge !== "" ? html`<span class="puredashboard-nav__badge">${node.badge}</span>` : ""}`;
  }
  // A row's secondary action button (sits beside the link/button, not inside it, so the link
  // stays a plain anchor and the button a plain button).
  _rowAction(node, path) {
    const a = node.action;
    if (!a) return "";
    return html`<button type="button" class="puredashboard-nav__action js-puredashboard-nav__action" data-action="${path.join("-")}" aria-label="${a.label ?? ""}" title="${a.label ?? ""}">${a.icon ? raw(a.icon) : html`<span class="puredashboard-nav__action-fallback" aria-hidden="true">…</span>`}</button>`;
  }

  // Render one node's <li>: a section (heading + flat list), a group (button + nested list) or
  // a leaf (<a href>).
  _renderNode(node, path, level) {
    if (this._isSection(node)) {
      const gid = this._gid(path);
      const open = this._isOpen(node, gid);
      const hid = `${gid}-heading`;
      const heading = node.collapsible
        ? html`<button type="button" class="puredashboard-nav__heading puredashboard-nav__heading--toggle ${open ? "puredashboard-nav__heading--open" : ""} js-puredashboard-nav__group" id="${hid}" data-group="${gid}" aria-expanded="${open ? "true" : "false"}" aria-controls="${gid}-list"><span class="puredashboard-nav__heading-text">${node.heading}</span><span class="puredashboard-nav__toggle" aria-hidden="true">${chevron}</span></button>`
        : html`<div class="puredashboard-nav__heading" id="${hid}"><span class="puredashboard-nav__heading-text">${node.heading}</span></div>`;
      return html`<li class="puredashboard-nav__section">
        ${heading}
        <ul class="puredashboard-nav__list puredashboard-nav__list--section" id="${gid}-list" role="list" aria-labelledby="${hid}" ?hidden="${!open}">${(node.children || []).map((c, i) => this._renderNode(c, [...path, i], level))}</ul>
      </li>`;
    }
    if (this._isGroup(node)) {
      const gid = this._gid(path);
      const open = this._isOpen(node, gid);
      const aria = open ? this._label("collapse", node.label) : this._label("expand", node.label);
      // `--holds-current`: the group contains the active leaf — the rail (icon-only) shows it on
      // the group's icon, since the nested list itself is hidden there.
      return html`<li class="puredashboard-nav__item puredashboard-nav__item--group ${node.action ? "puredashboard-nav__item--has-action" : ""}">
        <button type="button" class="puredashboard-nav__link puredashboard-nav__link--group ${open ? "puredashboard-nav__link--open" : ""} ${this._hasCurrent(node) ? "puredashboard-nav__link--holds-current" : ""} js-puredashboard-nav__group" data-group="${gid}" aria-expanded="${open ? "true" : "false"}" aria-controls="${gid}-list" aria-label="${aria}" title="${this._rowTitle(node)}">${this._rowInner(node)}<span class="puredashboard-nav__toggle" aria-hidden="true">${chevron}</span></button>${this._rowAction(node, path)}
        <ul class="puredashboard-nav__list puredashboard-nav__list--sub" id="${gid}-list" role="list" ?hidden="${!open}">${node.children.map((c, i) => this._renderNode(c, [...path, i], level + 1))}</ul>
      </li>`;
    }
    const active = node.href != null && node.href === this.current;
    return html`<li class="puredashboard-nav__item ${active ? "puredashboard-nav__item--active" : ""} ${node.action ? "puredashboard-nav__item--has-action" : ""}">
      <a class="puredashboard-nav__link ${active ? "puredashboard-nav__link--active" : ""}" href="${node.href ?? ""}" aria-current="${active ? "page" : ""}" title="${this._rowTitle(node)}">${this._rowInner(node)}</a>${this._rowAction(node, path)}
    </li>`;
  }

  // Skeleton rows while `loading`: an icon disc + a text bar whose width varies per row so the
  // placeholder reads as a list, not a grid. Decorative — the nav itself is aria-busy.
  _renderSkeleton() {
    const n = this.loading === true ? 5 : Math.max(1, Number(this.loading) || 0);
    const widths = [70, 55, 85, 60, 75];
    return Array.from({ length: n }, (_, i) => html`<li class="puredashboard-nav__item puredashboard-nav__item--skeleton" aria-hidden="true"><span class="puredashboard-nav__skeleton"><span class="puredashboard-nav__skeleton-icon"></span><span class="puredashboard-nav__skeleton-text" style="width:${widths[i % widths.length]}%"></span></span></li>`);
  }

  render() {
    const items = this.items || [];
    const loading = !!this.loading;
    return html`<nav class="puredashboard-nav__nav" aria-label="${this.getAttribute("aria-label") ?? this._label("ariaLabel")}" aria-busy="${loading ? "true" : null}">
      <ul class="puredashboard-nav__list puredashboard-nav__list--root" role="list">${loading ? this._renderSkeleton() : items.map((n, i) => this._renderNode(n, [i], 0))}</ul>
    </nav>`;
  }
}
PuredashboardNav.define("puredashboard-nav");

export { PuredashboardNav };
