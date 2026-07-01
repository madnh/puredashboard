// Tests for descriptions.js (<puredashboard-descriptions>).
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

const { PuredashboardDescriptions } = await import("../src/descriptions.js");
void PuredashboardDescriptions;

// ---- one dt/dd pair per item; values render ----
{
  const el = mount("puredashboard-descriptions");
  el.items = [
    { label: "Hostname", value: "web-01" },
    { label: "Region", value: "eu-west-1" },
  ];
  await tick();
  const dl = el.querySelector("dl.puredashboard-descriptions__list");
  ok(dl, "renders a <dl> list");
  const pairs = el.querySelectorAll(".puredashboard-descriptions__pair");
  ok(pairs.length === 2, "one pair per item");
  const dts = el.querySelectorAll("dt.puredashboard-descriptions__term");
  const dds = el.querySelectorAll("dd.puredashboard-descriptions__detail");
  ok(dts.length === 2 && dds.length === 2, "each pair has exactly one dt and one dd");
  ok(dts[0].textContent === "Hostname", "dt renders the label");
  ok(dds[0].textContent === "web-01", "dd renders the value");
  ok(dts[1].textContent === "Region" && dds[1].textContent === "eu-west-1", "second pair renders");
}

// ---- title shows only when set ----
{
  const el = mount("puredashboard-descriptions");
  el.items = [{ label: "A", value: "1" }];
  await tick();
  ok(!el.querySelector(".puredashboard-descriptions__title"), "no title node when title unset");
  el.title = "Server";
  await tick();
  const t = el.querySelector(".puredashboard-descriptions__title");
  ok(t && t.textContent === "Server", "title shows exactly when set");
}

// ---- columns reflected via --pd-descriptions-cols ----
{
  const el = mount("puredashboard-descriptions");
  el.items = [{ label: "A", value: "1" }];
  el.columns = 3;
  await tick();
  const dl = el.querySelector(".puredashboard-descriptions__list");
  ok(dl.getAttribute("style").includes("--pd-descriptions-cols:3"), "columns reflected as --pd-descriptions-cols style");
}

// ---- bordered modifier ----
{
  const el = mount("puredashboard-descriptions");
  el.items = [{ label: "A", value: "1" }];
  await tick();
  ok(!el.querySelector(".puredashboard-descriptions__list--bordered"), "not bordered by default");
  el.bordered = true;
  await tick();
  ok(el.querySelector(".puredashboard-descriptions__list--bordered"), "bordered adds the modifier class");
}

// ---- span applied as grid-column ----
{
  const el = mount("puredashboard-descriptions");
  el.columns = 2;
  el.items = [
    { label: "A", value: "1" },
    { label: "Notes", value: "wide", span: 2 },
  ];
  await tick();
  const pairs = el.querySelectorAll(".puredashboard-descriptions__pair");
  ok(!(pairs[0].getAttribute("style") || "").includes("span"), "span=1 pair has no grid-column span");
  ok((pairs[1].getAttribute("style") || "").includes("grid-column:span 2"), "span applied as grid-column span");
}

// ---- empty state ----
{
  const el = mount("puredashboard-descriptions");
  el.items = [];
  await tick();
  ok(!el.querySelector("dl"), "no <dl> when there are no items");
  const empty = el.querySelector(".puredashboard-descriptions__empty");
  ok(empty && empty.textContent === "No details to show.", "empty message rendered exactly");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-descriptions title="T" columns="2" bordered></puredashboard-descriptions>`;
  const el = document.body.firstElementChild;
  el.items = [{ label: "A", value: "1" }];
  await tick();
  ok(el.title === "T", "title attribute reflected to property");
  ok(el.columns === 2, "columns attribute reflected as a number");
  ok(el.bordered === true, "bordered boolean attribute reflected");
  ok(el.querySelector(".puredashboard-descriptions__list--bordered"), "reflected bordered reaches the list");
  ok(el.querySelector(".puredashboard-descriptions__list").getAttribute("style").includes("--pd-descriptions-cols:2"), "reflected columns reach the grid");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-descriptions");
  el.labels = { empty: "Không có dữ liệu" };
  el.items = [];
  await tick();
  ok(el.querySelector(".puredashboard-descriptions__empty").textContent === "Không có dữ liệu", "labels override the empty string");
  ok(el._label("empty") === "Không có dữ liệu", "labels override the default via _label");
}

console.log(`descriptions.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
