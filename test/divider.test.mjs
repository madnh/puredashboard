// Tests for divider.js (<puredashboard-divider>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, attributes and logic.
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

const { PuredashboardDivider } = await import("../src/divider.js");
void PuredashboardDivider;

// ---- plain horizontal rule: role=separator + aria-orientation ----
{
  const el = mount("puredashboard-divider");
  await tick();
  ok(el.getAttribute("role") === "separator", "plain horizontal has role=separator");
  ok(el.getAttribute("aria-orientation") === "horizontal", "aria-orientation is horizontal");
  ok(el.classList.contains("puredashboard-divider--horizontal"), "horizontal modifier class set");
  ok(!el.classList.contains("puredashboard-divider--with-text"), "no with-text modifier for a bare rule");
  ok(el.getAttribute("aria-label") === "Separator", "bare rule carries a default aria-label");
}

// ---- vertical: modifier + aria-orientation=vertical ----
{
  const el = mount("puredashboard-divider");
  el.orientation = "vertical";
  await tick();
  ok(el.classList.contains("puredashboard-divider--vertical"), "vertical modifier class set");
  ok(el.getAttribute("role") === "separator", "vertical rule is still a separator");
  ok(el.getAttribute("aria-orientation") === "vertical", "aria-orientation is vertical");
}

// ---- dashed modifier ----
{
  const el = mount("puredashboard-divider");
  el.dashed = true;
  await tick();
  ok(el.classList.contains("puredashboard-divider--dashed"), "dashed modifier class set");
  ok(el.dashed === true, "dashed property reads true");
  el.dashed = false;
  await tick();
  ok(!el.classList.contains("puredashboard-divider--dashed"), "dashed removed when cleared");
}

// ---- labelled via `text` property: renders label, drops separator role ----
{
  const el = mount("puredashboard-divider");
  el.text = "Section";
  await tick();
  const label = el.querySelector(".js-puredashboard-divider__text");
  ok(label && label.textContent === "Section", "text property renders the label exactly");
  ok(el.classList.contains("puredashboard-divider--with-text"), "with-text modifier set");
  ok(!el.hasAttribute("role"), "labelled divider is NOT role=separator (text is content)");
  ok(el.querySelectorAll(".puredashboard-divider__line").length === 2, "line—text—line has two lines");
  ok(el.classList.contains("puredashboard-divider--align-center"), "textAlign defaults to center");
}

// ---- textAlign applies ----
{
  const el = mount("puredashboard-divider");
  el.text = "Left";
  el.textAlign = "left";
  await tick();
  ok(el.classList.contains("puredashboard-divider--align-left"), "align-left modifier applied");
  ok(!el.classList.contains("puredashboard-divider--align-center"), "center modifier removed when left");
}

// ---- author children preserved as the label ----
{
  document.body.innerHTML = `<puredashboard-divider><b>Kept</b></puredashboard-divider>`;
  const el = document.body.firstElementChild;
  await tick();
  const label = el.querySelector(".js-puredashboard-divider__text");
  ok(label && label.textContent === "Kept", "author children preserved as label text");
  const b = label.querySelector("b");
  ok(b && b.textContent === "Kept", "the author's original element node is kept intact");
  ok(!el.hasAttribute("role"), "divider with author children is not role=separator");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-divider");
  el.labels = { separator: "Phân cách" };
  await tick();
  ok(el._t("separator") === "Phân cách", "labels override the default string");
  const el2 = mount("puredashboard-divider");
  await tick();
  ok(el2._t("separator") === "Separator", "default label kept when not overridden");
}

console.log(`divider.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
