// Tests for space.js (<puredashboard-space>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, layout classes and
// the dynamic --pd-space-gap custom property. (Real flex painting is a browser
// concern; here we verify the class/custom-property contract the CSS keys off.)
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

const { PuredashboardSpace } = await import("../src/space.js");
void PuredashboardSpace;

// ---- children are preserved as direct flex items (not moved/wrapped) ----
{
  const el = mount("puredashboard-space");
  const a = document.createElement("button"); a.textContent = "One";
  const b = document.createElement("button"); b.textContent = "Two";
  el.append(a, b);
  await tick();
  ok(el.classList.contains("puredashboard-space"), "host carries the block class (is the flex container)");
  ok(el.children.length === 2, "both author children are preserved");
  ok(el.children[0] === a && el.children[1] === b, "children are the DIRECT children of the host (no wrapper)");
  ok(a.parentElement === el && b.parentElement === el, "no wrapping element was inserted around the items");
}

// ---- direction: horizontal default, vertical modifier ----
{
  const el = mount("puredashboard-space");
  await tick();
  ok(el.direction === "horizontal", "direction defaults to horizontal");
  ok(el.classList.contains("puredashboard-space--horizontal"), "horizontal modifier applied by default");
  el.direction = "vertical";
  await tick();
  ok(el.classList.contains("puredashboard-space--vertical"), "vertical modifier applied when direction=vertical");
  ok(!el.classList.contains("puredashboard-space--horizontal"), "horizontal modifier removed when switching to vertical");
}

// ---- size maps to the --pd-space-gap custom property (named tokens) ----
{
  const el = mount("puredashboard-space");
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "var(--sp-3, 12px)", "default size=md maps gap to --sp-3");
  el.size = "sm";
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "var(--sp-2, 8px)", "size=sm maps gap to --sp-2");
  el.size = "lg";
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "var(--sp-4, 16px)", "size=lg maps gap to --sp-4");
}

// ---- numeric size maps to a raw px gap (number and numeric string) ----
{
  const el = mount("puredashboard-space");
  el.size = 24;
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "24px", "numeric size maps gap to a raw px value");
  el.size = "10";
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "10px", "numeric string size maps gap to a raw px value");
}

// ---- align + justify modifier classes ----
{
  const el = mount("puredashboard-space");
  el.align = "center";
  el.justify = "between";
  await tick();
  ok(el.classList.contains("puredashboard-space--align-center"), "align=center adds the align modifier");
  ok(el.classList.contains("puredashboard-space--justify-between"), "justify=between adds the justify modifier");
  el.align = "baseline";
  el.justify = "around";
  await tick();
  ok(el.classList.contains("puredashboard-space--align-baseline"), "changing align swaps to the new align modifier");
  ok(!el.classList.contains("puredashboard-space--align-center"), "the previous align modifier is removed");
  ok(el.classList.contains("puredashboard-space--justify-around"), "changing justify swaps to the new justify modifier");
  ok(!el.classList.contains("puredashboard-space--justify-between"), "the previous justify modifier is removed");
}

// ---- wrap: defaults true for horizontal, false for vertical, overridable ----
{
  const el = mount("puredashboard-space");
  await tick();
  ok(el.wrap === true, "wrap defaults to true for horizontal");
  ok(el.classList.contains("puredashboard-space--wrap"), "wrap modifier applied by default for horizontal");
  el.direction = "vertical";
  await tick();
  ok(el.wrap === false, "wrap defaults to false for vertical");
  ok(el.classList.contains("puredashboard-space--nowrap"), "nowrap modifier applied for vertical by default");
  el.wrap = true;
  await tick();
  ok(el.wrap === true, "wrap can be forced on for vertical");
  ok(el.classList.contains("puredashboard-space--wrap"), "wrap modifier applied when forced on");
}

// ---- declarative HTML attributes reflect into properties + classes ----
{
  document.body.innerHTML = `<puredashboard-space direction="vertical" size="lg" align="end" justify="center"></puredashboard-space>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.direction === "vertical", "direction attribute reflected to property");
  ok(el.size === "lg", "size attribute reflected to property");
  ok(el.align === "end", "align attribute reflected to property");
  ok(el.justify === "center", "justify attribute reflected to property");
  ok(el.classList.contains("puredashboard-space--vertical"), "direction attribute reaches the modifier class");
  ok(el.style.getPropertyValue("--pd-space-gap") === "var(--sp-4, 16px)", "size attribute reaches the gap property");
  ok(el.classList.contains("puredashboard-space--align-end"), "align attribute reaches the modifier class");
  ok(el.classList.contains("puredashboard-space--justify-center"), "justify attribute reaches the modifier class");
}

// ---- an attribute change updates the gap live ----
{
  document.body.innerHTML = `<puredashboard-space size="sm"></puredashboard-space>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "var(--sp-2, 8px)", "initial size attribute maps the gap");
  el.setAttribute("size", "40");
  await tick();
  ok(el.style.getPropertyValue("--pd-space-gap") === "40px", "changing the size attribute updates the gap live");
}

// ---- localisable labels (map is minimal but the override path exists) ----
{
  const el = mount("puredashboard-space");
  el.labels = { anything: "Xin chào" };
  await tick();
  ok(el._label("anything") === "Xin chào", "labels override is honoured");
  ok(el._label("missing") === undefined, "unset label key resolves to undefined");
}

console.log(`space.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
