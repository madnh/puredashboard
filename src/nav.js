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
 * @prop {Array}  items   - Tree of nodes. A node is `{ label, href?, icon?, badge?, children? }`:
 *   `label` (string, required) is the visible text; `href` (string) makes a leaf link;
 *   `icon` (string of trusted SVG markup) renders before the label; `badge` (string) shows
 *   a small count/status chip; `children` (node[]) makes it a collapsible group.
 * @prop {string} current - The `href` (or id) of the active item; the matching leaf gets `aria-current="page"`. Default `""`.
 * @prop {Object} [labels] - Override UI strings (English defaults). Keys: `ariaLabel`, `expand(group)`, `collapse(group)`.
 *
 * @fires puredashboard-nav#toggle - When a group is expanded/collapsed. `detail`: `{ label, expanded }`.
 *
 * @cssprop [--pd-nav-item-height] - Row height (defaults to `--control-height-md`).
 * @cssprop [--pd-nav-indent]      - Nested-level indent (defaults to `--sp-4`).
 *
 * @example
 * const nav = document.createElement("puredashboard-nav");
 * nav.items = [
 *   { label: "Dashboard", href: "#/", icon: "<svg …/>" },
 *   { label: "Nodes", children: [
 *     { label: "Web", href: "#/nodes/web", badge: "3" },
 *     { label: "DB",  href: "#/nodes/db" },
 *   ] },
 * ];
 * nav.current = "#/nodes/web";
 * document.querySelector("aside").append(nav);
 */
class PuredashboardNav extends Reactive {
  static properties = { items: {}, current: {}, labels: {} };

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
  }

  // Stable per-node group id from its position in the tree (path of child indices), so a
  // group's expanded state and aria-controls id stay put across re-renders.
  _gid(path) { return `js-puredashboard-nav__group-${this._uid}-${path.join("-")}`; }

  // A node is a group when it declares children.
  _isGroup(node) { return !!(node && node.children && node.children.length); }

  // Does the subtree rooted at `node` contain a leaf whose href === current? Used to
  // decide the DEFAULT expanded state (a group holding the active item starts open).
  _hasCurrent(node) {
    if (!node) return false;
    if (node.href != null && node.href === this.current) return true;
    return (node.children || []).some((c) => this._hasCurrent(c));
  }

  // Expanded? User's explicit toggle wins; otherwise default to open iff it holds current.
  _isOpen(node, gid) {
    if (this._expanded && this._expanded.has(gid)) return this._expanded.get(gid);
    return this._hasCurrent(node);
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
  _openByDefault(gid) { const f = this._find(gid); return f ? this._hasCurrent(f) : false; }
  _labelForGid(gid) { const f = this._find(gid); return f ? f.label : ""; }
  _find(gid, nodes = this.items || [], path = []) {
    for (let i = 0; i < nodes.length; i++) {
      const p = [...path, i];
      if (this._gid(p) === gid) return nodes[i];
      if (this._isGroup(nodes[i])) { const r = this._find(gid, nodes[i].children, p); if (r) return r; }
    }
    return null;
  }

  // Render one node's <li>: a group (button + nested list) or a leaf (<a href>).
  _renderNode(node, path, level) {
    if (this._isGroup(node)) {
      const gid = this._gid(path);
      const open = this._isOpen(node, gid);
      const aria = open ? this._label("collapse", node.label) : this._label("expand", node.label);
      return html`<li class="puredashboard-nav__item puredashboard-nav__item--group">
        <button type="button" class="puredashboard-nav__link puredashboard-nav__link--group ${open ? "puredashboard-nav__link--open" : ""} js-puredashboard-nav__group" data-group="${gid}" aria-expanded="${open ? "true" : "false"}" aria-controls="${gid}-list" aria-label="${aria}">${node.icon ? html`<span class="puredashboard-nav__icon">${raw(node.icon)}</span>` : ""}<span class="puredashboard-nav__label">${node.label}</span>${node.badge != null && node.badge !== "" ? html`<span class="puredashboard-nav__badge">${node.badge}</span>` : ""}<span class="puredashboard-nav__toggle" aria-hidden="true">${chevron}</span></button>
        <ul class="puredashboard-nav__list puredashboard-nav__list--sub" id="${gid}-list" role="list" ?hidden="${!open}">${node.children.map((c, i) => this._renderNode(c, [...path, i], level + 1))}</ul>
      </li>`;
    }
    const active = node.href != null && node.href === this.current;
    return html`<li class="puredashboard-nav__item">
      <a class="puredashboard-nav__link ${active ? "puredashboard-nav__link--active" : ""}" href="${node.href ?? ""}" aria-current="${active ? "page" : ""}">${node.icon ? html`<span class="puredashboard-nav__icon">${raw(node.icon)}</span>` : ""}<span class="puredashboard-nav__label">${node.label}</span>${node.badge != null && node.badge !== "" ? html`<span class="puredashboard-nav__badge">${node.badge}</span>` : ""}</a>
    </li>`;
  }

  render() {
    const items = this.items || [];
    return html`<nav class="puredashboard-nav__nav" aria-label="${this._label("ariaLabel")}">
      <ul class="puredashboard-nav__list puredashboard-nav__list--root" role="list">${items.map((n, i) => this._renderNode(n, [i], 0))}</ul>
    </nav>`;
  }
}
PuredashboardNav.define("puredashboard-nav");

export { PuredashboardNav };
