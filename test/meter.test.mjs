// Tests for ../src/meter.js — <puredashboard-meter> in jsdom. A display-only gauge, so
// everything observable is here: structure, the role="meter" ARIA contract, clamping and
// a guarded range, the native <meter> low/high/optimum colour zones, Intl formatting,
// the label row, the accessible name precedence, and declarative attributes.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event"]) global[k] = w[k];

await import("../src/meter.js");

const B = "puredashboard-meter";
async function mount(props = {}, attrs = {}) {
  document.body.innerHTML = "";
  const el = document.createElement(B);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.assign(el, props);
  document.body.append(el);
  await tick(); await tick();
  return el;
}
const track = (el) => el.querySelector(`.${B}__track`);
const fill = (el) => el.querySelector(`.${B}__fill`);
const readout = (el) => el.querySelector(`.${B}__value`);
const pct = (el) => el.style.getPropertyValue("--pd-meter-pct");

// ================================================== structure + the ARIA contract
{
  const el = await mount({ value: 40 });
  const t = track(el);
  ok(t && t.getAttribute("role") === "meter", "role=meter (a reading, NOT role=progressbar)");
  ok(t.getAttribute("aria-valuenow") === "40" && t.getAttribute("aria-valuemin") === "0" && t.getAttribute("aria-valuemax") === "100",
    "aria-valuenow/min/max report the reading and its range");
  ok(t.getAttribute("aria-valuetext") === "40%", "aria-valuetext is the formatted reading");
  ok(fill(el) !== null && pct(el) === "40%", "the fill width comes from the dynamic --pd-meter-pct");
  ok(readout(el).textContent === "40%", "the reading is shown by default");
}
{
  const el = await mount({ value: 3, min: 1, max: 5 });
  const t = track(el);
  ok(t.getAttribute("aria-valuemin") === "1" && t.getAttribute("aria-valuemax") === "5", "a custom range is reported as-is");
  ok(pct(el) === "50%", "the fill is the fraction WITHIN [min, max], not value/max");
  ok(readout(el).textContent === "50%", "the default read-out is the percent of the range");
}

// =============================================================== clamping + guards
{
  const el = await mount({ value: 250 });
  ok(track(el).getAttribute("aria-valuenow") === "100" && pct(el) === "100%", "a value above max clamps to max");
  el.value = -40; await tick();
  ok(track(el).getAttribute("aria-valuenow") === "0" && pct(el) === "0%", "a value below min clamps to min");
  el.value = NaN; await tick();
  ok(track(el).getAttribute("aria-valuenow") === "0", "a non-numeric value falls back to min (never NaN)");
}
{
  const el = await mount({ value: 5, min: 10, max: 10 });     // empty/inverted range
  ok(pct(el) === "5%" && track(el).getAttribute("aria-valuemax") === "100", "a zero-width range falls back to 0..100 instead of dividing by zero");
}

// ================================== colour zones (native <meter> low/high/optimum)
{
  // optimum in the LOW region: low = green, middle = amber, high = red
  const el = await mount({ value: 20, low: 60, high: 80, optimum: 0 });
  ok(fill(el).classList.contains(`${B}__fill--optimum`), "optimum at the bottom: a low reading is optimum (green)");
  el.value = 70; await tick();
  ok(fill(el).classList.contains(`${B}__fill--suboptimal`), "…the middle region is suboptimal (amber)");
  el.value = 95; await tick();
  ok(fill(el).classList.contains(`${B}__fill--poor`), "…the far region is poor (red)");
}
{
  // optimum in the HIGH region: mirrored
  const el = await mount({ value: 95, low: 20, high: 40, optimum: 100 });
  ok(fill(el).classList.contains(`${B}__fill--optimum`), "optimum at the top: a high reading is optimum");
  el.value = 10; await tick();
  ok(fill(el).classList.contains(`${B}__fill--poor`), "…and the low end is poor");
}
{
  // optimum in the MIDDLE: both ends are merely suboptimal (per the HTML spec)
  const el = await mount({ value: 50, low: 40, high: 60, optimum: 50 });
  ok(fill(el).classList.contains(`${B}__fill--optimum`), "optimum in the middle: the middle band is optimum");
  el.value = 10; await tick();
  ok(fill(el).classList.contains(`${B}__fill--suboptimal`), "…the low end is suboptimal, not poor");
  el.value = 90; await tick();
  ok(fill(el).classList.contains(`${B}__fill--suboptimal`), "…and so is the high end");
}
{
  const el = await mount({ value: 90 });
  ok(fill(el).className === `${B}__fill`, "no low/high/optimum → no zone modifier (plain accent bar)");
  el.low = 60; await tick();
  ok(fill(el).className === `${B}__fill`, "zones stay off until ALL of low/high/optimum are set");
}

// ===================================================================== formatting
{
  const el = await mount({ value: 8.5, max: 16, format: { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }, locale: "en-US" });
  ok(readout(el).textContent === "8.5 GB", "format: Intl.NumberFormat options applied to the RAW value");
  ok(track(el).getAttribute("aria-valuetext") === "8.5 GB", "…and the same text goes to aria-valuetext");
}
{
  const el = await mount({ value: 1234, max: 5000, format: { notation: "compact" }, locale: "en-US" });
  ok(readout(el).textContent === "1.2K", "format: compact notation works (Intl is a browser built-in — no dependency)");
}
{
  const el = await mount({ value: 40, format: { style: "nonsense" } });
  ok(readout(el).textContent === "40", "an invalid format falls back to the plain number instead of throwing");
}
{
  const el = await mount({ value: 40, labels: { valueText: (f, v, p) => `${f} (${v} of 100, ${p}%)` } });
  ok(track(el).getAttribute("aria-valuetext") === "40% (40 of 100, 40%)", "labels.valueText(formatted, value, pct) customises what a screen reader says");
}

// ================================================================== the label row
{
  const el = await mount({ label: "Disk used", value: 40 });
  const lab = el.querySelector(`.${B}__label`);
  ok(lab && lab.textContent === "Disk used", "label: rendered in the head row");
  ok(track(el).getAttribute("aria-labelledby") === lab.id && !!lab.id, "label: names the meter via aria-labelledby");
  ok(track(el).getAttribute("aria-label") === "", "label: no competing aria-label when the visible label names it");
}
{
  const el = await mount({ value: 40, showValue: false });
  ok(readout(el) === null, "showValue=false hides the reading");
  ok(el.querySelector(`.${B}__head`) === null, "…and with no label either, the whole head row is dropped");
}
{
  const el = await mount({ label: "<img src=x onerror=alert(1)>", value: 1 });
  ok(el.querySelector("img") === null && el.querySelector(`.${B}__label`).textContent === "<img src=x onerror=alert(1)>",
    "label: a string is escaped, never parsed as markup");
}
{
  const node = document.createElement("strong");
  node.textContent = "Rich";
  const el = await mount({ label: node, value: 1 });
  ok(el.querySelector(`.${B}__label strong`) !== null, "label: a DOM node renders as-is (rich content)");
}

// ============================================================ accessible naming
{
  const el = await mount({ value: 10 });
  ok(track(el).getAttribute("aria-label") === "Meter", "unnamed: the LABELS fallback names the meter");
}
{
  const el = await mount({ label: "Disk used", value: 10 }, { "aria-label": "Storage on web-01" });
  ok(track(el).getAttribute("aria-label") === "Storage on web-01" && track(el).getAttribute("aria-labelledby") === "",
    "an author aria-label wins over the visible label (and lands on the role=meter element)");
}
{
  const el = await mount({ value: 10, labels: { meter: "Đồng hồ đo" } });
  ok(track(el).getAttribute("aria-label") === "Đồng hồ đo", "labels.meter localises the fallback name");
}

// ================================================================== declarative
{
  const el = await mount({}, { value: "82", min: "0", max: "200", low: "60", high: "150", optimum: "0", label: "Memory", size: "lg" });
  ok(el.value === 82 && el.max === 200 && el.low === 60, "numeric attributes coerce to numbers");
  ok(track(el).getAttribute("aria-valuenow") === "82" && pct(el) === "41%", "…and drive the reading");
  ok(el.querySelector(`.${B}__label`).textContent === "Memory", "label attribute renders");
  ok(el.querySelector(`.${B}__wrap`).classList.contains(`${B}--lg`), "size attribute adds the modifier class");
  ok(fill(el).classList.contains(`${B}__fill--suboptimal`), "zones work from attributes too");
}
{
  const el = await mount({}, { value: "40", "show-value": "false" });
  ok(readout(el) === null, 'show-value="false" hides the reading');
  el.setAttribute("show-value", "");
  await tick();
  ok(readout(el) !== null, "show-value (bare) shows it again");
}
{
  const el = await mount({ value: 10 });
  el.setAttribute("value", "70");
  await tick();
  ok(track(el).getAttribute("aria-valuenow") === "70" && pct(el) === "70%", "changing the value attribute after mount re-renders");
}

console.log(`\nmeter.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
