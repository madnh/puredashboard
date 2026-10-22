// Tests for gallery.js (<puredashboard-gallery>).
// Run in isolation via Docker (no host install): `make -C test`.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver"])
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

// ---- the shell is the library's own layout; nothing selected = the index ----
{
  const g = mount();
  await tick(); await tick();
  ok(!!g.querySelector("puredashboard-layout.puredashboard-gallery__shell > puredashboard-sider"), "shell: a puredashboard-layout with a puredashboard-sider");
  ok(!!g.querySelector("puredashboard-header.puredashboard-gallery__toolbar") && !!g.querySelector("puredashboard-content.puredashboard-gallery__canvas"), "shell: a puredashboard-header toolbar and a puredashboard-content canvas");
  const sider = g.querySelector("puredashboard-sider");
  ok(sider.collapseMode === "offcanvas" && sider.breakpoint === "md" && sider.breakpointCollapse === "offcanvas", "sider: off-canvas, a drawer below md");
  ok(!!sider.querySelector(".puredashboard-sider__header puredashboard-input.js-puredashboard-gallery__filter"), "the filter box sits in the sider's header slot");
  const nav = g.querySelector("puredashboard-nav.puredashboard-gallery__nav");
  ok(nav && nav.items.map((n) => n.heading || n.label).join(",") === "Index,Overview,One,Two", "nav: Index + Overview rows, then one section per title prefix");
  ok(nav.items[2].children.map((c) => c.label + "=" + c.href).join(",") === "a=?c=puredashboard-a", "nav rows are links to ?c=<tag>");
  ok(nav.current === "?", "nothing selected: the nav's Index row is current");
  ok(g.querySelectorAll(".puredashboard-gallery__index-card").length === 2 && g.querySelectorAll(".puredashboard-gallery__index-group").length === 2, "the canvas is the index: one card per component, grouped");
  ok(!g.querySelector(".story-a"), "the index mounts no story");
  ok(g.querySelector(".puredashboard-gallery__index-meta").textContent.includes("2 stories"), "a card names the title and the story count");
  ok(g.querySelector(".puredashboard-gallery__title").textContent === "Components (2)", "toolbar title on the index");
  ok(!!g.querySelector(".puredashboard-header__start .js-puredashboard-gallery__burger") && !!g.querySelector(".puredashboard-header__end .js-pb-theme"), "toolbar: toggle + title at the start, controls at the end");
}

// ---- selecting: an index card, a nav row; modified clicks are left to the browser ----
{
  const g = mount();
  await tick(); await tick();
  let sel = null;
  g.addEventListener("select", (e) => { sel = e.detail.tag; });
  g.querySelector('.puredashboard-gallery__index-card[href="?c=puredashboard-a"]').click();
  await tick(); await tick();
  ok(sel === "puredashboard-a" && g.querySelectorAll(".puredashboard-gallery__story").length === 2 && !!g.querySelector(".story-a"), "clicking an index card selects it and mounts its stories");
  ok(g.querySelector("puredashboard-nav").current === "?c=puredashboard-a", "the nav marks it current");
  const toB = [...g.querySelectorAll("puredashboard-nav a")].find((a) => a.getAttribute("href") === "?c=puredashboard-b");
  toB.click();
  await tick(); await tick();
  ok(sel === "puredashboard-b" && g.querySelectorAll(".puredashboard-gallery__story").length === 1 && !!g.querySelector(".story-b"), "clicking a nav row switches in place");
  const toIndex = [...g.querySelectorAll("puredashboard-nav a")].find((a) => a.getAttribute("href") === "?");
  const ctrl = new w.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  toIndex.dispatchEvent(ctrl);
  await tick();
  ok(!ctrl.defaultPrevented && g.selected === "puredashboard-b", "a Ctrl-click is NOT intercepted (opens a new tab)");
  toIndex.click();
  await tick(); await tick();
  ok(sel === "" && g.querySelectorAll(".puredashboard-gallery__index-card").length === 2, "the Index row goes back to the index: sel=" + JSON.stringify(sel) + " cards=" + g.querySelectorAll(".puredashboard-gallery__index-card").length + " selected=" + JSON.stringify(g.selected));
  const toOverview = [...g.querySelectorAll("puredashboard-nav a")].find((a) => a.getAttribute("href") === "?overview=1");
  toOverview.click();
  await tick(); await tick();
  ok(g.overview === true && g.querySelectorAll(".puredashboard-gallery__cell").length === 2, "the Overview row shows the contact sheet");
}

// ---- filter: narrows the nav and the index; typing in the box drives it; "/" focuses it ----
{
  const g = mount();
  await tick(); await tick();
  g.filter = "B";
  await tick(); await tick();
  const nav = g.querySelector("puredashboard-nav");
  ok(nav.items.map((n) => n.heading || n.label).join(",") === "Index,Overview,Two", "filter: only matching sections stay in the nav (case-insensitive)");
  ok(g.querySelectorAll(".puredashboard-gallery__index-card").length === 1, "filter: the index shows only matches");
  g.filter = "zzz";
  await tick(); await tick();
  ok(/No component matches/.test(g.querySelector(".puredashboard-gallery__empty")?.textContent || ""), "filter: a no-match message");
  g.filter = "";
  await tick(); await tick();
  const field = g.querySelector(".js-puredashboard-gallery__filter input");
  ok(!!field, "the filter box renders a real <input>");
  field.value = "one";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  await tick(); await tick();
  ok(g.filter === "one" && g.querySelectorAll(".puredashboard-gallery__index-card").length === 1, "typing in the box sets `filter` (title match)");
  field.blur();
  document.body.focus();
  const slash = new w.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
  document.body.dispatchEvent(slash);
  ok(slash.defaultPrevented && g.querySelector(".js-puredashboard-gallery__filter").contains(document.activeElement), "\"/\" focuses the filter box");
  g.remove();
}

// ---- stories are not remounted by unrelated re-renders (typing in the filter) ----
{
  let renders = 0;
  const S = [{ tag: "puredashboard-c", title: "Three/C", stories: [{ name: "Count", render: () => { renders++; return document.createElement("i"); } }] }];
  const g = document.createElement("puredashboard-gallery");
  g.stories = S; g.selected = "puredashboard-c"; document.body.appendChild(g);
  await tick(); await tick();
  ok(renders === 1, "the story rendered once");
  g.filter = "x"; await tick(); await tick();
  g.theme = "light"; await tick(); await tick();
  ok(renders === 1, "filtering and switching theme do not remount it (got " + renders + ")");
  g.selected = ""; await tick();
  g.selected = "puredashboard-c"; await tick(); await tick();
  ok(renders === 2, "re-selecting the component renders it afresh");
  g.remove();
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
  ok(!g.querySelector("puredashboard-sider"), "only mode hides the sidebar chrome");
  ok(g.querySelectorAll(".puredashboard-gallery__story").length === 1, "only mode shows the single named story");
}

// ---- viewport stories: an iframe of that size loading this page in only mode ----
{
  const VP = [{ tag: "puredashboard-v", title: "Three/V", stories: [
    { name: "Phone", viewport: { width: 390, height: 640 }, render: () => Object.assign(document.createElement("div"), { className: "story-v" }) },
  ] }];
  const g = document.createElement("puredashboard-gallery");
  g.stories = VP; g.selected = "puredashboard-v"; g.theme = "light"; g.lang = "vi";
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
  named.selected = "puredashboard-n";
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
  g.selected = "puredashboard-a";
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

// ---- "/" still focuses the filter after a detach + re-attach ----
// setup() runs once, but disconnectedCallback removes the document keydown listener.
{
  const g = mount();
  await tick(); await tick();
  g.remove();
  document.body.appendChild(g);
  await tick(); await tick();
  document.body.focus();
  const slash = new w.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
  document.body.dispatchEvent(slash);
  ok(slash.defaultPrevented && g.querySelector(".js-puredashboard-gallery__filter").contains(document.activeElement), "re-attach: \"/\" still focuses the filter box");
  g.remove();
}

console.log(`gallery.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
