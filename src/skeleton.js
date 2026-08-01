// <puredashboard-skeleton> — a loading placeholder (shimmer). Zero-dep, no build,
// CSP-safe. Built on the Reactive base.
//
// Purely decorative visual filler shown while real content loads. It renders one or
// more shimmer shapes — a stack of text bars (the last one shorter), a rectangle, or
// a circle — sized via dynamic inline styles (the only sanctioned use of inline
// `style`). The shimmer is a CSS gradient keyframe animation over --panel-2 →
// --panel-3; under `prefers-reduced-motion: reduce` it collapses to a static block
// (no animation) — handled entirely in skeleton.css.
//
// Class naming (BEM, block = the component tag): style classes are namespaced
// `puredashboard-skeleton__<element>[--<modifier>]` so they never collide.
//
// a11y approach: the host owns the loading signal — role="status", aria-busy="true"
// and aria-label (LABELS.loading) — while every visual shape is aria-hidden="true"
// (the shapes carry no information). Assistive tech thus hears "loading" once, not a
// pile of empty boxes. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat } from "./reactive.js";

// All user-facing strings (English defaults). Override any subset via the `labels`
// property to localise — e.g. sk.labels = { loading: "Đang tải…" }.
const LABELS = {
  loading: "Loading…",
};

/**
 * A decorative loading placeholder that shows a shimmer while real content loads.
 * Renders a stack of text bars (`variant="text"`, last line shorter), a rectangle
 * (`variant="rect"`) or a circle (`variant="circle"`), sized through dynamic inline
 * styles. The shimmer collapses to a static block under `prefers-reduced-motion`.
 * Configure via JS properties or HTML attributes.
 *
 * a11y: the host is the single loading signal (`role="status"`, `aria-busy="true"`,
 * `aria-label` = `labels.loading`); the visual shapes are `aria-hidden="true"` so
 * assistive tech announces "loading" once rather than reading empty boxes.
 *
 * @element puredashboard-skeleton
 *
 * @prop {string}  variant  - `"text"` (default) | `"rect"` | `"circle"`.
 * @prop {number}  lines    - Number of bars for `variant="text"`. Default `3`.
 * @prop {string}  width    - CSS length; required for `rect`/`circle`, optional override for `text`. Default unset.
 * @prop {string}  height   - CSS length; sizes `rect` (and is the diameter fallback of `circle`). Default unset.
 * @prop {string}  radius   - CSS length; overrides the corner radius of `rect`/`text` bars. Default unset.
 * @prop {boolean} animated - Run the shimmer animation. Default `true` (set `false` for a static block).
 * @prop {Object}  labels   - Override UI strings. Keys: `loading`. Unset keys keep the English default.
 *
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @cssprop [--pd-skeleton-base]      - Base shape colour (defaults to `--panel-2`).
 * @cssprop [--pd-skeleton-highlight] - Shimmer highlight colour (defaults to `--panel-3`).
 * @cssprop [--pd-skeleton-radius]    - Corner radius of rect/text bars (defaults to `--radius`).
 *
 * @example
 * const sk = document.createElement("puredashboard-skeleton");
 * sk.variant = "text"; sk.lines = 4;                 // four shimmer bars
 * card.replaceChildren(sk);
 * // later, when data has loaded:
 * card.replaceChildren(realContent);
 *
 * @example
 * // an avatar placeholder
 * const av = document.createElement("puredashboard-skeleton");
 * av.variant = "circle"; av.width = "48px";
 */
class PuredashboardSkeleton extends Reactive {
  static properties = {
    variant: {}, lines: {}, width: {}, height: {}, radius: {}, animated: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the placeholder
  // can be dropped in as markup — <puredashboard-skeleton variant="circle" width="48px">
  // — not only via JS. `animated` is boolean-by-presence but defaults to true, so an
  // explicit animated="false" turns it off.
  static observedAttributes = ["variant", "lines", "width", "height", "radius", "animated"];
  attributeChangedCallback(name, _old, val) {
    if (name === "lines") this.lines = val == null ? undefined : Number(val);
    else if (name === "animated") this.animated = val == null ? true : val !== "false";
    else this[name] = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    // Signal "loading" on the host once; the shapes stay aria-hidden.
    this.setAttribute("role", "status");
    this.setAttribute("aria-busy", "true");
    this._syncName();
  }

  updated() {
    // Keep the label in sync if `labels` changes after mount.
    this._syncName();
  }

  // Our LABELS string is only the FALLBACK name: an aria-label (or aria-labelledby)
  // set by the author is never overwritten — we only ever replace our own value.
  _syncName() {
    if (this.hasAttribute("aria-labelledby")) return;
    if (this.hasAttribute("aria-label") && this.getAttribute("aria-label") !== this._ariaOwn) return;
    this._ariaOwn = this._label("loading");
    this.setAttribute("aria-label", this._ariaOwn);
  }

  // Build the dynamic inline style for a shape from width/height/radius. Inline style
  // is allowed here because every value is dynamic (see docs/DEVELOPMENT.md rule 1).
  _style({ width, height, radius } = {}) {
    let s = "";
    if (width != null) s += `width:${width};`;
    if (height != null) s += `height:${height};`;
    if (radius != null) s += `border-radius:${radius};`;
    return s;
  }

  render() {
    const variant = this.variant || "text";
    const animated = this.animated !== false;
    const animCls = animated ? " puredashboard-skeleton__el--animated" : "";

    if (variant === "circle") {
      // A circle is sized by width; height mirrors it (fall back to height if only that is set).
      const d = this.width ?? this.height;
      const style = this._style({ width: d, height: d });
      return html`<span class="puredashboard-skeleton__el puredashboard-skeleton__el--circle${animCls}" style="${style}" aria-hidden="true"></span>`;
    }

    if (variant === "rect") {
      const style = this._style({ width: this.width, height: this.height, radius: this.radius });
      return html`<span class="puredashboard-skeleton__el puredashboard-skeleton__el--rect${animCls}" style="${style}" aria-hidden="true"></span>`;
    }

    // text: N bars; the last bar is ~60% wide (a natural end-of-paragraph look).
    const n = Math.max(1, Number(this.lines) || 3);
    const items = Array.from({ length: n }, (_, i) => i);
    return html`<span class="puredashboard-skeleton__lines" aria-hidden="true">${repeat(items, (i) => i, (i) => {
      const last = i === n - 1 && n > 1;
      const w = this.width ?? (last ? "60%" : null);
      const style = this._style({ width: w, height: this.height, radius: this.radius });
      return html`<span class="puredashboard-skeleton__el puredashboard-skeleton__el--text${last ? " puredashboard-skeleton__el--last" : ""}${animCls}" style="${style}"></span>`;
    })}</span>`;
  }
}
PuredashboardSkeleton.define("puredashboard-skeleton");

export { PuredashboardSkeleton };
