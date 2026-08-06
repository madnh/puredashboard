// Reactive — a ReactiveElement-style base + a compact lit-html-style template
// engine. Zero-dep, no build step, CSP-safe (no eval/Function — uses <template>
// cloning + marker nodes, exactly like lit-html's strategy).
//
// Two things in one file:
//   1) html``  — a tagged template that returns a TemplateResult (lazy; just holds
//      strings+values). Supports the Lit-style binding syntax:
//        text/child:  ${value}            → text node (escaped) | nested html`` |
//                                            array | DOM node | SafeString (raw)
//        attribute:   class="x ${y}"      → setAttribute (supports static + concat)
//        property:    .value=${v}         → node.value = v
//        boolean:     ?disabled=${b}      → toggleAttribute
//        event:       @click=${fn}        → addEventListener
//   2) Reactive — base custom-element: declare `static properties`, return an html``
//      from render(); the engine updates only the parts that changed IN PLACE, so
//      <input> focus/scroll survive re-renders triggered by other props.
//
//   class Foo extends Reactive {
//     static properties = { items: {}, sel: {} };
//     render() { return html`
//       <input .value=${this.q} @input=${(e) => { this.q = e.target.value; }}>
//       ${this.items.map((it) => html`
//         <button class="row ${it.id === this.sel ? "active" : ""}"
//                 @click=${() => { this.sel = it.id; }}>${it.name}</button>`)}`; }
//   }
//   Foo.define("x-foo");
//
// For KEYED lists (reorder/insert/remove while preserving per-row focus), use the
// repeat() directive below instead of a plain array .map() — a bare ${array.map(...)}
// is rebuilt wholesale on change, repeat() moves existing rows by key.
//
// Notes / limits (by design, to stay small):
//  - Attribute NAMES are lowercased by the HTML parser → .property bindings must use
//    lowercase names; dynamic tag/attr-name (`<${t}>`) is unsupported.
//  - RCDATA elements: a child `${}` inside <textarea>/<title>/<script>/<style> can't
//    work (the parser keeps the marker as literal text). The engine DETECTS the lost
//    binding and THROWS a clear error rather than corrupting later bindings — bind the
//    value as an attribute instead: `<textarea .value=${x}></textarea>`.
//  - Nested `${html``}` templates ARE diffed in place (same template → the child
//    instance is reused), so an <input> inside a helper keeps its focus/edits across
//    re-renders. (Arrays still rebuild — use repeat() for keyed lists whose rows must
//    keep per-row state.)
//  - render() may also return a plain string / SafeString (from ./html.js) —
//    handled via innerHTML for back-compat.

const RESULT = Symbol("TemplateResult");
const REPEAT = Symbol("repeat");
const SAFE = Symbol.for("puredashboard.safe");   // shared with html.js raw()/SafeString
const MARKER = "lit";       // sentinel; never appears in real content
const cache = new Map();                // strings array → compiled <template>

export function html(strings, ...values) { return { strings, values, [RESULT]: true }; }
export const isResult = (x) => !!(x && x[RESULT]);

// repeat(items, keyFn, tmplFn) — keyed list directive (like lit's repeat). Use as a
// child binding: ${repeat(rows, (r) => r.id, (r, i) => html`...`)}. On update, rows
// whose key persists keep their existing DOM node and are MOVED, not rebuilt; only
// added/removed/changed rows touch the DOM.
//
// What "keeps its node" does and does NOT buy you. A row left where it is keeps
// everything: focus, scroll, and any state you hung on the node. A row the reconciler
// RELOCATES keeps only the node — relocation goes through insertBefore, which the DOM
// defines as a remove plus an insert, so focus is lost, an inner scroll container resets
// to 0, and a custom element inside the row is disconnected and reconnected (its
// connectedCallback runs again). Selection offsets do survive: after the move
// selectionStart still reads what it did, it is the focus that is gone.
//
// WHICH rows get relocated is a property of the diff, not of what you called the update.
// Measured (Chrome and jsdom agree): reversing [1,2,3] relocates the focused row and
// focus is lost; rotating it to [2,3,1] relocates a different one and focus survives; a
// removal leaving the survivors non-adjacent ([1,2,3,4,5] → [1,3,5]) relocates rows just
// as a reorder does, while an append, a prepend, and a head/tail/contiguous removal
// relocate nothing. So "reorders are lossy, edits are free" is the wrong summary. The
// right one: node identity is NOT a proxy for state surviving an update — if a row holds
// focus or scroll you care about, check that, not the node.
export function repeat(items, keyFn, tmplFn) { return { [REPEAT]: true, items, keyFn, tmplFn }; }
const isRepeat = (x) => !!(x && x[REPEAT]);

// labelIdFor(node) — the id a <label> must carry so an inner control can point at it
// with aria-labelledby, minted on first use and remembered on the node itself.
//
// It lives HERE, in the one module every form-associated component already imports,
// because the id has to be unique across the PAGE and each component file is its own
// module scope. Twelve files each counting `pd-label-${++labelId}` from zero produced
// the same id twelve times over: the first <label> wrapping a <puredashboard-select>
// and the first wrapping a <puredashboard-input> were both `pd-label-1`,
// getElementById returned whichever came first in the DOM, and the second control
// announced the first one's name. aria-labelledby outranks aria-label, so the author
// could not even override it from outside.
//
// One counter is still not enough on its own: the page we are minting into is the
// AUTHOR's, so an element of theirs may already hold the id we are about to hand out.
// Skip past anything already taken — same failure (the control announces someone else's
// text), only the clash comes from outside the library. Limit: a <label> not yet in the
// document has nothing to check against.
let labelId = 0;
export function labelIdFor(node) {
  if (!node.id) {
    let id;
    do { id = `pd-label-${++labelId}`; } while (document.getElementById(id));
    node.id = id;
  }
  return node.id;
}

function rawNodes(s) { const t = document.createElement("template"); t.innerHTML = s; return [...t.content.childNodes]; }

// URL-bearing attributes whose value must never carry a script-executing scheme.
const NAV_URL_ATTRS = new Set(["href", "xlink:href", "formaction", "action", "ping"]);
const MEDIA_URL_ATTRS = new Set(["src", "poster", "background"]);
// Neutralize javascript:/vbscript: (and data: for navigations) so a URL bound from a
// data field can't become click-to-XSS. Relative/hash/mailto/tel/http(s)/blob pass
// through untouched; data: stays allowed on media attrs (e.g. <img src>). Leading
// control chars/whitespace are stripped first because the browser ignores them when
// resolving the scheme (e.g. "java\tscript:").
function safeUrlAttr(name, val) {
  const n = name.toLowerCase();
  if (!NAV_URL_ATTRS.has(n) && !MEDIA_URL_ATTRS.has(n)) return val;
  const scheme = String(val).replace(/[\x00-\x20]+/g, "").match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return val;                                 // no scheme → relative/hash, safe
  const s = scheme[1].toLowerCase();
  if (s === "javascript" || s === "vbscript") return "";
  if (s === "data" && NAV_URL_ATTRS.has(n)) return "";
  return val;
}

// Row — one keyed item inside a repeat: its own anchor comment plus the nodes before
// it. update() re-binds in place when the template matches (keeping the live nodes, so
// focus survives); moveBefore() relocates the whole row in one shot.
//
// NOTE the method below is ours and is built on insertBefore — it is not the native
// moveBefore(), whose name it shares. That one performs a state-preserving atomic move:
// focus, an inner scroll position and an <iframe>'s loaded document all survive it
// (measured in Chrome), where insertBefore destroys all three. Chrome/Edge 133+ and
// Firefox 144+, no Safari, so adopting it would be a feature-detected enhancement rather
// than a swap.
//
// Detect it on the PARENT, at call time — `typeof parent.moveBefore === "function"`. Not
// on `Element.prototype`: `parent` here is `this.anchor.parentNode`, which may be a
// DocumentFragment, and `test/reactive.test.mjs` copies only six jsdom globals with
// `Element` not among them, so a detect written that way throws ReferenceError in the only
// runner this repo has. Detecting at call time is also what lets a test shim the dispatch;
// caching the answer at module load pins nothing.
//
// It is NOT a free swap, and the reason is inside this library rather than outside it.
// popover.js positions its panel ONCE, from getBoundingClientRect on open, with no
// reposition listener (see `_reposition`). Today a relocated row tears the panel out of the
// document and the browser drops it — self-correcting by accident. Under an atomic move the
// panel survives at its open-time coordinates while the trigger travels: measured in
// Chrome, a row sent to the end of a five-row list left the panel 331px from its trigger,
// still open. popconfirm.js measures the same, 331px; tooltip.js has the same shape (its
// disconnectedCallback drops listeners without closing) and is UNMEASURED. menubar.js is
// NOT affected — its disconnectedCallback calls close(), and that callback still fires
// under an atomic move, so it self-corrects (measured: openIndex 0 → -1). What decides it
// is whether the component closes ITSELF on disconnect or leans on the browser dropping a
// panel that left the document. The leaners have to be settled BEFORE this changes, or the
// enhancement ships a visible defect on exactly the browsers it is meant to help.
//
// It also only skips disconnected/connectedCallback for custom elements that OPT IN by
// defining connectedMoveCallback(); one that does not still gets the old pair, so it would
// not on its own spare a component inside a row from re-running its connect logic. Focus
// inside such a component does still survive, because renderResult rebinds in place rather
// than replacing children.
class Row {
  constructor(key) { this.key = key; this.anchor = document.createComment("row"); this.nodes = []; this.inst = null; }
  firstNode() { return this.nodes.length ? this.nodes[0] : this.anchor; }
  update(result) {
    if (this.inst && this.inst.key === result.strings) { bindAll(this.inst, result.values); return; }
    const inst = instantiate(compile(result.strings));
    inst.key = result.strings;
    bindAll(inst, result.values);
    for (const n of this.nodes) n.remove();
    const p = this.anchor.parentNode, next = [...inst.frag.childNodes];
    for (const n of next) p.insertBefore(n, this.anchor);
    this.nodes = next; this.inst = inst;
  }
  moveBefore(parent, ref) { for (const n of this.nodes) parent.insertBefore(n, ref); parent.insertBefore(this.anchor, ref); }
  remove() { for (const n of this.nodes) n.remove(); this.anchor.remove(); }
}

// ---- compile: build a <template> with markers (cached per call-site) ---------
function compile(strings) {
  let c = cache.get(strings);
  if (c) return c;
  let h = "";
  for (let i = 0; i < strings.length; i++) {
    h += strings[i];
    if (i < strings.length - 1) {
      const inTag = h.lastIndexOf("<") > h.lastIndexOf(">");
      h += inTag ? MARKER : `<!--${MARKER}-->`;   // attribute value vs child position
    }
  }
  const tmpl = document.createElement("template");
  tmpl.innerHTML = h;
  c = { tmpl, marks: strings.length - 1 };   // marks = expected number of bindings
  cache.set(strings, c);
  return c;
}

// ---- parts -------------------------------------------------------------------
class NodePart {
  size = 1;
  constructor(anchor) { this.anchor = anchor; this.nodes = []; this.rows = null; this.childInst = null; this.old = undefined; }
  setValue(values, i) { this.commit(values[i]); }
  replace(next) {
    for (const n of this.nodes) n.remove();
    const p = this.anchor.parentNode;
    for (const n of next) p.insertBefore(n, this.anchor);
    this.nodes = next;
  }
  commit(v) {
    if (isRepeat(v)) { this.commitRepeat(v); this.old = v; return; }
    if (this.rows) { for (const r of this.rows) r && r.remove(); this.rows = null; }  // left repeat mode
    // Nested template: when it's the SAME template as last time, reuse the child
    // instance and update its parts in place (keeps focus/edits) — learned from lit.
    // Only a different template rebuilds the DOM.
    if (isResult(v)) {
      if (this.childInst && this.childInst.key === v.strings) bindAll(this.childInst, v.values);
      else {
        const inst = instantiate(compile(v.strings));
        inst.key = v.strings;
        bindAll(inst, v.values);
        this.childInst = inst;
        this.replace([...inst.frag.childNodes]);
      }
      this.old = v; return;
    }
    this.childInst = null;                            // leaving nested-template mode
    if (v === this.old && !Array.isArray(v)) return;
    if (v == null || v === false || v === true || v === "") { this.replace([]); this.old = v; return; }
    if (typeof v === "string" || typeof v === "number") {
      if (this.nodes.length === 1 && this.nodes[0].nodeType === 3) this.nodes[0].data = String(v);
      else this.replace([document.createTextNode(String(v))]);
      this.old = v; return;
    }
    if (v.nodeType) { this.replace([v]); this.old = v; return; }
    if (Array.isArray(v)) { this.replace(arrayNodes(v)); this.old = v; return; }
    if (v[SAFE]) { this.replace(rawNodes(v.toString())); this.old = v; return; }  // trusted raw()/SafeString markup ONLY
    // any other non-primitive → coerce to TEXT (never innerHTML an unmarked value)
    if (this.nodes.length === 1 && this.nodes[0].nodeType === 3) this.nodes[0].data = String(v);
    else this.replace([document.createTextNode(String(v))]);
    this.old = v;
  }

  // commitRepeat — keyed two-end reconciliation (Snabbdom/lit style). Walks the old
  // and new lists from both ends, reusing rows by key (update in place + move when
  // needed); only genuinely new keys build DOM, only dropped keys remove it.
  commitRepeat(d) {
    if (this.nodes.length) this.replace([]);              // leaving plain-children mode
    const parent = this.anchor.parentNode, mainAnchor = this.anchor;
    const items = d.items || [];
    const newKeys = items.map((it, i) => d.keyFn(it, i));
    const newRes = items.map((it, i) => d.tmplFn(it, i));
    const oldRows = this.rows || [];
    const oldKeys = oldRows.map((r) => r && r.key);
    const newRows = new Array(items.length);

    let oh = 0, ot = oldRows.length - 1, nh = 0, nt = items.length - 1, oldKeyToIdx = null;
    while (oh <= ot && nh <= nt) {
      if (oldRows[oh] === null) { oh++; }
      else if (oldRows[ot] === null) { ot--; }
      else if (oldKeys[oh] === newKeys[nh]) { (newRows[nh] = oldRows[oh]).update(newRes[nh]); oh++; nh++; }
      else if (oldKeys[ot] === newKeys[nt]) { (newRows[nt] = oldRows[ot]).update(newRes[nt]); ot--; nt--; }
      else if (oldKeys[oh] === newKeys[nt]) {            // old head moved to the tail
        const r = oldRows[oh]; r.update(newRes[nt]); r.moveBefore(parent, oldRows[ot].anchor.nextSibling);
        newRows[nt] = r; oh++; nt--;
      }
      else if (oldKeys[ot] === newKeys[nh]) {            // old tail moved to the head
        const r = oldRows[ot]; r.update(newRes[nh]); r.moveBefore(parent, oldRows[oh].firstNode());
        newRows[nh] = r; ot--; nh++;
      }
      else {                                            // general case: look new head up by key
        if (!oldKeyToIdx) { oldKeyToIdx = new Map(); for (let i = oh; i <= ot; i++) if (oldRows[i]) oldKeyToIdx.set(oldKeys[i], i); }
        const idx = oldKeyToIdx.get(newKeys[nh]);
        if (idx === undefined) { newRows[nh] = this.#newRow(parent, newKeys[nh], newRes[nh], oldRows[oh].firstNode()); }
        else { const r = oldRows[idx]; r.update(newRes[nh]); r.moveBefore(parent, oldRows[oh].firstNode()); oldRows[idx] = null; newRows[nh] = r; }
        nh++;
      }
    }
    for (let ref; nh <= nt; nh++) { ref = newRows[nt + 1] ? newRows[nt + 1].firstNode() : mainAnchor; newRows[nh] = this.#newRow(parent, newKeys[nh], newRes[nh], ref); }
    for (; oh <= ot; oh++) if (oldRows[oh]) oldRows[oh].remove();
    this.rows = newRows;
  }
  #newRow(parent, key, result, ref) { const r = new Row(key); parent.insertBefore(r.anchor, ref); r.update(result); return r; }
}

class AttrPart {
  constructor(node, kind, name, statics) {
    this.node = node; this.kind = kind; this.name = name; this.statics = statics;
    this.size = statics.length - 1; this.old = undefined;
  }
  setValue(values, i) {
    const { node, name, kind } = this;
    if (kind === "attr") {
      let s = this.statics[0];
      for (let j = 0; j < this.size; j++) s += (values[i + j] ?? "") + this.statics[j + 1];
      if (s === this.old) return;
      this.old = s;
      // pure single nullish binding with no static text → drop the attribute
      if (this.size === 1 && this.statics[0] === "" && this.statics[1] === "" &&
          (values[i] == null || values[i] === false)) node.removeAttribute(name);
      else node.setAttribute(name, safeUrlAttr(name, s));
      return;
    }
    const v = values[i];
    if (kind === "event") { if (this.old) node.removeEventListener(name, this.old); if (typeof v === "function") node.addEventListener(name, v); this.old = v; return; }
    if (v === this.old) return;
    if (kind === "prop") node[name] = v;
    else node.toggleAttribute(name, !!v);   // boolean
    this.old = v;
  }
}

// ---- instantiate: clone template, discover parts in source order -------------
function instantiate(compiled) {
  const frag = compiled.tmpl.content.cloneNode(true);
  const insts = [];
  const w = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 8) { if (n.data === MARKER) insts.push(new NodePart(n)); continue; }
    for (const attr of [...n.attributes]) {
      if (!attr.value.includes(MARKER)) continue;
      const raw = attr.name, p = "@.?".includes(raw[0]) ? raw[0] : "";
      const kind = p === "@" ? "event" : p === "." ? "prop" : p === "?" ? "bool" : "attr";
      const statics = attr.value.split(MARKER);     // length = bindings + 1
      n.removeAttribute(raw);
      insts.push(new AttrPart(n, kind, p ? raw.slice(1) : raw, statics));
    }
  }
  // Learned from lit: a child ${} inside a raw-text element (<textarea>/<title>/
  // <script>/<style>) is swallowed as literal text by the parser, so its marker never
  // becomes a comment node — the part is missing and every later binding shifts. Catch
  // that loudly instead of silently corrupting the render.
  const bound = insts.reduce((sum, p) => sum + p.size, 0);
  if (bound !== compiled.marks)
    throw new Error(`reactive html: ${compiled.marks - bound} binding(s) lost — a \${} inside <textarea>/<title>/<script>/<style>? Bind it as an attribute instead, e.g. <textarea .value=\${x}>.`);
  return { frag, insts };
}

function bindAll(inst, values) { let vi = 0; for (const pt of inst.insts) { pt.setValue(values, vi); vi += pt.size; } }
function buildFragment(result) { const inst = instantiate(compile(result.strings)); bindAll(inst, result.values); return inst.frag; }

// renderResult mounts/updates a TemplateResult into container. First call clones &
// inserts; later calls with the SAME template reuse the live DOM and update only
// changed parts (this is what preserves focus). Non-results fall back to innerHTML.
export function renderResult(result, container) {
  if (!isResult(result)) { container.innerHTML = result == null ? "" : String(result); container.__lit = null; return; }
  let inst = container.__lit;
  if (!inst || inst.key !== result.strings) {
    inst = instantiate(compile(result.strings));
    inst.key = result.strings;
    bindAll(inst, result.values);     // bind while still in frag (anchors resolve there)
    container.replaceChildren(inst.frag);
    container.__lit = inst;
  } else {
    bindAll(inst, result.values);     // in-place update of live DOM
  }
}

function arrayNodes(arr) {
  const out = [];
  for (const v of arr) {
    if (v == null || v === false || v === true) continue;
    if (typeof v === "string" || typeof v === "number") out.push(document.createTextNode(String(v)));
    else if (v.nodeType) out.push(v);
    else if (isResult(v)) out.push(...buildFragment(v).childNodes);
    else if (v[SAFE]) out.push(...rawNodes(v.toString()));       // trusted raw()/SafeString markup ONLY
    else out.push(document.createTextNode(String(v)));           // unmarked object → text, never innerHTML
  }
  return out;
}

// ---- Reactive base -----------------------------------------------------------
export class Reactive extends HTMLElement {
  static properties = {};
  static define(tag) { customElements.define(tag, this); return this; }

  #changed = new Map();
  #deleg = new Map();
  #pending = false;
  #ready = false;
  #wired = false;
  #first = true;

  constructor() {
    super();
    for (const name in this.constructor.properties) {
      let v = this[name];
      Object.defineProperty(this, name, {
        get: () => v,
        set: (n) => { if (n === v) return; const o = v; v = n; this.#changed.set(name, o); this.#schedule(); },
      });
    }
  }

  connectedCallback() {
    if (!this.#wired) { this.#wired = true; this.setup?.(); }
    this.#ready = true;
    this.#schedule();
  }

  requestUpdate() { this.#changed.set("$", undefined); this.#schedule(); }
  #schedule() { if (this.#pending || !this.#ready) return; this.#pending = true; queueMicrotask(() => this.#run()); }
  #run() {
    this.#pending = false;
    const changed = this.#changed; this.#changed = new Map();
    renderResult(this.render(), this);
    if (this.#first) { this.#first = false; this.firstUpdated?.(changed); }
    this.updated?.(changed);
  }

  // Optional delegated events (one host listener/type, survives re-renders). Inline
  // @event bindings are usually nicer now, but on() stays for dynamic/global wiring.
  on(type, sel, fn) {
    if (typeof sel === "function") { fn = sel; sel = null; }
    if (!this.#deleg.has(type)) { this.#deleg.set(type, []); this.addEventListener(type, this.#fire); }
    this.#deleg.get(type).push({ sel, fn });
    return this;
  }
  #fire = (e) => {
    for (const { sel, fn } of this.#deleg.get(e.type) || []) {
      const el = sel ? e.target.closest(sel) : this;
      if (el && this.contains(el)) fn.call(this, e, el);
    }
  };
  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true })); }

  $(s) { return this.querySelector(s); }
  $$(s) { return [...this.querySelectorAll(s)]; }
  render() { return ""; }
}
