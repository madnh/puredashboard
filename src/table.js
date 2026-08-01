// <puredashboard-table> — a reusable data table/list for admin views. Zero-dep, no build,
// CSP-safe. Built on the Reactive base.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-table__<element>[--<modifier>]` so they never collide — restyle freely.
// Script hooks are SEPARATE `js-…` classes and data-* attributes; don't touch those.
//
// NB: html MUST come from reactive.js (the parts engine that diffs in place) so the
// search <input> keeps focus across re-renders. Icons are inline self-contained SVG.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const arrowUp      = svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>');
const arrowDown    = svg('<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>');
const sortNeutral  = svg('<path d="m8 9 4-4 4 4"/><path d="m16 15-4 4-4-4"/>');
const chevronLeft  = svg('<path d="m15 18-6-6 6-6"/>');
const chevronRight = svg('<path d="m9 18 6-6-6-6"/>');
//
// Features: sortable headers (always-visible SVG arrow, neutral→asc/desc), search
// filter, pagination with a rows-per-page selector, and optional row selection via a
// checkbox column with select-all and a bulk-actions bar. State changes emit events
// (sortchange / filterchange / pagechange / selectionchange / rowaction / bulkaction)
// and, when `debug` is set, console.debug each one.
//
// Full API (properties, events, methods, example) is documented in the JSDoc on the
// class below.

const cmp = (a, b) => {
  if (a == null) a = ""; if (b == null) b = "";
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== "" && b !== "") return na - nb;
  return String(a).localeCompare(String(b));
};

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. t.labels = { filter: "Lọc…", actions: "Thao tác" }.
// Entries that interpolate are functions.
const LABELS = {
  filter: "Filter…",
  filterAria: "Filter rows",
  actions: "Actions",
  open: "Open",
  empty: "Nothing to show.",
  rows: "Rows",
  page: (p, n) => `Page ${p} / ${n}`,
  range: (a, b, total) => `${a}–${b} of ${total}`,
  selected: (n) => `${n} selected`,
  selectAll: "Select all",
  selectRow: "Select row",
  prevPage: "Previous page",
  nextPage: "Next page",
};

/**
 * Data table / list with client-side sort, search filter, pagination, optional row
 * selection (checkbox column + select-all + a bulk-actions bar), per-row actions, and
 * localisable strings. Configure entirely via JS properties.
 *
 * @element puredashboard-table
 *
 * @prop {Array}    columns    - Column defs: `{ key, label, sortable?, align?, render?(row) }`.
 * @prop {Array}    rows       - Data rows (array of objects).
 * @prop {Function} [rowKey]   - `(row) => key` identity for selection (falls back to `row.id ?? row.name ?? JSON`).
 * @prop {Function} [getHref]  - `(row) => string`; when set, each row gets an "Open" `<a href>`.
 * @prop {Array}    [actions]  - Per-row buttons `{ name, label, danger? }` → fire `rowaction`.
 * @prop {Array}    [bulkActions] - Buttons shown when rows are selected `{ name, label, danger? }` → fire `bulkaction`.
 * @prop {boolean}  [selectable] - Show a checkbox column with select-all. Default `false`.
 * @prop {number}   [pageSize] - Rows per page; `0`/unset = no pagination.
 * @prop {number[]} [pageSizes=[10,25,50]] - Options for the rows-per-page selector.
 * @prop {boolean}  [filterable=true] - Show the search filter input.
 * @prop {string[]} [searchKeys] - Column keys the filter matches (default: all columns).
 * @prop {boolean}  [debug]    - `console.debug` every emitted event.
 * @prop {Object}   [labels]   - Override UI strings (English defaults). Keys: `filter`, `filterAria`, `actions`, `open`, `empty`, `rows`, `page(p,n)`, `range(a,b,total)`, `selected(n)`, `selectAll`, `selectRow`, `prevPage`, `nextPage`.
 * @prop {Array}    selected   - (read-only getter) selected row objects.
 * @prop {Array}    selectedKeys - (read-only getter) selected row keys.
 *
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @fires puredashboard-table#sortchange      - `detail`: `{ key, dir: "asc"|"desc" }`.
 * @fires puredashboard-table#filterchange    - `detail`: `{ q: string }`.
 * @fires puredashboard-table#pagechange      - `detail`: `{ page, pageSize }`.
 * @fires puredashboard-table#selectionchange - `detail`: `{ keys, rows }`.
 * @fires puredashboard-table#rowaction       - `detail`: `{ name, row }`.
 * @fires puredashboard-table#bulkaction      - `detail`: `{ name, rows, keys }`.
 *
 * @method clearSelection - `clearSelection() => void`.
 *
 * @example
 * const t = document.createElement("puredashboard-table");
 * t.columns = [{ key: "name", label: "Name", sortable: true }];
 * t.rows = nodes; t.rowKey = (r) => r.name;
 * t.selectable = true; t.bulkActions = [{ name: "delete", label: "Delete", danger: true }];
 * t.addEventListener("bulkaction", (e) => removeRows(e.detail.rows));
 */
class PuredashboardTable extends Reactive {
  static properties = {
    columns: {}, rows: {}, rowKey: {}, getHref: {}, actions: {}, bulkActions: {},
    filterable: {}, searchKeys: {},
    pageSize: {}, pageSizes: {}, page: {}, selectable: {}, debug: {}, labels: {},
    sortKey: {}, sortDir: {}, filter: {},
  };

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._sel = this._sel || new Set();
    this.on("click", "[data-sort]", (e, el) => this._toggleSort(el.dataset.sort));
    this.on("input", ".js-puredashboard-table__search", (e, el) => { this.filter = el.value; this.page = 1; this._notify("filterchange", { q: el.value }); });
    this.on("click", "[data-page]", (e, el) => this._go(el.dataset.page));
    this.on("change", ".js-puredashboard-table__page-size", (e, el) => { this.pageSize = Number(el.value) || 0; this.page = 1; this._notify("pagechange", { page: 1, pageSize: this.pageSize }); });
    this.on("change", ".js-puredashboard-table__check", (e, el) => this._toggleRow(Number(el.dataset.i), el.checked));
    this.on("change", ".js-puredashboard-table__check-all", (e, el) => this._toggleAll(el.checked));
    this.on("click", "[data-bulk]", (e, el) => this._notify("bulkaction", { name: el.dataset.bulk, rows: this.selected, keys: this.selectedKeys }));
    this.on("click", "[data-act]", (e, el) => this._notify("rowaction", { name: el.dataset.act, row: this._view[Number(el.dataset.i)] }));
  }

  updated() {
    const s = this.querySelector(".js-puredashboard-table__page-size");
    if (s && this.pageSize > 0 && s.value !== String(this.pageSize)) s.value = String(this.pageSize);
  }

  _notify(name, detail) {
    if (this.debug) { try { console.debug(`[${this.tagName.toLowerCase()}]`, name, detail); } catch { /* */ } }
    this.emit(name, detail);
  }

  _key(row) { return this.rowKey ? this.rowKey(row) : (row && (row.id ?? row.name) != null ? (row.id ?? row.name) : JSON.stringify(row)); }
  get selectedKeys() { return [...(this._sel || [])]; }
  get selected() { const s = this._sel || new Set(); return (this.rows || []).filter((r) => s.has(this._key(r))); }
  clearSelection() { this._sel = new Set(); this.requestUpdate(); this._notify("selectionchange", { keys: [], rows: [] }); }

  _toggleRow(i, on) {
    const row = this._view[i]; if (!row) return;
    const k = this._key(row);
    if (on) this._sel.add(k); else this._sel.delete(k);
    this.requestUpdate();
    this._notify("selectionchange", { keys: this.selectedKeys, rows: this.selected });
  }
  _toggleAll(on) {
    for (const r of this._all || []) { const k = this._key(r); if (on) this._sel.add(k); else this._sel.delete(k); }
    this.requestUpdate();
    this._notify("selectionchange", { keys: this.selectedKeys, rows: this.selected });
  }

  _toggleSort(key) {
    if (this.sortKey === key) this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
    else { this.sortKey = key; this.sortDir = "asc"; }
    this.page = 1;
    this._notify("sortchange", { key: this.sortKey, dir: this.sortDir });
  }

  _go(where) {
    const pages = this._pages || 1;
    let p = this.page || 1;
    if (where === "prev") p = Math.max(1, p - 1);
    else if (where === "next") p = Math.min(pages, p + 1);
    else p = Math.min(pages, Math.max(1, Number(where) || 1));
    if (p !== this.page) { this.page = p; this._notify("pagechange", { page: p, pageSize: this.pageSize || 0 }); }
  }

  _filtered() {
    const rows = this.rows || [];
    const q = (this.filter || "").trim().toLowerCase();
    if (!q) return rows.slice();
    const cols = this.columns || [];
    const keys = this.searchKeys || cols.map((c) => c.key).filter(Boolean);
    return rows.filter((r) => keys.some((k) => { const v = r[k]; return v != null && String(v).toLowerCase().includes(q); }));
  }

  _sorted(rows) {
    if (!this.sortKey) return rows;
    const dir = this.sortDir === "desc" ? -1 : 1, k = this.sortKey;
    return rows.slice().sort((a, b) => dir * cmp(a[k], b[k]));
  }

  render() {
    if (!this._sel) this._sel = new Set();
    const cols = this.columns || [];
    const all = this._sorted(this._filtered());
    this._all = all;
    const total = all.length;
    const pageSize = this.pageSize > 0 ? this.pageSize : 0;
    let start = 0, view = all, page = 1, pages = 1;
    if (pageSize > 0) {
      pages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(Math.max(1, this.page || 1), pages);
      if ((this.page || 1) !== page) this.page = page;
      start = (page - 1) * pageSize;
      view = all.slice(start, start + pageSize);
    }
    this._view = view; this._pages = pages;
    const rows = view;
    const sel = this._sel;
    const selectable = !!this.selectable;
    const selCount = selectable ? this.selectedKeys.length : 0;
    const allSel = selectable && total > 0 && all.every((r) => sel.has(this._key(r)));
    const someSel = selectable && all.some((r) => sel.has(this._key(r)));
    const hasActions = (this.actions && this.actions.length) || typeof this.getHref === "function";
    const openLabel = this._label("open");
    const sizes = this.pageSizes || [10, 25, 50];
    const bulk = this.bulkActions || [];
    const span = cols.length + (hasActions ? 1 : 0) + (selectable ? 1 : 0);

    const head = html`<thead><tr>
      ${selectable ? html`<th class="puredashboard-table__th puredashboard-table__check-head">
        <input type="checkbox" class="js-puredashboard-table__check-all" aria-label="${this._label("selectAll")}" .checked=${allSel} .indeterminate=${someSel && !allSel}></th>` : ""}
      ${cols.map((c) => {
        if (!c.sortable) return html`<th class="puredashboard-table__th" style="text-align:${c.align || "left"}">${c.label}</th>`;
        const active = this.sortKey === c.key;
        const aria = active ? (this.sortDir === "desc" ? "descending" : "ascending") : "none";
        const ic = active ? (this.sortDir === "desc" ? arrowDown : arrowUp) : sortNeutral;
        return html`<th class="puredashboard-table__th puredashboard-table__th--sortable" style="text-align:${c.align || "left"}" aria-sort="${aria}">
          <button type="button" class="puredashboard-table__sort ${active ? "puredashboard-table__sort--active" : ""}" data-sort="${c.key}">
            <span>${c.label}</span><span class="puredashboard-table__sort-icon">${ic}</span></button></th>`;
      })}
      ${hasActions ? html`<th class="puredashboard-table__th puredashboard-table__actions-head">${this._label("actions")}</th>` : ""}
    </tr></thead>`;

    const body = rows.length
      ? html`<tbody>${rows.map((r, i) => {
          const isSel = sel.has(this._key(r));
          return html`<tr class="puredashboard-table__row ${isSel ? "puredashboard-table__row--selected" : ""}">
          ${selectable ? html`<td class="puredashboard-table__td puredashboard-table__check-cell">
            <input type="checkbox" class="js-puredashboard-table__check" data-i="${i}" aria-label="${this._label("selectRow")}" .checked=${isSel}></td>` : ""}
          ${cols.map((c) => html`<td class="puredashboard-table__td" style="text-align:${c.align || "left"}">${c.render ? c.render(r) : (r[c.key] ?? "")}</td>`)}
          ${hasActions ? html`<td class="puredashboard-table__td puredashboard-table__actions">
            ${typeof this.getHref === "function" ? html`<a class="puredashboard-table__open" href="${this.getHref(r)}">${openLabel}</a>` : ""}
            ${(this.actions || []).map((a) => html`<button type="button" class="puredashboard-table__action ${a.danger ? "puredashboard-table__action--danger" : ""}" data-act="${a.name}" data-i="${i}">${a.label}</button>`)}
          </td>` : ""}
        </tr>`;
        })}</tbody>`
      : html`<tbody><tr><td class="puredashboard-table__empty" colspan="${span}">${this._label("empty")}</td></tr></tbody>`;

    return html`
      ${this.filterable === false && !(selectable && selCount && bulk.length) ? "" : html`<div class="puredashboard-table__toolbar">
        ${this.filterable === false ? "" : html`<input type="search" class="puredashboard-table__search js-puredashboard-table__search" placeholder="${this._label("filter")}" aria-label="${this._label("filterAria")}" autocomplete="off">`}
        <span class="puredashboard-table__count">${total}${(this.rows || []).length !== total ? " / " + (this.rows || []).length : ""}${selCount ? " · " + this._label("selected", selCount) : ""}</span>
        ${selectable && selCount && bulk.length ? html`<span class="puredashboard-table__bulk">
          ${bulk.map((a) => html`<button type="button" class="puredashboard-table__bulk-btn ${a.danger ? "puredashboard-table__bulk-btn--danger" : ""}" data-bulk="${a.name}">${a.label}</button>`)}
        </span>` : ""}
      </div>`}
      <div class="puredashboard-table__scroll"><table class="puredashboard-table__table" aria-label="${this.getAttribute("aria-label") ?? ""}">${head}${body}</table></div>
      ${pageSize > 0 && total > 0 ? html`<div class="puredashboard-table__pager">
        <span class="puredashboard-table__range">${this._label("range", start + 1, Math.min(start + pageSize, total), total)}</span>
        <span class="puredashboard-table__pages">
          <button type="button" class="puredashboard-table__page-btn" data-page="prev" ?disabled=${page <= 1} aria-label="${this._label("prevPage")}">${chevronLeft}</button>
          <span class="puredashboard-table__page-no">${this._label("page", page, pages)}</span>
          <button type="button" class="puredashboard-table__page-btn" data-page="next" ?disabled=${page >= pages} aria-label="${this._label("nextPage")}">${chevronRight}</button>
        </span>
        <label class="puredashboard-table__page-size">${this._label("rows")} <select class="puredashboard-table__page-size-select js-puredashboard-table__page-size" aria-label="${this._label("rows")}">${sizes.map((n) => html`<option value="${n}">${n}</option>`)}</select></label>
      </div>` : ""}`;
  }
}
PuredashboardTable.define("puredashboard-table");
export { PuredashboardTable };
