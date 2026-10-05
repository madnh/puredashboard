// Tests for field.js (<puredashboard-field>): label / hint / error wired to the control's inner field.
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic. The MutationObserver
// that re-wires after a control re-renders is real in jsdom, so those paths are exercised too.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "MutationObserver"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const settle = () => new Promise((r) => setTimeout(r, 0)); // let MutationObserver callbacks run

await import("../src/input.js");
const { PuredashboardField } = await import("../src/field.js");
void PuredashboardField;

// ---- label + hint + error around a library control, wired to its inner <input> ----
{
  document.body.innerHTML = `<puredashboard-field label="Email" hint="We never share it." error="Required"><puredashboard-input name="email"></puredashboard-input></puredashboard-field>`;
  const f = document.body.firstElementChild;
  const ctl = f.querySelector("puredashboard-input");
  await tick(); await settle();
  const inner = ctl.querySelector("input");
  const lbl = f.querySelector(".puredashboard-field__label");
  const hint = f.querySelector(".puredashboard-field__hint");
  const err = f.querySelector(".puredashboard-field__error");
  ok(lbl && lbl.tagName === "LABEL" && lbl.textContent === "Email", "visible <label> with the label text");
  ok(ctl.id && lbl.htmlFor === ctl.id, "label for= the control (an id generated for it)");
  ok([...f.children].join() === [lbl, ctl, hint, err].join(), "order: label, control, hint, error");
  ok(f.children[1] === ctl && ctl.parentElement === f, "the author's control stays an unmoved child");
  ok(err.getAttribute("role") === "alert" && err.textContent === "Required", "error is an alert with the text");
  ok((inner.getAttribute("aria-labelledby") || "").split(" ").includes(lbl.id), "inner input aria-labelledby includes the label id");
  const desc = (inner.getAttribute("aria-describedby") || "").split(" ");
  ok(desc.includes(hint.id) && desc.includes(err.id), "inner input aria-describedby includes hint and error ids");
  ok(inner.getAttribute("aria-invalid") === "true", "inner input aria-invalid while there is an error");
  ok([lbl, hint, err].every((p) => p.classList.contains("js-puredashboard-field__part") && p.classList.contains("puredashboard-field__part")), "parts carry the js- hook and the style class");

  // the control re-renders (its own value changes): our wiring survives
  ctl.value = "a@b.c"; await tick(); await settle();
  const desc2 = (ctl.querySelector("input").getAttribute("aria-describedby") || "").split(" ");
  ok(desc2.includes(hint.id) && desc2.includes(err.id), "wiring kept after the control re-renders");

  // clearing the error removes our id and our invalid mark
  f.error = ""; await tick(); await settle();
  ok(!f.querySelector(".puredashboard-field__error"), "clearing error removes the error node");
  const desc3 = (inner.getAttribute("aria-describedby") || "").split(" ");
  ok(!desc3.includes(err.id) && desc3.includes(hint.id), "error id dropped from aria-describedby, hint kept");
  ok(inner.getAttribute("aria-invalid") === "false", "aria-invalid back to what the control says");
  f.removeAttribute("hint"); await tick(); await settle();
  ok(!f.querySelector(".puredashboard-field__hint") && !(inner.getAttribute("aria-describedby") || "").includes("field__hint"), "removing the hint attribute removes the hint and its id");
  f.label = ""; await tick(); await settle();
  ok(!f.querySelector("label") && !(inner.getAttribute("aria-labelledby") || "").includes("field__label"), "clearing label removes the label and its id");
}

// ---- a click on the label focuses a custom-element control ----
{
  document.body.innerHTML = `<puredashboard-field label="Name"><puredashboard-input></puredashboard-input></puredashboard-field>`;
  const f = document.body.firstElementChild;
  await tick(); await settle();
  f.querySelector("label").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok(document.activeElement === f.querySelector("puredashboard-input input"), "label click focuses the custom control's inner input");
  f.querySelector("puredashboard-input input").blur();
  f.focus();
  ok(document.activeElement === f.querySelector("puredashboard-input input"), "field.focus() focuses the control");
}

// ---- native control, and a control appended after connect ----
{
  const f = document.createElement("puredashboard-field");
  f.label = "Qty"; f.hint = "1-9";
  document.body.replaceChildren(f);
  const input = document.createElement("input");
  input.id = "qty";
  f.append(input);
  await tick(); await settle();
  const lbl = f.querySelector("label");
  ok(lbl && lbl.htmlFor === "qty", "control appended later: label for= its existing id");
  ok(f.firstElementChild === lbl && f.children[1] === input, "parts re-ordered around the late control");
  ok((input.getAttribute("aria-describedby") || "").includes(f.querySelector(".puredashboard-field__hint").id), "native control gets the hint id directly");
  input.setAttribute("aria-describedby", "own");
  await settle();
  const d = input.getAttribute("aria-describedby").split(" ");
  ok(d.includes("own") && d.some((x) => x.includes("field__hint")), "an author's own describedby id is kept alongside ours");
}

// ---- stylesheet is part of the bundle ----
{
  const css = readFileSync(new URL("../src/components.css", import.meta.url), "utf8");
  ok(/@import\s+"field\.css"/.test(css), "components.css imports field.css");
}

console.log(`field.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
