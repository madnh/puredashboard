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
const MARKER = "lit";       // sentinel; never appears in real content
const cache = new Map();                // strings array → compiled <template>

export function html(strings, ...values) { return { strings, values, [RESULT]: true }; }
export const isResult = (x) => !!(x && x[RESULT]);

// repeat(items, keyFn, tmplFn) — keyed list directive (like lit's repeat). Use as a
// child binding: ${repeat(rows, (r) => r.id, (r, i) => html`...`)}. On update, rows
// whose key persists keep their existing DOM node (and any focus/scroll inside) and
// are MOVED, not rebuilt; only added/removed/changed rows touch the DOM.
export function repeat(items, keyFn, tmplFn) { return { [REPEAT]: true, items, keyFn, tmplFn }; }
const isRepeat = (x) => !!(x && x[REPEAT]);

function rawNodes(s) { const t = document.createElement("template"); t.innerHTML = s; return [...t.content.childNodes]; }

// Row — one keyed item inside a repeat: its own anchor comment plus the nodes before
// it. update() re-binds in place when the template matches (keeping the live nodes,
// so focus survives); moveBefore() relocates the whole row in one shot.
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
    this.replace(rawNodes(String(v)));  // SafeString / raw() trusted markup
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
      else node.setAttribute(name, s);
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
    else out.push(...rawNodes(String(v)));
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
