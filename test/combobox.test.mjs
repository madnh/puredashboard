// Tests for combobox.js (<puredashboard-combobox>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
//
// jsdom caveats, all guarded so the same source runs in a real browser:
//   - The Popover API (showPopover/hidePopover) is absent → the component takes its
//     fixed/high-z FALLBACK path here. Positioning/top-layer promotion is verified in a
//     real browser via the harness page; here we assert the semantics (open/close,
//     aria, filtering, keyboard, commit).
//   - Form-associated validity via ElementInternals is partly unsupported in jsdom;
//     those paths are guarded in the component and not asserted here.
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
// Dispatch a real KeyboardEvent (guarded: fall back to a plain Event carrying `key`
// where jsdom's KeyboardEvent ctor is unavailable).
const key = (el, k) => {
  let e;
  try { e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); }
  catch { e = new w.Event("keydown", { bubbles: true, cancelable: true }); Object.defineProperty(e, "key", { value: k }); }
  el.dispatchEvent(e);
};
const type = (input, val) => { input.value = val; input.dispatchEvent(new w.Event("input", { bubbles: true })); };

const { PuredashboardCombobox } = await import("../src/combobox.js");
void PuredashboardCombobox;

const OPTS = [
  { value: "us", label: "United States" },
  { value: "vn", label: "Vietnam" },
  { value: "de", label: "Germany" },
];

// ---- role="combobox" input + aria wiring ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  el.placeholder = "Pick one";
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  const listId = el.querySelector(".js-puredashboard-combobox__list").id;
  ok(input, "renders an inner text input");
  ok(input.getAttribute("role") === "combobox", "input has role=combobox");
  ok(input.getAttribute("aria-autocomplete") === "list", "aria-autocomplete=list");
  ok(input.getAttribute("aria-expanded") === "false", "aria-expanded false when closed");
  ok(input.getAttribute("aria-controls") === listId, "aria-controls points at the listbox id");
  ok(el.querySelector(".js-puredashboard-combobox__list").getAttribute("role") === "listbox", "popup has role=listbox");
  ok(input.getAttribute("placeholder") === "Pick one", "placeholder reflected");
}

// ---- typing filters options (case-insensitive substring) + opens list ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  type(input, "ger");
  await tick();
  ok(input.getAttribute("aria-expanded") === "true", "typing opens the list");
  const optionEls = el.querySelectorAll(".js-puredashboard-combobox__option");
  ok(optionEls.length === 1, "filter narrows to one match");
  ok(optionEls[0].textContent === "Germany", "the matching option label shown");
}

// ---- ArrowDown/ArrowUp move aria-activedescendant (focus stays in input) ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  key(input, "ArrowDown"); // opens
  await tick();
  ok(input.getAttribute("aria-expanded") === "true", "ArrowDown opens the list");
  key(input, "ArrowDown"); // active → first option
  await tick();
  let active = el.querySelector(".puredashboard-combobox__option--active");
  ok(active && active.textContent === "United States", "ArrowDown moves active to first option");
  ok(input.getAttribute("aria-activedescendant") === active.id, "aria-activedescendant points at active option");
  key(input, "ArrowDown"); // → second
  await tick();
  active = el.querySelector(".puredashboard-combobox__option--active");
  ok(active && active.textContent === "Vietnam", "ArrowDown advances to next option");
  key(input, "ArrowUp"); // → first
  await tick();
  active = el.querySelector(".puredashboard-combobox__option--active");
  ok(active && active.textContent === "United States", "ArrowUp moves back to previous option");
}

// ---- Enter selects the active option: value set, input filled, list closed, change fired ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  let detail = null;
  el.addEventListener("change", (e) => { detail = e.detail; });
  key(input, "ArrowDown"); await tick(); // open
  key(input, "ArrowDown"); await tick(); // active = United States
  key(input, "ArrowDown"); await tick(); // active = Vietnam
  key(input, "Enter"); await tick();
  ok(el.value === "vn", "Enter sets value to the active option's value");
  ok(input.value === "Vietnam", "input filled with the selected label");
  ok(input.getAttribute("aria-expanded") === "false", "list closed after Enter");
  ok(detail && detail.value === "vn", "change CustomEvent emitted with detail.value");
}

// ---- clicking an option selects it ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  let detail = null;
  el.addEventListener("change", (e) => { detail = e.detail; });
  key(input, "ArrowDown"); await tick(); // open
  const germany = [...el.querySelectorAll(".js-puredashboard-combobox__option")].find((o) => o.textContent === "Germany");
  germany.dispatchEvent(new w.Event("mousedown", { bubbles: true, cancelable: true }));
  await tick();
  ok(el.value === "de", "clicking an option sets its value");
  ok(detail && detail.value === "de", "click emits change with detail.value");
  ok(input.getAttribute("aria-expanded") === "false", "list closed after click");
}

// ---- Escape closes; a second Escape clears the selection ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  el.value = "vn";
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  key(input, "ArrowDown"); await tick(); // open
  ok(input.getAttribute("aria-expanded") === "true", "open before Escape");
  key(input, "Escape"); await tick();
  ok(input.getAttribute("aria-expanded") === "false", "Escape closes the list");
  ok(el.value === "vn", "first Escape keeps the value");
  key(input, "Escape"); await tick(); // second Escape (list already closed) → clears
  ok(el.value === "", "second Escape clears the selection");
}

// ---- no-results row ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  type(input, "zzzz");
  await tick();
  ok(el.querySelectorAll(".js-puredashboard-combobox__option").length === 0, "no options match");
  const empty = el.querySelector(".puredashboard-combobox__empty");
  ok(empty && empty.textContent === "No results", "no-results row shown with default label");
  // labels override
  el.labels = { noResults: "Không có" };
  await tick();
  ok(el.querySelector(".puredashboard-combobox__empty").textContent === "Không có", "no-results label is localisable");
}

// ---- allowCustom: a typed value with no match is accepted ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  el.allowCustom = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  let detail = null;
  el.addEventListener("change", (e) => { detail = e.detail; });
  type(input, "Freetext");
  await tick();
  key(input, "Enter"); await tick();
  ok(el.value === "Freetext", "allowCustom accepts the typed value");
  ok(detail && detail.value === "Freetext", "change emitted for the custom value");
  ok(input.value === "Freetext", "input keeps the custom text");

  // without allowCustom the typed non-match does NOT commit
  const el2 = mount("puredashboard-combobox");
  el2.options = OPTS;
  await tick();
  const input2 = el2.querySelector(".js-puredashboard-combobox__input");
  type(input2, "Freetext");
  await tick();
  key(input2, "Enter"); await tick();
  ok(el2.value == null || el2.value === "", "without allowCustom a non-match does not become the value");
}

// ---- disabled ----
{
  const el = mount("puredashboard-combobox");
  el.options = OPTS;
  el.disabled = true;
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  ok(input.disabled === true, "input is disabled");
  key(input, "ArrowDown"); await tick();
  ok(input.getAttribute("aria-expanded") === "false", "disabled combobox does not open");
}

// ---- string[] options + object options both normalise ----
{
  const el = mount("puredashboard-combobox");
  el.options = ["Red", "Green", "Blue"];
  await tick();
  const input = el.querySelector(".js-puredashboard-combobox__input");
  key(input, "ArrowDown"); await tick(); // open
  const optionEls = [...el.querySelectorAll(".js-puredashboard-combobox__option")];
  ok(optionEls.length === 3, "string[] options render");
  ok(optionEls[0].textContent === "Red", "string option label is the string");
  key(input, "ArrowDown"); await tick(); // active = Red
  key(input, "Enter"); await tick();
  ok(el.value === "Red", "string option value === label");
}

// ---- localisable labels default kept when not overridden ----
{
  const el = mount("puredashboard-combobox");
  await tick();
  ok(el._label("noResults") === "No results", "default noResults label kept when not overridden");
}

// ============ the light-dismiss listener must not outlive the element ============
// _open_() registers a pointerdown handler on DOCUMENT, so it survives the element unless it
// is taken back. Removing an open combobox left it registered for the page's lifetime,
// holding a reference to the element and re-running _close() on every pointerdown.
//
// Tearing it down on disconnect must NOT close the popup, because a relocation is a
// disconnect plus a reconnect and the user's open state has to survive that.
{
  const el = document.createElement("puredashboard-combobox");
  el.options = ["a", "b"];
  document.body.appendChild(el);
  await tick();
  await tick();

  let hits = 0;
  const inner = el._onOutside;
  el._onOutside = (...a) => { hits++; return inner.apply(el, a); };

  el._open_();
  await tick();
  ok(el._open === true, "dismiss listener: the popup is open");
  document.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  await tick();
  ok(hits > 0, "dismiss listener: it fires while the element is in the document");

  // a RELOCATION keeps the open state and keeps working
  el._open_();
  await tick();
  const host = document.createElement("div");
  document.body.appendChild(host);
  host.appendChild(el);
  await tick();
  await tick();
  ok(el._open === true, "dismiss listener: a move does not close the popup");
  hits = 0;
  document.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  await tick();
  ok(hits > 0, "dismiss listener: …and it still fires after the move");

  // REMOVAL takes it back
  el._open_();
  await tick();
  el.remove();
  await tick();
  hits = 0;
  document.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  await tick();
  ok(hits === 0, `dismiss listener: removing the element unregisters it — fired ${hits} time(s)`);
}

console.log(`combobox.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
