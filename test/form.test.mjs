// Tests for form.js (<puredashboard-form>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
// (Full form-associated validity via ElementInternals is only partly supported
// in jsdom; assertions that depend on it are guarded, and the native-input path
// — a plain <input name=x value=y> collected on submit — is tested directly.)
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "FormData", "HTMLFormElement"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardForm } = await import("../src/form.js");
void PuredashboardForm;
// The form places PureDashboard controls inside; import one to test that a
// custom control is preserved as a child alongside a plain native input.
await import("../src/input.js");

// ---- children get wrapped in a real <form>, order + nodes preserved ----
{
  document.body.innerHTML = `<puredashboard-form><input name="a" value="1"><puredashboard-input name="b"></puredashboard-input><button type="submit">Go</button></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  const form = el.querySelector(".js-puredashboard-form__form");
  ok(form instanceof w.HTMLFormElement, "creates a real native <form>");
  ok(form.parentElement === el, "the <form> is a child of the host");
  ok(el.querySelectorAll("form").length === 1, "exactly one <form> is created");
  const kids = Array.from(form.children);
  ok(kids.length === 3, "all three author children moved into the <form>");
  ok(kids[0].tagName === "INPUT" && kids[0].getAttribute("name") === "a", "first child preserved in order");
  ok(kids[1].tagName === "PUREDASHBOARD-INPUT", "the custom control child is preserved (not destroyed)");
  ok(kids[2].tagName === "BUTTON", "last child preserved in order");
  ok(el.form === form, "the .form getter exposes the internal <form>");
}

// ---- wrapping runs only once ----
{
  const el = mount("puredashboard-form");
  const p = document.createElement("input"); p.name = "x"; p.value = "y";
  el.appendChild(p);
  el.connectedCallback(); // simulate an extra connect
  el.connectedCallback();
  await tick();
  ok(el.querySelectorAll("form").length === 1, "wrapping is guarded to run once (no nested/duplicate forms)");
}

// ---- submit collects native input values + fires "submit" with detail.values ----
{
  document.body.innerHTML = `<puredashboard-form><input name="email" value="a@b.com"><input name="city" value="Hanoi"><button type="submit">Go</button></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  let detail = null;
  el.addEventListener("submit", (e) => { detail = e.detail; });
  el.submit();
  await tick();
  ok(detail, "a bubbling submit CustomEvent fires");
  ok(detail && detail.valid === true, "submit detail marks valid:true");
  ok(detail && detail.values && detail.values.email === "a@b.com", "native input value collected into values.email");
  ok(detail && detail.values.city === "Hanoi", "second native input collected into values.city");
  ok(detail && detail.formData instanceof w.FormData, "detail.formData is the raw FormData");
  ok(detail && detail.formData.get("email") === "a@b.com", "raw FormData carries the entries");
}

// ---- repeated names collapse into an array ----
{
  document.body.innerHTML = `<puredashboard-form><input name="tag" value="x"><input name="tag" value="y"><input name="tag" value="z"></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  let values = null;
  el.addEventListener("submit", (e) => { values = e.detail.values; });
  el.submit();
  await tick();
  ok(values && Array.isArray(values.tag), "repeated name becomes an array");
  ok(values && values.tag.length === 3 && values.tag[0] === "x" && values.tag[2] === "z", "array keeps all values in order");
}

// ---- the `values` getter mirrors a collection without submitting ----
{
  document.body.innerHTML = `<puredashboard-form><input name="n" value="42"></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.values.n === "42", "values getter returns collected values");
}

// ---- native <form> submit event is intercepted (no navigation), still emits ----
{
  document.body.innerHTML = `<puredashboard-form><input name="q" value="hi"><button type="submit">Go</button></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  const form = el.querySelector(".js-puredashboard-form__form");
  let got = null, defaultPrevented = false;
  el.addEventListener("submit", (e) => { got = e.detail; });
  const ev = new w.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
  defaultPrevented = ev.defaultPrevented;
  await tick();
  ok(defaultPrevented, "the native form submit is preventDefault'd (no navigation)");
  ok(got && got.values.q === "hi", "intercepted native submit still emits collected values");
}

// ---- reset() fires a "reset" event ----
{
  document.body.innerHTML = `<puredashboard-form><input name="r" value="v"></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  let reset = 0;
  el.addEventListener("reset", () => { reset++; });
  el.reset();
  await tick();
  ok(reset === 1, "reset() triggers exactly one reset event");
}

// ---- noValidate skips validation and always submits ----
{
  document.body.innerHTML = `<puredashboard-form novalidate><input name="e" required value=""></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  ok(el.noValidate === true, "novalidate attribute reflects to the property");
  let submitted = false, invalid = false;
  el.addEventListener("submit", () => { submitted = true; });
  el.addEventListener("invalid", () => { invalid = true; });
  el.submit();
  await tick();
  ok(submitted && !invalid, "noValidate submits even with an empty required field");
}

// ---- validation blocks submit + fires "invalid" (guarded on jsdom support) ----
{
  document.body.innerHTML = `<puredashboard-form><input name="e" required value=""><button type="submit">Go</button></puredashboard-form>`;
  const el = document.body.firstElementChild;
  await tick();
  const form = el.querySelector(".js-puredashboard-form__form");
  // Only meaningful where jsdom reports the required field as invalid.
  if (form.checkValidity() === false) {
    let submitted = false, invalidDetail = null;
    el.addEventListener("submit", () => { submitted = true; });
    el.addEventListener("invalid", (e) => { invalidDetail = e.detail; });
    el.submit();
    await tick();
    ok(!submitted, "invalid form blocks the submit event");
    ok(invalidDetail && invalidDetail.valid === false, "invalid event carries valid:false");
  } else {
    // jsdom can't validate this control — assert the code path exists instead.
    ok(typeof el.checkValidity === "function", "checkValidity() method exists (validation path guarded on jsdom)");
    ok(true, "invalid path skipped: jsdom did not flag the required field");
  }
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-form");
  el.labels = { submit: "Gửi" };
  await tick();
  ok(el._label("submit") === "Gửi", "labels override the default string");
  const el2 = mount("puredashboard-form");
  await tick();
  ok(el2._label("submit") === "Submit", "default label kept when not overridden");
}

console.log(`form.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
