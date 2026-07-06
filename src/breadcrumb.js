// <puredashboard-breadcrumb> — a navigation breadcrumb trail.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// A breadcrumb shows the path to the current page as an ordered list of crumbs.
// It is a NAVIGATION landmark, NOT a form control: every navigable crumb is a
// REAL <a href> so browser behaviour (open-in-new-tab, middle-click, "copy link",
// keyboard focus/activation) is inherited for free — nothing is faked with click
// handlers. The LAST crumb is the current page: it is rendered as plain text and
// marked `aria-current="page"` (never a link) even if the item carries an `href`,
// because you don't link to the page you're already on.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-breadcrumb__<element>[--<modifier>]`. The separator between crumbs
// is drawn purely in CSS (a decorative `::after`) so it is never announced by a
// screen reader and never selectable as text. Themed through the shared design
// tokens (--muted, --text, --accent, --focus-ring, --font-size-*, --sp-*, --radius)
// via a --pd-* fallback chain, so it looks right with NO theme linked and adapts to
// light/dark automatically. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat } from "./reactive.js";

// All user-facing FIXED strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. bc.labels = { ariaLabel: "Đường dẫn" }.
// NB: crumb text is CONTENT (from `items[].label`), not a fixed UI string.
const LABELS = {
  ariaLabel: "Breadcrumb",  // accessible name of the <nav> landmark
  ellipsis: "…",       // the collapsed-middle indicator ("…")
};

/**
 * A navigation breadcrumb trail: an ordered list of crumbs leading to the current
 * page. Renders a `<nav>` landmark wrapping an `<ol>` of `<li>` crumbs. Navigable
 * crumbs (those with an `href`, except the last) are REAL `<a>` links so
 * open-in-new-tab, middle-click and keyboard activation work natively; the last
 * crumb is the current page — plain text marked `aria-current="page"`. Configure
 * via JS properties. Not a form control; emits nothing (links navigate natively).
 *
 * @element puredashboard-breadcrumb
 *
 * @prop {Array<{label: string|Node, href?: string}>} items - The crumbs, root → current.
 *   Each `{ label, href? }`: `label` accepts a string (auto-escaped) OR a DOM node /
 *   nested `html` template / array — pass a node or template to embed a custom element
 *   (you build it, you own its safety; plain strings stay escaped); `href` (when present,
 *   and not the last crumb) makes that crumb a link. Default `[]`.
 * @prop {number} maxItems - When set and there are more crumbs than this, the middle
 *   is collapsed to a non-interactive ellipsis crumb, keeping the first crumb and the
 *   last two. `0`/unset = show all. Default `0`.
 * @prop {Object} labels - Override UI strings. Keys: `ariaLabel` (the `<nav>` label,
 *   default `"Breadcrumb"`), `ellipsis` (collapsed indicator, default `"…"`). Unset
 *   keys keep the English default. Crumb text is CONTENT, not a label.
 *
 * @cssprop [--pd-breadcrumb-gap]  - Space around each separator (defaults to `--sp-2`).
 * @cssprop [--pd-breadcrumb-sep]  - The separator glyph (defaults to `"/"`).
 *
 * @example
 * const bc = document.createElement("puredashboard-breadcrumb");
 * bc.items = [
 *   { label: "Home", href: "#/" },
 *   { label: "Nodes", href: "#/nodes" },
 *   { label: "web-01" },            // last crumb = current page (plain text)
 * ];
 * document.body.append(bc);
 */
class PuredashboardBreadcrumb extends Reactive {
  static properties = { items: {}, maxItems: {}, labels: {} };

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // _crumbs() → the render list. Each entry is either { item, index } (a real crumb,
  // index into `items` so its last-ness is known) or { ellipsis: true }. When
  // `maxItems` is set and exceeded, the middle collapses to a single ellipsis entry,
  // keeping the FIRST crumb and the LAST TWO (so the parent + current page stay visible).
  _crumbs() {
    const items = Array.isArray(this.items) ? this.items : [];
    const max = Number(this.maxItems) || 0;
    if (!max || items.length <= max) return items.map((item, index) => ({ item, index }));
    const head = [{ item: items[0], index: 0 }];
    const tail = [items.length - 2, items.length - 1].map((index) => ({ item: items[index], index }));
    return [...head, { ellipsis: true }, ...tail];
  }

  render() {
    const items = Array.isArray(this.items) ? this.items : [];
    const last = items.length - 1;
    const rows = this._crumbs();
    // Key by index for real crumbs (stable across label edits); the sole ellipsis
    // gets a fixed key so it is never confused with a crumb during reconciliation.
    return html`
      <nav class="puredashboard-breadcrumb" aria-label="${this._label("ariaLabel")}">
        <ol class="puredashboard-breadcrumb__list">
          ${repeat(rows, (r) => (r.ellipsis ? "…" : r.index), (r) => this._crumb(r, last))}
        </ol>
      </nav>`;
  }

  // _crumb(row, last) → one <li>. Ellipsis rows are decorative (aria-hidden) and
  // non-interactive. A real crumb is the CURRENT page when it is the last item: plain
  // text + aria-current="page", never a link. Otherwise a crumb WITH an href is a real
  // <a> link; a crumb without one is plain text.
  _crumb(row, last) {
    if (row.ellipsis)
      return html`<li class="puredashboard-breadcrumb__item puredashboard-breadcrumb__item--ellipsis" aria-hidden="true">${this._label("ellipsis")}</li>`;
    const { item, index } = row;
    const label = item ? item.label : "";
    if (index === last)
      return html`<li class="puredashboard-breadcrumb__item"><span class="puredashboard-breadcrumb__current" aria-current="page">${label}</span></li>`;
    if (item && item.href)
      return html`<li class="puredashboard-breadcrumb__item"><a class="puredashboard-breadcrumb__link" href="${item.href}">${label}</a></li>`;
    return html`<li class="puredashboard-breadcrumb__item"><span class="puredashboard-breadcrumb__text">${label}</span></li>`;
  }
}
PuredashboardBreadcrumb.define("puredashboard-breadcrumb");

export { PuredashboardBreadcrumb };
