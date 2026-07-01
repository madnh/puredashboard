// Tests for timeline.js (<puredashboard-timeline>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element and rendering logic.
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

const { PuredashboardTimeline } = await import("../src/timeline.js");
void PuredashboardTimeline;

// ---- one node per item; content + label render ----
{
  const el = mount("puredashboard-timeline");
  el.items = [
    { label: "09:00", content: "Deploy started" },
    { label: "09:02", content: "Build passed" },
    { content: "Rollout done" },
  ];
  await tick();
  const items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items.length === 3, "renders one <li> per item");
  ok(el.querySelector("ol[role='list']"), "renders an ordered list with role=list");
  const first = items[0];
  ok(first.querySelector(".puredashboard-timeline__content").textContent === "Deploy started", "content renders exactly");
  ok(first.querySelector(".puredashboard-timeline__label").textContent === "09:00", "label renders exactly");
  ok(!items[2].querySelector(".puredashboard-timeline__label"), "no label node when label omitted");
}

// ---- content is escaped (rendered as text, not markup) ----
{
  const el = mount("puredashboard-timeline");
  el.items = [{ content: "<b>x</b>" }];
  await tick();
  const c = el.querySelector(".puredashboard-timeline__content");
  ok(c.textContent === "<b>x</b>" && !c.querySelector("b"), "content is escaped, not parsed as HTML");
}

// ---- colour modifier on the dot's item ----
{
  const el = mount("puredashboard-timeline");
  el.items = [
    { content: "a", color: "success" },
    { content: "b", color: "error" },
    { content: "c" }, // default → accent
    { content: "d", color: "bogus" }, // unknown → accent fallback
  ];
  await tick();
  const items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items[0].classList.contains("puredashboard-timeline__item--success"), "color=success sets the success modifier");
  ok(items[1].classList.contains("puredashboard-timeline__item--error"), "color=error sets the error modifier");
  ok(items[2].classList.contains("puredashboard-timeline__item--accent"), "default color is accent");
  ok(items[3].classList.contains("puredashboard-timeline__item--accent"), "unknown color falls back to accent");
  ok(items[0].querySelector(".puredashboard-timeline__dot"), "each item has a dot marker");
}

// ---- custom dot markup rendered (trusted SVG via raw) ----
{
  const el = mount("puredashboard-timeline");
  el.items = [{ content: "starred", dot: '<svg class="js-mine"><circle></circle></svg>' }];
  await tick();
  const dot = el.querySelector(".puredashboard-timeline__dot");
  ok(dot.querySelector("svg.js-mine"), "custom dot SVG markup is rendered into the dot");
}

// ---- mode modifier (left default / right / alternate) ----
{
  const el = mount("puredashboard-timeline");
  el.items = [{ content: "a" }, { content: "b" }];
  await tick();
  let list = el.querySelector(".puredashboard-timeline__list");
  ok(list.classList.contains("puredashboard-timeline__list--left"), "default mode is left");
  let items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items[0].classList.contains("puredashboard-timeline__item--left"), "left mode: item sits left");

  el.mode = "right";
  await tick();
  list = el.querySelector(".puredashboard-timeline__list");
  ok(list.classList.contains("puredashboard-timeline__list--right"), "mode=right sets the list modifier");
  items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items[0].classList.contains("puredashboard-timeline__item--right"), "right mode: item sits right");

  el.mode = "alternate";
  await tick();
  list = el.querySelector(".puredashboard-timeline__list");
  ok(list.classList.contains("puredashboard-timeline__list--alternate"), "mode=alternate sets the list modifier");
  items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items[0].classList.contains("puredashboard-timeline__item--left") &&
     items[1].classList.contains("puredashboard-timeline__item--right"), "alternate mode zig-zags left/right");
}

// ---- reverse order ----
{
  const el = mount("puredashboard-timeline");
  el.items = [{ content: "first" }, { content: "second" }, { content: "third" }];
  await tick();
  let contents = [...el.querySelectorAll(".puredashboard-timeline__content")].map((n) => n.textContent);
  ok(contents.join(",") === "first,second,third", "default order matches items");

  el.reverse = true;
  await tick();
  contents = [...el.querySelectorAll(".puredashboard-timeline__content")].map((n) => n.textContent);
  ok(contents.join(",") === "third,second,first", "reverse flips the item order");
}

// ---- pending appends a trailing item with a spinner dot ----
{
  const el = mount("puredashboard-timeline");
  el.items = [{ content: "a" }, { content: "b" }];
  el.pending = "Retrying…";
  await tick();
  const items = el.querySelectorAll(".puredashboard-timeline__item");
  ok(items.length === 3, "pending appends one trailing item");
  const last = items[items.length - 1];
  ok(last.classList.contains("puredashboard-timeline__item--pending"), "trailing item has the pending modifier");
  ok(last.querySelector(".puredashboard-timeline__spinner"), "pending item shows a spinner glyph");
  ok(last.querySelector(".puredashboard-timeline__content").textContent === "Retrying…", "pending string is its content");

  // pending === true uses the default label
  el.pending = true;
  await tick();
  const last2 = el.querySelector(".puredashboard-timeline__item--pending .puredashboard-timeline__content");
  ok(last2.textContent === "In progress…", "pending=true uses the default label");

  // clearing pending removes the trailing item
  el.pending = false;
  await tick();
  ok(el.querySelectorAll(".puredashboard-timeline__item").length === 2, "clearing pending removes the trailing item");
  ok(!el.querySelector(".puredashboard-timeline__item--pending"), "no pending item when pending is falsy");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-timeline");
  el.labels = { pending: "Đang xử lý…" };
  el.pending = true;
  await tick();
  ok(el._label("pending") === "Đang xử lý…", "labels override the default string");
  const c = el.querySelector(".puredashboard-timeline__item--pending .puredashboard-timeline__content");
  ok(c.textContent === "Đang xử lý…", "overridden pending label reaches the DOM");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-timeline mode="alternate" reverse></puredashboard-timeline>`;
  const el = document.body.firstElementChild;
  el.items = [{ content: "a" }, { content: "b" }];
  await tick();
  ok(el.mode === "alternate", "mode attribute reflected to property");
  ok(el.reverse === true, "reverse boolean attribute reflected");
  const list = el.querySelector(".puredashboard-timeline__list");
  ok(list.classList.contains("puredashboard-timeline__list--alternate"), "reflected mode reaches the list");
}

console.log(`timeline.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
