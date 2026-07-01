// Tests for tree.js (<puredashboard-tree>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and keyboard logic.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

const { PuredashboardTree } = await import("../src/tree.js");
void PuredashboardTree;

// Sample tree used by most cases:
//  src (parent)
//    app.js
//    lib (parent)
//      util.js
//  readme.md
const sample = () => ([
  { id: "src", label: "src", children: [
    { id: "app", label: "app.js" },
    { id: "lib", label: "lib", children: [{ id: "util", label: "util.js" }] },
  ] },
  { id: "readme", label: "readme.md" },
]);

const items = (el) => [...el.querySelectorAll(".js-puredashboard-tree__item")];
const byId = (el, id) => el.querySelector(`.js-puredashboard-tree__item[data-id="${id}"]`);

// ---- roles + structure ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src", "lib"];
  await tick();
  const tree = el.querySelector('[role="tree"]');
  ok(tree, "container has role=tree");
  ok(tree.getAttribute("aria-label") === "Tree", "default aria-label applied");
  ok(items(el).every((n) => n.getAttribute("role") === "treeitem"), "every node has role=treeitem");
  ok(el.querySelectorAll('[role="group"]').length === 2, "each expanded parent has a role=group child list");
}

// ---- aria-level / setsize / posinset ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src", "lib"];
  await tick();
  const src = byId(el, "src"), app = byId(el, "app"), util = byId(el, "util"), readme = byId(el, "readme");
  ok(src.getAttribute("aria-level") === "1" && readme.getAttribute("aria-level") === "1", "root nodes are aria-level 1");
  ok(app.getAttribute("aria-level") === "2", "child is aria-level 2");
  ok(util.getAttribute("aria-level") === "3", "grandchild is aria-level 3");
  ok(src.getAttribute("aria-setsize") === "2" && src.getAttribute("aria-posinset") === "1", "root setsize/posinset");
  ok(readme.getAttribute("aria-posinset") === "2", "second root has posinset 2");
  ok(util.getAttribute("aria-setsize") === "1" && util.getAttribute("aria-posinset") === "1", "only-child setsize/posinset");
}

// ---- aria-expanded only on parents ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src"];
  await tick();
  ok(byId(el, "src").getAttribute("aria-expanded") === "true", "expanded parent aria-expanded=true");
  ok(byId(el, "lib").getAttribute("aria-expanded") === "false", "collapsed parent aria-expanded=false");
  ok(!byId(el, "app").hasAttribute("aria-expanded"), "leaf has no aria-expanded");
}

// ---- roving tabindex: exactly one treeitem is tabbable ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src"];
  await tick();
  const tabbables = items(el).filter((n) => n.getAttribute("tabindex") === "0");
  ok(tabbables.length === 1, "exactly one treeitem has tabindex=0");
  ok(tabbables[0].dataset.id === "src", "with no selection, first visible node is tabbable");
  el.selectedKey = "app";
  await tick();
  const t2 = items(el).filter((n) => n.getAttribute("tabindex") === "0");
  ok(t2.length === 1 && t2[0].dataset.id === "app", "selected visible node owns the roving tabindex");
}

// ---- selection + select event via Enter/Space ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src"];
  await tick();
  let detail = null, count = 0;
  el.addEventListener("select", (e) => { count++; detail = e.detail; });
  key(byId(el, "app"), "Enter");
  await tick();
  ok(el.selectedKey === "app", "Enter selects the focused node");
  ok(count === 1 && detail.key === "app" && detail.node.label === "app.js", "select event fires with { key, node }");
  ok(byId(el, "app").getAttribute("aria-selected") === "true", "selected node gets aria-selected=true");
  key(byId(el, "readme"), " ");
  await tick();
  ok(el.selectedKey === "readme" && count === 2, "Space selects too and re-emits");
}

// ---- click selects; twisty click toggles ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = [];
  await tick();
  let toggles = 0, lastToggle = null;
  el.addEventListener("toggle", (e) => { toggles++; lastToggle = e.detail; });
  byId(el, "src").querySelector(".js-puredashboard-tree__twisty").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(byId(el, "src").getAttribute("aria-expanded") === "true", "twisty click expands");
  ok(toggles === 1 && lastToggle.key === "src" && lastToggle.expanded === true, "toggle event { key, expanded:true } on expand");
  byId(el, "src").querySelector(".js-puredashboard-tree__twisty").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(lastToggle.expanded === false, "toggle event expanded:false on collapse");
  ok(!byId(el, "src") || byId(el, "src").getAttribute("aria-expanded") === "false", "twisty click collapses");
}

// ---- ArrowRight: expand a collapsed parent, then move to first child ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = [];
  await tick();
  let toggles = 0;
  el.addEventListener("toggle", () => { toggles++; });
  key(byId(el, "src"), "ArrowRight");   // collapsed parent → expand
  await tick();
  ok(byId(el, "src").getAttribute("aria-expanded") === "true", "ArrowRight expands a collapsed parent");
  ok(toggles === 1, "expand via ArrowRight emitted toggle");
  key(byId(el, "src"), "ArrowRight");   // already expanded → move to first child
  await tick();
  ok(document.activeElement === byId(el, "app"), "ArrowRight on an open parent moves to its first child");
}

// ---- ArrowLeft: collapse an expanded parent, then move to parent ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src", "lib"];
  await tick();
  key(byId(el, "app"), "ArrowLeft");    // leaf (parent still open) → move to its parent
  await tick();
  ok(document.activeElement === byId(el, "src"), "ArrowLeft on a child moves focus to its parent");
  key(byId(el, "src"), "ArrowLeft");    // open parent → collapse
  await tick();
  ok(byId(el, "src").getAttribute("aria-expanded") === "false", "ArrowLeft collapses an expanded parent");
}

// ---- ArrowDown/Up over visible nodes, skipping collapsed subtrees ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src"];   // src open (app, lib visible) but lib collapsed (util hidden)
  await tick();
  key(byId(el, "src"), "ArrowDown");
  await tick();
  ok(document.activeElement === byId(el, "app"), "ArrowDown goes to next visible node");
  key(byId(el, "app"), "ArrowDown");
  await tick();
  ok(document.activeElement === byId(el, "lib"), "ArrowDown reaches lib");
  key(byId(el, "lib"), "ArrowDown");    // util is inside collapsed lib → skipped
  await tick();
  ok(document.activeElement === byId(el, "readme"), "ArrowDown skips a collapsed subtree (util hidden)");
  key(byId(el, "readme"), "ArrowUp");
  await tick();
  ok(document.activeElement === byId(el, "lib"), "ArrowUp moves back up over visible nodes");
}

// ---- Home / End over visible nodes ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = ["src"];
  await tick();
  key(byId(el, "app"), "End");
  await tick();
  ok(document.activeElement === byId(el, "readme"), "End focuses the last visible node");
  key(byId(el, "readme"), "Home");
  await tick();
  ok(document.activeElement === byId(el, "src"), "Home focuses the first visible node");
}

// ---- expandedKeys accepts a Set ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.expandedKeys = new Set(["src"]);
  await tick();
  ok(byId(el, "src").getAttribute("aria-expanded") === "true", "expandedKeys accepts a Set");
  ok(byId(el, "util") === null, "collapsed lib keeps util out of the DOM");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-tree");
  el.nodes = sample();
  el.labels = { ariaLabel: "Cây" };
  await tick();
  ok(el.querySelector('[role="tree"]').getAttribute("aria-label") === "Cây", "labels override the default aria-label");
  const el2 = mount("puredashboard-tree");
  el2.nodes = sample();
  await tick();
  ok(el2._label("ariaLabel") === "Tree", "default label kept when not overridden");
}

// ---- label text rendered exactly (one line in the template) ----
{
  const el = mount("puredashboard-tree");
  el.nodes = [{ id: "a", label: "Alpha" }];
  await tick();
  ok(byId(el, "a").querySelector(".puredashboard-tree__label").textContent === "Alpha", "node label rendered exactly");
}

console.log(`tree.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
