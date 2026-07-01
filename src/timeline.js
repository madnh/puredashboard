// <puredashboard-timeline> — a vertical activity / history timeline. Zero-dep, no
// build, CSP-safe. Built on the Reactive base.
//
// Renders an ordered list of events, each as a coloured dot (or a custom SVG
// glyph) threaded onto a vertical connector line, with the event content and an
// optional label/time. This is the presentational sibling of steps.js: where
// steps derives a per-step status from a `current` index, a timeline takes an
// explicit per-item `color` and simply lays events out in order (oldest→newest,
// or reversed). It emits NO events and holds no interactive state.
//
// Item content/label are CONTENT (passed in `items`), rendered via escaped
// html`` interpolation — only the fixed accessibility wording lives in LABELS.
// An item's optional `dot` is trusted inline SVG markup (like menu.js icons),
// spliced in via raw(); pass author-controlled markup only.
import { Reactive, html, repeat } from "./reactive.js";
import { raw } from "./html.js";

// Self-contained inline icons, sized via an inline style in a tiny local svg()
// helper wrapping raw() — no shared icon module, mirroring menu.js / steps.js.
// spinnerIcon draws the ghost "pending" dot; CSS spins it (reduced-motion safe).
const svg = (b, cls = "") => raw(`<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible" aria-hidden="true">${b}</svg>`);
const spinnerIcon = svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', "puredashboard-timeline__spinner");

// All user-facing FIXED strings (English defaults). Item content/labels are
// content, not labels. Override any subset via the `labels` property to localise —
// e.g. tl.labels = { pending: "Đang xử lý…" }.
const LABELS = {
  // Default accessible/visible text for the trailing pending item when `pending`
  // is passed as a boolean rather than a string.
  pending: "In progress…",
};

// Map a semantic `color` name to its BEM modifier suffix. Unknown values fall
// back to the neutral "muted" dot so an unrecognised colour never breaks layout.
const COLORS = new Set(["accent", "success", "warning", "error", "muted"]);

/**
 * A vertical activity timeline. Renders an ordered list of events, each a
 * coloured dot (or a custom SVG glyph) on a continuous connector line, with the
 * event content and an optional label/time. Purely presentational — no events,
 * no interactive state; configure via JS properties.
 *
 * @element puredashboard-timeline
 *
 * @prop {Array<{content:string, label?:string, color?:"accent"|"success"|"warning"|"error"|"muted", dot?:string}>} items - The events, in order. `content` is the body; `label` an optional time/meta line; `color` picks the dot hue (default `accent`); `dot` is optional trusted inline SVG markup replacing the plain dot. Default `[]`.
 * @prop {string}  mode    - Which side content sits on: `"left"` (default), `"right"`, or `"alternate"` (zig-zag). Default `"left"`.
 * @prop {boolean} reverse - Render the items in reverse order (newest first). Default `false`.
 * @prop {(string|boolean)} pending - Append a trailing ghost item with an animated spinner dot. A string is its content; `true` uses the `pending` label. Falsy → no pending item. Default `false`.
 * @prop {Object}  labels  - Override UI strings. Keys: `pending`. Unset keys keep the English default.
 *
 * @cssprop [--pd-timeline-dot]       - Dot diameter (defaults to `12px`).
 * @cssprop [--pd-timeline-connector] - Connector line thickness (defaults to `2px`).
 * @cssprop [--pd-timeline-gap]       - Vertical gap between items (defaults to `--sp-5`).
 *
 * @example
 * const tl = document.createElement("puredashboard-timeline");
 * tl.items = [
 *   { label: "09:00", content: "Deploy started", color: "accent" },
 *   { label: "09:02", content: "Build passed",   color: "success" },
 *   { label: "09:05", content: "Rollout failed", color: "error" },
 * ];
 * tl.pending = "Retrying…";
 * document.body.append(tl);
 */
class PuredashboardTimeline extends Reactive {
  static properties = {
    items: {}, mode: {}, reverse: {}, pending: {}, labels: {},
  };

  // Reflect declarative HTML attributes so the timeline can also be configured
  // the natural way — <puredashboard-timeline mode="alternate" reverse>.
  static observedAttributes = ["mode", "reverse"];
  attributeChangedCallback(name, _old, val) {
    if (name === "reverse") this.reverse = val !== null; // boolean by presence
    else this.mode = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // side(i) → which side content sits on for row i, given the mode. "alternate"
  // zig-zags: even rows left, odd rows right.
  _side(i, mode) {
    if (mode === "right") return "right";
    if (mode === "alternate") return i % 2 === 0 ? "left" : "right";
    return "left";
  }

  // Build one <li>. `pending` rows get a spinner dot + the --pending modifier and
  // no colour class; ordinary rows get a colour-modified dot (or a custom glyph).
  _item({ content, label, color, dot }, i, side, pending) {
    const colorMod = pending ? "pending" : (COLORS.has(color) ? color : "accent");
    const itemCls = `puredashboard-timeline__item puredashboard-timeline__item--${side} puredashboard-timeline__item--${colorMod}`;
    // The dot marker: a spinner for pending, author SVG if given, else a plain
    // filled circle drawn by CSS. Custom/spinner glyphs render via raw() (trusted).
    const marker = pending
      ? spinnerIcon
      : (dot ? raw(dot) : "");
    const body = html`<div class="puredashboard-timeline__body">${label ? html`<div class="puredashboard-timeline__label">${label}</div>` : ""}<div class="puredashboard-timeline__content">${content}</div></div>`;
    return html`<li class="${itemCls}" data-index="${i}"><span class="puredashboard-timeline__dot" aria-hidden="true">${marker}</span>${body}</li>`;
  }

  render() {
    const mode = this.mode === "right" || this.mode === "alternate" ? this.mode : "left";
    const src = (this.items || []).slice();
    if (this.reverse) src.reverse();

    // A trailing "in progress" item when `pending` is set. A string is its
    // content; `true` uses the localised default label.
    const pending = this.pending;
    const pendingItem = pending
      ? { content: typeof pending === "string" ? pending : this._label("pending") }
      : null;

    const listCls = `puredashboard-timeline__list puredashboard-timeline__list--${mode}`;
    // Key by index so reordering (reverse) rebuilds rows cleanly; there is no
    // per-row focus/state to preserve, so index keys are safe here.
    return html`<ol class="${listCls}" role="list">${repeat(src, (s, i) => i, (s, i) => this._item(s, i, this._side(i, mode), false))}${pendingItem ? this._item(pendingItem, src.length, this._side(src.length, mode), true) : ""}</ol>`;
  }
}
PuredashboardTimeline.define("puredashboard-timeline");

export { PuredashboardTimeline };
