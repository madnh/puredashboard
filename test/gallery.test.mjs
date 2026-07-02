// Tests for gallery.js (<puredashboard-gallery>).
// Run in isolation via Docker (no host install): `make -C test`.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));

const { PuredashboardGallery } = await import("../src/gallery.js");
void PuredashboardGallery;

const STORIES = [
  { tag: "puredashboard-a", title: "One/A", stories: [
    { name: "Basic", render: () => Object.assign(document.createElement("div"), { className: "story-a", textContent: "A" }) },
    { name: "Alt", render: () => document.createElement("span") },
  ] },
  { tag: "puredashboard-b", title: "Two/B", stories: [
    { name: "Only", render: () => Object.assign(document.createElement("div"), { className: "story-b" }) },
  ] },
];

const mount = () => { const g = document.createElement("puredashboard-gallery"); g.stories = STORIES; document.body.appendChild(g); return g; };

// ---- sidebar + default canvas ----
{
  const g = mount();
  await tick();
  ok(g.querySelectorAll(".puredashboard-gallery__item").length === 2, "one sidebar item per component");
  ok(g.querySelectorAll(".puredashboard-gallery__group").length === 2, "grouped by title prefix (One, Two)");
  ok(g.querySelectorAll(".puredashboard-gallery__story").length === 2, "first component's stories render (A has 2)");
  ok(!!g.querySelector(".story-a"), "story render() output is mounted live");
  const first = g.querySelector(".puredashboard-gallery__item");
  ok(first.getAttribute("aria-current") === "true", "first component is current by default");
}

// ---- selecting a component ----
{
  const g = mount();
  await tick();
  let sel = null;
  g.addEventListener("select", (e) => { sel = e.detail.tag; });
  const items = g.querySelectorAll(".puredashboard-gallery__item");
  items[1].click();
  await tick();
  ok(sel === "puredashboard-b", "clicking an item emits select with its tag");
  ok(g.querySelectorAll(".puredashboard-gallery__story").length === 1, "canvas shows the selected component's stories (B has 1)");
  ok(!!g.querySelector(".story-b"), "B's story is mounted");
}

// ---- overview / contact sheet ----
{
  const g = document.createElement("puredashboard-gallery");
  g.stories = STORIES; g.overview = true; document.body.appendChild(g);
  await tick();
  ok(g.querySelectorAll(".puredashboard-gallery__cell").length === 2, "overview renders one cell per component");
  ok(g.querySelectorAll(".puredashboard-gallery__cell .story-a, .puredashboard-gallery__cell .story-b").length === 2, "each cell mounts the component's first story");
}

// ---- only mode: single story, no chrome ----
{
  const g = document.createElement("puredashboard-gallery");
  g.stories = STORIES; g.selected = "puredashboard-a"; g.story = "Alt"; g.only = true;
  document.body.appendChild(g);
  await tick();
  ok(!!g.querySelector(".puredashboard-gallery__only"), "only mode renders the full-bleed wrapper");
  ok(!g.querySelector(".puredashboard-gallery__side"), "only mode hides the sidebar chrome");
  ok(g.querySelectorAll(".puredashboard-gallery__story").length === 1, "only mode shows the single named story");
}

// ---- labels override ----
{
  const g = document.createElement("puredashboard-gallery");
  g.stories = []; g.labels = { empty: "Nothing here" }; document.body.appendChild(g);
  await tick();
  ok(g.querySelector(".puredashboard-gallery__empty")?.textContent === "Nothing here", "labels override the empty string");
}

console.log(`gallery.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
