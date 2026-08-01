// <puredashboard-toggle> — a two-state BUTTON (on / off). Zero-dep, no build, CSP-safe.
// Built on the Reactive base.
//
// Pick the right sibling — all three look toggle-ish but mean different things:
//   • <puredashboard-toggle>   — a COMMAND button that stays pressed (bold, mute, pin,
//     "show archived"). role=button + aria-pressed. Applies immediately; NOT a form
//     field, so it is deliberately not form-associated and submits nothing.
//   • <puredashboard-switch>   — a form INPUT for an on/off setting (role=switch).
//   • <puredashboard-checkbox> — a form INPUT for a boolean value in a set.
// Base UI draws the same line: a toggle is an action button with visual feedback, not a
// form control.
//
// It renders a real <button> so keyboard (Space/Enter), focus and disabled come from the
// platform. `icon` is trusted author SVG markup (like menu.js / segmented.js); an
// ICON-ONLY toggle must carry an `aria-label` — the name is mirrored onto the inner
// button, which is the element assistive tech announces.
//
// `tabbable` + `focus()` exist for <puredashboard-toggle-group>, which drives a roving
// tabindex across its children; on its own a toggle is always tabbable.
//
// Class naming (BEM, block = the component tag) with a SEPARATE `js-` hook for the one
// element the script selects. Themed through the shared tokens (--accent, --panel-2/-3,
// --text, --border, --focus-ring, --control-height-*, --radius, --duration-*,
// --disabled-opacity) via a --pd-* fallback chain, so it works with no theme linked.
// All fixed strings live in a LABELS map. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// A toggle renders no fixed strings of its own: the visible `label` is author CONTENT
// and the accessible name of an icon-only toggle is the author's `aria-label`. The map
// stays (empty) so the `labels` convention holds if a string is ever added — same as
// space.js.
const LABELS = {};

/**
 * A two-state button: it stays visibly pressed until you press it again. Use it for a
 * setting that applies IMMEDIATELY — bold/italic in a toolbar, mute, pin, "show
 * archived". Renders a native `<button>` with `aria-pressed`, so keyboard, focus and
 * `disabled` are the platform's.
 *
 * **Not a form field:** unlike `<puredashboard-switch>` (role=switch) and
 * `<puredashboard-checkbox>`, a toggle is an action button — it is not form-associated
 * and submits nothing. Pick switch/checkbox when the value belongs in a `<form>`.
 *
 * @element puredashboard-toggle
 *
 * @prop {boolean} pressed   - Whether the toggle is on (get/set). Default `false`.
 * @prop {boolean} disabled  - Disable the button. Default `false`.
 * @prop {string}  value     - Identity of this toggle inside a `<puredashboard-toggle-group>`. Ignored standalone.
 * @prop {string|Node} label - Visible label. A string is escaped; a DOM node / nested `html` template renders as-is. Default `""` (icon-only).
 * @prop {string}  icon      - Optional leading inline SVG markup (author-TRUSTED, like `menu.js` icons).
 * @prop {string}  size      - `"sm"` | `"md"` (default) | `"lg"`.
 * @prop {string}  variant   - `"default"` (bordered) | `"text"` (borderless, for toolbars).
 * @prop {boolean} tabbable  - Whether the inner button is in the tab order. Default `true`; `<puredashboard-toggle-group>` sets it to run a roving tabindex.
 * @prop {Object}  labels    - Override UI strings. This component renders no fixed text, so usually unused.
 *
 * @attr {boolean} pressed  - Declarative form of `pressed` (presence = true).
 * @attr {boolean} disabled - Declarative form of `disabled`.
 * @attr {string}  value    - Declarative form of `value`.
 * @attr {string}  label    - Declarative form of `label` (text only).
 * @attr {string}  icon     - Declarative form of `icon` (trusted SVG markup).
 * @attr {string}  size     - Declarative form of `size`.
 * @attr {string}  variant  - Declarative form of `variant`.
 * @attr {string}  aria-label - Accessible name, mirrored onto the inner `<button>`. REQUIRED for an icon-only toggle (`icon` with no `label`).
 *
 * @fires change - Bubbling `CustomEvent` fired when the state changes by user action. `detail` = `{ pressed, value }`. Setting `.pressed` in JS does NOT fire it.
 *
 * @method toggle - `toggle() => void` — flip the state as a click would (emits `change`).
 * @method focus  - `focus() => void` — focus the inner button.
 *
 * @cssprop [--pd-toggle-h] - Control height (defaults per `size`).
 *
 * @example
 * const t = document.createElement("puredashboard-toggle");
 * t.icon = BOLD_SVG;
 * t.setAttribute("aria-label", "Bold");     // icon-only → the name must be explicit
 * t.addEventListener("change", (e) => applyBold(e.detail.pressed));
 * document.body.append(t);
 */
class PuredashboardToggle extends Reactive {
  static properties = {
    pressed: {}, disabled: {}, value: {}, label: {}, icon: {}, size: {}, variant: {}, tabbable: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so a toolbar can be
  // written as markup — <puredashboard-toggle pressed value="bold" label="B"> — not only
  // via JS. Boolean attrs map by presence.
  static observedAttributes = ["pressed", "disabled", "value", "label", "icon", "size", "variant", "aria-label"];
  attributeChangedCallback(name, _old, val) {
    if (name === "aria-label") { this.requestUpdate(); return; }      // mirrored in render()
    const bool = name === "pressed" || name === "disabled";
    this[name] = bool ? val !== null : val;
  }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.pressed == null) this.pressed = this.hasAttribute("pressed");
    if (this.tabbable == null) this.tabbable = true;
  }

  _btn() { return this.$(".js-puredashboard-toggle__btn"); }
  focus() { this._btn()?.focus(); }

  /** Flip the state as a user click would — updates `pressed` and emits `change`. */
  toggle() {
    if (this.disabled) return;
    this.pressed = !this.pressed;
    this.emit("change", { pressed: !!this.pressed, value: this.value ?? null });
  }

  // Keep `pressed` mirrored as an attribute so CSS/tests can select on it and a group can
  // read state without touching JS. Guarded: writing an OBSERVED attribute re-enters
  // attributeChangedCallback, so only write when it actually differs.
  updated() {
    const on = !!this.pressed;
    if (on !== this.hasAttribute("pressed")) on ? this.setAttribute("pressed", "") : this.removeAttribute("pressed");
  }

  render() {
    const on = !!this.pressed;
    const dis = !!this.disabled;
    const hasLabel = this.label != null && this.label !== "";
    const sizeCls = this.size === "sm" ? " puredashboard-toggle__btn--sm" : this.size === "lg" ? " puredashboard-toggle__btn--lg" : "";
    const variantCls = this.variant === "text" ? " puredashboard-toggle__btn--text" : "";
    const onCls = on ? " puredashboard-toggle__btn--pressed" : "";
    const iconOnly = !hasLabel && this.icon ? " puredashboard-toggle__btn--icon-only" : "";
    // The accessible name belongs on the <button> (the host has no role) — see _agents.md.
    const name = this.getAttribute("aria-label") ?? "";
    const namedBy = this.getAttribute("aria-labelledby") ?? "";
    return html`<button type="button" class="puredashboard-toggle__btn js-puredashboard-toggle__btn${sizeCls}${variantCls}${onCls}${iconOnly}" aria-pressed="${on ? "true" : "false"}" aria-label="${name}" aria-labelledby="${namedBy}" ?disabled="${dis}" tabindex="${this.tabbable === false ? "-1" : "0"}" @click="${() => this.toggle()}">${this.icon ? html`<span class="puredashboard-toggle__icon">${raw(this.icon)}</span>` : ""}${hasLabel ? html`<span class="puredashboard-toggle__label">${this.label}</span>` : ""}</button>`;
  }
}
PuredashboardToggle.define("puredashboard-toggle");

export { PuredashboardToggle };
