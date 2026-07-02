// Tests for pagination.js (<puredashboard-pagination>).
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
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
const mount = (tag) => { const el = document.createElement(tag); document.body.appendChild(el); return el; };

const { PuredashboardPagination } = await import("../src/pagination.js");
void PuredashboardPagination;

const pages = (el) => [...el.querySelectorAll(".puredashboard-pagination__btn--page")].map((b) => b.textContent);
const items = (el) => [...el.querySelectorAll(".puredashboard-pagination__list > .puredashboard-pagination__item")]
  .map((li) => li.querySelector(".puredashboard-pagination__ellipsis") ? "…" : li.textContent);
const prevBtn = (el) => el.querySelector(".puredashboard-pagination__btn--prev");
const nextBtn = (el) => el.querySelector(".puredashboard-pagination__btn--next");

// ---- pageCount derived from total + pageSize ----
{
  const el = mount("puredashboard-pagination");
  el.total = 200; el.pageSize = 10; el.page = 1;
  await tick();
  ok(el._count() === 20, "pageCount = ceil(total/pageSize) = 20");
  el.total = 195; el.pageSize = 10;
  await tick();
  ok(el._count() === 20, "ceil rounds up a partial last page (195/10 -> 20)");
  // plain pageCount when total/pageSize absent
  const el2 = mount("puredashboard-pagination");
  el2.pageCount = 7;
  await tick();
  ok(el2._count() === 7, "falls back to pageCount when no total/pageSize");
}

// ---- window + ellipsis for a large count (page 5 of 20) ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 20; el.page = 5; el.siblingCount = 1;
  await tick();
  // first, gap, 4,5,6, gap, last
  ok(items(el).join(",") === "1,…,4,5,6,…,20", "page 5 of 20 windows to 1 … 4 5 6 … 20");
  const ell = el.querySelectorAll(".puredashboard-pagination__ellipsis");
  ok(ell.length === 2, "two ellipsis gaps rendered");
  ok([...ell].every((e) => e.getAttribute("aria-hidden") === "true"), "ellipsis are aria-hidden");
}

// ---- first & last always present; no lone ellipsis near the edges ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 20; el.page = 1; el.siblingCount = 1;
  await tick();
  ok(items(el)[0] === "1" && items(el)[items(el).length - 1] === "20", "first and last shown at page 1");
  ok(items(el).join(",") === "1,2,3,4,5,…,20", "near the start keeps constant width, no left gap");
  el.page = 20;
  await tick();
  ok(items(el).join(",") === "1,…,16,17,18,19,20", "near the end keeps constant width, no right gap");
}

// ---- small count renders every page, no ellipsis ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 5; el.page = 3;
  await tick();
  ok(pages(el).join(",") === "1,2,3,4,5", "small count shows every page");
  ok(el.querySelectorAll(".puredashboard-pagination__ellipsis").length === 0, "no ellipsis for a small count");
}

// ---- prev disabled at page 1, next disabled at last ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 10; el.page = 1;
  await tick();
  ok(prevBtn(el).disabled === true, "prev disabled on page 1");
  ok(nextBtn(el).disabled === false, "next enabled on page 1");
  el.page = 10;
  await tick();
  ok(nextBtn(el).disabled === true, "next disabled on the last page");
  ok(prevBtn(el).disabled === false, "prev enabled on the last page");
}

// ---- aria-current on the current page button ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 10; el.page = 4;
  await tick();
  const current = [...el.querySelectorAll(".puredashboard-pagination__btn--page")].filter((b) => b.getAttribute("aria-current") === "page");
  ok(current.length === 1 && current[0].textContent === "4", "exactly the current page has aria-current=page");
  ok(current[0].classList.contains("puredashboard-pagination__btn--current"), "current page has the active modifier class");
}

// ---- pagechange: number click emits that page + updates state ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 20; el.page = 5;
  await tick();
  let got = null;
  el.addEventListener("pagechange", (e) => { got = e.detail.page; });
  const six = [...el.querySelectorAll(".puredashboard-pagination__btn--page")].find((b) => b.textContent === "6");
  six.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(got === 6, "clicking page 6 emits { page: 6 }");
  ok(el.page === 6, "internal page state advances (uncontrolled)");
}

// ---- pagechange: prev / next emit the neighbouring page ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 20; el.page = 5;
  await tick();
  const seen = [];
  el.addEventListener("pagechange", (e) => { seen.push(e.detail.page); });
  nextBtn(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(seen[seen.length - 1] === 6 && el.page === 6, "next emits page 6");
  prevBtn(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(seen[seen.length - 1] === 5 && el.page === 5, "prev emits page 5");
}

// ---- clamping: prev at 1 and next at last do not emit ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 3; el.page = 1;
  await tick();
  let count = 0;
  el.addEventListener("pagechange", () => { count++; });
  prevBtn(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 0 && el.page === 1, "prev at page 1 is a no-op (clamped, no emit)");
  el.page = 3;
  await tick();
  nextBtn(el).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  ok(count === 0 && el.page === 3, "next at the last page is a no-op (clamped, no emit)");
}

// ---- pageCount <= 1 renders a minimal empty nav ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 1;
  await tick();
  const nav = el.querySelector(".puredashboard-pagination");
  ok(nav && nav.tagName === "NAV", "renders a <nav> even with one page");
  ok(el.querySelectorAll(".puredashboard-pagination__btn").length === 0, "no page/prev/next buttons for a single page");
}

// ---- localisable labels ----
{
  const el = mount("puredashboard-pagination");
  el.pageCount = 5; el.page = 2;
  el.labels = { prev: "Trước", next: "Sau", ariaLabel: "Phân trang", page: (n) => `Trang ${n}` };
  await tick();
  ok(prevBtn(el).getAttribute("aria-label") === "Trước", "prev label overridden");
  ok(nextBtn(el).getAttribute("aria-label") === "Sau", "next label overridden");
  ok(el.querySelector(".puredashboard-pagination").getAttribute("aria-label") === "Phân trang", "nav aria-label overridden");
  const p3 = [...el.querySelectorAll(".puredashboard-pagination__btn--page")].find((b) => b.textContent === "3");
  ok(p3.getAttribute("aria-label") === "Trang 3", "function-valued page label interpolates the override");
  ok(el._label("ariaLabel") === "Phân trang", "_label reads the override");
  const el2 = mount("puredashboard-pagination");
  await tick();
  ok(el2._label("ariaLabel") === "Pagination", "default nav label kept when not overridden");
}

console.log(`pagination.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
