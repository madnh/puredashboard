// <puredashboard-upload> — a drag-and-drop file picker with previews and managed upload.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-upload__<element>[--<modifier>]` so it can never collide with app or other
// component styles — restyle these freely. Script hooks are SEPARATE `js-…` classes
// (and data-* attributes); never restyle or remove those, the component needs them.
//
// html/repeat from reactive.js (parts engine, in-place diff) so progress updates in
// place and image thumbnails are NOT recreated each tick (no flicker). Icons are
// inline self-contained SVG, sized via inline style so the component needs no shared
// icon class.
import { Reactive, html, repeat, labelIdFor } from "./reactive.js";
import { raw } from "./html.js";

const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const uploadCloud = svg('<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M20 16.5A4.5 4.5 0 0 0 17 8h-1.26A8 8 0 1 0 4 15.25"/>');
const fileGlyph   = svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>');
const imageGlyph  = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/>');
const closeGlyph  = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const checkGlyph  = svg('<path d="M20 6 9 17l-5-5"/>');
const alertGlyph  = svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');
//
// Flow: selecting and uploading are SEPARATE. Drop files (or click → OS dialog) to
// SELECT; nothing is sent until you call up.upload(url). Images get a thumbnail;
// other files get a type glyph (restyle via .puredashboard-upload__ficon[data-ext=…]). Each
// file carries its own status (ready→uploading→done|error) + progress, shown as a bar
// and emitted as events: files / uploadstart / uploadprogress / uploaddone /
// uploaderror / uploadcomplete. Form-associated: inside a <form name=…> the files are
// submitted as native multipart (under the component's `name`, default "files").
//
// Full API (properties, events, methods, CSS custom props, example) is documented in
// the JSDoc on the class below.

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. up.labels = { browse: "Kéo & thả tệp…" }.
// Entries that interpolate are functions. (`label` stays the shortcut for the prompt.)
const LABELS = {
  browse: "Drag & drop files here, or click to browse",  // the main prompt
  hint: "",                                               // optional secondary line
  choose: "Choose files",                                 // input aria-label
  tooLarge: (max) => `too large (max ${max})`,
  notAllowed: "type not allowed",
  remove: (name) => `Remove ${name}`,
};

let uid = 0;

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  const u = ["KB", "MB", "GB"]; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 1 : 0) + " " + u[i];
}
const extOf = (name) => { const m = /\.([^.]+)$/.exec(name || ""); return m ? m[1].toLowerCase() : ""; };

/**
 * Drag-and-drop file picker with image thumbnails, per-file upload progress, and
 * native multipart form submission. Selecting and uploading are SEPARATE — files are
 * only sent when you call {@link PuredashboardUpload#upload} (or when the surrounding
 * `<form>` is submitted). Configure entirely via JS properties (no attributes needed).
 *
 * @element puredashboard-upload
 *
 * @prop {string}   accept     - Accept filter, e.g. `"image/*,.pdf"` (same syntax as `<input accept>`). Default `""` = any. NOTE: a UX hint only — client-side type/size checks are trivially bypassable (rename, spoofed MIME, direct `uploadFile()`), so the SERVER must validate content, size and storage.
 * @prop {boolean}  multiple   - Allow more than one file. Default `false`.
 * @prop {number}   maxSize    - Max bytes per file; `0` = unlimited. Default `0`. UX hint only — enforce real limits server-side (see `accept`).
 * @prop {boolean}  debug      - `console.debug` every emitted event. Default `false`.
 * @prop {Object}   labels     - Override UI strings (English defaults). Keys: `browse`, `hint`, `choose`, `tooLarge(maxStr)`, `notAllowed`, `remove(name)`. Function-valued keys interpolate. Unset keys keep the English default.
 * @prop {Function} [uploader] - Custom transport `(file, onProgress:(0..1)=>void) => Promise<{response}>` used by `upload()` instead of the built-in multipart XHR.
 * @prop {File[]}   files      - (read-only getter) the currently-selected File objects.
 * @attr {string}   name       - Field name for native `<form>` multipart submit. Default `"files"`.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires puredashboard-upload#files          - Selection changed. `detail`: `File[]`.
 * @fires puredashboard-upload#uploadstart    - `upload()` began. `detail`: `{ count: number }`.
 * @fires puredashboard-upload#uploadprogress - One file advanced. `detail`: `{ file: File, progress: number }` (0..1).
 * @fires puredashboard-upload#uploaddone     - One file succeeded. `detail`: `{ file: File, response }`.
 * @fires puredashboard-upload#uploaderror    - One file failed. `detail`: `{ file: File, error: string }`.
 * @fires puredashboard-upload#uploadcomplete - All files finished. `detail`: `{ results: Array<{file,ok,response?,error?}> }`.
 *
 * @method upload - `upload(url: string, opts?: {headers?,field?,method?}) => Promise<Array>` — send every pending (ready/errored) file; updates per-file status + progress.
 * @method clear  - `clear() => void` — remove all selected files (revokes thumbnails).
 * @method removeFile - `removeFile(id: number) => void` — drop ONE selected file by its id (revokes its thumbnail). Prefer this over `remove(id)`: `remove` is also the DOM's own `Element.remove()`, so a bare `el.remove()` detaches the element and only an explicit id drops a file.
 *
 * @cssprop [--puredashboard-upload-thumb=40px] - Thumbnail / file-glyph box size.
 *
 * @example
 * const u = document.createElement("puredashboard-upload");
 * u.accept = "image/*"; u.multiple = true; u.maxSize = 5 * 1024 * 1024;
 * u.labels = { browse: "Kéo & thả ảnh, hoặc bấm để chọn" };
 * u.addEventListener("files", (e) => submitBtn.disabled = !e.detail.length);
 * submitBtn.onclick = () => u.upload("/api/upload");
 */
class PuredashboardUpload extends Reactive {
  static formAssociated = true;
  static properties = { accept: {}, multiple: {}, maxSize: {}, debug: {}, labels: {}, items: {}, error: {} };

  constructor() { super(); try { this._internals = this.attachInternals(); } catch { this._internals = null; } }

  // _label(key, …args) → localised string: this.labels override, else the English default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this.items = this.items || [];
    this._depth = 0;
    const zone = () => this.querySelector(".js-puredashboard-upload__zone");
    const OVER = "puredashboard-upload__zone--over";
    this.on("dragenter", ".js-puredashboard-upload__zone", (e) => { e.preventDefault(); if (++this._depth) zone()?.classList.add(OVER); });
    this.on("dragover", ".js-puredashboard-upload__zone", (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
    this.on("dragleave", ".js-puredashboard-upload__zone", (e) => { e.preventDefault(); if (--this._depth <= 0) { this._depth = 0; zone()?.classList.remove(OVER); } });
    // drop is handled here (preventDefault cancels the native file-input drop, so files
    // aren't added twice) — validate + add ourselves.
    this.on("drop", ".js-puredashboard-upload__zone", (e) => { e.preventDefault(); this._depth = 0; zone()?.classList.remove(OVER); this._add(e.dataTransfer.files); });
    // The <input> overlays the whole zone (transparent, on top), so a click anywhere on
    // the zone IS a click on the file input → the OS dialog opens natively. No JS
    // .click() needed (most reliable cross-browser, incl. Safari) and keyboard works too.
    this.on("change", ".js-puredashboard-upload__input", (e, el) => { this._add(el.files); el.value = ""; });
    this.on("click", "[data-rm]", (e, el) => this.remove(Number(el.dataset.rm)));
  }

  // mirror the current selection into the owning <form> for native multipart submit
  _syncForm() {
    if (!this._internals || !this._internals.setFormValue) return;
    const name = this.getAttribute("name") || "files";
    const fd = new FormData();
    for (const it of this.items || []) fd.append(name, it.file, it.file.name);
    this._internals.setFormValue(fd);
  }

  // Revoking on disconnect is right — an element that leaves for good must not leak its
  // object URLs. But a RELOCATION is a disconnect plus a reconnect (re-parenting a node is
  // defined as a remove plus an insert, so a keyed repeat() reorder or a filter that leaves
  // survivors non-adjacent runs both), and after it every `it.thumb` pointed at a blob that
  // had been revoked. Measured before this: a row holding one image, relocated once, left the
  // thumbnail permanently broken with the URL string unchanged — revoked, not replaced, and
  // nothing rebuilt it. We still hold `it.file`, so mint them again on the way back in.
  connectedCallback() {
    // Per ITEM, not per element. A flag on the element said "this element was revoked", which
    // stops being true of every item the moment one is ADDED while disconnected: that item's
    // thumb is live, and re-minting it overwrote a URL nobody revoked. Measured that way —
    // created=4 revoked=1 live=3 for 2 items, one leaked per disconnected add.
    for (const it of this.items || []) if (it.thumbDead) { it.thumb = this._mintThumb(it.file); it.thumbDead = false; }
    super.connectedCallback();
  }
  disconnectedCallback() { this._revokeAll(); }
  get files() { return (this.items || []).map((it) => it.file); }
  clear() { this._revokeAll(); this.items = []; this._syncForm(); this._emit("files", this.files); }
  // `remove` is ALSO Element.prototype.remove(), and this class shadows it. Overriding it
  // outright made `uploadEl.remove()` a no-op for the DOM — measured: after el.remove() the
  // element was still connected — and that is a method the ENGINE calls. `Row.remove()` in
  // reactive.js does `for (const n of this.nodes) n.remove()`, so a keyed row whose top-level
  // node IS an upload could never be dropped: repeat() removed it from its own bookkeeping and
  // it stayed on screen forever (measured: [1,2,3] → [1,3] left all three). NodePart.replace
  // uses n.remove() the same way. Wrapping the element in any other node hid it, which is why
  // it survived this long.
  //
  // The two contracts do not overlap, so both are kept: no argument means the platform's
  // "detach me", an id means "drop that file". Item ids come from `++uid` and are never
  // undefined, so the discriminator is safe.
  /** Drop one selected file by its `id` (revokes its thumbnail). */
  removeFile(id) {
    const it = (this.items || []).find((x) => x.id === id);
    if (it && it.thumb) { try { URL.revokeObjectURL(it.thumb); } catch { /* */ } }
    this.items = (this.items || []).filter((x) => x.id !== id);
    this._syncForm(); this._emit("files", this.files);
  }
  // `remove` is the platform's "detach me" AND was this component's "drop a file". Overloading
  // it is fragile — measured: remove(null) and remove(0) do neither, silently, and a callback
  // that forwards an index (el.remove(i)) detaches nothing. removeFile(id) is the name that
  // cannot collide and is what the docs point at; this stays so existing callers keep working.
  // No argument at all is the DOM contract, because that is the form the ENGINE uses:
  // Row.remove() and NodePart.replace both call n.remove() bare, and while this method
  // shadowed Element's outright, a keyed row whose top node was an upload could never be
  // dropped — measured, [1,2,3] -> [1,3] left all three on screen.
  remove(id) {
    if (id === undefined) { super.remove(); return; }
    this.removeFile(id);
  }
  _revokeAll() { for (const it of this.items || []) if (it.thumb) { try { URL.revokeObjectURL(it.thumb); } catch { /* */ } it.thumbDead = true; } }

  _emit(name, detail) {
    if (this.debug) { try { console.debug(`[${this.tagName.toLowerCase()}]`, name, detail); } catch { /* */ } }
    this.emit(name, detail);
  }

  _mintThumb(f) {
    if (typeof URL === "undefined" || !URL.createObjectURL) return null;
    try { return URL.createObjectURL(f); } catch { return null; }
  }
  _wrap(f) {
    const isImage = (f.type || "").startsWith("image/");
    const thumb = isImage ? this._mintThumb(f) : null;
    return { id: ++uid, file: f, status: "ready", progress: 0, error: null, thumb, isImage, ext: extOf(f.name) };
  }

  _add(list) {
    const incoming = [...(list || [])];
    const max = this.maxSize || 0, accept = (this.accept || "").trim();
    const ok = [], bad = [];
    for (const f of incoming) {
      if (max && f.size > max) { bad.push(`${f.name}: ${this._label("tooLarge", fmtBytes(max))}`); continue; }
      if (accept && !matchesAccept(f, accept)) { bad.push(`${f.name}: ${this._label("notAllowed")}`); continue; }
      ok.push(f);
    }
    this.error = bad.length ? bad.join("; ") : "";
    if (!this.multiple) { this._revokeAll(); this.items = ok.slice(-1).map((f) => this._wrap(f)); }
    else this.items = [...(this.items || []), ...ok.map((f) => this._wrap(f))];
    this._syncForm();
    this._emit("files", this.files);
  }

  async upload(url, opts = {}) {
    const pending = (this.items || []).filter((it) => it.status === "ready" || it.status === "error");
    if (!pending.length) return [];
    const transport = typeof this.uploader === "function"
      ? this.uploader
      : (file, onProgress) => uploadFile(url, file, { ...opts, onProgress });
    this._emit("uploadstart", { count: pending.length });
    const results = [];
    for (const it of pending) {
      it.status = "uploading"; it.progress = 0; it.error = null; this.requestUpdate();
      try {
        const res = await transport(it.file, (p) => { it.progress = p; this.requestUpdate(); this._emit("uploadprogress", { file: it.file, progress: p }); });
        it.status = "done"; it.progress = 1; this.requestUpdate();
        this._emit("uploaddone", { file: it.file, response: res && res.response });
        results.push({ file: it.file, ok: true, response: res && res.response });
      } catch (e) {
        it.status = "error"; it.error = String((e && e.message) || e); this.requestUpdate();
        this._emit("uploaderror", { file: it.file, error: it.error });
        results.push({ file: it.file, ok: false, error: it.error });
      }
    }
    this._emit("uploadcomplete", { results });
    return results;
  }

  _statusIcon(it) {
    if (it.status === "done") return html`<span class="puredashboard-upload__status puredashboard-upload__status--ok">${checkGlyph}</span>`;
    if (it.status === "error") return html`<span class="puredashboard-upload__status puredashboard-upload__status--error">${alertGlyph}</span>`;
    return "";
  }

  // Accessible name: the author names this control by putting aria-label /
  // aria-labelledby on the HOST, but the host carries no role — so the name must be
  // mirrored onto the inner native control, which is what assistive tech announces.
  // (Same rule as button.js; unset → empty, which the browser ignores, so a wrapping
  // <label> or the visible label keeps naming the control.)
  _ariaName() { return this.getAttribute("aria-label") ?? this._label("choose"); }
  // …and a <label> that names the HOST (wrapping it, or label[for=hostId]) is associated
  // with the form-associated element, NOT with the inner control — so mirror it down as
  // aria-labelledby, giving each such <label> an id if it hasn't got one.
  _ariaNamedBy() {
    const explicit = this.getAttribute("aria-labelledby");
    if (explicit) return explicit;
    let labels = null;
    try { labels = this._internals && this._internals.labels; } catch { labels = null; }
    if (!labels || !labels.length) return "";
    const ids = [];
    for (const l of labels) ids.push(labelIdFor(l));
    return ids.join(" ");
  }

  render() {
    const items = this.items || [];
    return html`
      <label class="puredashboard-upload__zone js-puredashboard-upload__zone">
        <input type="file" class="puredashboard-upload__input js-puredashboard-upload__input" accept="${this.accept || ""}" ?multiple="${!!this.multiple}" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}">
        <span class="puredashboard-upload__icon">${uploadCloud}</span>
        <span class="puredashboard-upload__label">${this._label("browse")}</span>
        ${this._label("hint") ? html`<span class="puredashboard-upload__hint">${this._label("hint")}</span>` : ""}
      </label>
      ${this.error ? html`<div class="puredashboard-upload__error">${alertGlyph}<span>${this.error}</span></div>` : ""}
      ${items.length ? html`<ul class="puredashboard-upload__list">${repeat(items, (it) => it.id, (it) => html`<li class="puredashboard-upload__file" data-status="${it.status}">
        <span class="puredashboard-upload__ficon" data-ext="${it.ext}">${it.thumb ? html`<img class="puredashboard-upload__thumb" src="${it.thumb}" alt="">` : (it.isImage ? imageGlyph : fileGlyph)}</span>
        <span class="puredashboard-upload__meta">
          <span class="puredashboard-upload__name">${it.file.name}</span>
          <span class="puredashboard-upload__sub">${fmtBytes(it.file.size)}${it.status === "error" ? " · " + it.error : ""}</span>
          ${it.status === "uploading" ? html`<span class="puredashboard-upload__bar"><span class="puredashboard-upload__bar-fill" style="width:${Math.round(it.progress * 100)}%"></span></span>` : ""}
        </span>
        ${this._statusIcon(it)}
        <button type="button" class="puredashboard-upload__remove" data-rm="${it.id}" aria-label="${this._label("remove", it.file.name)}">${closeGlyph}</button>
      </li>`)}</ul>` : ""}`;
  }
}
PuredashboardUpload.define("puredashboard-upload");

function matchesAccept(file, accept) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((tok) => {
    if (tok.startsWith(".")) return name.endsWith(tok);
    if (tok.endsWith("/*")) return type.startsWith(tok.slice(0, -1));
    return type === tok;
  });
}

/**
 * POST one File as `multipart/form-data` with upload-progress reporting (XHR).
 * @function uploadFile
 * @param {string} url
 * @param {File} file
 * @param {Object} [opts] - `{ field="file", method="POST", headers?, onProgress?(p:0..1) }`.
 * @returns {Promise<{status:number, response:*}>} Resolves on 2xx (response JSON-parsed when possible); rejects otherwise.
 */
export function uploadFile(url, file, opts = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method || "POST", url);
    for (const [k, v] of Object.entries(opts.headers || {})) xhr.setRequestHeader(k, v);
    if (xhr.upload && opts.onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let response = xhr.responseText;
      try { response = JSON.parse(xhr.responseText); } catch { /* leave as text */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ status: xhr.status, response });
      else reject(Object.assign(new Error("upload failed: " + xhr.status), { status: xhr.status, response }));
    };
    xhr.onerror = () => reject(new Error("network error"));
    const fd = new FormData();
    fd.append(opts.field || opts.fieldName || "file", file, file.name);
    xhr.send(fd);
  });
}

export { PuredashboardUpload };
