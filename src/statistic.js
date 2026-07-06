// <puredashboard-statistic> — a dashboard stat-card figure (a labelled KPI number
// with optional prefix/suffix, thousands grouping, a trend arrow, and a loading
// placeholder). Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-statistic__<element>[--<modifier>]` so they never collide — restyle
// freely. There are no script hooks here (the element is display-only), so no `js-…`
// classes are needed.
//
// Content vs strings: `title`, `value`, `prefix`, `suffix` are AUTHOR CONTENT,
// interpolated at a child position in the reactive `html` engine (never `raw()`).
// `title`/`prefix`/`suffix` each accept a plain string (auto-escaped) OR a DOM node /
// nested `html` template / array to embed a custom element (you build it, you own its
// safety). `value` is coerced with `String()` before render, so it only takes real
// text (numbers are formatted, strings auto-escaped). The only trusted markup is the
// inline trend arrow, built with a local `svg()`/`raw()` helper.
// Fixed UI strings (the sr-only trend descriptions) live in `LABELS` + a `labels` prop.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// A tiny self-contained SVG helper (trusted markup only). `overflow:visible` so the
// stroke near the viewBox edge isn't clipped by the UA default. aria-hidden — the
// meaning is conveyed by the sr-only text alongside it.
const svg = (b) => raw(`<svg class="puredashboard-statistic__arrow-svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.12em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const arrowUp   = svg('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>');
const arrowDown = svg('<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>');

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. s.labels = { increase: "tăng", decrease: "giảm" }.
const LABELS = {
  increase: "increase",
  decrease: "decrease",
};

let uid = 0;

/**
 * A dashboard statistic figure: a title/label above a formatted value line
 * `[prefix][value][suffix]`, with an optional coloured trend arrow (green up / red
 * down) and a loading placeholder. Numeric values are formatted with a fixed
 * `precision` and optional thousands grouping; string values pass through as-is
 * (escaped). Display-only — configure via JS properties or HTML attributes.
 *
 * @element puredashboard-statistic
 *
 * @prop {string|Node}      title          - Label shown above the value: a string (auto-escaped) OR a DOM node / nested `html` template / array to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `""`.
 * @prop {number|string}   value          - The figure. Numbers are formatted (`precision` + grouping); strings pass through escaped. Default `""`.
 * @prop {number}          precision      - Decimal places for numeric values (`toFixed`). Default `0`.
 * @prop {boolean}         groupSeparator - Thousands grouping for numeric values. Default `true`.
 * @prop {string|Node}      prefix         - Before the value, e.g. `"$"`: a string (auto-escaped) OR a DOM node / nested `html` template / array to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `""`.
 * @prop {string|Node}      suffix         - After the value, e.g. `"%"`: a string (auto-escaped) OR a DOM node / nested `html` template / array to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `""`.
 * @prop {"up"|"down"|null} trend         - Trend direction → a coloured arrow + green/red value tint + sr-only text. Default `null`.
 * @prop {boolean}         loading        - Show a skeleton-ish placeholder in place of the value. Default `false`.
 * @prop {Object}          labels         - Override UI strings. Keys: `increase`, `decrease`. Unset keys keep the English default.
 *
 * @attr {string}  title           - Reflected to the `title` property.
 * @attr {string}  value           - Reflected to the `value` property.
 * @attr {string}  precision       - Reflected to the `precision` property (parsed as a number).
 * @attr {string}  prefix          - Reflected to the `prefix` property.
 * @attr {string}  suffix          - Reflected to the `suffix` property.
 * @attr {string}  trend           - Reflected to the `trend` property.
 * @attr {boolean} group-separator - Presence sets `groupSeparator`; absence with the attr declared unsets it.
 * @attr {boolean} loading         - Presence sets `loading`.
 *
 * @cssprop [--pd-statistic-value-size] - Value font-size (defaults to `--font-size-xl`).
 * @cssprop [--pd-statistic-title-size] - Title font-size (defaults to `--font-size-sm`).
 *
 * @example
 * const s = document.createElement("puredashboard-statistic");
 * s.title = "Revenue"; s.value = 1234567; s.prefix = "$"; s.precision = 2;
 * s.trend = "up";                       // → coloured ↑, green tint, sr-only "increase"
 * document.body.append(s);
 *
 * @example
 * // string value passes through untouched (escaped)
 * s.value = "N/A"; s.groupSeparator = false;
 */
class PuredashboardStatistic extends Reactive {
  static properties = {
    title: {}, value: {}, precision: {}, groupSeparator: {},
    prefix: {}, suffix: {}, trend: {}, loading: {}, labels: {},
  };

  constructor() {
    super();
    // Title↔value association for assistive tech (aria-labelledby needs stable ids).
    this._titleId = `js-puredashboard-statistic__title-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the figure can
  // be configured the natural way — <puredashboard-statistic title="Users" value="42"
  // trend="up"> — not only via JS. Boolean attrs map by presence; precision parses.
  static observedAttributes = ["title", "value", "precision", "prefix", "suffix", "trend", "group-separator", "loading"];
  attributeChangedCallback(name, _old, val) {
    if (name === "loading") { this.loading = val !== null; return; }
    if (name === "group-separator") { this.groupSeparator = val !== null; return; }
    if (name === "precision") { this.precision = val == null ? 0 : Number(val); return; }
    this[name] = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // _format(v) → the value as it should read on screen. Numbers (or purely-numeric
  // strings) get `precision` decimals and, when grouping is on, thousands separators;
  // everything else passes through as a string, untouched. Returns a string that the
  // template escapes — never trusted markup.
  _format(v) {
    if (v == null) return "";
    const group = this.groupSeparator !== false;   // default true
    const prec = Number.isFinite(Number(this.precision)) ? Math.max(0, Number(this.precision) | 0) : 0;
    // Only format genuine numbers (or numeric strings like "1234.5"); leave "N/A",
    // "12 units", dates, etc. exactly as authored.
    const isNumeric = typeof v === "number"
      ? Number.isFinite(v)
      : (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));
    if (!isNumeric) return String(v);
    const n = Number(v);
    // toLocaleString gives locale-correct grouping; when grouping is off we still want
    // fixed precision, so fall back to toFixed. `en-US` keeps the "1,234,567" grouping
    // deterministic across environments (matches the documented example + tests).
    return group
      ? n.toLocaleString("en-US", { minimumFractionDigits: prec, maximumFractionDigits: prec })
      : n.toFixed(prec);
  }

  render() {
    const trend = this.trend === "up" || this.trend === "down" ? this.trend : null;
    const title = this.title ?? "";
    const valueMod = trend ? ` puredashboard-statistic__value--${trend}` : "";
    const arrow = trend === "up" ? arrowUp : trend === "down" ? arrowDown : "";
    const trendText = trend ? this._label(trend === "up" ? "increase" : "decrease") : "";

    return html`
      <div class="puredashboard-statistic__title" id="${this._titleId}">${title}</div>
      <div class="puredashboard-statistic__value${valueMod}" aria-labelledby="${this._titleId}">
        ${this.loading
          ? html`<span class="puredashboard-statistic__skeleton" aria-hidden="true"></span>`
          : html`${trend ? html`<span class="puredashboard-statistic__arrow">${arrow}<span class="puredashboard-statistic__sr">${trendText} </span></span>` : ""}${this.prefix ? html`<span class="puredashboard-statistic__prefix">${this.prefix}</span>` : ""}<span class="puredashboard-statistic__number">${this._format(this.value)}</span>${this.suffix ? html`<span class="puredashboard-statistic__suffix">${this.suffix}</span>` : ""}`}
      </div>`;
  }
}
PuredashboardStatistic.define("puredashboard-statistic");

export { PuredashboardStatistic };
