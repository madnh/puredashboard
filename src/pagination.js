// <puredashboard-pagination> — a standalone, windowed page navigator for admin
// views. Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// NB: <puredashboard-table> ships its OWN prev/next pager (it computes ranges +
// labels internally); this is the SEPARATE, general-purpose control for paging
// anything else (a list, a grid, a remote query). It renders a windowed list of
// numbered page buttons with "…" ellipsis for gaps — always showing the first and
// last page and `siblingCount` pages either side of the current one.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-pagination__<element>[--<modifier>]` so they never collide.
// Script hooks are SEPARATE `data-*` attributes (data-page / data-nav); don't
// style those. Icons are inline self-contained SVG (a local svg() helper).
//
// It is NOT a form control — it navigates. Clicking a page/prev/next emits a
// bubbling "pagechange" CustomEvent { page } (clamped to [1, pageCount]) AND
// updates its own `page` state, so it works both controlled (parent sets `page`
// back) and uncontrolled (it advances itself), mirroring table.js's approach.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const chevronLeft  = svg('<path d="m15 18-6-6 6-6"/>');
const chevronRight = svg('<path d="m9 18 6-6-6-6"/>');

// Sentinel for a non-interactive gap in the page window.
const GAP = "…";

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. p.labels = { prev: "Trước", next: "Sau" }.
// Function-valued keys interpolate.
const LABELS = {
  prev: "Previous",
  next: "Next",
  page: (n) => `Page ${n}`,
  current: (n) => `Page ${n}, current page`,
  ariaLabel: "Pagination",
};

/**
 * A standalone, windowed page navigator: a Previous button, a list of numbered
 * page buttons with `…` ellipsis for gaps (first + last page always shown, plus
 * the current page and `siblingCount` pages either side), and a Next button.
 * Configure via JS properties or HTML attributes.
 *
 * The current page carries `aria-current="page"` and the active modifier class.
 * Previous is disabled on page 1, Next on the last page. Clicking any control
 * clamps the target to `[1, pageCount]`, updates the internal `page` state, and
 * emits a bubbling `pagechange` — so it works controlled or uncontrolled.
 *
 * @element puredashboard-pagination
 *
 * @prop {number}  page         - 1-based current page. Default `1`.
 * @prop {number}  pageCount    - Total number of pages. Default `1`. Ignored if `total` + `pageSize` are both set.
 * @prop {number}  total        - Total item count; with `pageSize`, `pageCount = ceil(total / pageSize)`.
 * @prop {number}  pageSize     - Items per page; used with `total` to derive `pageCount`.
 * @prop {number}  siblingCount - Page numbers shown either side of the current page. Default `1`.
 * @prop {boolean} disabled     - Disable the whole control. Default `false`.
 * @prop {Object}  labels       - Override UI strings. Keys: `prev`, `next`, `page(n)`, `current(n)`, `ariaLabel`. Unset keys keep the English default.
 * @attr {number}  page         - Declarative 1-based current page.
 * @attr {number}  page-count   - Declarative total page count.
 * @attr {number}  total        - Declarative total item count.
 * @attr {number}  page-size    - Declarative items per page.
 * @attr {number}  sibling-count - Declarative sibling count.
 * @attr {boolean} disabled     - Declarative disabled state.
 *
 * @fires puredashboard-pagination#pagechange - Bubbling `CustomEvent`; `detail`: `{ page }` (clamped to `[1, pageCount]`).
 *
 * @cssprop [--pd-pagination-height] - Button size (defaults to `--control-height-sm`).
 *
 * @example
 * const p = document.createElement("puredashboard-pagination");
 * p.total = 200; p.pageSize = 10; p.page = 5;   // → pageCount 20
 * p.addEventListener("pagechange", (e) => load(e.detail.page));
 * document.body.append(p);
 */
class PuredashboardPagination extends Reactive {
  static properties = {
    page: {}, pageCount: {}, total: {}, pageSize: {}, siblingCount: {},
    disabled: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way in markup, not only via JS. Boolean attrs
  // map by presence; numeric attrs are parsed.
  static observedAttributes = ["page", "page-count", "total", "page-size", "sibling-count", "disabled"];
  attributeChangedCallback(name, _old, val) {
    if (name === "disabled") { this.disabled = val !== null; return; }
    const prop = { "page-count": "pageCount", "page-size": "pageSize", "sibling-count": "siblingCount" }[name] || name;
    this[prop] = val == null ? undefined : Number(val);
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.on("click", "[data-nav]", (e, el) => this._go(el.dataset.nav));
    this.on("click", "[data-page]", (e, el) => this._go(el.dataset.page));
  }

  // Derived page count: total+pageSize wins when both are usable; else pageCount;
  // never below 1.
  _count() {
    if (this.total != null && this.pageSize > 0) return Math.max(1, Math.ceil(this.total / this.pageSize));
    return Math.max(1, Math.floor(this.pageCount) || 1);
  }

  // Navigate to prev/next/<n>, clamp to [1, count], update state AND emit — so the
  // control works whether or not the parent feeds `page` back (controlled/uncontrolled).
  _go(where) {
    if (this.disabled) return;
    const count = this._count();
    const cur = this._current(count);
    let p = where === "prev" ? cur - 1 : where === "next" ? cur + 1 : Number(where) || 1;
    p = Math.min(count, Math.max(1, p));
    if (p === cur) return;
    this.page = p;
    this.emit("pagechange", { page: p });
  }

  // Current page clamped into the valid range for `count`.
  _current(count) { return Math.min(Math.max(1, Math.floor(this.page) || 1), count); }

  // window(current, count) → the ordered list of items to render: page numbers plus
  // GAP sentinels. The control keeps a CONSTANT width: first + last + current +
  // `siblingCount` each side + up to two gaps. Near an edge (where one gap would
  // otherwise collapse) the window grows toward the opposite end so the count of
  // boxes stays stable. A single skipped page renders as that page, not a lone "…"
  // hiding one number. Small counts render every page, no gaps.
  _window(current, count) {
    const sib = Math.max(0, Math.floor(this.siblingCount ?? 1));
    // Total page-number boxes to keep visible: first + last + current + 2*sib.
    const shown = sib * 2 + 3;
    if (count <= shown + 2) return Array.from({ length: count }, (_, i) => i + 1);

    let left = Math.max(current - sib, 1);
    let right = Math.min(current + sib, count);
    // Expand the window toward the far edge so `shown` interior numbers are kept even
    // when the current page hugs one end.
    if (left <= 3) { left = 1; right = Math.max(right, shown); }
    if (right >= count - 2) { right = count; left = Math.min(left, count - shown + 1); }
    left = Math.max(left, 1); right = Math.min(right, count);

    const out = [];
    if (left > 1) { out.push(1); if (left > 2) out.push(GAP); }   // leading gap (never for one page)
    for (let p = left; p <= right; p++) out.push(p);
    if (right < count) { if (right < count - 1) out.push(GAP); out.push(count); }
    return out;
  }

  render() {
    const count = this._count();
    // pageCount <= 1 → nothing to page through; render a minimal empty (but valid) nav.
    if (count <= 1) return html`<nav class="puredashboard-pagination" aria-label="${this._label("ariaLabel")}"></nav>`;

    const cur = this._current(count);
    const disabled = !!this.disabled;
    const items = this._window(cur, count);

    return html`<nav class="puredashboard-pagination" aria-label="${this._label("ariaLabel")}">
      <button type="button" class="puredashboard-pagination__btn puredashboard-pagination__btn--prev" data-nav="prev" aria-label="${this._label("prev")}" ?disabled="${disabled || cur <= 1}">${chevronLeft}</button>
      <ul class="puredashboard-pagination__list">${items.map((it) => it === GAP
        ? html`<li class="puredashboard-pagination__item"><span class="puredashboard-pagination__ellipsis" aria-hidden="true">${GAP}</span></li>`
        : html`<li class="puredashboard-pagination__item"><button type="button" class="puredashboard-pagination__btn puredashboard-pagination__btn--page ${it === cur ? "puredashboard-pagination__btn--current" : ""}" data-page="${it}" aria-label="${it === cur ? this._label("current", it) : this._label("page", it)}" aria-current="${it === cur ? "page" : "false"}" ?disabled="${disabled}">${it}</button></li>`)}</ul>
      <button type="button" class="puredashboard-pagination__btn puredashboard-pagination__btn--next" data-nav="next" aria-label="${this._label("next")}" ?disabled="${disabled || cur >= count}">${chevronRight}</button>
    </nav>`;
  }
}
PuredashboardPagination.define("puredashboard-pagination");

export { PuredashboardPagination };
