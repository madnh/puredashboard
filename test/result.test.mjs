// Tests for result.js (<puredashboard-result>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element and wrap logic.
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

const { PuredashboardResult } = await import("../src/result.js");
void PuredashboardResult;

// ---- default status ----
{
  const el = mount("puredashboard-result");
  await tick();
  ok(el.status === "info", "default status is info");
  ok(el.getAttribute("data-status") === "info", "default status reflected to data-status");
  ok(el.querySelector(".puredashboard-result__icon svg"), "info status renders an svg glyph");
}

// ---- symbolic status icons + status class per status ----
for (const status of ["success", "error", "warning", "info"]) {
  const el = mount("puredashboard-result");
  el.status = status;
  await tick();
  const icon = el.querySelector(".puredashboard-result__icon");
  ok(el.getAttribute("data-status") === status, `data-status is ${status}`);
  ok(icon.querySelector("svg"), `${status} renders an svg glyph`);
  ok(!icon.classList.contains("puredashboard-result__icon--numeric"), `${status} icon is not numeric`);
}

// ---- numeric server statuses show the number (no svg) ----
for (const code of ["404", "403", "500"]) {
  const el = mount("puredashboard-result");
  el.status = code;
  await tick();
  const icon = el.querySelector(".puredashboard-result__icon");
  ok(el.getAttribute("data-status") === code, `data-status is ${code}`);
  ok(icon.classList.contains("puredashboard-result__icon--numeric"), `${code} icon uses the numeric modifier`);
  ok(icon.textContent === code, `${code} icon shows the number`);
  ok(!icon.querySelector("svg"), `${code} icon renders no svg`);
}

// ---- unknown status falls back to the default ----
{
  const el = mount("puredashboard-result");
  el.status = "bogus";
  await tick();
  ok(el.status === "info", "unknown status falls back to info");
}

// ---- title/subtitle render + reflect on change ----
{
  const el = mount("puredashboard-result");
  el.status = "success";
  el.title = "Payment done";
  el.subtitle = "Order confirmed.";
  await tick();
  const title = el.querySelector(".puredashboard-result__title");
  const subtitle = el.querySelector(".puredashboard-result__subtitle");
  ok(title.textContent === "Payment done", "title renders exactly");
  ok(subtitle.textContent === "Order confirmed.", "subtitle renders exactly");
  ok(!subtitle.hidden, "subtitle is visible when set");
  // reflect on change
  el.title = "All set";
  el.subtitle = "You may leave now.";
  await tick();
  ok(title.textContent === "All set", "title reflects on change");
  ok(subtitle.textContent === "You may leave now.", "subtitle reflects on change");
}

// ---- title falls back to the status label; subtitle hidden when empty ----
{
  const el = mount("puredashboard-result");
  el.status = "error";
  await tick();
  const title = el.querySelector(".puredashboard-result__title");
  const subtitle = el.querySelector(".puredashboard-result__subtitle");
  ok(title.textContent === "Error", "title falls back to the status label when unset");
  ok(subtitle.hidden, "subtitle is hidden when empty");
}

// ---- content sets title/subtitle via textContent, never innerHTML ----
{
  const el = mount("puredashboard-result");
  el.title = "<b>x</b>";
  await tick();
  const title = el.querySelector(".puredashboard-result__title");
  ok(title.textContent === "<b>x</b>" && !title.querySelector("b"), "title is set as text, not HTML");
}

// ---- author action children are preserved & moved into __extra ----
{
  document.body.innerHTML = `<puredashboard-result status="success"><button id="js-go">Go</button><a id="js-back" href="#">Back</a></puredashboard-result>`;
  const el = document.body.firstElementChild;
  const btn = el.querySelector("#js-go");
  await tick();
  const extra = el.querySelector(".puredashboard-result__extra");
  ok(extra, "an extra region is built");
  ok(extra.children.length === 2, "both author children are moved into the extra region");
  ok(extra.querySelector("#js-go") === btn, "the SAME button node is moved (not cloned)");
  ok(extra.querySelector("#js-back"), "the author link is preserved in order");
  ok(el.querySelector(".puredashboard-result__title").textContent === "Success", "declarative status drives the fallback title");
}

// ---- declarative attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-result status="404" title="Not found" subtitle="Nope."></puredashboard-result>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.status === "404", "status attribute reflected to property");
  ok(el.title === "Not found", "title attribute reflected to property");
  ok(el.subtitle === "Nope.", "subtitle attribute reflected to property");
  ok(el.querySelector(".puredashboard-result__icon").textContent === "404", "declarative numeric status shows the number");
}

// ---- connect is idempotent (no re-wrap / duplication) ----
{
  const el = mount("puredashboard-result");
  el.status = "info";
  await tick();
  document.body.removeChild(el);
  document.body.appendChild(el);   // reconnect
  await tick();
  ok(el.querySelectorAll(".puredashboard-result__icon").length === 1, "reconnect does not duplicate the icon");
  ok(el.querySelectorAll(".puredashboard-result__title").length === 1, "reconnect does not duplicate the title");
  ok(el.querySelectorAll(".puredashboard-result__extra").length === 1, "reconnect does not duplicate the extra region");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-result");
  el.labels = { "404": "Không tìm thấy" };
  el.status = "404";
  await tick();
  ok(el._label("404") === "Không tìm thấy", "labels override the default status title");
  ok(el.querySelector(".puredashboard-result__title").textContent === "Không tìm thấy", "overridden label used as the fallback title");
  const el2 = mount("puredashboard-result");
  await tick();
  ok(el2._label("success") === "Success", "default label kept when not overridden");
}

console.log(`result.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
