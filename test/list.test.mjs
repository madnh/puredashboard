// Tests for list.js (<puredashboard-list>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, rendering and logic.
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
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardList } = await import("../src/list.js");
void PuredashboardList;

// ---- one row per item, role=list/listitem, title + description ----
{
  const el = mount("puredashboard-list");
  el.items = [
    { title: "web-01", description: "us-east-1", extra: "online" },
    { title: "web-02", description: "us-west-2" },
    { title: "web-03" },
  ];
  await tick();
  const list = el.querySelector(".puredashboard-list__list");
  ok(list && list.getAttribute("role") === "list", "renders a <ul role=list>");
  const rows = el.querySelectorAll(".puredashboard-list__item");
  ok(rows.length === 3, "one row per item");
  ok([...rows].every((r) => r.getAttribute("role") === "listitem"), "each row is role=listitem");
  const t0 = rows[0].querySelector(".puredashboard-list__title");
  ok(t0 && t0.textContent === "web-01", "title renders in a <strong>");
  ok(t0.tagName === "STRONG", "title element is a <strong>");
  const d0 = rows[0].querySelector(".puredashboard-list__desc");
  ok(d0 && d0.textContent === "us-east-1", "description renders when present");
  const e0 = rows[0].querySelector(".puredashboard-list__extra");
  ok(e0 && e0.textContent === "online", "extra renders on the right when present");
  // row without description / extra omits those nodes
  ok(!rows[2].querySelector(".puredashboard-list__desc"), "no description node when description unset");
  ok(!rows[1].querySelector(".puredashboard-list__extra"), "no extra node when extra unset");
}

// ---- header / footer show only when set ----
{
  const el = mount("puredashboard-list");
  el.items = [{ title: "x" }];
  await tick();
  ok(!el.querySelector(".puredashboard-list__header"), "no header node by default");
  ok(!el.querySelector(".puredashboard-list__footer"), "no footer node by default");
  el.header = "Recent nodes";
  el.footer = "3 total";
  await tick();
  const h = el.querySelector(".puredashboard-list__header");
  const f = el.querySelector(".puredashboard-list__footer");
  ok(h && h.textContent === "Recent nodes", "header renders when set");
  ok(f && f.textContent === "3 total", "footer renders when set");
}

// ---- empty state when no items (and not loading) ----
{
  const el = mount("puredashboard-list");
  el.items = [];
  await tick();
  ok(!el.querySelector(".puredashboard-list__list"), "no <ul> when there are no items");
  const empty = el.querySelector(".puredashboard-list__empty");
  ok(empty && empty.textContent === "No data", "empty state shows the default LABELS.empty");
  // localisable empty label
  el.labels = { empty: "Không có dữ liệu" };
  await tick();
  ok(el.querySelector(".puredashboard-list__empty").textContent === "Không có dữ liệu", "labels override the empty string");
  ok(el._label("empty") === "Không có dữ liệu", "_label reflects the override");
}

// ---- bordered / split / size modifiers ----
{
  const el = mount("puredashboard-list");
  el.items = [{ title: "a" }, { title: "b" }];
  await tick();
  const panel = el.querySelector(".puredashboard-list__panel");
  const list = el.querySelector(".puredashboard-list__list");
  ok(!panel.classList.contains("puredashboard-list__panel--bordered"), "not bordered by default");
  ok(list.classList.contains("puredashboard-list__list--md"), "size defaults to md");
  ok(!list.classList.contains("puredashboard-list__list--no-split"), "split on by default (no no-split modifier)");

  el.bordered = true;
  el.size = "lg";
  el.split = false;
  await tick();
  ok(el.querySelector(".puredashboard-list__panel").classList.contains("puredashboard-list__panel--bordered"), "bordered modifier added");
  ok(el.querySelector(".puredashboard-list__list").classList.contains("puredashboard-list__list--lg"), "size=lg modifier added");
  ok(el.querySelector(".puredashboard-list__list").classList.contains("puredashboard-list__list--no-split"), "split=false adds no-split modifier");

  el.size = "sm";
  await tick();
  ok(el.querySelector(".puredashboard-list__list").classList.contains("puredashboard-list__list--sm"), "size=sm modifier added");
}

// ---- loading state: skeleton rows, no empty state, aria-busy ----
{
  const el = mount("puredashboard-list");
  el.items = [];
  el.loading = true;
  await tick();
  const list = el.querySelector(".puredashboard-list__list");
  ok(list && list.getAttribute("aria-busy") === "true", "loading list is aria-busy");
  ok(!el.querySelector(".puredashboard-list__empty"), "no empty state while loading");
  const sk = el.querySelectorAll(".puredashboard-list__item--skeleton");
  ok(sk.length > 0, "renders skeleton placeholder rows while loading");
  ok(el.querySelectorAll(".puredashboard-list__skeleton").length > 0, "skeleton bars are present");
  // turning loading off with items shows real content
  el.loading = false;
  el.items = [{ title: "done" }];
  await tick();
  ok(!el.querySelector(".puredashboard-list__item--skeleton"), "skeletons gone after loading clears");
  ok(el.querySelector(".puredashboard-list__title").textContent === "done", "real content renders after loading");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-list header="H" size="lg" bordered></puredashboard-list>`;
  const el = document.body.firstElementChild;
  el.items = [{ title: "z" }];
  await tick();
  ok(el.header === "H", "header attribute reflected to property");
  ok(el.size === "lg", "size attribute reflected");
  ok(el.bordered === true, "bordered boolean attribute reflected");
}

console.log(`list.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
