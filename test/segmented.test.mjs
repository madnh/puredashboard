// Tests for segmented.js (<puredashboard-segmented>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };
const segs = (el) => [...el.querySelectorAll(".js-puredashboard-segmented__segment")];
const key = (node, k) => node.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));

const { PuredashboardSegmented } = await import("../src/segmented.js");
void PuredashboardSegmented;

// ---- roles + aria-checked + default selection (object options) ----
{
  const el = mount("puredashboard-segmented");
  el.options = [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }];
  await tick();
  const track = el.querySelector(".puredashboard-segmented__track");
  ok(track && track.getAttribute("role") === "radiogroup", "container is role=radiogroup");
  const s = segs(el);
  ok(s.length === 2, "renders one segment per option");
  ok(s.every((x) => x.getAttribute("role") === "radio"), "each segment is role=radio");
  ok(el.value === "list", "value defaults to the first enabled option");
  ok(s[0].getAttribute("aria-checked") === "true", "first segment aria-checked=true");
  ok(s[1].getAttribute("aria-checked") === "false", "second segment aria-checked=false");
  ok(s[0].querySelector(".puredashboard-segmented__text").textContent === "List", "option label rendered as content");
}

// ---- string[] shorthand options ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["day", "week", "month"];
  await tick();
  const s = segs(el);
  ok(s.length === 3, "string[] yields one segment each");
  ok(el.value === "day", "string[] default selection is first string");
  ok(s[2].querySelector(".puredashboard-segmented__text").textContent === "month", "string[] label = the string");
}

// ---- roving tabindex: exactly one tabbable (=0), on the selected segment ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b", "c"];
  el.value = "b";
  await tick();
  const s = segs(el);
  ok(s.map((x) => x.getAttribute("tabindex")).join(",") === "-1,0,-1", "roving tabindex: only selected is 0");
}

// ---- keyboard: ArrowRight moves + selects, wraps at the end ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b", "c"];
  await tick();
  const events = [];
  el.addEventListener("change", (e) => events.push(e.detail.value));
  key(segs(el)[0], "ArrowRight");
  await tick();
  ok(el.value === "b", "ArrowRight selects the next option");
  ok(events[0] === "b", "change detail.value on ArrowRight");
  key(segs(el)[1], "ArrowRight");
  await tick();
  key(segs(el)[2], "ArrowRight");
  await tick();
  ok(el.value === "a", "ArrowRight wraps from last to first");
}

// ---- keyboard: ArrowLeft/Up wraps backwards, Home/End jump to ends ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b", "c"];
  el.value = "a";
  await tick();
  key(segs(el)[0], "ArrowLeft");
  await tick();
  ok(el.value === "c", "ArrowLeft wraps from first to last");
  key(segs(el)[2], "Home");
  await tick();
  ok(el.value === "a", "Home selects the first option");
  key(segs(el)[0], "End");
  await tick();
  ok(el.value === "c", "End selects the last option");
  key(segs(el)[2], "ArrowUp");
  await tick();
  ok(el.value === "b", "ArrowUp moves to the previous option");
}

// ---- keyboard skips disabled options ----
{
  const el = mount("puredashboard-segmented");
  el.options = [{ value: "a", label: "A" }, { value: "b", label: "B", disabled: true }, { value: "c", label: "C" }];
  el.value = "a";
  await tick();
  key(segs(el)[0], "ArrowRight");
  await tick();
  ok(el.value === "c", "ArrowRight skips the disabled middle option");
  const s = segs(el);
  ok(s[1].disabled === true, "disabled option is a disabled button");
  ok(s[1].getAttribute("tabindex") === "-1", "disabled option is never the tabbable segment");
  ok(s[1].classList.contains("puredashboard-segmented__segment--disabled"), "disabled option gets the modifier class");
}

// ---- click selects + emits change once, none on re-click ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b"];
  await tick();
  let count = 0, last = null;
  el.addEventListener("change", (e) => { count++; last = e.detail.value; });
  segs(el)[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === "b" && last === "b", "click selects the option and fires change");
  ok(count === 1, "exactly one change event on selection");
  segs(el)[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 1, "re-clicking the selected option fires no change");
}

// ---- block + size modifiers ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b"];
  el.block = true;
  el.size = "lg";
  await tick();
  const track = el.querySelector(".puredashboard-segmented__track");
  ok(track.classList.contains("puredashboard-segmented__track--block"), "block adds the block modifier");
  ok(track.classList.contains("puredashboard-segmented__track--lg"), "size=lg adds the lg modifier");
  const el2 = mount("puredashboard-segmented");
  el2.options = ["a"]; el2.size = "sm";
  await tick();
  ok(el2.querySelector(".puredashboard-segmented__track").classList.contains("puredashboard-segmented__track--sm"), "size=sm adds the sm modifier");
}

// ---- disabled whole control blocks selection ----
{
  const el = mount("puredashboard-segmented");
  el.options = ["a", "b"];
  el.disabled = true;
  await tick();
  const track = el.querySelector(".puredashboard-segmented__track");
  ok(track.classList.contains("puredashboard-segmented__track--disabled"), "disabled adds the track modifier");
  ok(track.getAttribute("aria-disabled") === "true", "disabled sets aria-disabled on the group");
  let fired = false;
  el.addEventListener("change", () => { fired = true; });
  segs(el)[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  key(segs(el)[0], "ArrowRight");
  await tick();
  ok(el.value === "a" && !fired, "disabled control ignores click and keyboard");
  ok(segs(el).every((x) => x.getAttribute("tabindex") === "-1"), "no segment is tabbable when disabled");
}

// ---- optional per-option icon (trusted inline SVG markup) ----
{
  const el = mount("puredashboard-segmented");
  el.options = [{ value: "a", label: "A", icon: "<svg data-icon></svg>" }, { value: "b", label: "B" }];
  await tick();
  const s = segs(el);
  ok(s[0].querySelector(".puredashboard-segmented__icon svg[data-icon]"), "option icon markup is rendered inside the segment");
  ok(!s[1].querySelector(".puredashboard-segmented__icon"), "no icon wrapper when the option has no icon");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-segmented");
  el.labels = { group: "Chế độ" };
  await tick();
  ok(el._label("group") === "Chế độ", "labels override the default group string");
  const el2 = mount("puredashboard-segmented");
  await tick();
  ok(el2._label("group") === "Segmented control", "default label kept when not overridden");
}

console.log(`segmented.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
