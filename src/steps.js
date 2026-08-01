// <puredashboard-steps> — a progress stepper / wizard indicator. Zero-dep, no
// build, CSP-safe. Built on the Reactive base.
//
// Shows an ordered sequence of steps with a per-step status derived purely from
// the `current` index: steps BEFORE current are "complete" (a check glyph),
// the step AT current is "current" (marked aria-current="step"), and steps
// AFTER current are "upcoming". BEM classes are namespaced by the tag
// (puredashboard-steps__…); the only script hook is `data-index` on the step.
//
// This is NOT a form control — it's a display/navigation indicator. When
// `clickable` is set each step becomes a real <button> that emits a bubbling
// `stepchange` CustomEvent; otherwise steps are plain, non-interactive markup so
// upcoming steps never look actionable. Numbers shown to users are 1-based; the
// `current` property and the event detail use a 0-based index.
//
// Step titles/descriptions are CONTENT (passed in `steps`), not localised
// strings — only the fixed accessibility wording lives in LABELS.
import { Reactive, html, repeat } from "./reactive.js";
import { raw } from "./html.js";

// Self-contained inline icon (a check glyph for completed steps), sized via an
// inline style in a tiny local svg() helper wrapping raw() — no shared icon
// module, mirroring menu.js / table.js.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const checkIcon = svg('<path d="M20 6 9 17l-5-5"/>');

// All user-facing FIXED strings (English defaults). Step titles/descriptions are
// content, not labels. Override any subset via the `labels` property to localise —
// e.g. st.labels = { stepLabel: (n) => `Bước ${n}`, complete: "Hoàn thành" }.
// Function-valued keys interpolate.
const LABELS = {
  // Accessible name for a step's number bubble, n = 1-based position.
  stepLabel: (n) => `Step ${n}`,
  // Visually-hidden status suffixes for assistive tech.
  complete: "completed",
  current: "current",
  upcoming: "upcoming",
};

/**
 * A progress stepper / wizard indicator. Renders an ordered list of steps, each
 * with a number bubble (or a check glyph once complete), a label and an optional
 * description; CSS draws the connector lines between them. Per-step status is
 * derived from the active index: earlier steps are complete, the active one is
 * current (`aria-current="step"`), later ones are upcoming. Horizontal by
 * default; set `vertical` to stack. Not a form control — configure via JS
 * properties.
 *
 * @element puredashboard-steps
 *
 * @prop {Array<{label:string|Node, description?:string|Node}>} steps - The steps to show, in order.
 *   Each `description` accepts a string (auto-escaped) OR a DOM node / nested `html` template / array —
 *   pass a node or template to embed a custom element (you build it, you own its safety; plain strings
 *   stay escaped). Each `label` accepts a string OR a DOM node / nested `html` template — but keep it a
 *   plain string when the accessible name matters: it also feeds `aria-label`, where a node would
 *   stringify to `[object Object]`. Default `[]`.
 * @prop {number}  current   - 0-based index of the active step. Default `0`.
 * @prop {boolean} vertical  - Stack steps vertically instead of horizontally. Default `false`.
 * @prop {boolean} clickable - Render each step as a `<button>` that emits `stepchange`. Default `false`.
 * @prop {Object}  labels    - Override UI strings. Keys: `stepLabel(n)`, `complete`, `current`, `upcoming`. Unset keys keep the English default.
 *
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @fires stepchange - Bubbling `CustomEvent` when a clickable step is chosen. `detail`: `{ index }` (0-based).
 *
 * @cssprop [--pd-steps-bubble]     - Bubble diameter (defaults to `28px`).
 * @cssprop [--pd-steps-connector]  - Connector line thickness (defaults to `2px`).
 *
 * @example
 * const st = document.createElement("puredashboard-steps");
 * st.steps = [
 *   { label: "Account", description: "Your details" },
 *   { label: "Billing" },
 *   { label: "Done" },
 * ];
 * st.current = 1;
 * st.clickable = true;
 * st.addEventListener("stepchange", (e) => { st.current = e.detail.index; });
 * document.body.append(st);
 */
class PuredashboardSteps extends Reactive {
  static properties = {
    steps: {}, current: {}, vertical: {}, clickable: {}, labels: {},
  };

  // Reflect declarative HTML attributes so the indicator can also be configured
  // the natural way — <puredashboard-steps current="1" vertical clickable>.
  static observedAttributes = ["current", "vertical", "clickable"];
  attributeChangedCallback(name, _old, val) {
    if (name === "current") this.current = Number(val) || 0;
    else this[name] = val !== null; // boolean: vertical / clickable
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    // One delegated listener; the step's 0-based index rides on data-index.
    this.on("click", "[data-index]", (e, el) => {
      if (!this.clickable) return;
      this.emit("stepchange", { index: Number(el.dataset.index) });
    });
  }

  // status(i) → "complete" | "current" | "upcoming", derived solely from current.
  _status(i) {
    const cur = Number(this.current) || 0;
    return i < cur ? "complete" : i === cur ? "current" : "upcoming";
  }

  render() {
    const steps = this.steps || [];
    const clickable = !!this.clickable;
    const listCls = "puredashboard-steps__list" + (this.vertical ? " puredashboard-steps__list--vertical" : " puredashboard-steps__list--horizontal");

    return html`<ol class="${listCls}" role="list" aria-label="${this.getAttribute("aria-label") ?? ""}">${repeat(steps, (s, i) => i, (s, i) => {
      const status = this._status(i);
      const isCurrent = status === "current";
      const complete = status === "complete";
      const itemCls = `puredashboard-steps__item puredashboard-steps__item--${status}`;
      // The bubble shows a 1-based number, or a check once complete. The
      // accessible name pairs the step label with its status for AT.
      const aria = `${this._label("stepLabel", i + 1)}: ${s.label} (${this._label(status)})`;
      const bubble = html`<span class="puredashboard-steps__bubble" aria-hidden="true">${complete ? checkIcon : i + 1}</span>`;
      const body = html`<span class="puredashboard-steps__body"><span class="puredashboard-steps__label">${s.label}</span>${s.description ? html`<span class="puredashboard-steps__desc">${s.description}</span>` : ""}</span>`;

      // Clickable → a real <button> (keyboard + focus for free). Otherwise a
      // non-interactive <span> so upcoming steps never look actionable.
      const cur = isCurrent ? "step" : null; // null → the parts engine drops the attr
      const inner = clickable
        ? html`<button type="button" class="puredashboard-steps__step" data-index="${i}" aria-current="${cur}" aria-label="${aria}">${bubble}${body}</button>`
        : html`<span class="puredashboard-steps__step" aria-current="${cur}" aria-label="${aria}">${bubble}${body}</span>`;

      return html`<li class="${itemCls}" data-index="${i}"><span class="puredashboard-steps__connector" aria-hidden="true"></span>${inner}</li>`;
    })}</ol>`;
  }
}
PuredashboardSteps.define("puredashboard-steps");

export { PuredashboardSteps };
