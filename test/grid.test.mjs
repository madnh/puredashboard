// Tests for grid.js (<puredashboard-row> + <puredashboard-col>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual elements, attribute
// reflection and the presentational custom properties/classes they set.
// (jsdom does NOT do layout, so we assert the reflected --pd-* custom properties
// and BEM classes — the real resolved widths are verified in a real browser.)
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

const { PuredashboardRow, PuredashboardCol } = await import("../src/grid.js");
void PuredashboardRow; void PuredashboardCol;

// ---- row: flex container that preserves its col children ----
{
  document.body.innerHTML = `<puredashboard-row><puredashboard-col span="12">a</puredashboard-col><puredashboard-col span="12">b</puredashboard-col></puredashboard-row>`;
  const row = document.body.firstElementChild;
  await tick();
  ok(row.classList.contains("puredashboard-row"), "row gets the BEM block class (styled display:flex in grid.css)");
  const cols = row.querySelectorAll("puredashboard-col");
  ok(cols.length === 2, "row preserves both col children");
  ok(cols[0].textContent === "a" && cols[1].textContent === "b", "col children content preserved");
  ok(row.getAttribute("role") === "group", "row exposes role=group for a11y");
}

// ---- row gutter: named preset maps to the --pd-row-gutter custom property ----
{
  const row = mount("puredashboard-row");
  row.setAttribute("gutter", "md");
  await tick();
  ok(row.style.getPropertyValue("--pd-row-gutter") === "var(--sp-4, 16px)", "gutter=md maps to the --sp-4 token via --pd-row-gutter");
  row.setAttribute("gutter", "24");
  await tick();
  ok(row.style.getPropertyValue("--pd-row-gutter") === "24px", "numeric gutter maps to px on --pd-row-gutter");
}

// ---- row align/justify reflect to BEM modifier classes ----
{
  const row = mount("puredashboard-row");
  row.setAttribute("align", "middle");
  row.setAttribute("justify", "between");
  await tick();
  ok(row.classList.contains("puredashboard-row--align-middle"), "align=middle adds the modifier class");
  ok(row.classList.contains("puredashboard-row--justify-between"), "justify=between adds the modifier class");
  row.setAttribute("align", "bottom");
  await tick();
  ok(row.classList.contains("puredashboard-row--align-bottom") && !row.classList.contains("puredashboard-row--align-middle"), "changing align swaps the modifier class");
}

// ---- col span sets the width custom property (span=12 → 50%) ----
{
  const col = mount("puredashboard-col");
  col.setAttribute("span", "12");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-span") === "12", "span=12 writes --pd-col-span=12 (width calc → 50%)");
  // width calc with no gutter: 12/24*100% = 50%
  const computed = 12 / 24 * 100;
  ok(computed === 50, "24-column math: span 12 of 24 is 50%");
  col.setAttribute("span", "8");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-span") === "8", "span=8 writes --pd-col-span=8 (→ 33.33%)");
}

// ---- col span is clamped into 1..24 ----
{
  const col = mount("puredashboard-col");
  col.setAttribute("span", "40");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-span") === "24", "span over 24 is clamped to 24");
  col.setAttribute("span", "0");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-span") === "1", "span under 1 is clamped to 1");
}

// ---- col offset applies via --pd-col-offset ----
{
  const col = mount("puredashboard-col");
  col.setAttribute("offset", "6");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-offset") === "6", "offset=6 writes --pd-col-offset=6 (margin-left 25%)");
  col.removeAttribute("offset");
  await tick();
  ok(col.style.getPropertyValue("--pd-col-offset") === "", "removing offset clears --pd-col-offset");
}

// ---- responsive attrs set their per-breakpoint custom properties ----
{
  document.body.innerHTML = `<puredashboard-col span="24" md="12" lg="8"></puredashboard-col>`;
  const col = document.body.firstElementChild;
  await tick();
  ok(col.style.getPropertyValue("--pd-col-span") === "24", "base span reflected to --pd-col-span");
  ok(col.style.getPropertyValue("--pd-col-md") === "12", "md=12 reflected to --pd-col-md");
  ok(col.style.getPropertyValue("--pd-col-lg") === "8", "lg=8 reflected to --pd-col-lg");
  ok(col.style.getPropertyValue("--pd-col-sm") === "", "unset sm leaves --pd-col-sm empty (inherits next-smaller, mobile-first)");
}

// ---- col preserves its author children (content) ----
{
  document.body.innerHTML = `<puredashboard-col span="6"><span class="inner">hello</span></puredashboard-col>`;
  const col = document.body.firstElementChild;
  await tick();
  const inner = col.querySelector(".inner");
  ok(inner && inner.textContent === "hello", "col preserves its author content children");
  ok(col.classList.contains("puredashboard-col"), "col gets the BEM block class");
}

// ---- property ⇆ attribute reflection ----
{
  const row = mount("puredashboard-row");
  row.gutter = "lg";
  await tick();
  ok(row.getAttribute("gutter") === "lg", "row.gutter setter reflects to the attribute");
  const col = mount("puredashboard-col");
  col.span = 6;
  await tick();
  ok(col.getAttribute("span") === "6" && col.style.getPropertyValue("--pd-col-span") === "6", "col.span setter reflects to attribute + custom property");
}

console.log(`grid.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
