// Tests for tabs.js (<puredashboard-tabs>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, roles, roving
// tabindex, the APG keyboard map (automatic activation), the tabchange event,
// and the author-panel hidden-toggling driven by `panelId`.
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

const { PuredashboardTabs } = await import("../src/tabs.js");
void PuredashboardTabs;

const THREE = () => [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo" },
  { id: "c", label: "Charlie" },
];
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

// ---- roles + default selection ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  await tick();
  const list = el.querySelector("[role='tablist']");
  const btns = el.querySelectorAll("[role='tab']");
  ok(list, "renders a role=tablist");
  ok(btns.length === 3, "renders one role=tab per tab");
  ok(btns[0].textContent === "Alpha", "tab label comes from data");
  ok(btns[0].getAttribute("aria-selected") === "true", "first enabled tab selected by default");
  ok(btns[1].getAttribute("aria-selected") === "false", "other tabs not selected");
  ok(el.value === undefined || el._current() === "a", "current resolves to first enabled tab");
}

// ---- roving tabindex ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  el.value = "b";
  await tick();
  const btns = el.querySelectorAll("[role='tab']");
  ok(btns[1].getAttribute("aria-selected") === "true", "value selects the matching tab");
  ok(btns[1].getAttribute("tabindex") === "0", "selected tab has tabindex 0 (roving)");
  ok(btns[0].getAttribute("tabindex") === "-1" && btns[2].getAttribute("tabindex") === "-1", "unselected tabs have tabindex -1");
}

// ---- ArrowRight/ArrowLeft activation with wrap ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  await tick();
  const list = el.querySelector(".js-puredashboard-tabs__list");
  key(list, "ArrowRight");
  await tick();
  ok(el.value === "b", "ArrowRight activates the next tab (automatic activation)");
  key(list, "ArrowRight"); await tick();
  key(list, "ArrowRight"); await tick();
  ok(el.value === "a", "ArrowRight wraps from last to first");
  key(list, "ArrowLeft"); await tick();
  ok(el.value === "c", "ArrowLeft wraps from first to last");
}

// ---- Home / End ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  el.value = "b";
  await tick();
  const list = el.querySelector(".js-puredashboard-tabs__list");
  key(list, "End"); await tick();
  ok(el.value === "c", "End activates the last enabled tab");
  key(list, "Home"); await tick();
  ok(el.value === "a", "Home activates the first enabled tab");
}

// ---- disabled tabs are skipped ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Bravo", disabled: true },
    { id: "c", label: "Charlie" },
  ];
  await tick();
  const list = el.querySelector(".js-puredashboard-tabs__list");
  const btns = el.querySelectorAll("[role='tab']");
  ok(btns[1].disabled === true, "disabled tab is a disabled button");
  key(list, "ArrowRight"); await tick();
  ok(el.value === "c", "ArrowRight skips the disabled tab");
  key(list, "ArrowRight"); await tick();
  ok(el.value === "a", "ArrowRight wraps skipping disabled");
  // clicking a disabled tab does nothing
  btns[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === "a", "clicking a disabled tab is ignored");
}

// ---- disabled first tab: default falls to first ENABLED ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = [
    { id: "a", label: "Alpha", disabled: true },
    { id: "b", label: "Bravo" },
  ];
  await tick();
  const btns = el.querySelectorAll("[role='tab']");
  ok(btns[1].getAttribute("aria-selected") === "true", "default selection skips a disabled first tab");
}

// ---- tabchange event ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  await tick();
  let count = 0, last = null;
  el.addEventListener("tabchange", (e) => { count++; last = e.detail.value; });
  const btns = el.querySelectorAll("[role='tab']");
  btns[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 1 && last === "c", "clicking a tab emits tabchange { value } once");
  ok(el.value === "c", "click activates the tab");
  // activating the already-active tab does not re-emit
  btns[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 1, "re-activating the current tab does not emit again");
}

// ---- panel hidden-toggling via panelId ----
{
  const pa = document.createElement("div"); pa.id = "panel-a";
  const pb = document.createElement("div"); pb.id = "panel-b";
  document.body.append(pa, pb);
  const el = mount("puredashboard-tabs");
  el.tabs = [
    { id: "a", label: "Alpha", panelId: "panel-a" },
    { id: "b", label: "Bravo", panelId: "panel-b" },
  ];
  await tick();
  const btns = el.querySelectorAll("[role='tab']");
  ok(pa.getAttribute("role") === "tabpanel" && pb.getAttribute("role") === "tabpanel", "panels get role=tabpanel");
  ok(pa.getAttribute("aria-labelledby") === btns[0].id, "panel aria-labelledby points at its tab id");
  ok(btns[0].getAttribute("aria-controls") === "panel-a", "tab aria-controls points at its panel");
  ok(pa.hidden === false && pb.hidden === true, "only the active panel is shown");
  el.value = "b";
  await tick();
  ok(pa.hidden === true && pb.hidden === false, "switching tabs toggles the hidden panel");
  // missing panel is tolerated (no throw)
  el.tabs = [{ id: "x", label: "X", panelId: "does-not-exist" }];
  await tick();
  ok(true, "a missing panelId does not throw");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  el.labels = { tablist: "Phần" };
  await tick();
  ok(el.querySelector("[role='tablist']").getAttribute("aria-label") === "Phần", "labels override the tablist aria-label");
  const el2 = mount("puredashboard-tabs");
  el2.tabs = THREE();
  await tick();
  ok(el2.querySelector("[role='tablist']").getAttribute("aria-label") === "Tabs", "default label kept when not overridden");
}

// ---- focus stays on the newly selected tab after a key or a click (the buttons re-render) ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  await tick();
  const sel = () => el.querySelector('[role="tab"][aria-selected="true"]');
  sel().focus();
  key(document.activeElement, "ArrowRight"); await tick();
  ok(el.value === "b" && document.activeElement === sel() && sel().dataset.tab === "b", "after ONE ArrowRight focus is on the new selected tab");
  key(document.activeElement, "ArrowRight"); await tick();
  ok(el.value === "c" && document.activeElement === sel(), "a second ArrowRight still has a focused tab to act on");
  key(document.activeElement, "Home"); await tick();
  ok(el.value === "a" && document.activeElement === sel(), "Home: focus on the first tab");
  key(document.activeElement, "End"); await tick();
  ok(el.value === "c" && document.activeElement === sel(), "End: focus on the last tab");
  el.querySelector('[data-tab="b"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick();
  ok(el.value === "b" && document.activeElement === sel(), "click with focus in the list: focus on the clicked (now selected) tab");
}

// ---- focus elsewhere is never stolen ----
{
  const outside = document.createElement("input");
  document.body.appendChild(outside);
  const el = mount("puredashboard-tabs");
  el.tabs = THREE();
  await tick();
  outside.focus();
  el.querySelector('[data-tab="c"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick();
  ok(el.value === "c" && document.activeElement === outside, "activation while focus is outside the tabs does not move focus");
  el.value = "a"; await tick();
  ok(document.activeElement === outside, "setting value programmatically does not move focus");
}

// ---- link mode: any tab with href → a <nav> of real links ----
{
  const el = mount("puredashboard-tabs");
  el.tabs = [
    { id: "a", label: "Alpha", href: "/a", panelId: "pa" },
    { id: "b", label: "Bravo", href: "/b?x=1" },
    { id: "c", label: "Charlie", href: "/c", disabled: true },
    { id: "d", label: "Delta" },
  ];
  el.value = "b";
  await tick();
  const nav = el.querySelector("nav.puredashboard-tabs__list");
  ok(nav && nav.getAttribute("aria-label") === "Tabs", "link mode renders a named <nav>");
  ok(!el.querySelector('[role="tablist"], [role="tab"]'), "link mode: no tab roles");
  const links = [...nav.querySelectorAll("a")];
  ok(links.length === 2 && links[0].getAttribute("href") === "/a" && links[1].getAttribute("href") === "/b?x=1", "enabled tabs with href are real <a href>");
  ok(links[1].getAttribute("aria-current") === "page" && links[1].classList.contains("puredashboard-tabs__tab--active"), "value's tab is aria-current=page and styled active");
  ok(links[0].getAttribute("aria-current") === "false", "other links are not current");
  ok(links.every((a) => !a.hasAttribute("tabindex")), "no roving tabindex: every link is in the tab order");
  const spans = [...nav.querySelectorAll("span.puredashboard-tabs__tab")];
  ok(spans.length === 2 && spans.every((s) => s.getAttribute("aria-disabled") === "true"), "disabled or href-less tabs are non-link spans with aria-disabled");
  let changes = 0;
  el.addEventListener("tabchange", () => changes++);
  links[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true })); await tick();
  key(links[0], "ArrowRight"); await tick();
  ok(changes === 0 && el.value === "b", "link mode: neither click nor arrow keys activate anything (navigation is the browser's)");
}

// ---- link mode leaves panels alone; without href the tablist is unchanged ----
{
  document.body.innerHTML = `<div id="pa">A</div><div id="pb" hidden>B</div>`;
  const el = mount("puredashboard-tabs");
  el.tabs = [{ id: "a", label: "Alpha", href: "/a", panelId: "pa" }, { id: "b", label: "Bravo", href: "/b", panelId: "pb" }];
  el.value = "b";
  await tick();
  ok(!document.getElementById("pa").hidden && document.getElementById("pb").hidden, "link mode: panelId is ignored (panels untouched)");
  el.tabs = [{ id: "a", label: "Alpha" }, { id: "b", label: "Bravo" }];
  await tick();
  ok(el.querySelector('[role="tablist"]') && !el.querySelector("nav"), "no href: back to the APG tablist");
}

// ---- tab corners: rounded on top, square at the bottom (sits on the underline) ----
// CSS contract only: jsdom does not resolve var() inside border-radius (measured: it reports "0" for the
// corners with and without this rule), so the computed outcome is checked in a real browser instead.
{
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("../src/tabs.css", import.meta.url), "utf8");
  ok(/\.puredashboard-tabs__tab\s*\{[^}]*border-radius:\s*var\(--pd-tabs-radius\)\s+var\(--pd-tabs-radius\)\s+0\s+0\s*;/.test(css), "tab: top corners rounded, bottom corners 0");
}

console.log(`tabs.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
