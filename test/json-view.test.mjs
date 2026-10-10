// Tests for json-view.js (<puredashboard-json-view>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and toggling.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;
// jsdom has no matchMedia; default to a stub that reports "light OS". Individual
// tests can replace w.matchMedia before mounting to simulate a dark OS.
w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardJsonView } = await import("../src/json-view.js");
void PuredashboardJsonView;

const DATA = { name: "web-01", up: true, ports: [80, 443], meta: null, count: 3 };

// ---- renders a tree with typed leaf values ----
{
  const el = mount("puredashboard-json-view");
  el.data = DATA;
  await tick();
  const strings = el.querySelectorAll(".puredashboard-json-view__value--string");
  const numbers = el.querySelectorAll(".puredashboard-json-view__value--number");
  const bools = el.querySelectorAll(".puredashboard-json-view__value--boolean");
  const nulls = el.querySelectorAll(".puredashboard-json-view__value--null");
  ok(strings.length === 1 && strings[0].textContent === '"web-01"', "string value is JSON-quoted");
  ok(numbers.length === 3, "three number leaves (80, 443, count)");
  ok(bools.length === 1 && bools[0].textContent === "true", "boolean leaf renders true");
  ok(nulls.length === 1 && nulls[0].textContent === "null", "null leaf renders null");
}

// ---- object/array headers are native buttons, open by default, and collapse ----
{
  const el = mount("puredashboard-json-view");
  el.data = DATA;
  await tick();
  const toggles = el.querySelectorAll(".puredashboard-json-view__toggle");
  // root object + the ports array = 2 toggles
  ok(toggles.length === 2, "one toggle per object/array (root + ports)");
  ok(toggles[0].tagName === "BUTTON", "toggle is a native <button>");
  ok(toggles[0].getAttribute("aria-expanded") === "true", "expanded by default");
  const before = el.querySelectorAll(".puredashboard-json-view__value--number").length;
  toggles[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));  // collapse ports
  await tick();
  const portsToggle = [...el.querySelectorAll(".puredashboard-json-view__toggle")].find((t) => t.textContent.includes("items"));
  ok(portsToggle && portsToggle.getAttribute("aria-expanded") === "false", "collapsed toggle is aria-expanded=false");
  ok(portsToggle.textContent.includes("2 items"), "collapsed array shows an item-count summary");
  const after = el.querySelectorAll(".puredashboard-json-view__value--number").length;
  ok(after === before - 2, "collapsing ports removes its two number leaves from the DOM");
}

// ---- copy button: present per leaf, toggleable, reads textContent lazily ----
{
  const el = mount("puredashboard-json-view");
  el.data = { token: "abc" };
  await tick();
  const copy = el.querySelector(".js-puredashboard-json-view__copy");
  ok(!!copy && copy.tagName === "BUTTON", "leaf has a copy button");
  ok(copy.getAttribute("aria-label") === "Copy value", "copy button is labelled");
  // clicking must not throw even with no clipboard available (jsdom) — it warns.
  let threw = false;
  try { copy.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); } catch { threw = true; }
  ok(!threw, "clicking copy does not throw when clipboard is unavailable");
}

// ---- copy text: strings drop surrounding quotes but KEEP escapes (no raw control chars) ----
{
  const el = mount("puredashboard-json-view");
  el.data = { plain: "web-01", multi: "line1\nline2", count: 7, flag: false, nada: null };
  await tick();
  const byKey = (k) => {
    const row = [...el.querySelectorAll(".puredashboard-json-view__row")]
      .find((r) => r.querySelector(".puredashboard-json-view__key")?.textContent === `"${k}"`);
    return el._valueToCopy(row.querySelector(".js-puredashboard-json-view__value"));
  };
  ok(byKey("plain") === "web-01", "string copy drops the surrounding quotes");
  const multi = byKey("multi");
  ok(multi === "line1\\nline2", "newline stays ESCAPED (backslash-n), not a real newline");
  ok(!multi.includes("\n"), "no real newline char reaches the clipboard (paste-injection safe)");
  ok(byKey("count") === "7", "number copies verbatim");
  ok(byKey("flag") === "false", "boolean copies verbatim");
  ok(byKey("nada") === "null", "null copies verbatim");
}

// ---- copyable=false hides the copy buttons ----
{
  const el = mount("puredashboard-json-view");
  el.copyable = false;
  el.data = { a: 1 };
  await tick();
  ok(el.querySelectorAll(".js-puredashboard-json-view__copy").length === 0, "copyable=false renders no copy buttons");
}

// ---- theme: explicit pin reflects to data-mode; auto follows the (stubbed) OS ----
{
  const el = mount("puredashboard-json-view");
  el.data = { a: 1 };
  el.theme = "light";
  await tick();
  ok(el.dataset.mode === "light", "theme=light reflects data-mode=light");
  el.theme = "dark";
  await tick();
  ok(el.dataset.mode === "dark", "theme=dark reflects data-mode=dark");
}
{
  // simulate a dark OS via matchMedia before mount; theme=auto should resolve dark
  w.matchMedia = (q) => ({ matches: /dark/.test(q), addEventListener() {}, removeEventListener() {} });
  const el = mount("puredashboard-json-view");
  el.data = { a: 1 };   // theme defaults to auto
  await tick();
  ok(el.dataset.mode === "dark", "theme=auto follows a dark OS preference");
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}

// ---- themes prop applies a per-mode palette as inline custom properties ----
{
  const el = mount("puredashboard-json-view");
  el.data = { a: 1 };
  el.theme = "dark";
  el.themes = { dark: { string: "#123456" }, light: { string: "#abcdef" } };
  await tick();
  ok(el.style.getPropertyValue("--pd-json-view-string") === "#123456", "dark palette override applied inline");
  el.theme = "light";
  await tick();
  ok(el.style.getPropertyValue("--pd-json-view-string") === "#abcdef", "switching mode swaps the inline palette");
}

// ---- built-in named palettes + custom data-driven mode ----
{
  ok(PuredashboardJsonView.BUILT_IN_THEMES.length === 10, "ships exactly 10 built-in palettes");
  ok(PuredashboardJsonView.BUILT_IN_THEMES.includes("github-dark") && PuredashboardJsonView.BUILT_IN_THEMES.includes("dracula"), "built-ins include github-dark and dracula");
  const el = mount("puredashboard-json-view");
  el.data = { a: 1 };
  el.theme = "dracula";                 // a built-in name pins straight through
  await tick();
  ok(el.dataset.mode === "dracula", "a built-in theme name pins data-mode directly");
  // a fully custom mode name is valid too — colours come from themes[name]
  el.theme = "brand";
  el.themes = { brand: { string: "#ff0088", bg: "#101014" } };
  await tick();
  ok(el.dataset.mode === "brand", "a custom mode name is accepted and reflected");
  ok(el.style.getPropertyValue("--pd-json-view-string") === "#ff0088", "custom mode palette applied inline");
  ok(el.style.getPropertyValue("--pd-json-view-bg") === "#101014", "custom mode bg applied inline");
}

// ---- labels override (summary strings) ----
{
  const el = mount("puredashboard-json-view");
  el.data = { list: [1, 2] };
  el.labels = { items: (n) => `${n} phần tử` };
  await tick();
  const t = [...el.querySelectorAll(".puredashboard-json-view__toggle")].find((x) => x.dataset.path !== "r");
  t.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));  // collapse the array
  await tick();
  const collapsed = [...el.querySelectorAll(".puredashboard-json-view__toggle")].find((x) => x.getAttribute("aria-expanded") === "false");
  ok(collapsed && collapsed.textContent.includes("2 phần tử"), "labels.items overrides the summary");
}

// ---- level: initial expand depth (user can still toggle) ----
{
  const LVL = { a: 1, nest: { b: 2, deep: { c: 3 } }, arr: [10, 20] };
  const byPath = (el, p) => el.querySelector(`.puredashboard-json-view__toggle[data-path="${p}"]`);

  // default → everything open
  {
    const el = mount("puredashboard-json-view");
    el.data = LVL;
    await tick();
    const all = [...el.querySelectorAll(".puredashboard-json-view__toggle")];
    ok(all.length === 4 && all.every((t) => t.getAttribute("aria-expanded") === "true"), "default expands every node");
  }
  // level 0 → all collapsed, including the root
  {
    const el = mount("puredashboard-json-view");
    el.level = 0;
    el.data = LVL;
    await tick();
    const toggles = [...el.querySelectorAll(".puredashboard-json-view__toggle")];
    ok(toggles.length === 1, "level 0 collapses the root (only the root toggle renders)");
    ok(toggles[0].getAttribute("aria-expanded") === "false", "level 0: root collapsed");
  }
  // level 1 → root open, its children collapsed; user can still expand, and the rule persists
  {
    const el = mount("puredashboard-json-view");
    el.level = 1;
    el.data = LVL;
    await tick();
    ok(byPath(el, "r").getAttribute("aria-expanded") === "true", "level 1: root open");
    ok(byPath(el, "r.1").getAttribute("aria-expanded") === "false", "level 1: object child collapsed");
    ok(byPath(el, "r.2").getAttribute("aria-expanded") === "false", "level 1: array child collapsed");
    ok(!byPath(el, "r.1.1"), "level 1: deep node not rendered (parent collapsed)");
    byPath(el, "r.1").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    await tick();
    ok(byPath(el, "r.1").getAttribute("aria-expanded") === "true", "user can expand a level-collapsed node");
    ok(byPath(el, "r.1.1") && byPath(el, "r.1.1").getAttribute("aria-expanded") === "false", "revealed deeper node keeps the level rule (collapsed)");
  }
  // level 2 → depth < 2 open
  {
    const el = mount("puredashboard-json-view");
    el.level = 2;
    el.data = LVL;
    await tick();
    ok(byPath(el, "r").getAttribute("aria-expanded") === "true" && byPath(el, "r.1").getAttribute("aria-expanded") === "true", "level 2: root and its children open");
    ok(byPath(el, "r.1.1").getAttribute("aria-expanded") === "false", "level 2: depth-2 node collapsed");
  }
}

// ---- data as a JSON string is parsed; invalid JSON falls back to raw ----
{
  const el = mount("puredashboard-json-view");
  el.data = '{"ok": 1}';
  await tick();
  ok(el.querySelector(".puredashboard-json-view__value--number")?.textContent === "1", "JSON string is parsed and rendered");
  el.data = "not json {";
  await tick();
  const raw = el.querySelector(".puredashboard-json-view__raw");
  ok(raw && raw.textContent === "not json {", "invalid JSON falls back to raw text");
}

// ---- maxDepth: deeper objects/arrays render as one placeholder row; deep input cannot overflow the stack ----
{
  const deep = (n) => { let v = 1; for (let i = 0; i < n; i++) v = [v]; return v; };
  const el = mount("puredashboard-json-view");
  let err = null;
  try { el.data = deep(5000); await tick(); } catch (e) { err = e; }
  ok(err === null, "5000-deep array renders without throwing (no RangeError)");
  const caps = el.querySelectorAll(".puredashboard-json-view__row--depth-cap");
  ok(caps.length === 1, "one depth-cap placeholder row at the default cap");
  ok(el.querySelectorAll(".js-puredashboard-json-view__toggle").length === 64, "default cap 64: nodes at depth 0..63 stay toggles");
  ok(caps[0] && caps[0].textContent.includes("… 1 item") && caps[0].textContent.includes("[") && caps[0].textContent.includes("]"), "placeholder shows braces, ellipsis and the item count");

  const s = mount("puredashboard-json-view");
  s.setAttribute("max-depth", "1");
  s.data = { a: { b: 1, c: 2 }, d: [1], e: 3 };
  await tick();
  ok(s.maxDepth === 1, "max-depth attribute reflects to maxDepth (number)");
  const sc = [...s.querySelectorAll(".puredashboard-json-view__row--depth-cap")];
  ok(sc.length === 2 && sc[0].textContent.includes("2 keys") && sc[1].textContent.includes("1 item"), "max-depth=1: each child object/array is a placeholder with its count");
  ok(s.querySelectorAll(".puredashboard-json-view__value--number").length === 1, "values inside capped nodes are not rendered");

  const lv = mount("puredashboard-json-view");
  lv.level = 1;
  err = null;
  try { lv.data = deep(5000); await tick(); } catch (e) { err = e; }
  ok(err === null && lv.collapsed.size === 63, "level seed walk stops at the cap too (no RangeError; depths 1..63 seeded collapsed)");

  const plain = mount("puredashboard-json-view");
  plain.data = DATA;
  await tick();
  ok(!plain.querySelector(".puredashboard-json-view__row--depth-cap"), "data shallower than maxDepth renders without placeholders");
  const neg = mount("puredashboard-json-view");
  neg.maxDepth = -3;
  neg.data = deep(70);
  await tick();
  ok(neg.querySelectorAll(".js-puredashboard-json-view__toggle").length === 64 && neg.querySelectorAll(".puredashboard-json-view__row--depth-cap").length === 1, "a negative maxDepth falls back to the default 64");
}

console.log(`\njson-view: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
