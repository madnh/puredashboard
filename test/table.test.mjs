// Tests for table.js (<puredashboard-table>): rowAttrs / thAttrs, <th scope>, wrap-headers.
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual element, events and logic.
import { readFileSync } from "node:fs";
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

const { PuredashboardTable } = await import("../src/table.js");
void PuredashboardTable;

const COLS = [{ key: "name", label: "Name", sortable: true }, { key: "n", label: "N" }];
const ROWS = [{ id: "a", name: "Alpha", n: 1 }, { id: "b", name: "Bravo", n: 2 }, { id: "c", name: "Charlie", n: 3 }];
const trs = (el) => [...el.querySelectorAll("tbody > tr.puredashboard-table__row")];

// ---- every header cell is a column header (scope="col") ----
{
  const el = mount("puredashboard-table");
  el.columns = COLS; el.rows = ROWS; el.selectable = true; el.actions = [{ name: "x", label: "X" }];
  await tick();
  const ths = [...el.querySelectorAll("thead th")];
  ok(ths.length === 4 && ths.every((th) => th.getAttribute("scope") === "col"), "check, sortable, plain and actions <th> all carry scope=col");
}

// ---- rowAttrs: attributes and classes on each row's <tr> ----
{
  const el = mount("puredashboard-table");
  el.columns = COLS; el.rows = ROWS;
  el.rowAttrs = (row, i) => ({ "data-id": row.id, "data-i": i, class: row.n === 2 ? "is-two" : "", hidden: false });
  await tick();
  const r = trs(el);
  ok(r.map((tr) => tr.dataset.id).join() === "a,b,c", "rowAttrs sets data-* per row");
  ok(r.map((tr) => tr.dataset.i).join() === "0,1,2", "rowAttrs receives the row index");
  ok(r[1].classList.contains("is-two") && r[1].classList.contains("puredashboard-table__row"), "class is ADDED to the row's own classes");
  ok(!r[0].hasAttribute("hidden"), "false does not set the attribute");
}

// ---- rowAttrs: nothing stamped stays behind when the data under a <tr> changes ----
{
  const el = mount("puredashboard-table");
  el.columns = COLS; el.rows = ROWS;
  el.rowAttrs = (row) => (row.id === "a" ? { "data-flag": "yes", class: "is-a" } : { "data-id": row.id });
  await tick();
  ok(trs(el)[0].dataset.flag === "yes" && trs(el)[0].classList.contains("is-a"), "first row stamped for Alpha");
  el.sortKey = "name"; el.sortDir = "desc"; // Charlie, Bravo, Alpha
  await tick();
  const r = trs(el);
  ok(r[0].textContent.includes("Charlie"), "sorted: Charlie is on the first row now");
  ok(!r[0].hasAttribute("data-flag") && !r[0].classList.contains("is-a"), "a key / class rowAttrs no longer returns for that row is removed");
  ok(r[0].classList.contains("puredashboard-table__row"), "the row keeps its own classes");
  ok(r[2].dataset.flag === "yes" && r[2].classList.contains("is-a"), "Alpha's attributes follow Alpha to its new row");
  el.rowAttrs = null;
  await tick();
  ok(trs(el).every((tr) => !tr.hasAttribute("data-flag") && !tr.hasAttribute("data-id") && !tr.classList.contains("is-a")), "unsetting rowAttrs removes everything it stamped");
}

// ---- thAttrs on a column's <th> ----
{
  const el = mount("puredashboard-table");
  const cols = [{ key: "name", label: "Name" }, { key: "n", label: "N", thAttrs: { "aria-sort": "ascending", "data-col": "n" } }];
  el.columns = cols; el.rows = ROWS; el.selectable = true;
  await tick();
  const ths = el.querySelectorAll("thead th");
  ok(ths[2].getAttribute("aria-sort") === "ascending" && ths[2].dataset.col === "n", "thAttrs land on that column's <th> (offset by the select column)");
  ok(!ths[1].hasAttribute("aria-sort"), "other columns untouched");
  el.columns = [cols[0], { key: "n", label: "N", thAttrs: { "aria-sort": "descending" } }];
  await tick();
  const ths2 = el.querySelectorAll("thead th");
  ok(ths2[2].getAttribute("aria-sort") === "descending" && !ths2[2].hasAttribute("data-col"), "changed thAttrs update, dropped keys are removed");
}

// ---- default: no rowAttrs / thAttrs → no extra attributes ----
{
  const el = mount("puredashboard-table");
  el.columns = COLS; el.rows = ROWS;
  await tick();
  ok(trs(el).every((tr) => [...tr.attributes].every((a) => a.name === "class")), "default: rows carry only their class");
}

// ---- wrap-headers lets header labels wrap (CSS contract, computed in jsdom) ----
{
  const style = document.createElement("style");
  style.textContent = readFileSync(new URL("../src/table.css", import.meta.url), "utf8");
  document.head.appendChild(style);
  const a = mount("puredashboard-table");
  const b = mount("puredashboard-table");
  b.setAttribute("wrap-headers", "");
  for (const t of [a, b]) { t.columns = COLS; t.rows = ROWS; }
  await tick();
  ok(w.getComputedStyle(a.querySelector("thead th")).whiteSpace === "nowrap", "default: headers do not wrap");
  ok(w.getComputedStyle(b.querySelector("thead th")).whiteSpace === "normal", "wrap-headers: headers wrap");
  style.remove();
}

// ---- columns[].wrapHeader: only that column's header may wrap ----
{
  const style = document.createElement("style");
  style.textContent = readFileSync(new URL("../src/table.css", import.meta.url), "utf8");
  document.head.appendChild(style);
  const el = mount("puredashboard-table");
  el.columns = [{ key: "name", label: "Name", sortable: true, wrapHeader: true }, { key: "n", label: "A long header label", wrapHeader: true }, { key: "x", label: "Short" }];
  el.rows = ROWS; el.selectable = true;
  await tick();
  const ths = [...el.querySelectorAll("thead th")];
  const ws = (th) => w.getComputedStyle(th).whiteSpace;
  ok(ths[1].classList.contains("puredashboard-table__th--wrap") && ths[2].classList.contains("puredashboard-table__th--wrap"), "wrapHeader adds the --wrap modifier on that <th> (sortable and plain)");
  ok(ws(ths[1]) === "normal" && ws(ths[2]) === "normal", "wrapHeader columns: header may wrap");
  // The sort <button> is `all: unset`, so in a browser it inherits white-space from the <th>. jsdom does not resolve
  // `all` (measured: computed white-space "" on the button), so that inheritance is not observable here.
  ok(ws(ths[0]) === "nowrap" && ws(ths[3]) === "nowrap" && !ths[3].classList.contains("puredashboard-table__th--wrap"), "other headers stay on one line");
  el.setAttribute("wrap-headers", ""); await tick();
  ok(ws(el.querySelectorAll("thead th")[3]) === "normal", "table-level wrap-headers still wraps every header (OR)");
  style.remove();
}

// ---- rows-per-page select always offers the current pageSize ----
{
  const el = mount("puredashboard-table");
  el.columns = COLS; el.rows = ROWS; el.pageSize = 4;
  await tick();
  const sel = el.querySelector(".js-puredashboard-table__page-size");
  ok([...sel.options].map((o) => o.value).join() === "4,10,25,50", "pageSize 4 is added to the default options, sorted");
  ok(sel.value === "4", "the select shows the current pageSize instead of blank");
  el.pageSizes = [5, 20]; el.pageSize = 20; await tick();
  ok([...el.querySelector(".js-puredashboard-table__page-size").options].map((o) => o.value).join() === "5,20", "a pageSize already in pageSizes is not duplicated");
}

console.log(`table.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
