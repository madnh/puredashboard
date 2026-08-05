// Tests for ../src/reactive.js — the template engine + keyed repeat().
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual lexer/parts/reconciler, not mocks.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", {
  runScripts: "outside-only",
});
const w = dom.window;
for (const k of [
  "document",
  "HTMLElement",
  "customElements",
  "NodeFilter",
  "CustomEvent",
  "Node",
])
  global[k] = w[k];
global.queueMicrotask = queueMicrotask;

const { html, repeat, Reactive, renderResult } =
  await import("../src/reactive.js");

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const tick = () => new Promise((r) => queueMicrotask(r));

// ============================ engine: bindings ==============================
{
  const host = document.createElement("div");
  const view = (sel) =>
    html`<button class="row ${sel === 1 ? "active" : ""}" data-n="n${sel}">item ${sel}</button>`;
  renderResult(view(1), host);
  let btn = host.querySelector("button");
  ok(btn, "button rendered");
  ok(
    btn.getAttribute("class") === "row active",
    "class concat active: " + btn.className,
  );
  ok(btn.getAttribute("data-n") === "n1", "data-n attr");
  ok(btn.textContent === "item 1", "text content: " + btn.textContent);

  renderResult(view(2), host);
  const btn2 = host.querySelector("button");
  ok(btn2 === btn, "same DOM node reused on update (in-place)");
  ok(
    btn2.getAttribute("class").trim() === "row",
    "class updated to inactive: " + btn2.className,
  );
  ok(btn2.textContent === "item 2", "text updated: " + btn2.textContent);

  let clicks = 0;
  renderResult(
    html`<button
      @click=${() => {
        clicks++;
      }}
    >
      x
    </button>`,
    host,
  );
  host.querySelector("button").dispatchEvent(new w.MouseEvent("click"));
  ok(clicks === 1, "@click fired: " + clicks);

  renderResult(html`<input ?disabled=${true} .value=${"hi"} />`, host);
  const inp = host.querySelector("input");
  ok(inp.hasAttribute("disabled"), "?disabled set");
  ok(inp.value === "hi", ".value prop set: " + inp.value);
  renderResult(html`<input ?disabled=${false} .value=${"bye"} />`, host);
  ok(
    !host.querySelector("input").hasAttribute("disabled"),
    "?disabled removed on update",
  );

  // A value explicitly marked SAFE (html.js raw()/SafeString share this symbol) is
  // the ONLY object inserted as markup.
  const safe = {
    [Symbol.for("puredashboard.safe")]: true,
    toString() {
      return "<b>raw</b>";
    },
  };
  renderResult(html`<span>${safe}</span>`, host);
  ok(
    host.querySelector("span b")?.textContent === "raw",
    "SAFE-marked value inserted as markup",
  );

  // An UNMARKED object with a hostile toString must NOT become markup — it is
  // coerced to text (type-confusion XSS guard).
  const hostile = {
    toString() {
      return "<img src=x onerror=1>";
    },
  };
  renderResult(html`<span>${hostile}</span>`, host);
  ok(
    host.querySelector("span img") === null,
    "unmarked object NOT parsed as HTML (type-confusion guard)",
  );

  renderResult(html`<span>${"<img src=x onerror=1>"}</span>`, host);
  ok(
    host.querySelector("span img") === null,
    "untrusted text NOT parsed as HTML (escaped)",
  );
  ok(
    host.querySelector("span").textContent === "<img src=x onerror=1>",
    "untrusted text preserved literally",
  );
}

// ====================== engine: Reactive component ==========================
{
  class List extends Reactive {
    static properties = { items: {}, sel: {} };
    render() {
      return html`${(this.items || []).map(
        (it) =>
          html` <button
            class="row ${it === this.sel ? "on" : ""}"
            @click=${() => {
              this.sel = it;
            }}
          >
            ${it}
          </button>`,
      )}`;
    }
  }
  List.define("x-list");
  const el = document.createElement("x-list");
  el.items = ["a", "b", "c"];
  document.body.appendChild(el);
  await tick();
  let rows = el.querySelectorAll("button");
  ok(rows.length === 3, "list rendered 3 rows: " + rows.length);
  rows[1].dispatchEvent(new w.MouseEvent("click"));
  await tick();
  rows = el.querySelectorAll("button");
  ok(
    [...rows].filter((b) => b.classList.contains("on")).length === 1,
    "exactly one row active after click",
  );
  ok(rows[1].classList.contains("on"), "clicked row marked active");
}

// =========================== keyed repeat() =================================
{
  const host = document.createElement("div");
  const ids = () =>
    [...host.querySelectorAll("li")]
      .map((li) => li.getAttribute("data-k"))
      .join(",");
  const txt = () =>
    [...host.querySelectorAll("li")]
      .map((li) => li.textContent.trim())
      .join(",");
  const list = (arr) =>
    html`<ul>
      ${repeat(
        arr,
        (x) => x.id,
        (x) => html`<li data-k="${x.id}">${x.id}:${x.label}</li>`,
      )}
    </ul>`;

  renderResult(
    list([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
      { id: "c", label: "C" },
    ]),
    host,
  );
  ok(ids() === "a,b,c", "initial order: " + ids());
  const liA = host.querySelector('[data-k="a"]'),
    liB = host.querySelector('[data-k="b"]'),
    liC = host.querySelector('[data-k="c"]');
  liB.__keep = "STATE-B"; // stand-in for live state (focus/scroll) on a persisting node

  renderResult(
    list([
      { id: "c", label: "C" },
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]),
    host,
  );
  ok(ids() === "c,a,b", "reordered order: " + ids());
  ok(
    host.querySelector('[data-k="a"]') === liA,
    "row 'a' kept SAME node across reorder",
  );
  ok(
    host.querySelector('[data-k="b"]') === liB &&
      host.querySelector('[data-k="b"]').__keep === "STATE-B",
    "row 'b' kept node + live state across move",
  );
  ok(
    host.querySelector('[data-k="c"]') === liC,
    "row 'c' kept SAME node across move-to-head",
  );

  renderResult(
    list([
      { id: "c", label: "C" },
      { id: "a", label: "A" },
      { id: "x", label: "X" },
      { id: "b", label: "B" },
    ]),
    host,
  );
  ok(ids() === "c,a,x,b", "after middle insert: " + ids());
  ok(
    host.querySelector('[data-k="b"]') === liB,
    "existing 'b' node untouched by insert",
  );

  renderResult(
    list([
      { id: "c", label: "C" },
      { id: "b", label: "B" },
    ]),
    host,
  );
  ok(ids() === "c,b", "after removals: " + ids());
  ok(
    host.querySelector('[data-k="b"]') === liB &&
      host.querySelector('[data-k="b"]').__keep === "STATE-B",
    "'b' STILL same live node after neighbors removed",
  );

  const cNode = host.querySelector('[data-k="c"]');
  renderResult(
    list([
      { id: "c", label: "C2" },
      { id: "b", label: "B2" },
    ]),
    host,
  );
  ok(txt() === "c:C2,b:B2", "labels updated in place: " + txt());
  ok(
    host.querySelector('[data-k="c"]') === cNode,
    "content-only update kept node identity",
  );

  renderResult(
    list([
      { id: "b", label: "B2" },
      { id: "c", label: "C2" },
    ]),
    host,
  );
  ok(ids() === "b,c", "reversed: " + ids());

  renderResult(list([]), host);
  ok(host.querySelectorAll("li").length === 0, "cleared to empty");
  renderResult(list([{ id: "z", label: "Z" }]), host);
  ok(ids() === "z", "repopulated after empty: " + ids());
}

// ============ nested-template caching (learned from lit) ====================
// A ${html``} helper that contains an <input> now keeps its DOM/edits across
// re-renders (the child instance is reused, not rebuilt).
{
  const host = document.createElement("div");
  const field = (label, val) =>
    html`<label>${label}</label><input id="f" value="${val}" />`;
  const view = (n) =>
    html`<div>${field("Name", "x")}<span id="c">${n}</span></div>`;
  renderResult(view(1), host);
  const input = host.querySelector("#f");
  input.value = "typed"; // user edit; the value binding (x) is unchanged
  renderResult(view(2), host); // re-render — only the count span changes
  ok(
    host.querySelector("#f") === input,
    "nested: same <input> node reused across re-render",
  );
  ok(
    host.querySelector("#f").value === "typed",
    "nested: user edit inside nested template preserved",
  );
  ok(
    host.querySelector("#c").textContent === "2",
    "nested: sibling binding still updates",
  );
}

// ============ the two halves of in-place diffing, as documented ==============
// docs/ARCHITECTURE.md and src/_agents.md promise a consuming app two things about
// keeping an <input> usable. Pin both, because the NEGATIVE one is what an app hits
// and then works around by abandoning the engine for hand-built DOM.

// (a) UNCHANGED ⇒ NO WRITE. A `.value` PROPERTY binding whose value has not changed
// must not push over what the user typed, however often an unrelated binding
// re-renders. This is why an app never has to drop the binding to stay usable.
{
  const host = document.createElement("div");
  const view = (q, n) => html`<input id="f" .value="${q}" /><span id="c">${n}</span>`;
  renderResult(view("ab", 1), host);
  const input = host.querySelector("#f");
  input.value = "abcdef"; // user keeps typing; the component's own `q` is still "ab"
  for (const n of [2, 3, 4]) renderResult(view("ab", n), host); // churn from elsewhere
  ok(host.querySelector("#f") === input, "prop binding: same <input> node across re-renders");
  ok(input.value === "abcdef", "prop binding: unchanged .value does not clobber a user edit");
  ok(host.querySelector("#c").textContent === "4", "prop binding: the sibling binding still updates");
  renderResult(view("zz", 5), host); // a genuine change still writes
  ok(input.value === "zz", "prop binding: a CHANGED .value is written through");
}

// (b) A DIFFERENT TEMPLATE ⇒ REBUILD. Two literals in one ${} child position are two
// `strings` arrays, so switching between them replaces the DOM — focus and un-committed
// text go with it. Documented as the failure mode; pinned here so it cannot drift into
// looking safe. The one-literal form right after is the fix we tell people to use.
{
  const host = document.createElement("div");
  const two = (on, q) => html`<div>${on
    ? html`<span class="on"><input id="f" .value="${q}" /></span>`
    : html`<span class="off"><input id="f" .value="${q}" /></span>`}</div>`;
  renderResult(two(false, ""), host);
  const before = host.querySelector("#f");
  before.value = "half-typed";
  renderResult(two(true, ""), host);
  const after = host.querySelector("#f");
  ok(after !== before, "template identity: switching literals REBUILDS the input (documented)");
  ok(after.value === "", "template identity: the rebuild loses the un-committed text");

  const one = (on, q) =>
    html`<div><span class="${on ? "on" : "off"}"><input id="g" .value="${q}" /></span></div>`;
  renderResult(one(false, ""), host);
  const kept = host.querySelector("#g");
  kept.value = "half-typed";
  renderResult(one(true, ""), host);
  ok(host.querySelector("#g") === kept, "one literal + a bound attribute: same node");
  ok(kept.value === "half-typed", "one literal + a bound attribute: the edit survives");
  ok(host.querySelector("span").className === "on", "one literal: the class still flipped");
}

// ============ raw-text guard (learned from lit) =============================
// A child ${} inside <textarea> would silently drop + misalign; now it throws.
{
  let msg = "";
  try {
    renderResult(
      html`<textarea>${"x"}</textarea>`,
      document.createElement("div"),
    );
  } catch (e) {
    msg = String(e);
  }
  ok(
    /textarea|binding/i.test(msg),
    "rawtext guard: ${} inside <textarea> throws a clear error: " +
      msg.slice(0, 40),
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
