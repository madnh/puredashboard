// <puredashboard-segmented> — a single-select segmented control (a connected
// button group with a sliding "thumb"). Zero-dep, no build, CSP-safe. Built on
// the Reactive base.
//
// Follows the same pattern as its closest sibling <puredashboard-radio-group>
// (radio-group.js): a segmented control has no single native equivalent, so it
// OWNS its selection and implements the WAI-ARIA APG "Radio Group" pattern by
// hand — role=radiogroup container + role=radio segments, aria-checked, roving
// tabindex (exactly one segment tabbable), and the arrow/Home/End keyboard map
// (wrapping, skipping disabled). Selection moves focus and emits a bubbling
// `change` CustomEvent (detail.value). Unlike radio-group this is NOT a form
// input — it's a view toggle (like a tabs/segment switcher), so it is not
// form-associated; it just reports the chosen value via the event + `value`.
//
// State lives in `static properties`; all FIXED strings live in a `LABELS` map;
// BEM classes are namespaced by the tag with SEPARATE `js-…`/`data-*` script
// hooks; theming flows through the shared design tokens (--panel/--panel-2/-3,
// --text, --muted, --border, --focus-ring, --radius, --control-height-*,
// --duration-*, --ease-standard, --disabled-opacity) via a --pd-* fallback chain
// so it works with no theme linked. Icons (optional per option) are inline,
// trusted SVG markup via a local svg()/raw() helper, mirroring table.js/menu.js.
// See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat } from "./reactive.js";
import { raw } from "./html.js";

// Option icons are OPTIONAL, trusted author-supplied inline SVG markup, inserted
// as-is via raw() (like menu.js / table.js icons). Option TEXT, by contrast, is
// escaped content — it always flows through the html`` text binding, never raw.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. seg.labels = { group: "Chế độ" }.
// Function-valued keys interpolate. NB: each option's visible label is author
// CONTENT (it comes from the `options` data), NOT a fixed string, so it is never
// a LABELS key.
const LABELS = {
  group: "Segmented control",
};

/**
 * A single-select segmented control: a connected group of buttons where exactly
 * one segment is selected, with a highlighted "thumb" that slides to the choice.
 * Use it as a compact view toggle (list/grid, day/week/month, …). It is NOT a
 * form input — it owns its selection and reports it via a bubbling `change`
 * event and the `value` property. Renders a `role="radiogroup"` container with
 * one `role="radio"` segment per option (not native radios) and follows the
 * WAI-ARIA APG "Radio Group" pattern: roving tabindex (exactly one segment
 * tabbable) plus the arrow/Home/End keyboard map, skipping disabled options and
 * wrapping at the ends. Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-segmented
 *
 * @prop {Array<{value:string,label:string,icon?:string,disabled?:boolean}>|string[]} options - The segments. A plain `string[]` is shorthand for `{ value, label }` pairs. `icon` is trusted inline SVG markup. Default `[]`.
 * @prop {string}  value    - Value of the selected segment (get/set). Defaults to the first enabled option.
 * @prop {string}  size     - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} block    - Full width with equal-width segments. Default `false`.
 * @prop {boolean} disabled - Disable the whole control. Default `false`.
 * @prop {Object}  labels   - Override UI strings. Keys: `group` (the group's accessible name). Unset keys keep the English default.
 * @attr {string}  aria-label      - Accessible name for the group (mirrored to the radiogroup; falls back to the `group` label).
 * @attr {string}  aria-labelledby - IDs labelling the group (mirrored to the radiogroup).
 *
 * @fires change - Bubbling `CustomEvent` fired when the selection changes. `detail.value` is the newly selected value.
 *
 * @method focus - `focus() => void` — focus the current roving-tabindex segment.
 *
 * @cssprop [--pd-segmented-gap] - Padding around the thumb inside the track (defaults to `2px`).
 *
 * @example
 * const seg = document.createElement("puredashboard-segmented");
 * seg.options = [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }];
 * seg.value = "grid";
 * seg.setAttribute("aria-label", "View");
 * seg.addEventListener("change", (e) => console.log(e.detail.value));
 * document.body.append(seg);
 */
class PuredashboardSegmented extends Reactive {
  static properties = {
    options: {}, value: {}, size: {}, block: {}, disabled: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way — <puredashboard-segmented size="lg" block>
  // — not only via JS. Boolean attrs map by presence.
  static observedAttributes = ["value", "size", "block", "disabled"];
  attributeChangedCallback(name, _old, val) {
    const bool = name === "block" || name === "disabled";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._explicit = this.getAttribute("value") ?? "";   // explicit initial value, if any
    if (this.options == null) this.options = [];
    if (this.value == null) this.value = this._explicit;
  }

  // Resolve the effective selection: an explicit value, else the first enabled
  // option. Called from render() so a value set BEFORE or AFTER options both
  // work (options may be assigned after mount, once connectedCallback ran).
  _defaultValue() {
    const opts = this._opts();
    if (this.value && opts.some((o) => o.value === this.value)) return this.value;
    const first = opts.find((o) => !o.disabled) || opts[0];
    return first ? first.value : (this.value ?? "");
  }

  focus() { (this.$(`.js-puredashboard-segmented__segment[tabindex="0"]`) || this.$(`.js-puredashboard-segmented__segment`))?.focus(); }

  // The list of options, always an array of normalised {value,label,icon?,disabled?}.
  // A plain string[] is shorthand: each string is both value and label.
  _opts() {
    const raw = Array.isArray(this.options) ? this.options : [];
    return raw.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  }
  // Indices of enabled options (control not disabled AND option not disabled).
  _enabled() { const o = this._opts(); const out = []; for (let i = 0; i < o.length; i++) if (!this.disabled && !o[i].disabled) out.push(i); return out; }

  // Select the option at index i (if enabled), move focus to it, and emit `change`
  // when the value actually changes. Central to both click and keyboard handling.
  _select(i) {
    const o = this._opts()[i];
    if (!o || o.disabled || this.disabled) return;
    const changed = this.value !== o.value;
    this.value = o.value;
    // Re-render happens on the microtask; focus the segment once it exists.
    queueMicrotask(() => this.$(`[data-idx="${i}"]`)?.focus());
    if (changed) this.emit("change", { value: o.value });
  }

  // Keyboard: implements the WAI-ARIA APG Radio Group map. Right/Down → next
  // enabled segment (wraps) + select; Left/Up → previous (wraps) + select; Home →
  // first enabled; End → last enabled; Space/Enter → select the focused segment.
  // Moving the selection moves focus (handled by _select). Disabled options skip.
  _onKeydown(e) {
    if (this.disabled) return;
    const enabled = this._enabled();
    if (!enabled.length) return;
    const cur = Number(e.currentTarget.dataset.idx);
    let target = null;
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": {
        const at = enabled.indexOf(cur);
        target = enabled[(at + 1) % enabled.length]; break;
      }
      case "ArrowUp": case "ArrowLeft": {
        const at = enabled.indexOf(cur);
        target = enabled[(at - 1 + enabled.length) % enabled.length]; break;
      }
      case "Home": target = enabled[0]; break;
      case "End": target = enabled[enabled.length - 1]; break;
      case " ": case "Spacebar": case "Enter": target = cur; break;
      default: return;
    }
    e.preventDefault();
    this._select(target);
  }

  // The roving-tabindex owner: the selected segment, or (none selected) the first
  // enabled segment, or (all disabled) the first segment — exactly one is tabbable.
  _tabIndexOwner() {
    const o = this._opts();
    const sel = o.findIndex((x) => x.value === this.value);
    if (sel >= 0) return sel;
    const enabled = this._enabled();
    return enabled.length ? enabled[0] : 0;
  }

  render() {
    const opts = this._opts();
    // Reflect the resolved default (first enabled option) into `value` so the
    // property, the aria-checked segment, and any reader agree.
    const resolved = this._defaultValue();
    if (resolved !== this.value) this.value = resolved;
    const owner = this._tabIndexOwner();
    const label = this.getAttribute("aria-label");
    const labelledby = this.getAttribute("aria-labelledby");
    const sizeCls = this.size === "sm" ? " puredashboard-segmented__track--sm" : this.size === "lg" ? " puredashboard-segmented__track--lg" : "";
    const blockCls = this.block ? " puredashboard-segmented__track--block" : "";
    const disCls = this.disabled ? " puredashboard-segmented__track--disabled" : "";
    return html`
      <div class="puredashboard-segmented__track${sizeCls}${blockCls}${disCls}" role="radiogroup" aria-label="${labelledby ? "" : (label ?? this._label("group"))}" aria-labelledby="${labelledby ?? ""}" aria-disabled="${this.disabled ? "true" : "false"}">
        ${repeat(opts, (o) => o.value, (o, i) => {
          const checked = o.value === this.value;
          const optDisabled = !!(this.disabled || o.disabled);
          return html`<button type="button" class="puredashboard-segmented__segment js-puredashboard-segmented__segment${checked ? " puredashboard-segmented__segment--checked" : ""}${optDisabled ? " puredashboard-segmented__segment--disabled" : ""}" role="radio" data-idx="${i}" aria-checked="${checked ? "true" : "false"}" ?disabled="${optDisabled}" tabindex="${i === owner && !optDisabled ? "0" : "-1"}" @click="${() => this._select(i)}" @keydown="${(e) => this._onKeydown(e)}">${o.icon ? html`<span class="puredashboard-segmented__icon">${raw(o.icon)}</span>` : ""}<span class="puredashboard-segmented__text">${o.label}</span></button>`;
        })}
      </div>`;
  }
}
PuredashboardSegmented.define("puredashboard-segmented");

export { PuredashboardSegmented };
