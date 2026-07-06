// <puredashboard-json-view> — a collapsible, syntax-highlighted JSON tree.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// `data` may be any JS value OR a JSON string (parsed; if it isn't valid JSON it
// falls back to showing the raw text). Objects/arrays get a header `<button
// aria-expanded>` that collapses their body (native buttons give Enter / Space for
// free); collapse state is kept per node path. Adapted from an mcp-studio /
// claude-mesh `json-view`, reworked to PureDashboard conventions and extended with
// per-mode theming and per-value copy.
//
// XSS: every key and value is interpolated at a CHILD position through the
// reactive.js parts engine, which turns a string into a TEXT NODE (escaped) — the
// same guarantee as textContent. Untrusted JSON therefore can't inject markup. The
// only fixed markup is the inline chevron / copy / check SVGs (author constants,
// never data) and never `raw()`.
//
// Class naming (BEM, block = the tag): style classes are
// `puredashboard-json-view__<element>[--<modifier>]`. Script hooks are SEPARATE
// `js-…` classes; don't style those.
import { Reactive, html } from "./reactive.js";

// All user-facing FIXED strings (English defaults). Override any subset via the
// `labels` property. Function-valued keys interpolate. The JSON keys/values are
// CONTENT (from `data`), never from here.
const LABELS = {
  copy: "Copy value",
  copied: "Copied",
  items: (n) => `${n} ${n === 1 ? "item" : "items"}`,
  keys: (n) => `${n} ${n === 1 ? "key" : "keys"}`,
};

// The per-mode palette knobs the `themes` property can override, mapped to the
// `--pd-json-view-*` custom properties the stylesheet reads. Applied as inline
// custom properties (dynamic values — allowed under the styles-only 'unsafe-inline').
const PALETTE_KEYS = ["bg", "border", "text", "muted", "key", "string", "number", "boolean", "null", "punct", "summary", "accent"];

// Inline, self-contained SVGs (no shared icon module). Static author markup.
const iconChevron = html`<svg class="puredashboard-json-view__chevron" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
const iconCopy = html`<svg class="puredashboard-json-view__icon puredashboard-json-view__icon--copy" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const iconCheck = html`<svg class="puredashboard-json-view__icon puredashboard-json-view__icon--check" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>`;

// copyText — best-effort clipboard write that works across environments WITHOUT
// probing the Permissions API (which itself can surface a prompt). Try the async
// Clipboard API in a secure context first; otherwise fall back to a throwaway
// <textarea> + execCommand. Returns a Promise<boolean> — false when both fail.
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* blocked / unavailable — fall through to the legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(ta);
    const sel = document.getSelection();
    const prev = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    ta.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    ta.remove();
    if (sel) { sel.removeAllRanges(); if (prev) sel.addRange(prev); }  // restore the user's selection
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * A collapsible, syntax-highlighted JSON tree viewer. Objects and arrays get a
 * header `<button aria-expanded>` that toggles their body; leaf values show a copy
 * button. Light/dark aware: by default it follows the OS colour scheme and updates
 * live, or you can pin a mode and supply a custom palette per mode. XSS-safe —
 * keys/values render as escaped text nodes, never markup.
 *
 * @element puredashboard-json-view
 *
 * @prop {*} data - The value to render: any JS value, or a JSON string (parsed; invalid JSON falls back to raw text).
 * @prop {string} theme - Colour mode. `"auto"` (default) follows the OS (`prefers-color-scheme`) and updates live, resolving to `light`/`dark`. ANY other value pins that mode name directly and is reflected to the `data-mode` attribute. Ten built-in palettes ship (see `PuredashboardJsonView.BUILT_IN_THEMES`): `light`, `dark`, `github-light`, `github-dark`, `monokai`, `dracula`, `solarized-light`, `solarized-dark`, `nord`, `one-dark`. A name outside that list is a valid custom mode — supply its colours via `themes[name]` (or a `[data-mode="name"]` CSS block).
 * @prop {Object} themes - Palette overrides keyed by mode name, e.g. `{ dark: {…}, "github-dark": {…}, myMode: {…} }`. Each map may set any of `bg`, `border`, `text`, `muted`, `key`, `string`, `number`, `boolean`, `null`, `punct`, `summary`, `accent` (any CSS colour); applied as `--pd-json-view-*` inline custom properties for the active mode only (they win over the built-in palette). Unset knobs keep the stylesheet default.
 * @prop {boolean} copyable - Show a copy button after each leaf value. Default `true`.
 * @prop {number} level - Initial expand depth. Omit (default) to expand everything. Otherwise a node at depth < `level` starts open and deeper nodes start collapsed (depth 0 = root): `0` collapses all (including the root), `1` shows the root's fields, `2` expands one level further, and so on. Only the INITIAL state — the user can still toggle any node; it re-applies when `data` or `level` changes.
 * @prop {Object} labels - Override UI strings. Keys: `copy`, `copied`, `items(n)`, `keys(n)`. Unset keys keep the English default.
 *
 * @attr {string} theme - Reflected to the `theme` property (`auto`, a built-in name, or a custom mode).
 * @attr {string} level - Reflected to the `level` property (parsed as a number).
 *
 * @cssprop [--pd-json-view-bg] - Panel background.
 * @cssprop [--pd-json-view-border] - Panel border colour.
 * @cssprop [--pd-json-view-key] - Object-key colour.
 * @cssprop [--pd-json-view-string] - String-value colour.
 * @cssprop [--pd-json-view-number] - Number-value colour.
 * @cssprop [--pd-json-view-boolean] - Boolean-value colour.
 * @cssprop [--pd-json-view-null] - `null`-value colour.
 * @cssprop [--pd-json-view-indent] - Per-level indent (defaults to `--sp-4`).
 *
 * @example
 * const jv = document.createElement("puredashboard-json-view");
 * jv.data = { name: "web-01", up: true, ports: [80, 443], meta: null };
 * jv.theme = "auto";                       // follow the OS (default)
 * jv.theme = "dracula";                    // or pin a built-in palette
 * jv.level = 1;                            // start with only the root's fields expanded
 * jv.themes = { dark: { string: "#a5d6ff" } };   // tweak one colour in dark mode
 * document.body.append(jv);
 */
class PuredashboardJsonView extends Reactive {
  // The palettes shipped in json-view.css (as `[data-mode="…"]` blocks). Exposed for
  // introspection / building a theme picker; `theme` also accepts any custom name.
  static BUILT_IN_THEMES = ["light", "dark", "github-light", "github-dark", "monokai", "dracula", "solarized-light", "solarized-dark", "nord", "one-dark"];

  static properties = {
    data: {}, theme: {}, themes: {}, copyable: {}, level: {}, labels: {}, collapsed: {},
  };

  // Reflect the declarative `theme`/`level` attributes so they can be set the natural
  // way: <puredashboard-json-view theme="dark" level="1">.
  static observedAttributes = ["theme", "level"];
  attributeChangedCallback(name, _old, val) {
    if (name === "theme") this.theme = val || "auto";
    else if (name === "level") this.level = val == null || val === "" ? undefined : Number(val);
  }

  setup() {
    this.collapsed = this.collapsed || new Set();
    // Live OS colour-scheme tracking (only re-render when the mode is "auto").
    this._mql = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    this._onScheme = () => { if ((this.theme ?? "auto") === "auto") this.requestUpdate(); };
    this._mql?.addEventListener?.("change", this._onScheme);

    this.on("click", ".js-puredashboard-json-view__toggle", (e, el) => this._toggle(el.dataset.path));
    this.on("click", ".js-puredashboard-json-view__copy", (e, el) => this._copy(el));
  }

  // Re-add the scheme listener on reconnect (addEventListener dedupes the same
  // reference, so this is a no-op when already attached).
  connectedCallback() {
    super.connectedCallback();
    this._mql?.addEventListener?.("change", this._onScheme);
  }
  disconnectedCallback() { this._mql?.removeEventListener?.("change", this._onScheme); }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // Resolve the effective mode. Only "auto" tracks the OS; any other value pins that
  // mode name directly — so a built-in palette OR a fully custom mode is just data.
  _mode() {
    const t = this.theme ?? "auto";
    if (t !== "auto") return t;
    return this._mql && this._mql.matches ? "dark" : "light";
  }

  _isOpen(path) { return !(this.collapsed && this.collapsed.has(path)); }
  _toggle(path) {
    const s = new Set(this.collapsed);   // new ref so the Reactive setter re-renders
    s.has(path) ? s.delete(path) : s.add(path);
    this.collapsed = s;
  }

  // Seed the collapsed set from `level`: a node at depth >= level starts collapsed
  // (depth 0 = root). `level` unset → nothing collapsed (everything open). This is only
  // the INITIAL display state — it's re-applied whenever `data` or `level` changes, but
  // the user's own toggles persist in between (level doesn't lock anything).
  _seedCollapsed() {
    const lvl = this.level;
    const s = new Set();
    if (lvl != null) {
      let v = this.data;
      if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = undefined; } }
      const walk = (val, path, depth) => {
        if (val === null || typeof val !== "object") return;   // primitive → no toggle
        const entries = Array.isArray(val) ? val.map((x, i) => [i, x]) : Object.entries(val);
        if (!entries.length) return;                           // empty {}/[] → no toggle
        if (depth >= lvl) s.add(path);
        entries.forEach(([, cv], i) => walk(cv, `${path}.${i}`, depth + 1));
      };
      walk(v, "r", 0);
    }
    this.collapsed = s;
  }

  // Copy the CLICKED value's text. Read is deferred to click time and takes only the
  // rendered textContent — so a very long value is never duplicated into memory or an
  // attribute up front. Warns to the console when no clipboard path works.
  // The text to copy for a value element. Strings render as a JSON literal
  // ("…") — we drop only the SURROUNDING quotes so you copy the value itself, but
  // keep inner escapes (\n, \t, \uXXXX) ESCAPED rather than expanding them to real
  // control characters. That's deliberate and security-relevant: injecting a real
  // newline / ESC / ANSI sequence into the clipboard risks paste-injection when the
  // value is later pasted into a shell or terminal (a newline runs the next line; an
  // ESC sequence can hijack the terminal). Numbers / booleans / null copy verbatim.
  _valueToCopy(valEl) {
    const text = valEl.textContent;
    if (valEl.classList.contains("puredashboard-json-view__value--string")) {
      return text.slice(1, -1);
    }
    return text;
  }

  _copy(btn) {
    const row = btn.closest(".puredashboard-json-view__row");
    const valEl = row && row.querySelector(".js-puredashboard-json-view__value");
    if (!valEl) return;
    const text = this._valueToCopy(valEl);
    copyText(text).then((ok) => {
      if (!ok) {
        console.warn("[puredashboard-json-view] Copy failed: clipboard is unavailable in this environment (needs a secure context or execCommand support).");
        return;
      }
      btn.classList.add("puredashboard-json-view__copy--copied");
      btn.setAttribute("aria-label", this._label("copied"));
      clearTimeout(btn._pdCopyTimer);
      btn._pdCopyTimer = setTimeout(() => {
        btn.classList.remove("puredashboard-json-view__copy--copied");
        btn.setAttribute("aria-label", this._label("copy"));
      }, 1200);
    });
  }

  // After each render: (re)seed collapse state when data/level changed, then reflect the
  // resolved mode and apply the per-mode palette as inline custom properties.
  updated(changed) {
    if (changed && (changed.has("data") || changed.has("level"))) this._seedCollapsed();
    const mode = this._mode();
    if (this.dataset.mode !== mode) this.dataset.mode = mode;
    const pal = (this.themes && this.themes[mode]) || null;
    for (const k of PALETTE_KEYS) {
      const v = pal && pal[k];
      if (v) this.style.setProperty(`--pd-json-view-${k}`, v);
      else this.style.removeProperty(`--pd-json-view-${k}`);
    }
  }

  // The key prefix for a row: `"key": ` (arrays pass key=null → no prefix).
  _keyPart(key) {
    if (key == null) return "";
    return html`<span class="puredashboard-json-view__key">"${key}"</span><span class="puredashboard-json-view__punct">: </span>`;
  }

  _copyBtn() {
    if (this.copyable === false) return "";
    const label = this._label("copy");
    return html`<button type="button" class="puredashboard-json-view__copy js-puredashboard-json-view__copy" aria-label="${label}" title="${label}">${iconCopy}${iconCheck}</button>`;
  }

  // Render one node. `path` is a collision-free index path; `key` is the object key
  // (or null in an array); `last` suppresses the trailing comma.
  node(v, path, key, last) {
    const keyPart = this._keyPart(key);
    const comma = last ? "" : html`<span class="puredashboard-json-view__punct">,</span>`;
    const isArr = Array.isArray(v);
    const isObj = v !== null && typeof v === "object";

    if (isObj || isArr) {
      const entries = isArr ? v.map((x, i) => [i, x]) : Object.entries(v);
      const [o, c] = isArr ? ["[", "]"] : ["{", "}"];
      if (!entries.length) {
        return html`<div class="puredashboard-json-view__row">${keyPart}<span class="puredashboard-json-view__brace">${o + c}</span>${comma}</div>`;
      }
      const open = this._isOpen(path);
      return html`<div class="puredashboard-json-view__node">
        <button type="button" class="puredashboard-json-view__toggle js-puredashboard-json-view__toggle ${open ? "puredashboard-json-view__toggle--open" : ""}" data-path="${path}" aria-expanded="${open ? "true" : "false"}"><span class="puredashboard-json-view__chevron-wrap">${iconChevron}</span>${keyPart}<span class="puredashboard-json-view__brace">${o}</span>${open ? "" : html`<span class="puredashboard-json-view__summary">${this._label(isArr ? "items" : "keys", entries.length)}</span><span class="puredashboard-json-view__brace">${c}</span>${comma}`}</button>
        ${open ? html`<div class="puredashboard-json-view__children">${entries.map(([k, val], i) => this.node(val, `${path}.${i}`, isArr ? null : k, i === entries.length - 1))}</div><div class="puredashboard-json-view__row puredashboard-json-view__row--close"><span class="puredashboard-json-view__brace">${c}</span>${comma}</div>` : ""}
      </div>`;
    }

    // Leaf: primitive value + a copy affordance.
    const t = v === null ? "null" : typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string";
    const disp = typeof v === "string" ? JSON.stringify(v) : String(v);
    return html`<div class="puredashboard-json-view__row">${keyPart}<span class="puredashboard-json-view__value puredashboard-json-view__value--${t} js-puredashboard-json-view__value">${disp}</span>${comma}${this._copyBtn()}</div>`;
  }

  render() {
    let v = this.data;
    if (v === undefined) return html`<div class="puredashboard-json-view__tree"></div>`;
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch { return html`<pre class="puredashboard-json-view__raw">${this.data}</pre>`; }
    }
    return html`<div class="puredashboard-json-view__tree">${this.node(v, "r", null, true)}</div>`;
  }
}
PuredashboardJsonView.define("puredashboard-json-view");

export { PuredashboardJsonView };
