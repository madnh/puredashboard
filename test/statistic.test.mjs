// Tests for statistic.js (<puredashboard-statistic>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element and formatting logic.
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

const { PuredashboardStatistic } = await import("../src/statistic.js");
void PuredashboardStatistic;

// ---- title + value render, with a11y association ----
{
  const el = mount("puredashboard-statistic");
  el.title = "Revenue";
  el.value = 42;
  await tick();
  const title = el.querySelector(".puredashboard-statistic__title");
  const value = el.querySelector(".puredashboard-statistic__value");
  const number = el.querySelector(".puredashboard-statistic__number");
  ok(title && title.textContent === "Revenue", "title renders exactly");
  ok(number && number.textContent === "42", "value renders");
  ok(title.id && value.getAttribute("aria-labelledby") === title.id, "value is labelled by the title");
}

// ---- numeric formatting: grouping + precision ----
{
  const el = mount("puredashboard-statistic");
  el.value = 1234567;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "1,234,567", "grouping inserts thousands separators");
  el.precision = 2;
  el.value = 1234.5;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "1,234.50", "precision pads to fixed decimals with grouping");
}

// ---- grouping can be turned off ----
{
  const el = mount("puredashboard-statistic");
  el.groupSeparator = false;
  el.value = 1234567;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "1234567", "groupSeparator=false disables separators");
}

// ---- prefix + suffix ----
{
  const el = mount("puredashboard-statistic");
  el.prefix = "$";
  el.suffix = "%";
  el.value = 50;
  await tick();
  const pre = el.querySelector(".puredashboard-statistic__prefix");
  const suf = el.querySelector(".puredashboard-statistic__suffix");
  ok(pre && pre.textContent === "$", "prefix renders exactly");
  ok(suf && suf.textContent === "%", "suffix renders exactly");
}

// ---- trend up: colour modifier + arrow + sr-only text ----
{
  const el = mount("puredashboard-statistic");
  el.value = 10;
  el.trend = "up";
  await tick();
  const value = el.querySelector(".puredashboard-statistic__value");
  ok(value.classList.contains("puredashboard-statistic__value--up"), "trend=up adds the up colour modifier");
  ok(el.querySelector(".puredashboard-statistic__arrow-svg"), "trend=up renders the arrow svg");
  const sr = el.querySelector(".puredashboard-statistic__sr");
  ok(sr && sr.textContent.trim() === "increase", "trend=up sr-only text is 'increase'");
}

// ---- trend down ----
{
  const el = mount("puredashboard-statistic");
  el.value = 10;
  el.trend = "down";
  await tick();
  const value = el.querySelector(".puredashboard-statistic__value");
  ok(value.classList.contains("puredashboard-statistic__value--down"), "trend=down adds the down colour modifier");
  const sr = el.querySelector(".puredashboard-statistic__sr");
  ok(sr && sr.textContent.trim() === "decrease", "trend=down sr-only text is 'decrease'");
}

// ---- string value passes through untouched ----
{
  const el = mount("puredashboard-statistic");
  el.value = "N/A";
  await tick();
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "N/A", "string value passes through as-is");
}

// ---- loading placeholder ----
{
  const el = mount("puredashboard-statistic");
  el.value = 99;
  el.loading = true;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__skeleton"), "loading shows the skeleton placeholder");
  ok(!el.querySelector(".puredashboard-statistic__number"), "loading hides the value number");
  el.loading = false;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "99", "clearing loading restores the value");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-statistic title="Users" value="1000" trend="up"></puredashboard-statistic>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.title === "Users", "title attribute reflected");
  ok(el.querySelector(".puredashboard-statistic__number").textContent === "1,000", "value attribute formatted");
  ok(el.querySelector(".puredashboard-statistic__value").classList.contains("puredashboard-statistic__value--up"), "trend attribute reflected");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-statistic");
  el.labels = { increase: "tăng" };
  el.trend = "up";
  el.value = 1;
  await tick();
  ok(el.querySelector(".puredashboard-statistic__sr").textContent.trim() === "tăng", "labels override the trend text");
  ok(el._label("decrease") === "decrease", "default label kept when not overridden");
}

console.log(`statistic.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
