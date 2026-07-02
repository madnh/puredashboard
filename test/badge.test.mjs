// Tests for badge.js (<puredashboard-badge>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, wrapping and sync.
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

const { PuredashboardBadge } = await import("../src/badge.js");
void PuredashboardBadge;

const IND = ".js-puredashboard-badge__indicator";
const ANCHOR = ".js-puredashboard-badge__anchor";

// ---- children preserved in an anchor; count shown ----
{
  document.body.innerHTML = `<puredashboard-badge count="5"><button>Inbox</button></puredashboard-badge>`;
  const el = document.body.firstElementChild;
  await tick();
  const anchor = el.querySelector(ANCHOR);
  ok(anchor, "wraps children in an anchor");
  const btn = anchor && anchor.querySelector("button");
  ok(btn && btn.textContent === "Inbox", "badged child is preserved inside the anchor");
  const ind = el.querySelector(IND);
  ok(ind && ind.textContent === "5", "count shows as the indicator text");
  ok(!ind.classList.contains("puredashboard-badge__indicator--hidden"), "indicator visible for count 5");
}

// ---- count > max shows "max+" ----
{
  const el = mount("puredashboard-badge");
  el.max = 99;
  el.count = 250;
  await tick();
  const ind = el.querySelector(IND);
  ok(ind.textContent === "99+", "count>max shows max+ (99+)");
  el.max = 9;
  el.count = 12;
  await tick();
  ok(ind.textContent === "9+", "custom max reflected (9+)");
}

// ---- count === 0 hidden unless showZero / dot ----
{
  const el = mount("puredashboard-badge");
  el.count = 0;
  await tick();
  let ind = el.querySelector(IND);
  ok(ind.classList.contains("puredashboard-badge__indicator--hidden"), "count 0 hidden by default");
  el.showZero = true;
  await tick();
  ok(!ind.classList.contains("puredashboard-badge__indicator--hidden"), "showZero reveals a 0 badge");
  ok(ind.textContent === "0", "showZero renders the 0");
}

// ---- dot mode shows no number and is visible even at count 0 ----
{
  const el = mount("puredashboard-badge");
  el.count = 0;
  el.dot = true;
  await tick();
  const ind = el.querySelector(IND);
  ok(ind.classList.contains("puredashboard-badge__indicator--dot"), "dot mode adds the dot modifier");
  ok(ind.textContent === "", "dot mode shows no number");
  ok(!ind.classList.contains("puredashboard-badge__indicator--hidden"), "dot visible even at count 0");
}

// ---- color modifier ----
{
  const el = mount("puredashboard-badge");
  el.count = 3;
  el.color = "success";
  await tick();
  const ind = el.querySelector(IND);
  ok(ind.classList.contains("puredashboard-badge__indicator--success"), "color variant adds a modifier class");
  el.color = "red";
  await tick();
  ok(!ind.classList.contains("puredashboard-badge__indicator--success"), "switching to default red drops the modifier");
}

// ---- standalone mode: no anchor, indicator in flow ----
{
  // standalone is a connect-time decision (like the wrap), so set it before mount.
  document.body.innerHTML = `<puredashboard-badge standalone count="7"></puredashboard-badge>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(!el.querySelector(ANCHOR), "standalone renders no anchor");
  const ind = el.querySelector(IND);
  ok(ind && ind.textContent === "7", "standalone still renders the indicator");
}

// ---- count update reflects immediately ----
{
  const el = mount("puredashboard-badge");
  el.count = 1;
  await tick();
  const ind = el.querySelector(IND);
  ok(ind.textContent === "1", "initial count reflected");
  el.count = 42;
  await tick();
  ok(ind.textContent === "42", "updating count updates the indicator text");
  ok(ind.getAttribute("aria-label") === "42 notifications", "aria-label follows count via LABELS.count");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-badge");
  el.labels = { count: (n) => `${n} tin nhắn` };
  el.count = 3;
  await tick();
  const ind = el.querySelector(IND);
  ok(ind.getAttribute("aria-label") === "3 tin nhắn", "labels override the aria-label string");
}

console.log(`badge.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
