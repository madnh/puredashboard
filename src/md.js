// md.js — a small, SAFE markdown renderer (zero deps, self-hosted).
//
// Two layers:
//   1. parseMarkdown(src) → a plain-object AST. Pure, no DOM, fully unit-testable
//      (see md.test.mjs). This is where all parsing/whitelisting decisions live.
//   2. renderMarkdown(src) → a DocumentFragment, built ONLY with document.create*
//      and node.textContent. No HTML strings, no innerHTML anywhere.
//
// Security model: inter-node messages are authored by AI/remote nodes, so they are
// untrusted. Because every text value reaches the DOM via textContent (never HTML
// parsing) and the only elements that exist are the ones we createElement, there is
// no HTML-injection surface — escaping correctness is not even in the trust path.
// The single attribute taken from input is a link href, whitelisted to
// http/https/mailto/relative in the parser (anything else stays plain text).
//
// Supported: headings, bold, italic, inline code, fenced code, ordered/unordered
// lists, blockquotes, horizontal rules, links, strikethrough, and GFM tables.

// ---- inline ----------------------------------------------------------------
// A STICKY (`y`) regex matches the next token anchored at the scan index, so the
// tokenizer visits each character once (no re-slice from 0 → no quadratic blowup
// on adversarial input). Bounds on the link's bracket/url scans (`{1,256}` /
// `{1,2048}`) keep that alternative from greedily scanning the whole tail, which
// was the source of a remote O(n²) DoS. Underscore emphasis requires non-word
// boundaries so identifiers like foo_bar_baz are NOT italicised. Emphasis/strong/
// del recurse so **bold `code`** nests; code spans keep their content literal.
const INLINE =
  /(`[^`]+`)|(\*\*[\s\S]+?\*\*)|((?<![A-Za-z0-9])__[\s\S]+?__(?![A-Za-z0-9]))|(~~[\s\S]+?~~)|(\*(?!\s)[\s\S]*?\*)|((?<![A-Za-z0-9])_(?!\s)[\s\S]*?_(?![A-Za-z0-9]))|(\[[^\]\n]{1,256}\]\([^)\s]{1,2048}\))/y;

function safeHref(href) {
  if (/^(https?:|mailto:)/i.test(href)) return true;
  if (href.startsWith("#")) return true;
  // same-origin path, but NOT protocol-relative ("//host") or its "/\\host" twin,
  // which navigate cross-origin despite starting with "/".
  return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

export function parseInline(str) {
  const s = String(str ?? "");
  const out = [];
  let last = 0, i = 0;
  while (i < s.length) {
    INLINE.lastIndex = i;
    const m = INLINE.exec(s); // sticky → matches only when a token starts exactly at i
    if (!m) { i++; continue; }
    if (i > last) out.push({ type: "text", value: s.slice(last, i) });
    const tok = m[0];
    if (tok[0] === "`") {
      out.push({ type: "code", value: tok.slice(1, -1) });
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push({ type: "strong", children: parseInline(tok.slice(2, -2)) });
    } else if (tok.startsWith("~~")) {
      out.push({ type: "del", children: parseInline(tok.slice(2, -2)) });
    } else if (tok[0] === "*" || tok[0] === "_") {
      out.push({ type: "em", children: parseInline(tok.slice(1, -1)) });
    } else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (mm && safeHref(mm[2])) out.push({ type: "link", href: mm[2], children: parseInline(mm[1]) });
      else out.push({ type: "text", value: tok }); // unsafe/odd link → literal text
    }
    i += tok.length;
    last = i;
  }
  if (s.length > last) out.push({ type: "text", value: s.slice(last) });
  return out;
}

function parseInlineLines(lines) {
  const out = [];
  lines.forEach((ln, i) => { if (i) out.push({ type: "br" }); out.push(...parseInline(ln)); });
  return out;
}

// ---- block helpers ---------------------------------------------------------
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
// A table separator line: every cell is dashes with optional alignment colons
// (handles 1+ columns, unlike a fixed multi-column regex).
function isTableSep(line) {
  if (!/[-]/.test(line) || !line.includes("|")) return false;
  const cells = splitRow(line);
  return cells.length >= 1 && cells.every((c) => /^:?-+:?$/.test(c));
}

function isBlockStart(line) {
  return /^\s*```/.test(line) || /^(#{1,6})\s/.test(line) || /^\s*>\s?/.test(line) ||
    /^(\s*)[-*+]\s+/.test(line) || /^(\s*)\d+[.)]\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line);
}

// ---- block parser → AST ----------------------------------------------------
export function parseMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const buf = []; i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push({ type: "code", value: buf.join("\n") });
      continue;
    }

    if (/^\s*$/.test(line)) { i++; continue; }

    // GFM table: a header row followed by a |---|:--:| separator line.
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(":"), r = c.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : "";
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push({
        type: "table", align,
        head: head.map(parseInline),
        rows: rows.map((r) => r.map(parseInline)),
      });
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: "heading", level: h[1].length, children: parseInline(h[2].trim()) }); i++; continue; }

    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      blocks.push({ type: "blockquote", children: parseInline(buf.join(" ")) });
      continue;
    }

    const isUL = (l) => l.match(/^(\s*)[-*+]\s+(.*)$/);
    const isOL = (l) => l.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (isUL(line) || isOL(line)) {
      const ordered = !!isOL(line);
      const items = [];
      while (i < lines.length) {
        const mm = ordered ? isOL(lines[i]) : isUL(lines[i]);
        if (!mm) break;                                      // not this list type / not a list
        if (ordered ? isUL(lines[i]) && !isOL(lines[i]) : isOL(lines[i]) && !isUL(lines[i])) break;
        items.push(parseInline(mm[2].trim()));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // paragraph: gather consecutive non-blank, non-structural lines. Also stop at
    // a table that starts mid-paragraph (header row + separator on the next line),
    // so a table written without a preceding blank line isn't swallowed.
    const startsTable = (j) => lines[j].includes("|") && j + 1 < lines.length && isTableSep(lines[j + 1]);
    const buf = [line]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i]) && !startsTable(i)) { buf.push(lines[i]); i++; }
    blocks.push({ type: "paragraph", children: parseInlineLines(buf) });
  }
  return blocks;
}

// ---- DOM emitter (browser) -------------------------------------------------
function emitInline(parent, nodes) {
  for (const n of nodes) {
    if (n.type === "text") {
      parent.appendChild(document.createTextNode(n.value));
    } else if (n.type === "br") {
      parent.appendChild(document.createElement("br"));
    } else if (n.type === "code") {
      const c = document.createElement("code"); c.textContent = n.value; parent.appendChild(c);
    } else if (n.type === "link") {
      const a = document.createElement("a");
      a.setAttribute("href", n.href); // parser already whitelisted the scheme
      a.target = "_blank"; a.rel = "noopener noreferrer";
      emitInline(a, n.children); parent.appendChild(a);
    } else {
      const e = document.createElement(n.type === "strong" ? "strong" : n.type === "em" ? "em" : "del");
      emitInline(e, n.children); parent.appendChild(e);
    }
  }
}

export function renderMarkdown(src) {
  const frag = document.createDocumentFragment();
  for (const b of parseMarkdown(src)) {
    if (b.type === "heading") {
      const h = document.createElement("h" + b.level); emitInline(h, b.children); frag.appendChild(h);
    } else if (b.type === "paragraph") {
      const p = document.createElement("p"); emitInline(p, b.children); frag.appendChild(p);
    } else if (b.type === "code") {
      const pre = document.createElement("pre"); const c = document.createElement("code");
      c.textContent = b.value; pre.appendChild(c); frag.appendChild(pre);
    } else if (b.type === "blockquote") {
      const q = document.createElement("blockquote"); emitInline(q, b.children); frag.appendChild(q);
    } else if (b.type === "hr") {
      frag.appendChild(document.createElement("hr"));
    } else if (b.type === "list") {
      const l = document.createElement(b.ordered ? "ol" : "ul");
      for (const it of b.items) { const li = document.createElement("li"); emitInline(li, it); l.appendChild(li); }
      frag.appendChild(l);
    } else if (b.type === "table") {
      const t = document.createElement("table");
      const thead = document.createElement("thead"); const htr = document.createElement("tr");
      b.head.forEach((cell, ci) => {
        const th = document.createElement("th");
        if (b.align[ci]) th.style.textAlign = b.align[ci];
        emitInline(th, cell); htr.appendChild(th);
      });
      thead.appendChild(htr); t.appendChild(thead);
      const tbody = document.createElement("tbody");
      for (const row of b.rows) {
        const tr = document.createElement("tr");
        row.forEach((cell, ci) => {
          const td = document.createElement("td");
          if (b.align[ci]) td.style.textAlign = b.align[ci];
          emitInline(td, cell); tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      t.appendChild(tbody); frag.appendChild(t);
    }
  }
  return frag;
}

// ---- <puredashboard-markdown> component -------------------------------------------
// A thin custom element over renderMarkdown: set `.value` (the markdown string),
// the `value` attribute, or put the markdown as the element's text content, and it
// renders the SAFE DOM inside itself. Light DOM → md.css (which styles
// `puredashboard-markdown` descendants) applies. Not built on Reactive — it emits a prebuilt
// safe DOM fragment, not a reactive template.
//
/**
 * Renders Markdown to a SAFE DOM subtree — `textContent` only, href whitelist, no
 * `innerHTML` — so it is XSS-safe for UNTRUSTED input (e.g. an AI/agent response).
 * Extends plain `HTMLElement` (not `Reactive`): it emits a prebuilt safe fragment,
 * not a reactive template. Setting `.value` coalesces the re-render to the next
 * animation frame, so a caller streaming tokens can set it per-token without an
 * O(n²) re-parse. With no `.value`, inline text content is used as the source.
 *
 * @prop {string} value - The Markdown source. Set via the property (safe for
 *   untrusted text) or the `value` attribute. Default `""`.
 * @attr {string} value - Declarative form of `value`.
 *
 * @example
 * // <puredashboard-markdown value="# Hello"></puredashboard-markdown>
 * const md = document.createElement("puredashboard-markdown");
 * md.value = "# Hello\n\nsome **markdown**";   // untrusted text is safe (textContent only)
 * container.append(md);
 */
class PuredashboardMarkdown extends HTMLElement {
  static get observedAttributes() { return ["value"]; }
  // A template engine (reactive.js / lit) sets `.value` while the element is still in
  // inert <template> content — i.e. BEFORE upgrade — which leaves a plain own-property
  // shadowing this accessor. Reconcile it through the setter on upgrade so
  // `<puredashboard-markdown .value=${md}>` inside another component works.
  constructor() { super(); this._upgrade("value"); }
  _upgrade(p) { if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; } }
  // Setting `.value` COALESCES the re-render to the next animation frame. So a caller
  // STREAMING tokens (e.g. an AI/agent response) may set `.value` on every token without
  // paying an O(n²) re-parse — only ~one render per frame runs, always of the latest
  // value. Safe-by-default: callers don't need to throttle/debounce themselves.
  set value(v) { this._value = v == null ? "" : String(v); this._set = true; if (this.isConnected) this._schedule(); }
  get value() { return this._value || ""; }
  connectedCallback() {
    if (!this._set && this.textContent.trim()) this._value = this.textContent;   // inline markdown fallback
    this._render();   // first paint is synchronous; subsequent .value changes coalesce per frame
  }
  attributeChangedCallback(name, _old, val) { if (name === "value") this.value = val; }
  _schedule() {
    if (this._pending) return;
    this._pending = true;
    const run = () => { this._pending = false; this._render(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);   // browser: ~1 render/frame
    else queueMicrotask(run);                                                       // non-visual env (tests)
  }
  _render() { this.replaceChildren(renderMarkdown(this._value || "")); }
}
customElements.define("puredashboard-markdown", PuredashboardMarkdown);
export { PuredashboardMarkdown };
