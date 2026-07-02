// Tests for titlebar.js (<puredashboard-titlebar>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, regions and events.
// (The drag region + app-region CSS and hover styling are verified in a real
// browser; jsdom can't model layout/paint. navigator.userAgentData is guarded.)
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
const mount = (tag) => { const el = document.createElement(tag); return el; };
const click = (el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));

const { PuredashboardTitlebar } = await import("../src/titlebar.js");
void PuredashboardTitlebar;

// ---- author children preserved into the trailing region ----
{
  const el = mount("puredashboard-titlebar");
  const btn = document.createElement("button");
  btn.id = "act";
  btn.textContent = "Settings";
  el.appendChild(btn);
  document.body.appendChild(el);
  await tick();
  const trailing = el.querySelector(".puredashboard-titlebar__region--trailing");
  ok(trailing, "trailing region is built on connect");
  ok(trailing.contains(btn), "unmarked author child is moved into the trailing region");
  ok(document.getElementById("act") === btn, "the live child node is preserved (not recreated)");
}

// ---- data-titlebar-* routes children to a specific region ----
{
  document.body.innerHTML = `<puredashboard-titlebar>
    <span data-titlebar-leading id="lead">L</span>
    <span data-titlebar-center id="mid">M</span>
    <span data-titlebar-trailing id="tail">T</span>
  </puredashboard-titlebar>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.querySelector(".puredashboard-titlebar__region--leading").contains(document.getElementById("lead")), "data-titlebar-leading → leading");
  ok(el.querySelector(".puredashboard-titlebar__region--center").contains(document.getElementById("mid")), "data-titlebar-center → center");
  ok(el.querySelector(".puredashboard-titlebar__region--trailing").contains(document.getElementById("tail")), "data-titlebar-trailing → trailing");
}

// ---- title property renders a label in the center ----
{
  const el = mount("puredashboard-titlebar");
  el.title = "My App";
  document.body.appendChild(el);
  await tick();
  const label = el.querySelector(".js-puredashboard-titlebar__title");
  ok(label && label.textContent === "My App", "title renders exactly in the center region");
  ok(el.querySelector(".puredashboard-titlebar__region--center").contains(label), "title label lives in the center region");
  // clearing the title removes the node
  el.title = "";
  await tick();
  ok(!el.querySelector(".js-puredashboard-titlebar__title"), "clearing title removes the label node");
}

// ---- platform=windows renders 3 control buttons with aria-labels ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "windows";
  document.body.appendChild(el);
  await tick();
  const ctrls = el.querySelectorAll(".js-puredashboard-titlebar__control");
  ok(ctrls.length === 3, "windows renders exactly 3 window-control buttons");
  const acts = [...ctrls].map((b) => b.getAttribute("data-act"));
  ok(acts.join(",") === "minimize,maximizetoggle,close", "buttons are minimize / maximizetoggle / close in order");
  ok([...ctrls].every((b) => b.tagName === "BUTTON" && b.type === "button"), "controls are real <button type=button>");
  ok(ctrls[0].getAttribute("aria-label") === "Minimize", "minimize has an aria-label");
  ok(ctrls[1].getAttribute("aria-label") === "Maximize", "maximize has an aria-label");
  ok(ctrls[2].getAttribute("aria-label") === "Close", "close has an aria-label");
  ok(ctrls[2].classList.contains("puredashboard-titlebar__control--close"), "close button carries the danger modifier class");
  ok(el.classList.contains("puredashboard-titlebar--windows"), "host reflects the resolved platform as a class");
  ok(ctrls[0].classList.contains("puredashboard-titlebar__nodrag"), "controls carry the no-drag helper class");
}

// ---- clicking each control emits the matching bubbling event ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "windows";
  document.body.appendChild(el);
  await tick();
  const got = [];
  for (const name of ["minimize", "maximizetoggle", "close"]) el.addEventListener(name, (e) => got.push([name, e.bubbles]));
  const [min, max, close] = el.querySelectorAll(".js-puredashboard-titlebar__control");
  click(min); click(max); click(close);
  await tick();
  ok(got.length === 3, "three control events fired");
  ok(got[0][0] === "minimize" && got[1][0] === "maximizetoggle" && got[2][0] === "close", "each button emits its own event");
  ok(got.every(([, bubbles]) => bubbles === true), "control events bubble");
}

// ---- platform=mac reserves the inset + renders NO controls by default ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "mac";
  el.title = "Centered";
  document.body.appendChild(el);
  await tick();
  ok(el.classList.contains("puredashboard-titlebar--mac"), "host reflects mac platform (drives the traffic-light inset via CSS)");
  ok(el.querySelectorAll(".js-puredashboard-titlebar__control").length === 0, "mac renders no custom window controls by default");
  ok(el.querySelector(".puredashboard-titlebar__region--leading"), "mac still builds a leading region to reserve the inset");
}

// ---- controls=true forces the buttons even on mac ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "mac";
  el.controls = true;
  document.body.appendChild(el);
  await tick();
  ok(el.querySelectorAll(".js-puredashboard-titlebar__control").length === 3, "controls=true forces the window buttons on mac");
  // toggling controls off removes them again
  el.controls = false;
  await tick();
  ok(el.querySelectorAll(".js-puredashboard-titlebar__control").length === 0, "clearing controls removes the forced buttons on mac");
}

// ---- maximized swaps the maximize glyph + aria-label for restore ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "windows";
  document.body.appendChild(el);
  await tick();
  const maxBtn = el.querySelectorAll(".js-puredashboard-titlebar__control")[1];
  const before = maxBtn.querySelector(".puredashboard-titlebar__control-icon").innerHTML;
  ok(maxBtn.getAttribute("aria-label") === "Maximize", "maximize label before toggling");
  el.maximized = true;
  await tick();
  ok(el.hasAttribute("maximized"), "maximized reflects to an attribute");
  const after = maxBtn.querySelector(".puredashboard-titlebar__control-icon").innerHTML;
  ok(maxBtn.getAttribute("aria-label") === "Restore", "aria-label becomes Restore when maximized");
  ok(after !== before, "the maximize glyph is swapped for the restore glyph");
  el.maximized = false;
  await tick();
  ok(maxBtn.getAttribute("aria-label") === "Maximize", "aria-label returns to Maximize when restored");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-titlebar");
  el.platform = "windows";
  el.labels = { close: "Đóng" };
  document.body.appendChild(el);
  await tick();
  const close = el.querySelectorAll(".js-puredashboard-titlebar__control")[2];
  ok(close.getAttribute("aria-label") === "Đóng", "labels override the control aria-label");
  ok(el._label("minimize") === "Minimize", "unset labels keep the English default");
}

console.log(`titlebar.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
