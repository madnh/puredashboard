// Tests for the value-control contract shared by input, textarea, number, select, date, time, datetime,
// color, slider, checkbox, switch, radio-group and combobox:
//   1. a consumer `input`/`change` listener on the HOST reads the NEW `.value`/`.checked`, even when it was
//      attached before the element connected (the sync runs in the capture phase — Reactive.on({ capture })).
//   2. `error` is cleared when the user changes the value, before the consumer's handler runs, so a handler
//      that sets it again keeps it.
//   3. both still hold after detach + re-attach (CLAUDE.md lifecycle rule).
// Run in isolation via Docker (no host install): `make -C test`.
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

for (const m of ["input", "textarea", "number", "select", "date", "time", "datetime", "color", "slider", "checkbox", "switch", "radio-group", "combobox"])
  await import(`../src/${m}.js`);

// Native-field wrappers: `field` is the inner control and `ev` the event a user edit fires on it;
// `prop` is the property the host mirrors it into; `next` then `other` are two successive user values.
const SELECT_OPTS = [{ value: "us", label: "United States" }, { value: "vn", label: "Vietnam" }];
const NATIVE = [
  { tag: "input", field: ".js-puredashboard-input__field", ev: "input", prop: "value", next: "https://x/?sku={code}", other: "b" },
  { tag: "textarea", field: ".js-puredashboard-textarea__field", ev: "input", prop: "value", next: "two\nlines", other: "c" },
  { tag: "number", field: ".js-puredashboard-number__field", ev: "input", prop: "value", next: "42", other: "7" },
  { tag: "date", field: ".js-puredashboard-date__field", ev: "input", prop: "value", next: "2026-10-29", other: "2026-10-30" },
  { tag: "time", field: ".js-puredashboard-time__field", ev: "input", prop: "value", next: "10:30", other: "11:00" },
  { tag: "datetime", field: ".js-puredashboard-datetime__field", ev: "input", prop: "value", next: "2026-10-29T10:30", other: "2026-10-30T11:00" },
  { tag: "color", field: ".js-puredashboard-color__input", ev: "input", prop: "value", next: "#ff0000", noError: true },
  { tag: "slider", field: ".js-puredashboard-slider__field", ev: "input", prop: "value", next: "30", noError: true },
  { tag: "select", field: ".js-puredashboard-select__field", ev: "change", prop: "value", next: "vn", other: "us", init: (el) => { el.options = SELECT_OPTS; } },
  { tag: "checkbox", field: ".js-puredashboard-checkbox__box", ev: "change", prop: "checked", next: true, other: false },
  { tag: "switch", field: ".js-puredashboard-switch__input", ev: "change", prop: "checked", next: true, other: false },
];
const userEdit = (c, el, v) => {
  const f = el.querySelector(c.field);
  if (c.prop === "checked") f.checked = v; else f.value = v;
  f.dispatchEvent(new w.Event(c.ev, { bubbles: true }));
};

for (const c of NATIVE) {
  const name = `puredashboard-${c.tag}`;

  // ---- 1. a host listener attached BEFORE connect reads the new value ----
  {
    const el = document.createElement(name);
    c.init?.(el);
    let seen;
    el.addEventListener(c.ev, () => { seen = el[c.prop]; });
    document.body.appendChild(el);
    await tick();
    userEdit(c, el, c.next);
    ok(seen === c.next, `${c.tag}: ${c.ev} listener attached before connect reads the new .${c.prop} (got ${JSON.stringify(seen)})`);
    el.remove();
  }

  if (c.noError) continue;

  // ---- 2. a user edit clears `error`; a handler that sets it again keeps it ----
  {
    const el = document.createElement(name);
    c.init?.(el);
    document.body.appendChild(el);
    el.error = "Server says no";
    await tick();
    ok(el.querySelector(`.puredashboard-${c.tag}__error`), `${c.tag}: error shown before the edit`);
    userEdit(c, el, c.next);
    await tick();
    ok(el.error === "", `${c.tag}: user edit clears error`);
    ok(!el.querySelector(`.puredashboard-${c.tag}__error`), `${c.tag}: error node removed after the edit`);

    el.error = "Server says no";
    const again = () => { el.error = "Still wrong"; };
    el.addEventListener(c.ev, again);
    userEdit(c, el, c.other);
    await tick();
    ok(el.error === "Still wrong", `${c.tag}: an error set by the consumer's ${c.ev} handler is kept`);
    el.removeEventListener(c.ev, again);
    el.remove();
  }

  // ---- 3. detach + re-attach: both still hold ----
  {
    const el = document.createElement(name);
    c.init?.(el);
    let seen;
    el.addEventListener(c.ev, () => { seen = el[c.prop]; });
    document.body.appendChild(el);
    await tick();
    el.remove();
    document.body.appendChild(el);
    el.error = "Server says no";
    await tick();
    userEdit(c, el, c.next);
    await tick();
    ok(seen === c.next, `${c.tag}: after re-attach the listener reads the new .${c.prop}`);
    ok(el.error === "", `${c.tag}: after re-attach a user edit clears error`);
    el.remove();
  }
}

// ---- radio-group: a click on an option clears error; re-attach keeps it working ----
{
  const el = document.createElement("puredashboard-radio-group");
  el.options = [{ value: "s", label: "Small" }, { value: "l", label: "Large" }];
  document.body.appendChild(el);
  await tick();
  el.remove();
  document.body.appendChild(el);
  el.error = "Pick another";
  await tick();
  const opts = () => [...el.querySelectorAll(".js-puredashboard-radio-group__option")];
  ok(opts().length === 2, "radio-group: options rendered");
  opts()[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.value === "l" && el.error === "", "radio-group: selecting an option clears error (after re-attach)");
  el.error = "Pick another";
  el.addEventListener("change", () => { el.error = "Still wrong"; });
  opts()[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(el.error === "Still wrong", "radio-group: an error set by the consumer's change handler is kept");
  el.remove();
}

// ---- combobox: choosing an option clears error; re-attach keeps it working ----
{
  const el = document.createElement("puredashboard-combobox");
  el.options = [{ value: "vn", label: "Vietnam" }, { value: "de", label: "Germany" }];
  document.body.appendChild(el);
  await tick();
  el.remove();
  document.body.appendChild(el);
  el.error = "Not allowed";
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  await tick();
  const de = [...el.querySelectorAll(".js-puredashboard-combobox__option")].find((o) => o.textContent === "Germany");
  ok(de, "combobox: list opened");
  de?.dispatchEvent(new w.Event("mousedown", { bubbles: true, cancelable: true }));
  await tick();
  ok(el.value === "de" && el.error === "", "combobox: choosing an option clears error (after re-attach)");
  el.remove();
}

console.log(`value-sync.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
