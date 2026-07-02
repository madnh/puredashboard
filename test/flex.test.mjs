// Tests for flex.js (<puredashboard-flex>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, props and reflection.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardFlex } = await import("../src/flex.js");
void PuredashboardFlex;

// ---- children preserved as direct flex items (not moved/wrapped) ----
{
  const el = mount("puredashboard-flex");
  const a = document.createElement("div");
  const b = document.createElement("div");
  const c = document.createElement("div");
  el.append(a, b, c);
  ok(el.children.length === 3, "all three children preserved");
  ok(el.children[0] === a && el.children[1] === b && el.children[2] === c, "children kept as DIRECT children, in order");
  ok(a.parentNode === el, "no wrapper element inserted around a child");
  ok(el.classList.contains("puredashboard-flex"), "host carries the base block class (becomes the flex container)");
}

// ---- vertical modifier ----
{
  const el = mount("puredashboard-flex");
  ok(!el.classList.contains("puredashboard-flex--vertical"), "row by default (no --vertical)");
  ok(el.vertical === false, "vertical defaults to false");
  el.vertical = true;
  ok(el.classList.contains("puredashboard-flex--vertical"), "vertical=true adds the modifier");
  ok(el.vertical === true, "vertical property reflects true");
  el.vertical = false;
  ok(!el.classList.contains("puredashboard-flex--vertical"), "clearing vertical removes the modifier");
}

// ---- justify variants ----
{
  const el = mount("puredashboard-flex");
  for (const j of ["start", "center", "end", "between", "around", "evenly"]) {
    el.justify = j;
    ok(el.classList.contains(`puredashboard-flex--justify-${j}`), `justify=${j} adds its modifier`);
  }
  // only one justify class at a time
  el.justify = "center";
  ok(!el.classList.contains("puredashboard-flex--justify-evenly"), "previous justify modifier is cleared");
  // unknown value clears all justify modifiers
  el.justify = "bogus";
  ok(!el.classList.contains("puredashboard-flex--justify-center"), "unknown justify clears the modifier");
}

// ---- align variants ----
{
  const el = mount("puredashboard-flex");
  for (const a of ["start", "center", "end", "stretch", "baseline"]) {
    el.align = a;
    ok(el.classList.contains(`puredashboard-flex--align-${a}`), `align=${a} adds its modifier`);
  }
  el.align = "center";
  ok(!el.classList.contains("puredashboard-flex--align-baseline"), "previous align modifier is cleared");
}

// ---- wrap: boolean, "wrap", "nowrap", "reverse" ----
{
  const el = mount("puredashboard-flex");
  ok(el.wrap === false, "wrap defaults to false (nowrap)");
  ok(!el.classList.contains("puredashboard-flex--wrap"), "no wrap modifier by default");
  el.wrap = true;
  ok(el.classList.contains("puredashboard-flex--wrap") && el.wrap === true, "wrap=true adds --wrap");
  el.wrap = "reverse";
  ok(el.classList.contains("puredashboard-flex--wrap-reverse"), "wrap='reverse' adds --wrap-reverse");
  ok(!el.classList.contains("puredashboard-flex--wrap"), "--wrap cleared when reverse selected");
  ok(el.wrap === "reverse", "wrap property returns 'reverse'");
  el.wrap = "nowrap";
  ok(el.wrap === false && !el.classList.contains("puredashboard-flex--wrap-reverse"), "wrap='nowrap' turns wrapping off");
  el.wrap = "wrap";
  ok(el.wrap === true && el.classList.contains("puredashboard-flex--wrap"), "wrap='wrap' turns wrapping on");
}

// ---- gap maps: named tokens + raw length ----
{
  const el = mount("puredashboard-flex");
  ok(el.style.getPropertyValue("--pd-flex-gap") === "", "no gap by default");
  el.gap = "sm";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "var(--sp-2, 8px)", "gap=sm → --sp-2 token");
  el.gap = "md";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "var(--sp-3, 12px)", "gap=md → --sp-3 token");
  el.gap = "lg";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "var(--sp-4, 16px)", "gap=lg → --sp-4 token");
  el.gap = "12px";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "12px", "raw length gap used verbatim");
  el.gap = "1rem";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "1rem", "raw rem length used verbatim");
  el.gap = "";
  ok(el.style.getPropertyValue("--pd-flex-gap") === "", "clearing gap removes the custom property");
}

// ---- declarative attributes reflect into properties + modifiers ----
{
  document.body.innerHTML = `<puredashboard-flex vertical justify="between" align="center" wrap gap="md"></puredashboard-flex>`;
  const el = document.body.firstElementChild;
  ok(el.vertical === true, "vertical attribute reflected to property");
  ok(el.justify === "between", "justify attribute reflected");
  ok(el.align === "center", "align attribute reflected");
  ok(el.wrap === true, "bare wrap attribute → true");
  ok(el.gap === "md", "gap attribute reflected");
  ok(el.classList.contains("puredashboard-flex--vertical"), "vertical attr applies its modifier");
  ok(el.classList.contains("puredashboard-flex--justify-between"), "justify attr applies its modifier");
  ok(el.classList.contains("puredashboard-flex--align-center"), "align attr applies its modifier");
  ok(el.classList.contains("puredashboard-flex--wrap"), "wrap attr applies its modifier");
  ok(el.style.getPropertyValue("--pd-flex-gap") === "var(--sp-3, 12px)", "gap attr resolves the token");
}

// ---- attribute CHANGE updates live ----
{
  document.body.innerHTML = `<puredashboard-flex justify="start"></puredashboard-flex>`;
  const el = document.body.firstElementChild;
  ok(el.classList.contains("puredashboard-flex--justify-start"), "initial justify modifier present");
  el.setAttribute("justify", "end");
  ok(el.classList.contains("puredashboard-flex--justify-end"), "changing the justify attribute updates the modifier");
  ok(!el.classList.contains("puredashboard-flex--justify-start"), "old justify modifier removed on change");
  el.setAttribute("wrap", "reverse");
  ok(el.classList.contains("puredashboard-flex--wrap-reverse"), "setting wrap attr to reverse updates live");
  el.removeAttribute("wrap");
  ok(el.wrap === false && !el.classList.contains("puredashboard-flex--wrap-reverse"), "removing wrap attr turns wrapping off");
  el.setAttribute("gap", "20px");
  ok(el.style.getPropertyValue("--pd-flex-gap") === "20px", "setting gap attr to a raw length updates live");
}

// ---- localisable labels (parity with the library; no strings by default) ----
{
  const el = mount("puredashboard-flex");
  el.labels = { note: "Ghi chú" };
  ok(el._label("note") === "Ghi chú", "labels override is available");
  ok(el._label("missing") === undefined, "unknown label key is undefined by default");
}

console.log(`flex.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
