// Cross-cutting a11y test: THE ACCESSIBLE NAME REACHES THE RIGHT ELEMENT.
//
// A custom-element host carries no role, so an `aria-label` sitting on it is dropped by
// assistive tech unless the component either (a) puts a role on the host itself, or
// (b) mirrors the name onto the inner element it owns (the native <input>, the
// role="tablist" div, …). And a component's own LABELS default must never overwrite a
// name the author set — that's the bug this suite pins down (see button.js `_sync`).
//
// Real accessible-name computation is a browser job; jsdom only gives us the DOM. So
// this suite asserts the wiring (which element ends up carrying aria-label /
// aria-labelledby); test/a11y-names-harness.html verifies the computed names in Chrome.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame"]) global[k] = w[k];

// Safety net: an element that writes an attribute it observes can loop forever (writing
// an observed attribute re-enters attributeChangedCallback even with an unchanged value).
// jsdom reports the resulting error on window — fail the suite instead of scrolling past.
w.addEventListener("error", (e) => { fail++; console.log("FAIL: uncaught error —", (e.error && e.error.message) || e.message); });

const MODULES = ["input", "textarea", "number", "select", "combobox", "checkbox", "switch", "slider", "date", "time", "color", "upload",
  "rate", "progress", "tabs", "breadcrumb", "pagination", "nav", "splitter", "steps", "timeline", "list", "alert", "table", "collapse",
  "badge", "tree", "segmented", "radio-group", "menubar", "copy", "spinner", "skeleton", "avatar", "divider", "button", "card"];
for (const m of MODULES) await import(`../src/${m}.js`);

const PROPS = {
  select: { options: ["a", "b"] }, combobox: { options: ["a", "b"] }, "radio-group": { options: ["a", "b"] },
  segmented: { options: ["a", "b"] }, tabs: { tabs: [{ id: "t1", label: "One" }] },
  breadcrumb: { items: [{ label: "Home", href: "#/" }, { label: "Now" }] },
  pagination: { page: 1, total: 50, pageSize: 10 }, steps: { steps: [{ label: "A" }, { label: "B" }] },
  nav: { items: [{ label: "Home", href: "#/" }] }, tree: { nodes: [{ key: "a", label: "A" }] },
  collapse: { items: [{ key: "a", header: "H", content: "C" }] },
  table: { columns: [{ key: "n", label: "N" }], rows: [{ n: 1 }] },
  menubar: { menus: [{ label: "File", items: [{ label: "New", value: "n" }] }] },
  list: { items: [{ title: "x" }] }, timeline: { items: [{ content: "x" }] },
  progress: { value: 40 }, rate: { value: 3 }, avatar: { name: "Ann" }, badge: { count: 3 },
};

async function mount(mod, { name = null, kids = 0 } = {}) {
  document.body.innerHTML = "";
  const el = document.createElement(`puredashboard-${mod}`);
  if (name != null) el.setAttribute("aria-label", name);
  Object.assign(el, PROPS[mod] || {});
  for (let i = 0; i < kids; i++) el.append(document.createElement("div"));
  document.body.append(el);
  await tick(); await tick();
  return el;
}

// ============ 1. the name lands on the element that actually carries the semantics ====
// [module, selector for the element that must end up named, extra mount options]
const FORWARDS = [
  ["input", "input"], ["textarea", "textarea"], ["number", ".js-puredashboard-number__field"],
  ["select", "select"], ["combobox", 'input[role="combobox"]'], ["checkbox", 'input[type="checkbox"]'],
  ["switch", 'input[role="switch"]'], ["slider", 'input[type="range"]'], ["date", "input"], ["time", "input"],
  ["color", "input"], ["upload", 'input[type="file"]'],
  ["rate", '[role="slider"]'], ["progress", '[role="progressbar"]'], ["tabs", '[role="tablist"]'],
  ["breadcrumb", "nav"], ["pagination", "nav"], ["nav", "nav"], ["splitter", '[role="separator"]', { kids: 2 }],
  ["steps", 'ol[role="list"]'], ["timeline", 'ol[role="list"]'], ["list", 'ul[role="list"]'],
  ["alert", '[role="status"],[role="alert"]'], ["table", "table"], ["collapse", '[role="presentation"]'],
  ["badge", ".js-puredashboard-badge__indicator"],
  // these already did the right thing — pinned so they stay that way
  ["tree", '[role="tree"]'], ["segmented", '[role="radiogroup"]'], ["radio-group", '[role="radiogroup"]'],
  ["menubar", '[role="menubar"]'],
  ["copy", "button"],
];
for (const [mod, sel, opts] of FORWARDS) {
  const el = await mount(mod, { name: "AUTHOR NAME", ...(opts || {}) });
  const target = el.querySelector(sel);
  ok(target && target.getAttribute("aria-label") === "AUTHOR NAME",
    `${mod}: an aria-label on the host reaches ${sel} (the host has no role of its own)`);
}

// ============ 2. hosts that DO carry a role keep the author's name themselves =========
// (these used to overwrite it with their LABELS default on every render)
for (const mod of ["spinner", "skeleton", "avatar", "divider", "card"]) {
  const el = await mount(mod, { name: "AUTHOR NAME" });
  ok(el.getAttribute("aria-label") === "AUTHOR NAME", `${mod}: the author's aria-label survives (host carries the role)`);
  ok(el.hasAttribute("role"), `${mod}: host still exposes its role`);
}
{
  const el = await mount("button", { name: "More actions" });
  ok(el.querySelector(".js-puredashboard-button__el").getAttribute("aria-label") === "More actions",
    "button: aria-label reaches the inner <button> (icon-only trigger)");
}

// ============ 3. the component default still applies when nothing is authored ========
const DEFAULTS = [
  ["color", "input", "Choose a colour"], ["upload", 'input[type="file"]', "Choose files"],
  ["rate", '[role="slider"]', "Rating"], ["tabs", '[role="tablist"]', "Tabs"],
  ["progress", '[role="progressbar"]', "40%"], ["collapse", '[role="presentation"]', "Sections"],
  ["badge", ".js-puredashboard-badge__indicator", "3 notifications"],
  // a copy button is icon-only by default, so unlike a bare icon button it names itself
  ["copy", "button", "Copy"],
];
for (const [mod, sel, expected] of DEFAULTS) {
  const el = await mount(mod);
  const target = el.querySelector(sel);
  ok(target && target.getAttribute("aria-label") === expected, `${mod}: keeps its default name "${expected}" when unnamed`);
}
for (const [mod, expected] of [["spinner", "Loading"], ["skeleton", "Loading…"], ["avatar", "Ann"], ["divider", "Separator"]]) {
  const el = await mount(mod);
  ok(el.getAttribute("aria-label") === expected, `${mod}: keeps its default name "${expected}" when unnamed`);
}
// controls with no default stay unnamed rather than inventing one (an empty aria-label
// is ignored by the name computation, so a <label> or visible text still wins)
for (const [mod, sel] of [["input", "input"], ["select", "select"], ["checkbox", 'input[type="checkbox"]']]) {
  const el = await mount(mod);
  ok(el.querySelector(sel).getAttribute("aria-label") === "", `${mod}: no author name → empty aria-label (never a made-up one)`);
}

// ============ 4. a name set AFTER mount is honoured, and never clobbered later =======
{
  const el = await mount("input");
  el.setAttribute("aria-label", "Late name");
  await tick();
  ok(el.querySelector("input").getAttribute("aria-label") === "Late name", "input: aria-label set after mount re-syncs to the inner control");
  el.setAttribute("aria-labelledby", "some-id");
  await tick();
  ok(el.querySelector("input").getAttribute("aria-labelledby") === "some-id", "input: aria-labelledby is mirrored too");
}
{
  const el = await mount("skeleton");
  el.setAttribute("aria-label", "Loading the report");
  el.lines = 3;                                  // force a re-render
  await tick(); await tick();
  ok(el.getAttribute("aria-label") === "Loading the report", "skeleton: a later author name is not overwritten by the LABELS default");
}
{
  const el = await mount("spinner");
  el.setAttribute("aria-label", "Reconnecting");
  el.size = "lg";
  await tick(); await tick();
  ok(el.getAttribute("aria-label") === "Reconnecting", "spinner: a later author name is not overwritten");
}
{
  const el = await mount("avatar", { name: "AUTHOR NAME" });
  el.name = "Bob";                               // the `name` prop must not win over aria-label
  await tick(); await tick();
  ok(el.getAttribute("aria-label") === "AUTHOR NAME", "avatar: `name` does not overwrite an author aria-label");
}
{
  const el = await mount("button");
  el.loading = true;
  await tick(); await tick();
  ok(el.getAttribute("aria-label") === "Loading", "button: unnamed + loading → the LABELS fallback names it");
  el.setAttribute("aria-label", "Saving the form");
  el.loading = false;
  await tick(); await tick();
  ok(el.getAttribute("aria-label") === "Saving the form", "button: a name set while loading survives loading ending");
}

// A WRAPPING <label> IS MIRRORED TO THE RIGHT CONTROL — across component types.
//
// Each form-associated component points its inner control at the wrapping <label> with
// aria-labelledby, stamping that label with an id when it has none. Those ids have to be
// unique across the PAGE, and each component is its own module scope: while every file
// minted `pd-label-${++labelId}` from a counter of its own, the first <label> around a
// select and the first around an input were both `pd-label-1`. getElementById returns
// whichever comes first in the DOM, so the second control announced the first one's name
// — and since aria-labelledby outranks aria-label, an author could not override it.
//
// Every pair matters, not just the first, so this mounts one of each on ONE page.
{
  const FORM_MODULES = ["input", "textarea", "number", "select", "combobox", "checkbox",
    "switch", "slider", "date", "time", "color", "upload"];
  document.body.innerHTML = "";
  const mounted = [];
  for (const mod of FORM_MODULES) {
    const label = document.createElement("label");
    label.append(document.createTextNode(`Name of ${mod}`));
    const el = document.createElement(`puredashboard-${mod}`);
    Object.assign(el, PROPS[mod] || {});
    label.append(el);
    document.body.append(label);
    mounted.push([mod, el, label]);
  }
  await tick(); await tick();

  const seen = new Map();   // id → the module that claimed it first
  for (const [mod, el, label] of mounted) {
    const inner = el.querySelector("input, select, textarea");
    if (!inner) continue;                      // component names itself some other way
    const ref = inner.getAttribute("aria-labelledby");
    if (!ref) continue;                        // no wrapping label mirrored: nothing to clash
    // The id must resolve to THIS component's own label, not to one further up the page.
    ok(document.getElementById(ref) === label,
      `${mod}: aria-labelledby resolves to its own wrapping <label>, not another component's`);
    const clash = seen.get(ref);
    ok(clash === undefined, `${mod}: label id ${ref} is not already used by ${clash}`);
    seen.set(ref, mod);
  }
}

// A MINTED LABEL ID NEVER LANDS ON AN ID THE AUTHOR'S PAGE ALREADY USES.
//
// One shared counter fixes the library clashing with itself, but the ids go into the
// AUTHOR's document, where `pd-label-<n>` is not reserved for us. If they already have an
// element on that id, getElementById hands the control THEIR element and it announces
// their text — the same defect, sourced from outside. So mint past what is taken.
//
// The counter has already advanced by the time this runs, so read where it is (mount one
// component, look at the id it minted) and plant the author's element on the id that comes
// next. That keeps the test independent of how many labels the cases above consumed.
{
  document.body.innerHTML = "";
  const first = document.createElement("label");
  first.append(document.createTextNode("Project"));
  first.append(document.createElement("puredashboard-input"));
  document.body.append(first);
  await tick(); await tick();

  const next = Number(first.id.replace("pd-label-", "")) + 1;
  const authorEl = document.createElement("h2");
  authorEl.id = `pd-label-${next}`;              // the author got there first
  authorEl.textContent = "Their own heading";
  document.body.append(authorEl);

  const second = document.createElement("label");
  second.append(document.createTextNode("Agent"));
  second.append(document.createElement("puredashboard-input"));
  document.body.append(second);
  await tick(); await tick();

  ok(second.id !== authorEl.id, `label id skips pd-label-${next}, already taken by the author's page`);
  ok(authorEl.id === `pd-label-${next}` && authorEl.textContent === "Their own heading",
    "the author's element is left alone — we mint past it, we don't restamp it");
  const ref = second.querySelector("input").getAttribute("aria-labelledby");
  ok(document.getElementById(ref) === second,
    "aria-labelledby resolves to the component's own <label>, not the author's element");
}

console.log(`\na11y-names.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
