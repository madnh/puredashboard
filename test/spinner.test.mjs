// Tests for spinner.js (<puredashboard-spinner>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, a11y wiring and logic.
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

const { PuredashboardSpinner } = await import("../src/spinner.js");
void PuredashboardSpinner;

// ---- role=status + aria-live + default aria-label ----
{
  const el = mount("puredashboard-spinner");
  await tick();
  ok(el.getAttribute("role") === "status", "host has role=status");
  ok(el.getAttribute("aria-live") === "polite", "host has aria-live=polite");
  ok(el.getAttribute("aria-label") === "Loading", "default accessible label is Loading");
  const ring = el.querySelector(".puredashboard-spinner__ring");
  ok(ring, "renders the ring element");
  ok(ring.getAttribute("aria-hidden") === "true", "the spinning ring is aria-hidden");
}

// ---- label override sets the aria-label ----
{
  const el = mount("puredashboard-spinner");
  el.label = "Saving";
  await tick();
  ok(el.getAttribute("aria-label") === "Saving", "label overrides the default aria-label");
}

// ---- named size modifier + numeric custom property ----
{
  const el = mount("puredashboard-spinner");
  el.size = "lg";
  await tick();
  ok(el.querySelector(".puredashboard-spinner__ring--lg"), "size=lg adds the modifier class");
  const el2 = mount("puredashboard-spinner");
  el2.size = "48";
  await tick();
  const ring2 = el2.querySelector(".puredashboard-spinner__ring");
  ok(ring2.getAttribute("style").includes("--pd-spinner-size:48px"), "numeric size sets --pd-spinner-size in px");
}

// ---- labelVisible shows the text and wires aria-labelledby ----
{
  const el = mount("puredashboard-spinner");
  el.label = "Uploading";
  el.labelVisible = true;
  await tick();
  const lbl = el.querySelector(".puredashboard-spinner__label");
  ok(lbl && lbl.textContent === "Uploading", "visible label text rendered exactly");
  ok(!lbl.classList.contains("puredashboard-spinner__label--sr"), "visible label is not sr-only");
  ok(lbl.id && el.getAttribute("aria-labelledby") === lbl.id, "aria-labelledby points at the visible label");
  ok(!el.hasAttribute("aria-label"), "aria-label dropped when the label is visible");
}

// ---- label is sr-only by default (name via aria-label, not labelledby) ----
{
  const el = mount("puredashboard-spinner");
  await tick();
  const lbl = el.querySelector(".puredashboard-spinner__label");
  ok(lbl.classList.contains("puredashboard-spinner__label--sr"), "label is sr-only when not labelVisible");
  ok(!el.hasAttribute("aria-labelledby"), "no aria-labelledby when the label is sr-only");
}

// ---- inline modifier ----
{
  const el = mount("puredashboard-spinner");
  el.inline = true;
  await tick();
  ok(el.classList.contains("puredashboard-spinner--inline"), "inline adds the modifier class on the host");
}

// ---- declarative HTML attributes reflect into properties ----
{
  document.body.innerHTML = `<puredashboard-spinner size="sm" label="Fetching" label-visible inline></puredashboard-spinner>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.size === "sm", "size attribute reflected to property");
  ok(el.label === "Fetching", "label attribute reflected");
  ok(el.labelVisible === true, "label-visible boolean attribute reflected");
  ok(el.inline === true, "inline boolean attribute reflected");
  ok(el.querySelector(".puredashboard-spinner__ring--sm"), "reflected size reaches the ring");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-spinner");
  el.labels = { loading: "Đang tải" };
  await tick();
  ok(el._label("loading") === "Đang tải", "labels override the default string");
  ok(el.getAttribute("aria-label") === "Đang tải", "overridden default label used as aria-label");
  const el2 = mount("puredashboard-spinner");
  await tick();
  ok(el2._label("loading") === "Loading", "default label kept when not overridden");
}

console.log(`spinner.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
