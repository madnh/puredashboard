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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
