// Tests for combobox.js `multiple` (string[] value, puredashboard-tag chips) and a golden
// replay proving the single-value path is unchanged by it.
// Run in isolation via Docker (no host install): `make -C test`.
//
// Golden: test/fixtures/combobox-single-golden.json was RECORDED from the combobox before
// `multiple` existed (GOLDEN_WRITE=1 prints the snapshots instead of comparing). Each step
// captures the normalised DOM (comment anchors dropped — `multiple` adds one empty template
// slot — and per-instance id counters replaced), value, input text, events and the form
// value / validity the component handed to ElementInternals (stubbed: jsdom's is partial).
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "FormData"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

// ElementInternals stub, installed before any element exists: records the last form value / validity.
const formLog = new WeakMap();
w.HTMLElement.prototype.attachInternals = function () {
  const host = this, rec = { value: undefined, validity: { flags: {}, msg: "" } };
  formLog.set(host, rec);
  return {
    form: null, labels: [], validity: { valid: true }, checkValidity: () => true,
    setFormValue(v) { rec.value = v instanceof w.FormData ? [...v.entries()].map(([k, x]) => `${k}=${x}`) : v; },
    setValidity(flags, msg) { rec.validity = { flags: { ...(flags || {}) }, msg: msg || "" }; },
  };
};

const { PuredashboardCombobox } = await import("../src/combobox.js");
void PuredashboardCombobox;

const OPTS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
  { value: "d", label: "Delta" },
];
const norm = (s) => s.replace(/(js-puredashboard-combobox__(?:list|opt|error)-)\d+/g, "$1N").replace(/<!--[^>]*-->/g, "");
const inputOf = (el) => el.querySelector(".js-puredashboard-combobox__input");
const typed = async (el, t) => { const i = inputOf(el); i.value = t; i.dispatchEvent(new w.Event("input", { bubbles: true })); await flush(); };
const key = async (el, k) => { inputOf(el).dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); await flush(); };
const outside = async () => { document.body.dispatchEvent(new w.Event("pointerdown", { bubbles: true })); await flush(); };
const pick = async (el, label) => { const o = [...el.querySelectorAll('[role="option"]')].find((x) => x.textContent === label); o.dispatchEvent(new w.MouseEvent("mousedown", { bubbles: true, cancelable: true })); await flush(); };
const focusIn = async (el) => { inputOf(el).dispatchEvent(new w.Event("focus")); await flush(); };

// ---- golden: single-value scripts ----
async function record(props, script) {
  document.body.replaceChildren();
  const el = document.createElement("puredashboard-combobox");
  el.setAttribute("name", "pick");
  Object.assign(el, props);
  const events = [];
  for (const t of ["change", "comboboxopen", "comboboxsearch"]) el.addEventListener(t, (e) => events.push([t, e.detail]));
  document.body.append(el);
  await flush();
  const snaps = [];
  const snap = (step) => {
    const rec = formLog.get(el) || {};
    snaps.push({ step, html: norm(el.innerHTML), value: el.value, text: inputOf(el).value, events: events.splice(0), form: { value: rec.value, validity: rec.validity } });
  };
  snap("mount");
  await script(el, snap);
  return snaps;
}
const scripts = {
  basic: [{ options: OPTS, placeholder: "Chọn", clearable: true }, async (el, snap) => {
    await focusIn(el); snap("open");
    await typed(el, "e"); snap("type e");
    await key(el, "ArrowDown"); snap("ArrowDown");
    await key(el, "ArrowDown"); snap("ArrowDown 2");
    await key(el, "Enter"); snap("Enter commits");
    await focusIn(el); snap("reopen");
    await pick(el, "Alpha"); snap("mousedown Alpha");
    await focusIn(el); await key(el, "Escape"); snap("Escape closes");
    await key(el, "Escape"); snap("2nd Escape clears");
    await focusIn(el); await typed(el, "delta"); await key(el, "Tab"); snap("Tab commits exact");
    el.querySelector(".puredashboard-combobox__clear").dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await flush(); snap("clear button");
    await focusIn(el); await typed(el, "zz"); snap("no results");
    await outside(); snap("outside click");
    el.value = "b"; await flush(); snap("value set");
    el.formResetCallback(); await flush(); snap("form reset");
  }],
  custom: [{ options: OPTS, allowCustom: true, required: true }, async (el, snap) => {
    await focusIn(el); await typed(el, "Free"); await outside(); snap("outside commits free text");
    await focusIn(el); snap("reopen over free text");
    await typed(el, "Beta"); await key(el, "Escape"); snap("Escape commits exact label");
    el.error = "Bad"; await flush(); snap("error");
    el.error = ""; el.value = ""; await flush(); snap("required empty");
    el.disabled = true; await flush(); await focusIn(el); snap("disabled");
  }],
};
const got = {};
for (const [name, [props, script]] of Object.entries(scripts)) got[name] = await record(props, script);
if (process.env.GOLDEN_WRITE) { console.log(JSON.stringify(got, null, 1)); process.exit(0); }
const golden = JSON.parse(readFileSync(new URL("./fixtures/combobox-single-golden.json", import.meta.url), "utf8"));
for (const name of Object.keys(scripts)) {
  ok(got[name].length === golden[name].length, `golden ${name}: same number of steps`);
  golden[name].forEach((g, i) => {
    const s = got[name][i] || {};
    for (const f of ["html", "value", "text", "events", "form"])
      ok(JSON.stringify(s[f]) === JSON.stringify(g[f]), `golden ${name} step "${g.step}": ${f} unchanged`);
  });
}

// ---- multiple: chips, toggling, list stays open, aria ----
{
  document.body.replaceChildren();
  const el = document.createElement("puredashboard-combobox");
  el.setAttribute("name", "tags");
  el.setAttribute("multiple", "");
  el.options = OPTS;
  const changes = [];
  el.addEventListener("change", (e) => changes.push(e.detail.value));
  document.body.append(el);
  await flush();
  ok(el.multiple === true && Array.isArray(el.value) && el.value.length === 0, "multiple attribute: value starts as []");
  await focusIn(el);
  ok(el.querySelector('[role="listbox"]').getAttribute("aria-multiselectable") === "true", "listbox is aria-multiselectable");
  await pick(el, "Alpha");
  await pick(el, "Delta");
  ok(JSON.stringify(el.value) === '["a","d"]', "two picks: value is the array of both");
  ok(inputOf(el).getAttribute("aria-expanded") === "true", "the list stays open after a pick");
  ok(JSON.stringify(changes) === '[["a"],["a","d"]]', "change carries the new array each time");
  const sel = [...el.querySelectorAll('[role="option"][aria-selected="true"]')].map((o) => o.textContent);
  ok(sel.join() === "Alpha,Delta", "chosen options are aria-selected");
  const chips = () => [...el.querySelectorAll("puredashboard-tag.puredashboard-combobox__chip")];
  ok(chips().map((c) => c.textContent.trim()).join() === "Alpha,Delta", "one puredashboard-tag chip per value, labelled");
  ok(chips()[0].querySelector(".js-puredashboard-tag__close")?.getAttribute("aria-label") === "Remove Alpha", "chip close button named Remove <label>");
  await pick(el, "Alpha");
  ok(JSON.stringify(el.value) === '["d"]', "picking a chosen option again removes it (toggle)");
  await pick(el, "Gamma");
  ok(JSON.stringify(el.value) === '["d"]', "a disabled option cannot be picked");
  await typed(el, "be");
  ok([...el.querySelectorAll(".js-puredashboard-combobox__option")].map((o) => o.textContent).join() === "Beta", "typed text still filters");
  await key(el, "ArrowDown"); await key(el, "Enter");
  ok(JSON.stringify(el.value) === '["d","b"]', "Enter on the active option adds it");
  ok(JSON.stringify((formLog.get(el) || {}).value) === '["tags=d","tags=b"]', "form value: the name repeated once per value");
  await typed(el, "");
  await key(el, "Backspace");
  ok(JSON.stringify(el.value) === '["d"]', "Backspace on an empty text box removes the last chip");
  await typed(el, "x");
  await key(el, "Backspace");
  ok(JSON.stringify(el.value) === '["d"]', "Backspace with text in the box edits the text, keeps the chips");
  await key(el, "Tab");
  ok(inputOf(el).getAttribute("aria-expanded") === "false" && JSON.stringify(el.value) === '["d"]', "Tab only closes: nothing is committed");
  ok(inputOf(el).value === "", "closed: the text box shows no value text (the chips do)");
}

// ---- multiple: removing a chip keeps keyboard focus in the control ----
{
  document.body.replaceChildren();
  const el = document.createElement("puredashboard-combobox");
  el.multiple = true; el.options = OPTS; el.value = ["a", "b", "d"];
  document.body.append(el);
  await flush();
  const chips = () => [...el.querySelectorAll("puredashboard-tag")];
  const closeOf = (i) => chips()[i].querySelector(".js-puredashboard-tag__close");
  closeOf(1).focus();
  closeOf(1).click(); await flush();
  ok(JSON.stringify(el.value) === '["a","d"]' && chips().length === 2, "chip close button removes that value (the tag stays managed by the combobox)");
  ok(document.activeElement === closeOf(1) && chips()[1].textContent.includes("Delta"), "focus moves to the NEXT chip's close button");
  closeOf(1).click(); await flush();
  ok(document.activeElement === closeOf(0), "last chip removed: focus moves to the previous chip");
  closeOf(0).click(); await flush();
  ok(document.activeElement === inputOf(el) && inputOf(el).getAttribute("aria-expanded") === "false", "no chip left: focus goes to the text box WITHOUT opening the list");
}

// ---- multiple: clear, Escape, required, reset ----
{
  document.body.replaceChildren();
  const el = document.createElement("puredashboard-combobox");
  el.setAttribute("name", "m");
  el.multiple = true; el.options = OPTS; el.clearable = true; el.required = true; el.value = ["a"];
  document.body.append(el);
  await flush();
  let last;
  el.addEventListener("change", (e) => { last = e.detail.value; });
  ok(el.querySelector(".puredashboard-combobox__clear"), "clearable shows the clear button while values are chosen");
  el.querySelector(".puredashboard-combobox__clear").dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await flush();
  ok(Array.isArray(el.value) && el.value.length === 0 && Array.isArray(last) && last.length === 0, "clear button: value [] and change carries []");
  ok((formLog.get(el) || {}).validity.flags.valueMissing === true, "required with no value: valueMissing");
  el.value = ["b"]; await flush();
  await key(el, "Escape");
  ok(el.value.length === 0, "Escape with the list closed clears all values");
  el.value = ["d"]; el.formResetCallback(); await flush();
  ok(Array.isArray(el.value) && el.value.length === 0, "form reset: back to []");
}

// ---- multiple: the chip styling ships with the component ----
{
  const css = readFileSync(new URL("../src/combobox.css", import.meta.url), "utf8");
  ok(/\.puredashboard-combobox__control--multiple\s*\{/.test(css) && /\.puredashboard-combobox__chip\s*\{/.test(css), "combobox.css styles the multiple control and its chips");
}

console.log(`combobox-multiple.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
