// Tests for ../src/copy.js — <puredashboard-copy> in jsdom. jsdom ships no clipboard,
// so the async Clipboard API is stubbed here (a recording fake) and REMOVED again for
// the failure cases — which is the point: the component must report a failure instead of
// throwing. Covered: the button/ARIA structure, the three value sources (value / src /
// from), text · html · image writes, the state machine + `data-state` reflection, the
// `copied` / `copyerror` events, the feedback reset, disabled, labels and the
// declarative attribute surface.
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const tick = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://localhost/" });
const w = dom.window;
for (const k of ["window", "document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent", "KeyboardEvent", "Blob", "Image", "URL"]) global[k] = w[k];

// Fail loudly on an uncaught error (e.g. an attribute-write loop) instead of scrolling past.
w.addEventListener("error", (e) => { fail++; console.log("FAIL: uncaught error —", (e.error && e.error.message) || e.message); });

// ---- clipboard fake ---------------------------------------------------------
// The component reads window.navigator / window.isSecureContext / window.ClipboardItem,
// so the whole surface can be swapped per test.
Object.defineProperty(w, "isSecureContext", { value: true, configurable: true });
class FakeClipboardItem {
  constructor(payload) { this.payload = payload; this.types = Object.keys(payload); }
}
const clip = { text: null, items: [], fail: false };
function installClipboard() {
  clip.text = null; clip.items = []; clip.fail = false;
  w.ClipboardItem = FakeClipboardItem;
  Object.defineProperty(w.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (t) => { if (clip.fail) throw new Error("denied"); clip.text = t; },
      write: async (items) => { if (clip.fail) throw new Error("denied"); clip.items = items; },
    },
  });
}
function removeClipboard() {
  delete w.ClipboardItem;
  Object.defineProperty(w.navigator, "clipboard", { configurable: true, value: undefined });
}
installClipboard();

await import("../src/copy.js");

const B = "puredashboard-copy";
async function mount(props = {}, attrs = {}) {
  document.body.innerHTML = "";
  const el = document.createElement(B);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.assign(el, props);
  document.body.append(el);
  await tick(); await tick();
  return el;
}
const btn = (el) => el.querySelector(`.js-${B}__btn`);
// click + let the async copy() settle and re-render
async function click(el) { btn(el).click(); await tick(); await tick(); await tick(); }

// ============================================================ structure + ARIA
{
  const el = await mount({ value: "npm i" });
  const b = btn(el);
  ok(b && b.tagName === "BUTTON" && b.getAttribute("type") === "button", "renders a real <button type=button>");
  ok(el.querySelector(`.${B}__icon svg`) !== null, "the Lucide copy icon is inlined");
  ok(b.getAttribute("aria-label") === "Copy", "icon-only: named by default (no aria-label needed from the author)");
  ok(b.classList.contains(`${B}__btn--icon-only`), "icon-only: square modifier");
  ok(el.getAttribute("data-state") === "idle", "the host reflects data-state=idle");
  const live = el.querySelector(`.${B}__live`);
  ok(live && live.getAttribute("role") === "status" && live.getAttribute("aria-live") === "polite", "an off-screen live region announces the result");
  ok(!b.contains(live), "the live region sits OUTSIDE the button, so it never becomes part of its name");
}
{
  const el = await mount({ value: "x", label: "Copy token" }, { "aria-label": "Copy the API token" });
  ok(el.querySelector(`.${B}__label`).textContent === "Copy token", "label rendered next to the icon");
  ok(!btn(el).classList.contains(`${B}__btn--icon-only`), "with a label it is not icon-only");
  ok(btn(el).getAttribute("aria-label") === "Copy the API token", "an author aria-label wins and is mirrored onto the inner button");
}
{
  const el = await mount({ value: "x", label: "<img src=x onerror=alert(1)>" });
  ok(el.querySelector("img") === null && el.querySelector(`.${B}__label`).textContent === "<img src=x onerror=alert(1)>",
    "label: a string is escaped, never parsed as markup");
}
{
  const el = await mount({ value: "ghp_secret", showValue: true });
  ok(el.querySelector(`.${B}__label`).textContent === "ghp_secret", "showValue: the value itself becomes the visible label");
}

// ================================================================== copy text
{
  installClipboard();
  const el = await mount({ value: "npm i puredashboard" });
  const seen = [];
  el.addEventListener("copied", (e) => seen.push(e.detail));
  await click(el);
  ok(clip.text === "npm i puredashboard", "click writes the value with clipboard.writeText");
  ok(el.state === "copied" && el.getAttribute("data-state") === "copied", "state → copied (and reflected)");
  ok(btn(el).classList.contains(`${B}__btn--copied`), "the copied modifier drives the green feedback");
  ok(el.querySelector(`.${B}__live`).textContent === "Copied", "the live region announces it");
  ok(seen.length === 1 && seen[0].type === "text" && seen[0].value === "npm i puredashboard", "emits copied{type:'text',value}");
}
{
  // the event is `copied`, NOT `copy` — the platform's own copy event also bubbles
  installClipboard();
  const el = await mount({ value: "a" });
  let native = 0, bubbled = false;
  document.body.addEventListener("copy", () => native++);
  document.body.addEventListener("copied", () => (bubbled = true));
  await click(el);
  ok(native === 0, "it does NOT dispatch a `copy` event (no collision with Ctrl+C handlers)");
  ok(bubbled, "`copied` bubbles, so an ancestor can listen");
}
{
  installClipboard();
  const el = await mount({ value: async () => "late-bound" });
  await click(el);
  ok(clip.text === "late-bound", "a function value is called on each click (async supported)");
}
{
  installClipboard();
  document.body.innerHTML = '<pre id="src">  hello world  </pre>';
  const el = document.createElement(B);
  el.from = "#src";
  document.body.append(el);
  await tick(); await tick();
  await click(el);
  ok(clip.text === "hello world", "from: copies the target element's textContent (trimmed)");
}
{
  installClipboard();
  document.body.innerHTML = '<input id="f" />';
  document.querySelector("#f").value = "field value";
  const el = document.createElement(B);
  el.from = "#f";
  document.body.append(el);
  await tick(); await tick();
  await click(el);
  ok(clip.text === "field value", "from: an <input> contributes its .value, not its textContent");
}
{
  installClipboard();
  const el = await mount({ value: "v", from: "#nope" });
  await click(el);
  ok(clip.text === "v", "value wins over from");
}

// ================================================================== copy html
{
  installClipboard();
  const el = await mount({ value: "<b>bold</b>", type: "html" });
  let detail = null;
  el.addEventListener("copied", (e) => (detail = e.detail));
  await click(el);
  ok(clip.items.length === 1, "html: writes a ClipboardItem");
  const types = clip.items[0].types;
  ok(types.includes("text/html") && types.includes("text/plain"), "html: carries BOTH text/html and a text/plain flattening");
  ok(detail && detail.type === "html", "emits copied{type:'html'}");
}
{
  // no ClipboardItem support → the html path degrades to a plain-text write
  installClipboard();
  delete w.ClipboardItem;
  const el = await mount({ value: "<b>bold</b>", type: "html" });
  await click(el);
  ok(clip.text === "bold", "html: without ClipboardItem it degrades to the plain-text flattening");
  w.ClipboardItem = FakeClipboardItem;
}

// ====================================================== copy a table (Excel)
// The point of the html path: a spreadsheet reads text/html and rebuilds the grid, and
// the text/plain half must be TSV so "Paste Special → Text" (and any plain-text field)
// still lands one cell per column instead of one run-on string.
const TABLE = '<table><thead><tr><th>Service</th><th>Region</th></tr></thead><tbody><tr><td>api-gateway</td><td>us-east-1</td></tr><tr><td>auth-service</td><td>eu-west-1</td></tr></tbody></table>';
const payloadOf = (item) => item.payload;
async function textOf(item, mime) { return await payloadOf(item)[mime].text(); }
{
  installClipboard();
  document.body.innerHTML = `<div id="report">${TABLE}</div>`;
  const el = document.createElement(B);
  el.from = "#report table";
  document.body.append(el);
  await tick(); await tick();
  let detail = null;
  el.addEventListener("copied", (e) => (detail = e.detail));
  await click(el);
  ok(detail && detail.type === "html", "a <table> element is inferred as html without setting `type`");
  const markup = await textOf(clip.items[0], "text/html");
  ok(markup.startsWith("<table") && markup.includes("api-gateway"), "text/html carries the table's outerHTML (not its textContent)");
  const plain = await textOf(clip.items[0], "text/plain");
  ok(plain === "Service\tRegion\napi-gateway\tus-east-1\nauth-service\teu-west-1",
    "text/plain is TSV — a tab per cell, a newline per row (pastes into Excel as cells)");
}
{
  installClipboard();
  document.body.innerHTML = `<div id="plainsrc">${TABLE}</div>`;
  const el = document.createElement(B);
  el.from = "#plainsrc table";
  el.type = "text";                                  // forced plain — still structured
  document.body.append(el);
  await tick(); await tick();
  await click(el);
  ok(clip.text === "Service\tRegion\napi-gateway\tus-east-1\nauth-service\teu-west-1",
    "type=text on an element keeps the structure too (a raw textContent would run every cell together)");
}
{
  installClipboard();
  document.body.innerHTML = '<div id="rich"><h2>Report</h2><p>Two <b>services</b></p><ul><li>one</li><li>two</li></ul></div>';
  const el = document.createElement(B);
  el.from = "#rich";
  el.type = "html";
  document.body.append(el);
  await tick(); await tick();
  await click(el);
  const markup = await textOf(clip.items[0], "text/html");
  ok(markup.startsWith('<div id="rich">'), "type=html on any element copies its outerHTML");
  const plain = await textOf(clip.items[0], "text/plain");
  ok(plain === "Report\nTwo services\none\ntwo", `block elements become line breaks, not a run-on string (got ${JSON.stringify(plain)})`);
}
{
  installClipboard();
  const el = await mount({ value: "<p>a<br>b</p>   <p>  c  </p>", type: "html" });
  await click(el);
  ok(await textOf(clip.items[0], "text/plain") === "a\nb\nc", "<br> breaks the line and source whitespace is collapsed");
}
{
  installClipboard();
  const el = await mount({ value: '<table><tr><td>x<br>y</td><td><table><tr><td>n</td></tr></table></td></tr></table>', type: "html" });
  await click(el);
  ok(await textOf(clip.items[0], "text/plain") === "x y\tn", "a cell is squashed to one line, so a <br> or a nested table can't invent rows/columns");
}
{
  installClipboard();
  document.body.innerHTML = '<input id="f2" />';
  document.querySelector("#f2").value = "a > b";
  const el = document.createElement(B);
  el.from = "#f2";
  el.type = "html";
  document.body.append(el);
  await tick(); await tick();
  await click(el);
  ok(await textOf(clip.items[0], "text/html") === "a &gt; b", "a form control has no markup worth copying: its .value is escaped into text");
}
{
  // no ClipboardItem → the html path degrades to the SAME structured plain text
  installClipboard();
  delete w.ClipboardItem;
  const el = await mount({ value: TABLE, type: "html" });
  await click(el);
  ok(clip.text === "Service\tRegion\napi-gateway\tus-east-1\nauth-service\teu-west-1",
    "without ClipboardItem the table still degrades to TSV, not to a run-on string");
  w.ClipboardItem = FakeClipboardItem;
}

// ================================================================= copy image
{
  installClipboard();
  const png = new w.Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const el = await mount({ value: png });
  let detail = null;
  el.addEventListener("copied", (e) => (detail = e.detail));
  await click(el);
  ok(clip.items.length === 1 && clip.items[0].types[0] === "image/png", "image: a PNG Blob is written as an image/png ClipboardItem");
  ok(detail && detail.type === "image" && detail.value === null && detail.blob === png, "emits copied{type:'image',blob} (value is null)");
  ok(clip.text === null, "image: never silently degrades to a text write");
}
{
  // a non-PNG image needs a canvas to transcode; jsdom has none → a reported failure,
  // never a throw and never a wrong-format write.
  installClipboard();
  const jpg = new w.Blob([new Uint8Array([255, 216])], { type: "image/jpeg" });
  const el = await mount({ value: jpg });
  let err = null;
  el.addEventListener("copyerror", (e) => (err = e.detail.error));
  await click(el);
  ok(el.state === "error" && err instanceof Error, "image: a transcode failure surfaces as copyerror, not an exception");
}
{
  installClipboard();
  const el = await mount({ value: "not an image", type: "image" });
  let err = null;
  el.addEventListener("copyerror", (e) => (err = e.detail.error));
  await click(el);
  ok(el.state === "error" && /not an image/.test(err.message), "type=image with a non-image value reports a clear error");
}

// ==================================================================== failure
{
  removeClipboard();                       // jsdom also has no document.execCommand
  const el = await mount({ value: "x" });
  let err = null, threw = false;
  el.addEventListener("copyerror", (e) => (err = e.detail.error));
  try { await click(el); } catch { threw = true; }
  ok(!threw, "no clipboard at all: clicking does not throw");
  ok(el.state === "error" && el.getAttribute("data-state") === "error", "…it enters the error state");
  ok(btn(el).classList.contains(`${B}__btn--error`) && el.querySelector(`.${B}__live`).textContent === "Copy failed", "…shows + announces the failure");
  ok(err instanceof Error, "…and emits copyerror with an Error");
  installClipboard();
}
{
  installClipboard();
  const el = await mount({});
  let err = null;
  el.addEventListener("copyerror", (e) => (err = e.detail.error));
  await click(el);
  ok(el.state === "error" && /no value to copy/.test(err.message), "nothing configured: a clear 'no value' error");
}
{
  installClipboard();
  clip.fail = true;                        // permission denied
  const el = await mount({ value: "x" });
  await click(el);
  ok(el.state === "error", "a rejected clipboard write becomes the error state");
  clip.fail = false;
}

// ============================================================ state lifecycle
{
  installClipboard();
  const el = await mount({ value: "x", feedback: 20 });
  await click(el);
  ok(el.state === "copied", "the feedback state is shown…");
  await sleep(60);
  ok(el.state === "idle" && el.getAttribute("data-state") === "idle", "…and clears itself after `feedback` ms");
  ok(el.querySelector(`.${B}__live`).textContent === "", "the live region is emptied again");
}
{
  installClipboard();
  const el = await mount({ value: "x", feedback: 0 });
  await click(el);
  await sleep(30);
  ok(el.state === "copied", "feedback=0 keeps the state until the next click (the caller owns the reset)");
}
{
  installClipboard();
  const el = await mount({ value: "x", label: "Copy" });
  await click(el);
  ok(el.querySelector(`.${B}__label`).textContent === "Copied", "a visible label becomes 'Copied' while the feedback lasts");
  el.state = "idle";
  await tick();
  ok(el.querySelector(`.${B}__label`).textContent === "Copy", "…then goes back to the author's label");
}
{
  installClipboard();
  const el = await mount({ value: "x", disabled: true });
  let fired = 0;
  el.addEventListener("copied", () => fired++);
  el.addEventListener("copyerror", () => fired++);
  ok(btn(el).disabled === true, "disabled: the native button is disabled (blocks clicks + skips tab)");
  const done = await el.copy();
  await tick();
  ok(done === false && fired === 0 && clip.text === null, "disabled: copy() is a no-op that emits nothing");
}

// ===================================================================== labels
{
  installClipboard();
  const el = await mount({ value: "x", labels: { copy: "Sao chép", copied: "Đã sao chép" } });
  ok(btn(el).getAttribute("aria-label") === "Sao chép", "labels: the icon-only name is localisable");
  await click(el);
  ok(el.querySelector(`.${B}__live`).textContent === "Đã sao chép", "labels: the announcement is localisable");
}

// ================================================================ declarative
{
  installClipboard();
  const el = await mount({}, { value: "from-attr", label: "Copy", size: "sm", variant: "text", "show-value": "", feedback: "40" });
  ok(el.value === "from-attr" && el.feedback === 40 && el.showValue === true, "string / number / boolean attributes reflect into properties");
  ok(btn(el).classList.contains(`${B}__btn--sm`) && btn(el).classList.contains(`${B}__btn--text`), "size + variant modifiers");
  await click(el);
  ok(clip.text === "from-attr", "…and the declarative value is what gets copied");
}
{
  installClipboard();
  const el = await mount({ value: "a" });
  el.setAttribute("value", "b");
  await tick();
  await click(el);
  ok(clip.text === "b", "changing the value attribute after mount changes what is copied");
}
{
  installClipboard();
  const el = await mount({ value: "x" });
  el.setAttribute("aria-label", "Copy the ID");
  await tick();
  ok(btn(el).getAttribute("aria-label") === "Copy the ID", "a later aria-label change re-syncs to the inner button");
}
{
  installClipboard();
  const el = await mount({ value: "x", feedback: 500 });
  await click(el);
  el.remove();                              // pending reset timer must not fire on a dead node
  await sleep(20);
  ok(true, "removing the element while the feedback timer is pending is safe");
}

console.log(`\ncopy.test.mjs: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
