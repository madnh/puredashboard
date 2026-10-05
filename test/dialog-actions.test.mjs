// Tests for dialog.js's `actions` option: footer buttons rendered by the library as
// <puredashboard-button>. Separate from dialog.test.mjs because this path needs custom
// elements (button.js is loaded on demand by dialog.js — this file never imports it).
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const wait = () => new Promise((r) => setTimeout(r, 30));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "HTMLDialogElement", "customElements", "CustomEvent", "Node", "NodeFilter", "Event", "MouseEvent", "KeyboardEvent", "requestAnimationFrame", "cancelAnimationFrame"])
  global[k] = w[k];
global.queueMicrotask = queueMicrotask;

const { dialog } = await import("../src/dialog.js");
ok(!customElements.get("puredashboard-button"), "precondition: button.js not loaded by this test");

// ---- actions render as library buttons in a footer row; button.js is loaded on demand ----
{
  const d = dialog({ title: "Delete?", content: "Sure?", actions: [
    { label: "Cancel", value: "cancel" },
    { label: "Delete", value: "ok", variant: "primary", danger: true, attrs: { "data-act": "del" } },
    { label: "Later", disabled: true },
  ] });
  d.show();
  await wait();
  ok(customElements.get("puredashboard-button"), "button.js was loaded by dialog.js when actions were used");
  const row = d.el.querySelector(".puredashboard-dialog__footer > .puredashboard-dialog__actions");
  ok(row, "footer created (none was given) with an actions row");
  const bs = [...row.children];
  ok(bs.length === 3 && bs.every((b) => b.tagName === "PUREDASHBOARD-BUTTON"), "one <puredashboard-button> per action, in order");
  ok(d.actions.length === 3 && d.actions.every((b, i) => b === bs[i]), "ctrl.actions returns the same elements in order");
  ok(bs.map((b) => b.textContent.trim()).join() === "Cancel,Delete,Later", "labels as text");
  ok(bs[1].getAttribute("variant") === "primary" && bs[1].hasAttribute("danger") && bs[1].dataset.act === "del", "variant, danger and attrs applied");
  ok(bs[2].hasAttribute("disabled"), "disabled applied");
  ok(bs.every((b) => b.querySelector("button")), "buttons upgraded: each has its inner native <button>");
  let result;
  d.closed.then((v) => { result = v; });
  bs[1].querySelector("button").click();
  await wait();
  ok(result === "ok" && !d.el.isConnected, "a click without onclick closes the dialog with that action's value");
}

// ---- onclick runs instead of closing; actions append after an author footer ----
{
  let got = null;
  const d = dialog({ title: "Edit", footer: "note", actions: [{ label: "Save", onclick: (ev, ctrl) => { got = [ev.type, ctrl]; } }] });
  d.show();
  await wait();
  const foot = d.el.querySelector(".puredashboard-dialog__footer");
  ok(foot.firstChild.nodeType === 3 && foot.firstChild.textContent === "note" && foot.lastElementChild.classList.contains("puredashboard-dialog__actions"), "actions row appended after the author's footer content");
  d.actions[0].querySelector("button").click();
  await wait();
  ok(got && got[0] === "click" && got[1] === d, "onclick(ev, ctrl) called with the dialog controller");
  ok(d.el.isConnected, "onclick: the dialog stays open");
  d.close();
}

// ---- without actions nothing changes ----
{
  const d = dialog({ title: "Plain", content: "x" });
  ok(Array.isArray(d.actions) && d.actions.length === 0, "no actions: ctrl.actions is empty");
  ok(d.footer === null && !d.el.querySelector(".puredashboard-dialog__footer"), "no actions, no footer: no footer element");
  d.close();
}

console.log(`dialog-actions.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
