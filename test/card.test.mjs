// Tests for card.js (<puredashboard-card>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element and light-DOM wrapping.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
const w = dom.window;
for (const k of ["document", "HTMLElement", "customElements", "NodeFilter", "CustomEvent", "Node", "Event", "MouseEvent"])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

const { PuredashboardCard } = await import("../src/card.js");
void PuredashboardCard;

// ---- children preserved & wrapped in __body ----
{
  document.body.innerHTML = `<puredashboard-card><p id="a">Alpha</p><span id="b">Beta</span></puredashboard-card>`;
  const el = document.body.firstElementChild;
  const a = el.querySelector("#a");
  const b = el.querySelector("#b");
  const body = el.querySelector(".puredashboard-card__body");
  ok(body, "renders a __body wrapper");
  ok(a && a.parentElement === body, "existing #a child moved into __body");
  ok(b && b.parentElement === body, "existing #b child moved into __body");
  ok(body.textContent === "AlphaBeta", "body preserves child content in order");
  ok(a.isConnected && b.isConnected, "children stay connected (moved, not cloned)");
}

// ---- title renders in header ----
{
  document.body.innerHTML = `<puredashboard-card title="Revenue"><p>body</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  const header = el.querySelector(".puredashboard-card__header");
  const title = el.querySelector(".puredashboard-card__title");
  ok(header, "header created when a title is set");
  ok(title && title.textContent === "Revenue", "title text rendered in header");
  // header comes before the body in DOM order
  const body = el.querySelector(".puredashboard-card__body");
  ok(header.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING, "header precedes body");
}

// ---- no title/footer/extra → just a bordered body, no header/footer ----
{
  document.body.innerHTML = `<puredashboard-card><p>only body</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  ok(!el.querySelector(".puredashboard-card__header"), "no header when no title/extra");
  ok(!el.querySelector(".puredashboard-card__footer"), "no footer when nothing projected");
  ok(el.querySelector(".puredashboard-card__body").textContent === "only body", "body renders alone");
  ok(el.getAttribute("aria-label") === "Panel", "fallback aria-label used when untitled");
}

// ---- data-card-footer child moved to footer ----
{
  document.body.innerHTML = `<puredashboard-card><p id="c">content</p><div data-card-footer id="f">the footer</div></puredashboard-card>`;
  const el = document.body.firstElementChild;
  const footer = el.querySelector(".puredashboard-card__footer");
  const f = el.querySelector("#f");
  const body = el.querySelector(".puredashboard-card__body");
  ok(footer, "footer region created for a projected child");
  ok(f.parentElement === footer, "data-card-footer child moved into footer");
  ok(el.querySelector("#c").parentElement === body, "non-projected child stays in body");
  ok(!body.contains(f), "footer child is NOT left in the body");
}

// ---- data-card-extra moved to header extra ----
{
  document.body.innerHTML = `<puredashboard-card title="T"><button data-card-extra id="x">Act</button><p>b</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  const extra = el.querySelector(".puredashboard-card__extra");
  const x = el.querySelector("#x");
  ok(extra, "extra region created for a projected action");
  ok(x.parentElement === extra, "data-card-extra child moved into header extra");
  ok(extra.parentElement === el.querySelector(".puredashboard-card__header"), "extra lives inside the header");
}

// ---- slot="footer" / slot="extra" also project ----
{
  document.body.innerHTML = `<puredashboard-card><i slot="extra" id="se">e</i><b slot="footer" id="sf">f</b><p>b</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  ok(el.querySelector("#se").parentElement === el.querySelector(".puredashboard-card__extra"), "slot=extra projects to header extra");
  ok(el.querySelector("#sf").parentElement === el.querySelector(".puredashboard-card__footer"), "slot=footer projects to footer");
}

// ---- connect is idempotent (no double-wrap on reconnect) ----
{
  document.body.innerHTML = `<puredashboard-card><p id="p">x</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  const bodyBefore = el.querySelector(".puredashboard-card__body");
  el.remove();
  document.body.appendChild(el);   // triggers connectedCallback again
  const bodies = el.querySelectorAll(".puredashboard-card__body");
  ok(bodies.length === 1, "reconnect does not create a second __body");
  ok(el.querySelector(".puredashboard-card__body") === bodyBefore, "same body wrapper reused across reconnect");
  ok(bodyBefore.querySelector("#p"), "child not re-wrapped or lost on reconnect");
}

// ---- title update reflects ----
{
  document.body.innerHTML = `<puredashboard-card><p>b</p></puredashboard-card>`;
  const el = document.body.firstElementChild;
  ok(!el.querySelector(".puredashboard-card__header"), "starts headerless");
  el.title = "Later";
  ok(el.querySelector(".puredashboard-card__title").textContent === "Later", "setting title after connect creates header + title");
  el.title = "Renamed";
  ok(el.querySelector(".puredashboard-card__title").textContent === "Renamed", "title update reflected to header");
}

// ---- bordered default + flat toggle ----
{
  const el = document.createElement("puredashboard-card");
  document.body.appendChild(el);
  ok(el.bordered === true, "bordered defaults to true");
  ok(!el.hasAttribute("data-card-flat"), "no flat state hook by default");
  el.bordered = false;
  ok(el.hasAttribute("data-card-flat"), "bordered=false sets the flat state hook");
  el.bordered = true;
  ok(!el.hasAttribute("data-card-flat"), "restoring bordered removes the flat hook");
}

// ---- localisable labels ----
{
  const el = document.createElement("puredashboard-card");
  el.labels = { region: "Bảng" };
  document.body.appendChild(el);
  ok(el.getAttribute("aria-label") === "Bảng", "labels override the fallback region name");
  ok(el._label("region") === "Bảng", "labels override the default string");
}

console.log(`card.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
