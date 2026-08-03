// <puredashboard-copy> — a copy-to-clipboard button. Zero-dep, no build, CSP-safe.
// Built on the Reactive base.
//
// One click writes a value to the system clipboard and the button reports what
// happened: the icon swaps to a checkmark (or a cross on failure) for a moment and an
// off-screen live region announces it. The value is TEXT by default, but it can just as
// well be an IMAGE (a URL, a Blob/File, an <img>, a <canvas>) or rich HTML — the
// component picks the right clipboard write for what it is:
//   • text  → navigator.clipboard.writeText, with a <textarea> + execCommand fallback
//             for insecure contexts (the same best-effort path json-view.js uses).
//   • html  → a ClipboardItem carrying BOTH text/html and a STRUCTURED text/plain
//             flattening (a <table> becomes TSV — tab per cell, newline per row), so it
//             pastes into Excel/Sheets as real cells either way. An element source
//             contributes its outerHTML, so `from` can point straight at a <table>.
//   • image → normalised to a PNG Blob (the only image type browsers accept) via a
//             <canvas>, then written as a ClipboardItem. There is no legacy fallback:
//             images need the async Clipboard API in a secure context.
//
// Where the value comes from, in priority order: `value` (a string, Blob, <img>,
// <canvas>, or a — possibly async — function returning one), then `src` (an image URL,
// fetched), then `from` (a CSS selector for the element holding it: an <img>/<canvas>
// copies as an image, a <table> as HTML + TSV, an <input>/<textarea> its `.value`,
// anything else its structured text). Nothing resolvable = a no-op that emits `copyerror`.
//
// It renders a real <button>, so keyboard (Space/Enter), focus and `disabled` come from
// the platform. An icon-only copy button is NAMED by default (LABELS.copy) — unlike a
// bare icon button, you don't have to supply an aria-label, though one you set wins and
// is mirrored onto the inner button.
//
// Icons are Lucide (ISC) — `copy`, `check`, `x` — inlined here as static markup, like
// every other component (no shared icon module, no sprite).
//
// Class naming is BEM with the tag as the block, plus a SEPARATE `js-` hook for the one
// element the script selects; the host also reflects `data-state`
// (`idle`/`copying`/`copied`/`error`) for CSS and tests. Themed through the shared
// tokens (--accent, --green, --danger, --panel, --border, --focus-ring,
// --control-height-*, --radius, --duration-*) via a --pd-* fallback chain, so it works
// with no theme linked. All fixed strings live in a LABELS map. See
// docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";
import { raw, escapeHTML } from "./html.js";

// All FIXED user-facing strings (English defaults). Override any subset via the
// `labels` property — e.g. c.labels = { copy: "Sao chép", copied: "Đã sao chép" }.
// `copy` doubles as the accessible name of an icon-only button; `copied`/`failed` are
// announced through the live region (and replace a visible label while the feedback
// lasts). Function-valued keys interpolate.
const LABELS = {
  copy: "Copy",
  copied: "Copied",
  failed: "Copy failed",
};

// Lucide icons (ISC licence), inlined — self-contained, no icon dependency.
// `overflow:visible` keeps strokes near the viewBox edge from being clipped.
const SVG_ATTRS = 'viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible" aria-hidden="true" focusable="false"';
const ICON_COPY = `<svg ${SVG_ATTRS}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const ICON_CHECK = `<svg ${SVG_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`;
const ICON_X = `<svg ${SVG_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

const isBlob = (v) => typeof Blob !== "undefined" && v instanceof Blob;
const tagOf = (v) => (v && typeof v === "object" && typeof v.tagName === "string" ? v.tagName.toUpperCase() : "");

// ---- clipboard writers -------------------------------------------------------
// Every writer returns a Promise<boolean>; they never throw for an expected failure
// (blocked permission, insecure context, no API) — the caller turns `false` into the
// error state + a `copyerror` event.

// writeText — best-effort text write that works across environments WITHOUT probing the
// Permissions API (which can itself surface a prompt). Try the async Clipboard API in a
// secure context first; otherwise fall back to a throwaway <textarea> + execCommand.
async function writeText(text) {
  const nav = window.navigator;
  try {
    if (nav && nav.clipboard && window.isSecureContext) {
      await nav.clipboard.writeText(text);
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
    if (sel) { sel.removeAllRanges(); if (prev) sel.addRange(prev); }   // restore the user's selection
    return !!ok;
  } catch {
    return false;
  }
}

// writeItem — write one ClipboardItem payload ({ mime: Blob | Promise<Blob> }).
// Safari only keeps the user gesture alive when the ClipboardItem holds a PROMISE, so
// that is tried first; browsers that reject a promise value get a second, awaited try.
async function writeItem(payload) {
  const nav = window.navigator;
  if (!nav || !nav.clipboard || !nav.clipboard.write || typeof window.ClipboardItem !== "function") return false;
  try {
    await nav.clipboard.write([new window.ClipboardItem(payload)]);
    return true;
  } catch {
    try {
      const resolved = {};
      for (const [mime, v] of Object.entries(payload)) resolved[mime] = await v;
      await nav.clipboard.write([new window.ClipboardItem(resolved)]);
      return true;
    } catch {
      return false;
    }
  }
}

// ---- image normalisation -----------------------------------------------------
// Browsers accept image/png on the clipboard (and little else, reliably), so whatever
// the source is — a URL, a Blob of any image type, an <img>, a <canvas> — it ends up
// drawn onto a canvas and exported as PNG. A cross-origin <img> without CORS taints the
// canvas and `toBlob` throws; that surfaces as a `copyerror`, not a silent no-op.

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") { reject(new Error("canvas.toBlob is unavailable")); return; }
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob produced nothing"))), "image/png");
  });
}

// Draw an already-decoded source (an <img>, an ImageBitmap, a <canvas>) to PNG.
function rasterise(source) {
  if (tagOf(source) === "CANVAS") return canvasToPng(source);
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  if (!w || !h) return Promise.reject(new Error("the image has no intrinsic size (not loaded?)"));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("2d canvas context is unavailable"));
  ctx.drawImage(source, 0, 0, w, h);
  return canvasToPng(canvas);
}

async function blobToPng(blob) {
  if (blob.type === "image/png") return blob;
  if (typeof window.createImageBitmap === "function") return rasterise(await window.createImageBitmap(blob));
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    if (typeof img.decode === "function") await img.decode();
    else await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("the image failed to load")); });
    return await rasterise(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// source → a PNG Blob. `source` is a URL string wrapper, a Blob/File, an <img> or a
// <canvas>. Rejects with a descriptive Error the caller reports via `copyerror`.
async function toPngBlob(source) {
  if (source && typeof source.url === "string") {
    const res = await fetch(source.url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`fetching the image failed (HTTP ${res.status})`);
    source = await res.blob();
  }
  if (isBlob(source)) return blobToPng(source);
  const tag = tagOf(source);
  if (tag === "IMG" || tag === "CANVAS" || (typeof window.ImageBitmap === "function" && source instanceof window.ImageBitmap)) return rasterise(source);
  throw new Error("the value is not an image (expected a URL, Blob, <img> or <canvas>)");
}

// ---- the text/plain half of an HTML payload ----------------------------------
// A bare `textContent` would run every cell together ("ServiceRegionReq/day…"), which
// is what lands in a plain-text field — and in Excel's "Paste Special → Text", where
// the whole thing then sits in ONE cell. So the flattening keeps the structure the two
// characters a spreadsheet understands can carry: a TAB between cells, a NEWLINE
// between rows. Everything else block-level also breaks the line, and `<br>` becomes a
// newline. Horizontal whitespace is collapsed the way HTML renders it (so source indent
// never reaches the clipboard) — a `<pre>` keeps its line breaks but not its indent;
// copy code as `type="text"` when the exact spacing matters.
const BLOCK = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET",
  "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR",
  "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "UL",
]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "HEAD"]);

function flattenInto(node, out) {
  if (node.nodeType === 3) { out.push(node.data); return; }              // text
  if (node.nodeType !== 1) return;                                       // comment, …
  const tag = node.tagName.toUpperCase();
  if (SKIP.has(tag)) return;
  if (tag === "BR") { out.push("\n"); return; }
  if (tag === "TABLE") { out.push("\n", tableToTsv(node), "\n"); return; }
  const block = BLOCK.has(tag);
  if (block) out.push("\n");
  for (const child of node.childNodes) flattenInto(child, out);
  if (block) out.push("\n");
}

// One row per line, one TAB per cell — the shape a spreadsheet pastes into a grid. A
// cell's own content is squashed to a single line first, so a nested table or a <br>
// inside a cell can't invent extra rows/columns.
function tableToTsv(table) {
  const rows = [];
  // Only OUR rows: a nested table's <tr>s belong to that table, and they already went
  // into their own cell's one-line text — counting them here would invent extra rows.
  for (const tr of [...table.querySelectorAll("tr")].filter((tr) => tr.closest("table") === table)) {
    const cells = [];
    for (const cell of tr.children) {
      const t = cell.tagName.toUpperCase();
      if (t === "TD" || t === "TH") cells.push(flattenToText(cell).replace(/\s+/g, " ").trim());
    }
    if (cells.length) rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}

function flattenToText(root) {
  const out = [];
  for (const child of root.childNodes) flattenInto(child, out);
  return out.join("");
}

// An ELEMENT flattened including itself — so a <table> source is seen as a table (TSV)
// and not as a bag of rows. This is what `from` uses for plain text too: a raw
// `textContent` would paste the whole grid as one run-on line.
function elementToText(el) {
  const out = [];
  flattenInto(el, out);
  return tidy(out.join(""));
}

// Collapse the horizontal runs HTML would collapse anyway, then squash every run of
// line breaks to ONE — a block both opens and closes with a break, and in a spreadsheet
// every newline is another row, so blank ones would paste as empty rows. TABs are never
// touched: they are the column separators.
function tidy(s) {
  return s.replace(/[^\S\n\t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n+/g, "\n").trim();
}

// Flatten an HTML string to the text/plain half of the clipboard payload. A <template>
// is inert — its content is parsed but never loaded, scripted, or connected.
function htmlToText(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup;
  return tidy(flattenToText(t.content));
}

/**
 * A copy-to-clipboard button: click it and its value lands on the system clipboard,
 * with the icon swapping to a checkmark (or a cross on failure) while an off-screen
 * live region announces the result.
 *
 * The value does not have to be text. Set `value` to a **string** (text or, with
 * `type="html"`, rich markup), a **Blob/File**, an **`<img>`** or a **`<canvas>`**, or a
 * (possibly async) **function** returning one of those; or point at an image URL with
 * `src`; or name the element that holds it with `from` (a CSS selector — an
 * `<img>`/`<canvas>` copies as an image, an `<input>`/`<textarea>` copies its `.value`,
 * anything else its `textContent`). Images are normalised to PNG — the one image type
 * clipboards accept — through a `<canvas>`.
 *
 * Text falls back to a legacy `execCommand` copy when the async Clipboard API is
 * unavailable (e.g. a page served over plain HTTP). Images and HTML have no fallback:
 * they need `navigator.clipboard.write`, which requires a **secure context**
 * (https / localhost). A failure is never silent — it shows the error state and emits
 * `copyerror`.
 *
 * @element puredashboard-copy
 *
 * @prop {string|Blob|Element|Function} value - What to copy: a string, a `Blob`/`File`, an element (`<img>`/`<canvas>` → image, `<table>` → HTML + TSV, anything else → its text or, with `type="html"`, its `outerHTML`), or a function (may be `async`) returning one — called on each click, so a late-bound value stays fresh. Takes priority over `src` and `from`.
 * @prop {string}  src      - URL of an IMAGE to copy. Fetched on click (`credentials: "same-origin"`) — a cross-origin URL needs CORS. Used when `value` is unset.
 * @prop {string}  from     - CSS selector (resolved against the document) for the element holding the value. `<img>`/`<canvas>` → copied as an image; `<table>` → copied as HTML + TSV (pastes into a spreadsheet as rows and columns); `<input>`/`<textarea>`/`<select>` → its `.value`; anything else → its text with the structure kept (block elements and `<br>` break the line, a table stays TSV — never a run-on `textContent`), or its `outerHTML` with `type="html"`. Used when `value` and `src` are unset.
 * @prop {string}  type     - What the value IS: `"auto"` (default — inferred from the value; a `<table>` element is inferred as `"html"`), `"text"`, `"html"` (writes `text/html` **and** a structured plain-text flattening: TSV for tables, line breaks for block elements) or `"image"`.
 * @prop {string|Node} label - Visible label next to the icon. A string is escaped; a DOM node / nested `html` template renders as-is. Default `""` (icon-only). While the feedback lasts it is replaced by `labels.copied` / `labels.failed`.
 * @prop {boolean} showValue - Use the copied text itself as the visible label (for a token / ID / command chip). Ignored when `label` is set or the value isn't text. Default `false`.
 * @prop {string}  variant  - `"default"` (bordered) | `"text"` (borderless, for toolbars and table cells).
 * @prop {string}  size     - `"sm"` | `"md"` (default) | `"lg"`.
 * @prop {boolean} disabled - Disable the button. Default `false`.
 * @prop {number}  feedback - How long the copied / error state lasts, in ms. Default `1600`. `0` keeps it until the next click.
 * @prop {string}  icon     - Override the idle icon with inline SVG markup (author-TRUSTED, like `menu.js` icons). The check / cross feedback icons are unchanged.
 * @prop {string}  state    - READ-ONLY: `"idle"` | `"copying"` | `"copied"` | `"error"`. Also mirrored to the host's `data-state` attribute.
 * @prop {Object}  labels   - Override UI strings. Keys: `copy` (also the icon-only accessible name), `copied`, `failed`. Unset keys keep the English default.
 *
 * @attr {string}  value      - Declarative form of `value` (text only).
 * @attr {string}  src        - Declarative form of `src`.
 * @attr {string}  from       - Declarative form of `from`.
 * @attr {string}  type       - Declarative form of `type`.
 * @attr {string}  label      - Declarative form of `label` (text only).
 * @attr {boolean} show-value - Declarative form of `showValue`.
 * @attr {string}  variant    - Declarative form of `variant`.
 * @attr {string}  size       - Declarative form of `size`.
 * @attr {boolean} disabled   - Declarative form of `disabled`.
 * @attr {string}  feedback   - Declarative form of `feedback` (ms).
 * @attr {string}  icon       - Declarative form of `icon` (trusted SVG markup).
 * @attr {string}  data-state - Reflected state (`idle`/`copying`/`copied`/`error`) — for CSS and tests, never set it yourself.
 * @attr {string}  aria-label - Accessible name, mirrored onto the inner `<button>`. Optional: an icon-only copy button is named `labels.copy` by default.
 *
 * @fires copied - Bubbling `CustomEvent` after a successful write. `detail` = `{ type, value, blob }` — `value` is the text written (`null` for an image), `blob` the PNG written (`null` for text). Named `copied`, not `copy`, so it never collides with the platform's own `copy` (Ctrl+C) event, which also bubbles.
 * @fires copyerror - Bubbling `CustomEvent` when the write fails or no value resolves. `detail` = `{ error }` (an `Error`).
 *
 * @method copy  - `copy() => Promise<boolean>` — copy as a click would (resolves `true` on success). Emits the same events.
 * @method focus - `focus() => void` — focus the inner button.
 *
 * @cssprop [--pd-copy-h]  - Control height (defaults per `size`).
 * @cssprop [--pd-copy-ok] - Colour of the copied state (defaults to `--green`).
 *
 * @example
 * // <puredashboard-copy value="npm i" label="Copy"></puredashboard-copy>
 * // <puredashboard-copy from="#token" variant="text"></puredashboard-copy>
 * // <puredashboard-copy src="/chart.png" type="image" label="Copy chart"></puredashboard-copy>
 * // <puredashboard-copy from="#report table" label="Copy table"></puredashboard-copy>  ← pastes into Excel as cells
 * const c = document.createElement("puredashboard-copy");
 * c.value = () => document.querySelector("#log").textContent;   // late-bound
 * c.addEventListener("copied", (e) => toast.success("Copied"));
 * document.body.append(c);
 */
class PuredashboardCopy extends Reactive {
  static properties = {
    value: {}, src: {}, from: {}, type: {}, label: {}, showValue: {}, variant: {}, size: {},
    disabled: {}, feedback: {}, icon: {}, state: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the common cases
  // are plain markup — <puredashboard-copy value="npm i" variant="text"> — not only JS.
  static observedAttributes = ["value", "src", "from", "type", "label", "show-value", "variant", "size", "disabled", "feedback", "icon", "aria-label"];
  attributeChangedCallback(name, _old, val) {
    if (name === "aria-label") { this.requestUpdate(); return; }        // mirrored in render()
    if (name === "disabled") { this.disabled = val !== null; return; }
    if (name === "show-value") { this.showValue = val !== null; return; }
    if (name === "feedback") { this.feedback = val == null || val === "" ? undefined : Number(val); return; }
    this[name] = val;
  }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.state == null) this.state = "idle";
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
  }

  _btn() { return this.$(".js-puredashboard-copy__btn"); }
  focus() { this._btn()?.focus(); }

  // ---- value resolution -------------------------------------------------------
  // Pick the source synchronously (no I/O): `value`, else `src` as an image URL, else
  // the `from` element. Returns null when nothing is configured.
  _source() {
    if (this.value != null && this.value !== "") return this.value;
    if (this.src) return { url: String(this.src) };
    if (this.from) {
      const el = document.querySelector(this.from);
      if (!el) throw new Error(`no element matches from="${this.from}"`);
      return el;
    }
    return null;
  }

  // Which clipboard flavour a resolved value is. An explicit `type` always wins — it is
  // how you copy an <img>'s alt text as text, or a string as text/html.
  _kind(v) {
    const hint = (this.type || "auto").toLowerCase();
    if (hint === "text" || hint === "html" || hint === "image") return hint;
    if (typeof v === "string") return "text";
    if (v && typeof v.url === "string") return "image";                 // `src`
    if (isBlob(v)) return v.type.startsWith("image/") ? "image" : v.type === "text/html" ? "html" : "text";
    const tag = tagOf(v);
    if (tag === "IMG" || tag === "CANVAS") return "image";
    if (typeof window.ImageBitmap === "function" && v instanceof window.ImageBitmap) return "image";
    // A <table> is the one element whose plain text is useless on its own — copied as
    // HTML (+ a TSV flattening) it pastes into a spreadsheet as real rows and columns.
    if (tag === "TABLE") return "html";
    return "text";
  }

  // A source coerced to the STRING to write (for text/html). An element contributes its
  // `.value` when it is a form control, otherwise its textContent; a Blob is read.
  async _asText(v) {
    if (typeof v === "string") return v;
    if (isBlob(v)) return await v.text();
    const tag = tagOf(v);
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return String(v.value ?? "");
    if (tag === "IMG") return v.getAttribute("alt") || v.getAttribute("src") || "";
    if (v && typeof v.url === "string") return v.url;
    if (v && v.nodeType === 1) return elementToText(v);                 // keeps rows/columns
    if (v && typeof v.textContent === "string") return v.textContent.trim();
    return String(v ?? "");
  }

  // The same source coerced to MARKUP (for type="html"). An element gives its
  // `outerHTML` — that is what makes `from="#some-table"` paste as a real table instead
  // of one run-on string. A form control has no markup worth copying, so its `.value`
  // is escaped into text. The markup is author-TRUSTED, exactly like `raw()`/`icon`:
  // you chose the element or wrote the string.
  async _asMarkup(v) {
    if (typeof v === "string") return v;
    if (isBlob(v)) return await v.text();
    const tag = tagOf(v);
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && v && typeof v.outerHTML === "string") return v.outerHTML;
    return escapeHTML(await this._asText(v));
  }

  // ---- the click ---------------------------------------------------------------
  /** Copy the current value as a click would. Resolves `true` when it reached the clipboard. */
  async copy() {
    if (this.disabled || this._busy) return false;
    this._busy = true;
    clearTimeout(this._timer);
    this.state = "copying";
    try {
      let src = this._source();
      if (typeof src === "function") src = await src(this);             // late-bound value
      if (src == null || src === "") throw new Error("there is no value to copy (set value, src or from)");

      const kind = this._kind(src);
      let ok = false, text = null, blob = null;

      if (kind === "image") {
        // Keep the user gesture alive on Safari: hand the ClipboardItem the PROMISE.
        const png = toPngBlob(src);
        png.catch(() => {});                                            // handled below via `blob`
        ok = await writeItem({ "image/png": png });
        blob = await png;                                               // rethrows a decode/CORS failure
      } else if (kind === "html") {
        text = await this._asMarkup(src);
        const plain = htmlToText(text);                                 // tables → TSV
        ok = await writeItem({
          "text/html": new Blob([text], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        if (!ok) ok = await writeText(plain);                           // degrade to plain text
      } else {
        text = await this._asText(src);
        ok = await writeText(text);
      }

      if (!ok) throw new Error("the clipboard is unavailable (it needs a secure context, and images need the async Clipboard API)");
      this.state = "copied";
      this.emit("copied", { type: kind, value: text, blob });
      this._scheduleReset();
      return true;
    } catch (error) {
      this.state = "error";
      this.emit("copyerror", { error: error instanceof Error ? error : new Error(String(error)) });
      this._scheduleReset();
      return false;
    } finally {
      this._busy = false;
    }
  }

  // Return to idle after `feedback` ms. `0` (or a negative number) keeps the state until
  // the next click, for a caller that wants to own the reset.
  _scheduleReset() {
    const ms = this.feedback == null ? 1600 : Number(this.feedback);
    if (!(ms > 0)) return;
    this._timer = setTimeout(() => { if (this.isConnected) this.state = "idle"; }, ms);
  }

  // Mirror the state onto the host so CSS and tests can select it without touching JS.
  // `data-state` is NOT an observed attribute, so this cannot re-enter.
  updated() {
    const st = this.state || "idle";
    if (this.getAttribute("data-state") !== st) this.setAttribute("data-state", st);
  }

  render() {
    const st = this.state || "idle";
    const dis = !!this.disabled;
    const copied = st === "copied";
    const errored = st === "error";

    // The visible label: the author's, or the copied text when `showValue` is on. While
    // the feedback lasts it becomes "Copied" / "Copy failed" — but only when there IS a
    // label, so an icon-only button keeps its size.
    const authored = this.label != null && this.label !== "" ? this.label
      : this.showValue && typeof this.value === "string" ? this.value : null;
    const text = authored == null ? null : copied ? this._label("copied") : errored ? this._label("failed") : authored;

    const sizeCls = this.size === "sm" ? " puredashboard-copy__btn--sm" : this.size === "lg" ? " puredashboard-copy__btn--lg" : "";
    const variantCls = this.variant === "text" ? " puredashboard-copy__btn--text" : "";
    const stateCls = copied ? " puredashboard-copy__btn--copied" : errored ? " puredashboard-copy__btn--error" : "";
    const iconOnly = text == null ? " puredashboard-copy__btn--icon-only" : "";

    const glyph = copied ? ICON_CHECK : errored ? ICON_X : (this.icon || ICON_COPY);
    // The accessible name belongs on the <button> (the host has no role). An icon-only
    // copy button is named by default — an author aria-label always wins.
    const name = this.getAttribute("aria-label") || (text == null ? this._label("copy") : "");
    const namedBy = this.getAttribute("aria-labelledby") ?? "";
    // Announced OUTSIDE the button, so the result never becomes part of its name.
    const live = copied ? this._label("copied") : errored ? this._label("failed") : "";

    return html`<button type="button" class="puredashboard-copy__btn js-puredashboard-copy__btn${sizeCls}${variantCls}${stateCls}${iconOnly}" aria-label="${name}" aria-labelledby="${namedBy}" ?disabled="${dis}" @click="${() => this.copy()}"><span class="puredashboard-copy__icon">${raw(glyph)}</span>${text == null ? "" : html`<span class="puredashboard-copy__label">${text}</span>`}</button><span class="puredashboard-copy__live" role="status" aria-live="polite">${live}</span>`;
  }
}
PuredashboardCopy.define("puredashboard-copy");

export { PuredashboardCopy };
