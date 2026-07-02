// Tests for steps.js (<puredashboard-steps>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, status derivation,
// rendering and the stepchange event.
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

const { PuredashboardSteps } = await import("../src/steps.js");
void PuredashboardSteps;

const STEPS = [
  { label: "Account", description: "Your details" },
  { label: "Billing" },
  { label: "Review" },
  { label: "Done" },
];

// ---- one list item per step, 1-based numbering ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  await tick();
  const list = el.querySelector(".puredashboard-steps__list");
  ok(list && list.tagName === "OL", "renders an <ol> list");
  const items = el.querySelectorAll(".puredashboard-steps__item");
  ok(items.length === STEPS.length, "one item per step");
  const labels = [...el.querySelectorAll(".puredashboard-steps__label")].map((n) => n.textContent);
  ok(labels[0] === "Account" && labels[3] === "Done", "step labels rendered as content");
  const desc = el.querySelector(".puredashboard-steps__desc");
  ok(desc && desc.textContent === "Your details", "optional description rendered");
  // upcoming bubbles show a 1-based number
  const bubble2 = items[1].querySelector(".puredashboard-steps__bubble");
  ok(bubble2.textContent === "2", "bubble shows 1-based number (index 1 -> '2')");
}

// ---- status modifiers derived from current ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.current = 1; // index 0 complete, 1 current, 2+ upcoming
  await tick();
  const items = el.querySelectorAll(".puredashboard-steps__item");
  ok(items[0].classList.contains("puredashboard-steps__item--complete"), "index < current -> complete");
  ok(items[1].classList.contains("puredashboard-steps__item--current"), "index === current -> current");
  ok(items[2].classList.contains("puredashboard-steps__item--upcoming"), "index > current -> upcoming");
  ok(items[3].classList.contains("puredashboard-steps__item--upcoming"), "later step also upcoming");
}

// ---- aria-current only on the current step ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.current = 2;
  await tick();
  const withCurrent = el.querySelectorAll('[aria-current="step"]');
  ok(withCurrent.length === 1, "exactly one element has aria-current=step");
  const item = withCurrent[0].closest(".puredashboard-steps__item");
  ok(item.dataset.index === "2", "aria-current is on the current (index 2) step");
  // upcoming/complete steps carry no aria-current attribute at all
  const step0 = el.querySelectorAll(".puredashboard-steps__step")[0];
  ok(!step0.hasAttribute("aria-current"), "complete step has no aria-current attribute");
}

// ---- check glyph present on completed steps only ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.current = 2; // 0,1 complete
  await tick();
  const items = el.querySelectorAll(".puredashboard-steps__item");
  ok(items[0].querySelector("svg"), "completed step shows the check glyph (svg)");
  ok(items[1].querySelector("svg"), "second completed step shows the check glyph");
  ok(!items[2].querySelector("svg"), "current step has no check glyph");
  ok(!items[3].querySelector("svg"), "upcoming step has no check glyph");
  // and the completed bubble no longer shows its number
  ok(items[0].querySelector(".puredashboard-steps__bubble").textContent.trim() === "", "completed bubble replaces the number with the glyph");
}

// ---- not clickable: steps are non-interactive spans ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  await tick();
  const buttons = el.querySelectorAll("button.puredashboard-steps__step");
  ok(buttons.length === 0, "no buttons when clickable is false");
  const spans = el.querySelectorAll("span.puredashboard-steps__step");
  ok(spans.length === STEPS.length, "steps render as spans when not clickable");
}

// ---- clickable: buttons emit stepchange with the right 0-based index ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.clickable = true;
  await tick();
  const buttons = el.querySelectorAll("button.puredashboard-steps__step");
  ok(buttons.length === STEPS.length, "clickable renders a <button> per step");
  let seen = null, count = 0;
  el.addEventListener("stepchange", (e) => { seen = e.detail.index; count++; });
  buttons[2].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 1, "one stepchange emitted on click");
  ok(seen === 2, "stepchange detail carries the clicked 0-based index");
  // a bubbling event so ancestors can listen
  let bubbled = false;
  document.body.addEventListener("stepchange", () => { bubbled = true; }, { once: true });
  buttons[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(bubbled, "stepchange bubbles");
}

// ---- vertical modifier ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.vertical = true;
  await tick();
  const list = el.querySelector(".puredashboard-steps__list");
  ok(list.classList.contains("puredashboard-steps__list--vertical"), "vertical adds the vertical modifier");
  ok(!list.classList.contains("puredashboard-steps__list--horizontal"), "horizontal modifier removed when vertical");
}

// ---- horizontal by default ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  await tick();
  const list = el.querySelector(".puredashboard-steps__list");
  ok(list.classList.contains("puredashboard-steps__list--horizontal"), "horizontal by default");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-steps");
  el.steps = STEPS;
  el.labels = { stepLabel: (n) => `Bước ${n}` };
  await tick();
  ok(el._label("stepLabel", 1) === "Bước 1", "labels override the default stepLabel");
  const el2 = mount("puredashboard-steps");
  await tick();
  ok(el2._label("stepLabel", 3) === "Step 3", "default label kept when not overridden");
}

console.log(`steps.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
