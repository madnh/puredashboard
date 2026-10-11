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

// ---- viewport stories: an iframe of that size loading this page in only mode ----
{
  const VP = [{ tag: "puredashboard-v", title: "Three/V", stories: [
    { name: "Phone", viewport: { width: 390, height: 640 }, render: () => Object.assign(document.createElement("div"), { className: "story-v" }) },
  ] }];
  const g = document.createElement("puredashboard-gallery");
  g.stories = VP; g.theme = "light"; g.lang = "vi";
  document.body.appendChild(g);
  await tick();
  const frame = g.querySelector("iframe.puredashboard-gallery__frame");
  ok(!!frame, "a story with `viewport` is staged in an iframe");
  ok(!g.querySelector(".story-v"), "… and its render() is NOT mounted inline in the host page");
  ok(frame && frame.style.width === "390px" && frame.style.height === "640px", "the iframe takes the viewport size");
  const q = frame && new URLSearchParams(frame.getAttribute("src").split("?")[1] || "");
  ok(q && q.get("c") === "puredashboard-v" && q.get("s") === "Phone" && q.get("only") === "1", "the iframe loads this page in only mode for that story: " + (frame && frame.getAttribute("src")));
  ok(q && q.get("theme") === "light" && q.get("lang") === "vi", "the frame inherits the host's theme and lang");
  ok(g.querySelector(".puredashboard-gallery__viewport")?.textContent === "390 × 640", "the bar names the viewport size");
  const named = document.createElement("puredashboard-gallery");
  named.stories = [{ tag: "puredashboard-n", title: "Three/N", stories: [{ name: "P", viewport: "phone", render: () => document.createElement("i") }] }];
  document.body.appendChild(named);
  await tick();
  ok(named.querySelector("iframe")?.style.width === "390px", "a story may declare its viewport by preset name");
  ok(g.querySelector(".puredashboard-gallery__stage--viewport"), "the stage carries the --viewport modifier");

  const inner = document.createElement("puredashboard-gallery");
  inner.stories = VP; inner.selected = "puredashboard-v"; inner.story = "Phone"; inner.only = true;
  document.body.appendChild(inner);
  await tick();
  ok(!inner.querySelector("iframe") && !!inner.querySelector(".story-v"), "inside the frame (only mode) the same story renders inline — no nested iframe");
  ok(inner.querySelector(".puredashboard-gallery__story--fill") && inner.querySelector(".puredashboard-gallery__stage--fill"), "only mode + viewport: the story fills the frame (--fill modifiers)");
}

// ---- viewport switch: toolbar for every card, per-card override (a segmented control), presets ----
{
  const g = mount();            // puredashboard-a: "Basic" + "Alt", neither declares a viewport
  await tick(); await tick();   // the segmented controls render on their own microtask
  const switches = () => [...g.querySelectorAll("puredashboard-segmented.js-puredashboard-gallery__vp")];
  ok(g.querySelectorAll("iframe").length === 0 && switches().length === 2, "no viewport: stories inline, every card carries a switch");
  ok(switches()[0].options.map((o) => o.value).join(",") === "auto,phone,tablet,desktop", "the switch is a <puredashboard-segmented> offering Auto · Phone · Tablet · Desktop");
  ok(switches()[0].options.every((o) => /^<svg/.test(o.icon)) && switches()[0].value === "auto", "every segment has an icon; Auto is selected");
  ok(switches()[0].getAttribute("size") === "sm" && switches()[0].getAttribute("aria-label") === "Viewport", "small, labelled for assistive tech");
  const sel = g.querySelector(".js-pb-viewport");
  ok(sel && [...sel.options].map((o) => o.value).join(",") === ",phone,tablet,desktop", "the toolbar has a Viewport select with the presets");
  g.viewport = "tablet";
  await tick(); await tick();
  const frames = [...g.querySelectorAll("iframe.puredashboard-gallery__frame")];
  ok(frames.length === 2 && frames.every((f) => f.style.width === "820px"), "toolbar viewport=tablet frames EVERY card at 820px");
  ok(switches().every((sw) => sw.value === "tablet"), "… and every card's switch shows Tablet");
  ok(!g.querySelector(".story-a"), "… and nothing renders inline any more");
  const basicCard = g.querySelector(".puredashboard-gallery__story");
  basicCard.querySelectorAll(".js-puredashboard-segmented__segment")[1].click();   // Phone
  await tick(); await tick();
  ok(basicCard.querySelector("iframe").style.width === "390px", "a card's Phone segment overrides the toolbar for that card");
  ok(g.querySelectorAll(".puredashboard-gallery__story")[1].querySelector("iframe").style.width === "820px", "… the other card keeps the toolbar size");
  ok(basicCard.querySelector(".js-puredashboard-gallery__vp").value === "phone", "the card's switch reflects the override");
  basicCard.querySelectorAll(".js-puredashboard-segmented__segment")[0].click();   // Auto
  await tick(); await tick();
  ok(!basicCard.querySelector("iframe") && !!basicCard.querySelector(".story-a") && g.querySelectorAll("iframe").length === 1, "Auto on a card with no own viewport renders it inline again (ignoring the toolbar); the other card stays framed");
  g.viewport = "1024x600"; g.frames = {};
  await tick();
  ok(g.querySelector("iframe").style.width === "1024px" && g.querySelector("iframe").style.height === "600px", "a custom WxH viewport is honoured");
  g.viewport = "";
  await tick();
  ok(!g.querySelector("iframe"), "clearing the toolbar viewport goes back to inline");
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
