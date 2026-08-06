// Tests for ../src/md.js — the markdown renderer. md.js is the ONLY component that
// turns UNTRUSTED input (inter-node message bodies) into DOM, so XSS-safety is the
// headline concern; jsdom lets us assert that hostile input produces inert text, not
// live <img>/<script>/<a javascript:> nodes. Also covers correct rendering + the pure
// AST layer (parseMarkdown needs no DOM).
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>");
for (const k of [
  "document",
  "HTMLElement",
  "Node",
  "DocumentFragment",
  "customElements",
])
  global[k] = dom.window[k];

const { parseMarkdown, renderMarkdown } = await import("../src/md.js");

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r))); // for coalesced renders
const render = (src) => {
  const d = document.createElement("div");
  d.appendChild(renderMarkdown(src));
  return d;
};

// ============================ rendering =====================================
ok(
  render("# Hello").querySelector("h1")?.textContent === "Hello",
  "heading → h1",
);
ok(
  render("### H3").querySelector("h3")?.textContent === "H3",
  "heading level → h3",
);
ok(
  render("**b**").querySelector("strong")?.textContent === "b",
  "bold → strong",
);
ok(render("*i*").querySelector("em")?.textContent === "i", "italic → em");
ok(
  render("~~s~~").querySelector("del")?.textContent === "s",
  "strikethrough → del",
);
ok(
  render("`c`").querySelector("code")?.textContent === "c",
  "inline code → code",
);
ok(
  render("```\nx=1\n```").querySelector("pre code")?.textContent === "x=1",
  "fenced → pre>code",
);
ok(
  render("- a\n- b").querySelectorAll("ul li").length === 2,
  "unordered list → ul>li×2",
);
ok(
  render("1. a\n2. b").querySelectorAll("ol li").length === 2,
  "ordered list → ol>li×2",
);
ok(
  render("> quote").querySelector("blockquote")?.textContent === "quote",
  "blockquote",
);
ok(!!render("---").querySelector("hr"), "--- → hr");
{
  const d = render("| A | B |\n|---|:--:|\n| 1 | 2 |");
  ok(
    d.querySelectorAll("thead th").length === 2 &&
      d.querySelectorAll("tbody td").length === 2,
    "GFM table → thead/tbody",
  );
  ok(
    d.querySelector("thead th:nth-child(2)")?.style.textAlign === "center",
    "table alignment (:--:) → center",
  );
}

// ============================ XSS safety ====================================
{
  const d = render("hi <img src=x onerror=alert(1)> there");
  ok(!d.querySelector("img"), "xss: <img> in text is NOT a real element");
  ok(
    d.textContent.includes("<img src=x onerror=alert(1)>"),
    "xss: angle-bracket text kept literal",
  );
}
{
  const d = render("<script>alert(1)</script>");
  ok(!d.querySelector("script"), "xss: <script> not created as element");
}
{
  const d = render("**<b>not bold html</b>**");
  ok(
    !d.querySelector("strong b"),
    "xss: HTML inside markdown stays text, not parsed",
  );
}
{
  const d = render("[click](javascript:alert(1))");
  ok(!d.querySelector("a"), "xss: javascript: link rejected (no <a>)");
  ok(
    d.textContent.includes("javascript:alert(1)"),
    "xss: rejected link falls back to literal text",
  );
}
{
  ok(
    !render("[x](//evil.com)").querySelector("a"),
    "xss: protocol-relative //host link rejected",
  );
  ok(
    !render("[x](/\\\\evil.com)").querySelector("a"),
    "xss: /\\host link rejected",
  );
  ok(
    !render("[x](vbscript:msgbox)").querySelector("a"),
    "xss: vbscript: link rejected",
  );
}
{
  const a = render("[ok](https://example.com/p)").querySelector("a");
  ok(
    a?.getAttribute("href") === "https://example.com/p",
    "safe https link → <a href>",
  );
  ok(
    a?.target === "_blank" && a?.rel === "noopener noreferrer",
    "safe link hardened: target=_blank rel=noopener noreferrer",
  );
  ok(!!render("[m](mailto:a@b.com)").querySelector("a"), "mailto: allowed");
  ok(
    !!render("[r](/local/path)").querySelector("a"),
    "same-origin /path allowed",
  );
}

// ============================ pure AST (no DOM) =============================
{
  const ast = parseMarkdown("# H\n\ntext **b**");
  ok(ast[0].type === "heading" && ast[0].level === 1, "AST: heading node");
  ok(ast[1].type === "paragraph", "AST: paragraph node");
  const strong = ast[1].children.find((n) => n.type === "strong");
  ok(!!strong, "AST: strong inline node");
}

// ============================ <puredashboard-markdown> component ===================
{
  ok(
    !!customElements.get("puredashboard-markdown"),
    "puredashboard-markdown is defined",
  );
  const el = document.createElement("puredashboard-markdown");
  el.value = "# Hi\n\nsome **bold** and `code`";
  document.body.appendChild(el); // connectedCallback → render
  ok(
    el.querySelector("h1")?.textContent === "Hi",
    "component renders heading from .value",
  );
  ok(
    el.querySelector("strong")?.textContent === "bold",
    "component renders inline bold",
  );
  ok(
    el.querySelector("code")?.textContent === "code",
    "component renders inline code",
  );
  // re-render on value change (coalesced to next frame → await)
  el.value = "## Changed";
  await tick();
  ok(
    el.querySelector("h2")?.textContent === "Changed" &&
      !el.querySelector("h1"),
    "re-renders when .value changes",
  );
  // XSS safety carries into the component: a hostile link scheme stays inert text
  el.value = "[x](javascript:alert(1))";
  await tick();
  ok(
    !el.querySelector("a"),
    "component keeps md XSS-safety (javascript: link → not an <a>)",
  );
}

// ============ moving the element must not destroy the markdown it was given =========
// Re-parenting is a remove + an insert, so connectedCallback runs AGAIN — on a keyed
// repeat() reorder, a drag-drop, or just wrapping the element in a new parent. On that
// second run the children are our own rendered output, not the source. Re-reading them
// fed the render back in as markdown and the source was gone for good.
{
  const a = document.createElement("div"),
    b = document.createElement("div");
  document.body.append(a, b);

  // source given as CHILDREN — the case that used to corrupt
  const inline = document.createElement("puredashboard-markdown");
  inline.textContent = "# Heading\n\nParagraph.";
  a.append(inline);
  await tick();
  // `first` is only a before/after baseline below — assert the FIRST render semantically,
  // so a renderer change that alters serialisation without altering behaviour stays green.
  const first = inline.innerHTML;
  ok(
    inline.querySelector("h1")?.textContent === "Heading" &&
      inline.querySelector("p")?.textContent === "Paragraph.",
    "inline markdown renders on first connect: " + first,
  );
  b.append(inline); // MOVE
  await tick();
  ok(
    inline.innerHTML === first,
    "inline markdown survives a move (was: heading lost, blocks welded) — got " +
      inline.innerHTML,
  );
  a.append(inline); // and again, since the old bug was cumulative
  await tick();
  ok(inline.innerHTML === first, "inline markdown survives a second move");
  ok(
    inline.value === "# Heading\n\nParagraph.",
    "the adopted source itself is still the markdown, not the rendered text",
  );

  // source given as .value — must be unaffected either way
  const prop = document.createElement("puredashboard-markdown");
  prop.value = "# Heading\n\nParagraph.";
  a.append(prop);
  await tick();
  const propFirst = prop.innerHTML;
  b.append(prop);
  await tick();
  ok(prop.innerHTML === propFirst, ".value-sourced markdown survives a move");

  // an element connected EMPTY must still accept children as its source later
  const late = document.createElement("puredashboard-markdown");
  a.append(late);
  await tick();
  late.remove();
  late.textContent = "# Later";
  b.append(late);
  await tick();
  ok(
    late.querySelector("h1")?.textContent === "Later",
    "connecting empty does not latch: children given later are still adopted",
  );

  // The other side of adopting once, and the behaviour change worth knowing about:
  // hand-replacing the children after the source has been adopted does NOT change the
  // content. It cannot — after the first render the children are the output, so honouring
  // them is exactly the bug above. `.value` is the way to change the source after mount.
  const after = document.createElement("puredashboard-markdown");
  after.textContent = "# One";
  a.append(after);
  await tick();
  after.textContent = "# Two"; // author overwrites the rendered output by hand
  b.append(after); // …and a move gives connectedCallback its chance to re-read
  await tick();
  ok(
    after.value === "# One",
    "children replaced after adoption are not re-read as the source — got " + after.value,
  );
  // A move is not a source change, so it no longer repaints — the author's markup is still
  // there. That is the same rule as the no-move case below, which is the point: nothing
  // except a render replaces the children, and a move is not a render.
  ok(
    after.innerHTML === "# Two",
    "…and a move does not repaint over it either — got " + after.innerHTML,
  );
  after.value = "# Two"; // the documented way to change it
  await tick();
  ok(
    after.querySelector("h1")?.textContent === "Two",
    "setting .value after adoption does change the content",
  );

  // What hand-replacing the children actually does, since the JSDoc has to state it
  // exactly: it does NOT change the source, but it DOES stay on screen — nothing polls the
  // children, so the author's markup survives until something triggers a render, and only
  // then is it replaced by the adopted source.
  const held = document.createElement("puredashboard-markdown");
  held.textContent = "# One";
  a.append(held);
  await tick();
  held.textContent = "# Two"; // author overwrites the rendered output
  await tick();
  ok(
    held.innerHTML === "# Two",
    "hand-replaced children stay on screen while nothing re-renders — got " + held.innerHTML,
  );
  ok(held.value === "# One", "…while the source is untouched");
  held.value = held.value; // any render at all, even to the same source
  await tick();
  ok(
    held.querySelector("h1")?.textContent === "One",
    "…and the next render puts the adopted source back",
  );
}

// ============ a move is not a source change, so it must not repaint ================
// connectedCallback runs on every re-parent. Painting there unconditionally re-parsed the
// markdown and replaced the whole rendered subtree on every move, for output that was
// byte-identical — so node identity, and anything an app hung on those nodes, was lost for
// nothing. `_dirty` is what separates "has a source" from "has painted that source";
// `_set` cannot, because a `.value` set before the first connect and an already-painted
// element being moved are both `_set === true`.
{
  const a = document.createElement("div"), b = document.createElement("div");
  document.body.append(a, b);
  let renders = 0;
  const el = document.createElement("puredashboard-markdown");
  const paint = el._render.bind(el);
  el._render = (...args) => { renders++; return paint(...args); };

  el.value = "# H\n\npara"; // set BEFORE connect: has a source, has not painted it
  a.append(el);
  await tick();
  ok(renders === 1, "a source set before the first connect is painted on connect");
  const firstChild = el.firstElementChild;

  b.append(el);
  await tick();
  a.append(el);
  await tick();
  ok(renders === 1, "two moves cause no repaint — got " + renders + " renders");
  ok(el.firstElementChild === firstChild, "…and the rendered nodes keep their identity");

  el.remove(); // changed while disconnected: the paint is stale, so reconnect must repaint
  el.value = "# Changed";
  b.append(el);
  await tick();
  ok(renders === 2, "a source changed while disconnected is repainted on reconnect");
  ok(el.querySelector("h1")?.textContent === "Changed", "…with the new source");
}

// ============ first connect normalises whatever it was given =======================
// `_dirty` starts true precisely so this holds. Starting it false looks equivalent and is
// not: a whitespace-only element never takes the adopt branch, so it would never be marked
// dirty, never paint, and keep its raw whitespace text node — a silent divergence from
// every other first connect.
{
  const host = document.createElement("div");
  document.body.append(host);

  const ws = document.createElement("puredashboard-markdown");
  ws.textContent = " \n ";
  host.append(ws);
  await tick();
  ok(
    ws.childNodes.length === 0,
    "whitespace-only children are normalised away on first connect — got " +
      ws.childNodes.length + " node(s)",
  );

  const empty = document.createElement("puredashboard-markdown");
  host.append(empty);
  await tick();
  ok(empty.childNodes.length === 0, "an element given nothing connects with no children");

  // and neither of those latched a source, so children given later are still adopted
  empty.remove();
  empty.textContent = "# Later";
  host.append(empty);
  await tick();
  ok(
    empty.querySelector("h1")?.textContent === "Later",
    "connecting empty leaves the element able to adopt children later",
  );
}

// ============ the `value` ATTRIBUTE path ==========================================
// Declarative form from the JSDoc example. It had no coverage at all: deleting
// attributeChangedCallback left every suite green, and it now interacts with the
// adopt-once latch, so pin it here.
{
  const host = document.createElement("div");
  document.body.append(host);

  const attr = document.createElement("puredashboard-markdown");
  attr.setAttribute("value", "# From attribute");
  host.append(attr);
  await tick();
  ok(
    attr.querySelector("h1")?.textContent === "From attribute",
    "value attribute renders on connect",
  );
  attr.setAttribute("value", "## Changed by attribute");
  await tick();
  ok(
    attr.querySelector("h2")?.textContent === "Changed by attribute" &&
      !attr.querySelector("h1"),
    "changing the value attribute re-renders",
  );

  // the attribute establishes a source, so inline children must never be adopted over it
  const both = document.createElement("puredashboard-markdown");
  both.setAttribute("value", "# Attribute wins");
  both.append(document.createTextNode("# Inline loses"));
  host.append(both);
  await tick();
  ok(
    both.querySelector("h1")?.textContent === "Attribute wins",
    "an element carrying a value attribute does not adopt its children",
  );

  // and the attribute still works as the escape hatch after inline adoption
  const late = document.createElement("puredashboard-markdown");
  late.textContent = "# Inline";
  host.append(late);
  await tick();
  late.setAttribute("value", "# Via attribute");
  await tick();
  ok(
    late.querySelector("h1")?.textContent === "Via attribute",
    "the value attribute overrides an already-adopted inline source",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
