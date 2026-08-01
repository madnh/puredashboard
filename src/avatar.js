// <puredashboard-avatar> — a compact identity chip: a person's photo, or their
// initials on a stable per-name colour, or a neutral placeholder glyph.
//
// Zero-dep, no build, CSP-safe. Built on the Reactive base. The rendered content
// is DERIVED entirely from props (an <img> or initials) — there are no author
// children, so Reactive fits: state in `static properties`, `html\`\`` from
// render(). The author-supplied `name` is CONTENT: it becomes the alt text and,
// when there's no image, the initials fallback. It only ever reaches the DOM via
// escaped `html\`\`` interpolation / attribute values — never raw() — so an
// attacker-controlled name can't inject markup.
//
// If `src` is set we render an <img>; if that image fails to load, `onerror`
// flips an internal flag and we re-render the initials instead, so a broken URL
// degrades gracefully. With no `src`, we show initials (first letters of up to
// two words) on a colour deterministically hashed from the name — identical names
// always get the identical colour. With neither src nor name, a neutral glyph.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. av.labels = { placeholder: "Người dùng" }.
const LABELS = {
  placeholder: "No image",   // aria-label / alt for the neutral placeholder glyph
};

// Local inline SVG helper (self-contained; no shared icon module). The neutral
// "person" glyph used when there is neither a src nor a name.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const personGlyph = svg('<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>');

// Fixed palette — indices map to the shared status hues so avatars sit in the
// same visual language as the rest of the theme (with system-colour fallbacks in
// avatar.css). The colour is picked by hashing the name, never authored, so it's
// stable and free of literal per-name colours.
const PALETTE_LEN = 6;

/**
 * initials(name) — up to two uppercased letters derived from a name. Pure.
 * "Ada Lovelace" → "AL"; "cher" → "C"; "  " / "" → "". Splits on whitespace,
 * takes the first character of the first and last non-empty words.
 * @param {string} name
 * @returns {string}
 */
function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * colorIndex(name) — a stable palette index in [0, PALETTE_LEN) from a name.
 * Pure + deterministic: identical names always yield the identical index (so the
 * same person is always the same colour). Uses a small FNV-1a-style string hash.
 * @param {string} name
 * @returns {number}
 */
function colorIndex(name) {
  const s = String(name ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h % PALETTE_LEN;
}

/**
 * A compact identity avatar. Shows a photo (`src`), else initials derived from
 * `name` on a colour deterministically hashed from that name, else a neutral
 * placeholder glyph. A broken image URL falls back to the initials automatically.
 * Content is derived from props — no author children needed. Configure via JS
 * properties or HTML attributes.
 *
 * @element puredashboard-avatar
 *
 * @prop {string}  src        - Image URL. When set (and it loads) an `<img>` is shown. Default `""`.
 * @prop {string}  name       - Full name → `alt` text and the initials fallback. Author content. Default `""`.
 * @prop {string}  size       - `"sm"` | `"md"` | `"lg"`, or a number of pixels (e.g. `"48"`). Default `"md"`.
 * @prop {string}  shape      - `"circle"` (default) | `"square"` (rounded corners instead of a full circle).
 * @prop {string}  color      - Optional explicit background colour for the initials; if unset, derived from `name`. Default `""`.
 * @prop {boolean} decorative - Mark purely decorative (e.g. beside a visible name): renders `aria-hidden`, no `role`/label. Default `false`.
 * @prop {Object}  labels     - Override UI strings. Keys: `placeholder`. Unset keys keep the English default.
 *
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 * @cssprop [--pd-avatar-size] - Diameter/side of the avatar (defaults to the `md` size; a numeric `size` sets this).
 *
 * @example
 * const av = document.createElement("puredashboard-avatar");
 * av.name = "Ada Lovelace"; av.src = "/u/ada.png"; av.size = "lg";
 * document.body.append(av);   // shows the photo, or "AL" on a stable colour if it 404s
 */
class PuredashboardAvatar extends Reactive {
  static properties = {
    src: {}, name: {}, size: {}, shape: {}, color: {}, decorative: {}, labels: {},
    _imgError: {},   // internal: set true by the <img> onerror handler → render initials
  };

  // Reflect declarative HTML attributes into reactive properties so the avatar can
  // be configured the natural way — <puredashboard-avatar name="Ada" size="lg">.
  static observedAttributes = ["src", "name", "size", "shape", "color", "decorative"];
  attributeChangedCallback(name, _old, val) {
    if (name === "decorative") this.decorative = val !== null;
    else this[name] = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    // A fresh src supersedes any prior load error, so a previously-broken avatar
    // that gets a new (working) URL tries the image again instead of staying stuck
    // on initials.
    this._lastSrc = this.src;
  }

  updated() {
    if (this.src !== this._lastSrc) { this._lastSrc = this.src; if (this._imgError) this._imgError = false; }
    // Host-level a11y attributes live on the element itself (not a child), so AT
    // treats the whole avatar as the image/decoration. Applied imperatively
    // because the host isn't part of the html`` template.
    // An author-supplied aria-label always wins: we only ever replace or remove the
    // value WE wrote (tracked in _ariaOwn), never one set on the element by its user.
    const mine = this.getAttribute("aria-label") === this._ariaOwn;
    const unnamed = !this.hasAttribute("aria-label") || mine;
    if (this.decorative) {
      this.setAttribute("aria-hidden", "true");
      this.removeAttribute("role");
      if (mine) { this.removeAttribute("aria-label"); this._ariaOwn = null; }
    } else {
      this.removeAttribute("aria-hidden");
      this.setAttribute("role", "img");
      if (unnamed) { this._ariaOwn = this.name || this._label("placeholder"); this.setAttribute("aria-label", this._ariaOwn); }
    }
  }

  render() {
    const shapeCls = this.shape === "square" ? " puredashboard-avatar--square" : "";
    // Numeric size → a per-instance --pd-avatar-size; named size → a modifier class.
    const num = this.size != null && this.size !== "" && !isNaN(Number(this.size));
    const sizeCls = !num && this.size === "sm" ? " puredashboard-avatar--sm"
      : !num && this.size === "lg" ? " puredashboard-avatar--lg" : "";
    const style = num ? `--pd-avatar-size:${Number(this.size)}px` : "";

    // a11y: decorative avatars are hidden from AT (a visible name is nearby);
    // otherwise the avatar conveys a person → role="img" + an accessible label.
    // Those host attributes are set in updated() (the host isn't in the template).
    const showImg = this.src && !this._imgError;

    let inner;
    if (showImg) {
      // Escaped alt attribute — the name is interpolated, never raw(). onerror
      // flips the internal flag so the next render swaps in the initials.
      inner = html`<img class="puredashboard-avatar__img" src="${this.src}" alt="${this.name || ""}" @error="${() => { this._imgError = true; }}">`;
    } else if (this.name && initials(this.name)) {
      const idx = colorIndex(this.name);
      const bg = this.color || `var(--pd-avatar-c${idx})`;
      // Initials via escaped text-node interpolation (never raw()); background via
      // an inline dynamic style (allowed for dynamic values).
      inner = html`<span class="puredashboard-avatar__initials" style="background:${bg}">${initials(this.name)}</span>`;
    } else {
      inner = html`<span class="puredashboard-avatar__placeholder">${personGlyph}</span>`;
    }

    // The wrapper carries shape/size classes + a per-instance size var; the inner
    // content is the img / initials / glyph.
    return html`<span class="puredashboard-avatar__box${shapeCls}${sizeCls}" style="${style}">${inner}</span>`;
  }
}
PuredashboardAvatar.define("puredashboard-avatar");

export { PuredashboardAvatar, initials, colorIndex };
