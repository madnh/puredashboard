// <puredashboard-list> — a simple, presentational data list for admin views.
// Zero-dep, no build, CSP-safe. Built on the Reactive base — a list is a lighter
// table: rows of { title, description?, extra? } with optional header/footer,
// dividers, sizing, an empty state, and a loading (skeleton) state.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-list__<element>[--<modifier>]` so they never collide — restyle
// freely. This component is purely presentational (no events). Content-bearing
// fields (item `title`/`description`/`extra`, plus `header`/`footer`) are
// interpolated at a child position in the reactive `html` parts engine (never
// `raw()`): a plain string is auto-escaped, so untrusted titles/descriptions
// can't inject markup — but each field also accepts a DOM node / nested `html`
// template / array, letting you embed a custom element (you build it, you own
// its safety).
import { Reactive, html, repeat } from "./reactive.js";

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. list.labels = { empty: "Không có dữ liệu" }.
// Function-valued keys interpolate.
const LABELS = {
  empty: "No data",
};

/**
 * A simple, presentational data list — a lighter sibling of `<puredashboard-table>`.
 * Renders a `<ul role="list">` of items, each with a bold `title`, an optional muted
 * `description` on the left and an optional `extra` value on the right, plus an
 * optional header and footer. Shows an empty state when there are no items, and a
 * skeleton "loading" state on demand. Configure entirely via JS properties.
 *
 * @element puredashboard-list
 *
 * @prop {Array<{title:string|Node, description?:string|Node, extra?:string|Node}>} items - Row data. Each of `title`/`description`/`extra` accepts a string (auto-escaped) OR a DOM node / nested `html` template / array — pass a node or template to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `[]`.
 * @prop {string|Node}  [header]   - Optional header shown above the list: a string (auto-escaped) OR a DOM node / nested `html` template / array to embed a custom element (author-owned safety).
 * @prop {string|Node}  [footer]   - Optional footer shown below the list: a string (auto-escaped) OR a DOM node / nested `html` template / array to embed a custom element (author-owned safety).
 * @prop {boolean} [bordered] - Wrap the list in a bordered panel. Default `false`.
 * @prop {string}  [size]     - Row padding density: `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} [split]    - Draw dividers between rows. Default `true`; set `false` to remove them.
 * @prop {boolean} [loading]  - Show skeleton placeholder rows instead of content. Default `false`.
 * @prop {Object}  [labels]   - Override UI strings (English defaults). Keys: `empty`.
 *
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @example
 * const list = document.createElement("puredashboard-list");
 * list.header = "Recent nodes";
 * list.items = [
 *   { title: "web-01", description: "us-east-1", extra: "online" },
 *   { title: "web-02", description: "us-west-2", extra: "offline" },
 * ];
 * list.bordered = true;
 * document.body.append(list);
 */
class PuredashboardList extends Reactive {
  static properties = {
    items: {}, header: {}, footer: {}, bordered: {}, size: {}, split: {},
    loading: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the list can
  // be configured the natural way — <puredashboard-list bordered size="lg"> — not
  // only via JS. Boolean attrs map by presence.
  static observedAttributes = ["header", "footer", "size", "bordered", "split", "loading"];
  attributeChangedCallback(name, _old, val) {
    const bool = name === "bordered" || name === "split" || name === "loading";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  render() {
    const items = this.items || [];
    const size = this.size === "sm" ? "sm" : this.size === "lg" ? "lg" : "md";
    const split = this.split !== false;
    const listCls = `puredashboard-list__list puredashboard-list__list--${size}${split ? "" : " puredashboard-list__list--no-split"}`;

    let body;
    if (this.loading) {
      // A few skeleton-ish placeholder rows while data loads.
      const skeletons = [0, 1, 2];
      body = html`<ul class="${listCls}" role="list" aria-label="${this.getAttribute("aria-label") ?? ""}" aria-busy="true">${
        skeletons.map((i) => html`<li class="puredashboard-list__item puredashboard-list__item--skeleton" role="listitem" aria-hidden="true">
          <span class="puredashboard-list__main"><span class="puredashboard-list__skeleton puredashboard-list__skeleton--title"></span><span class="puredashboard-list__skeleton puredashboard-list__skeleton--desc"></span></span>
        </li>`)
      }</ul>`;
    } else if (items.length) {
      body = html`<ul class="${listCls}" role="list" aria-label="${this.getAttribute("aria-label") ?? ""}">${
        repeat(items, (_it, i) => i, (it) => html`<li class="puredashboard-list__item" role="listitem">
          <span class="puredashboard-list__main"><strong class="puredashboard-list__title">${it.title ?? ""}</strong>${it.description != null && it.description !== "" ? html`<span class="puredashboard-list__desc">${it.description}</span>` : ""}</span>${it.extra != null && it.extra !== "" ? html`<span class="puredashboard-list__extra">${it.extra}</span>` : ""}
        </li>`)
      }</ul>`;
    } else {
      body = html`<div class="puredashboard-list__empty" role="status">${this._label("empty")}</div>`;
    }

    return html`
      <div class="puredashboard-list__panel ${this.bordered ? "puredashboard-list__panel--bordered" : ""}">
        ${this.header != null && this.header !== "" ? html`<div class="puredashboard-list__header">${this.header}</div>` : ""}
        ${body}
        ${this.footer != null && this.footer !== "" ? html`<div class="puredashboard-list__footer">${this.footer}</div>` : ""}
      </div>`;
  }
}
PuredashboardList.define("puredashboard-list");

export { PuredashboardList };
