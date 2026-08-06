// Tests for the admin component library: table.js, menu.js, upload.js.
// Run in isolation via Docker (no host install): `make -C test`.
// jsdom gives a real DOM so we exercise the actual elements, events and logic.
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
  "Event",
  "MouseEvent",
  "File",
  "FormData",
])
  global[k] = w[k];
global.window = w;
global.queueMicrotask = queueMicrotask;

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const tick = () => new Promise((r) => queueMicrotask(() => queueMicrotask(r)));
const mount = (tag) => {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
};
const fire = (el, type, init = {}) =>
  el.dispatchEvent(new w.Event(type, { bubbles: true, ...init }));

const { PuredashboardTable } = await import("../src/table.js");
const { menu } = await import("../src/menu.js");
const { PuredashboardUpload, uploadFile } = await import("../src/upload.js");
void PuredashboardTable;
void PuredashboardUpload;
void uploadFile;

// ============================ table.js ============================
{
  const t = mount("puredashboard-table");
  t.columns = [
    { key: "name", label: "Name", sortable: true },
    { key: "n", label: "N", sortable: true, align: "right" },
  ];
  t.rows = [
    { name: "web", n: 3 },
    { name: "api", n: 10 },
    { name: "db", n: 1 },
  ];
  t.rowKey = (r) => r.name;
  t.getHref = (r) => `#/nodes/${r.name}`;
  t.actions = [{ name: "delete", label: "Delete", danger: true }];
  await tick();

  let bodyRows = t.querySelectorAll("tbody tr");
  ok(bodyRows.length === 3, "table renders 3 rows, got " + bodyRows.length);
  ok(
    t.querySelector(".puredashboard-table__open").getAttribute("href") ===
      "#/nodes/web",
    "first row Open is a real <a href>",
  );
  ok(
    t.querySelectorAll(".puredashboard-table__action--danger").length === 3,
    "each row has a danger action button",
  );

  // sort ascending by name: api, db, web
  t.querySelector('[data-sort="name"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  let firstName = t.querySelector("tbody tr td").textContent;
  ok(
    firstName === "api",
    "sort by name asc → first row 'api', got " + firstName,
  );
  ok(
    t.querySelector('th[aria-sort="ascending"]'),
    "aria-sort=ascending set on sorted header",
  );

  // toggle to descending → web first
  t.querySelector('[data-sort="name"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    t.querySelector("tbody tr td").textContent === "web",
    "sort toggle desc → first row 'web'",
  );

  // numeric sort by n asc → 1,3,10 (db, web, api)
  t.querySelector('[data-sort="n"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    t.querySelector("tbody tr td").textContent === "db",
    "numeric sort asc → 'db' (n=1) first",
  );

  // filter
  const search = t.querySelector(".puredashboard-table__search");
  search.value = "ap";
  fire(search, "input");
  await tick();
  ok(t.querySelectorAll("tbody tr").length === 1, "filter 'ap' → 1 row");
  ok(
    t.querySelector("tbody tr td").textContent === "api",
    "filter keeps 'api'",
  );
  search.value = "";
  fire(search, "input");
  await tick();

  // action event
  let acted = null;
  t.addEventListener("rowaction", (e) => {
    acted = e.detail;
  });
  t.querySelector(".puredashboard-table__action").dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    acted && acted.name === "delete" && acted.row,
    "rowaction emits { name, row }: " + JSON.stringify(acted && acted.name),
  );

  // empty state
  const t2 = mount("puredashboard-table");
  t2.columns = [{ key: "name", label: "Name" }];
  t2.rows = [];
  t2.labels = { empty: "No nodes" };
  await tick();
  ok(
    t2.querySelector(".puredashboard-table__empty") &&
      t2.querySelector(".puredashboard-table__empty").textContent ===
        "No nodes",
    "empty state shows labels.empty",
  );
}

// ============================ menu.js ============================
{
  const anchor = mount("button");
  const p = menu(anchor, [
    { label: "Rename", value: "rename" },
    { separator: true },
    { label: "Delete", value: "delete", danger: true },
    { label: "Nope", value: "nope", disabled: true },
  ]);
  const el = document.querySelector(".puredashboard-menu");
  ok(el, "menu element appended to body");
  ok(
    el.querySelectorAll(".puredashboard-menu__item").length === 3,
    "3 menu items (separator excluded)",
  );
  ok(el.querySelector(".puredashboard-menu__separator"), "separator rendered");
  ok(
    el.querySelector(".puredashboard-menu__item--danger"),
    "danger item styled",
  );
  ok(
    el.querySelector('[aria-disabled="true"]'),
    "disabled item marked aria-disabled",
  );

  // click Delete resolves the promise with its value
  const items = el.querySelectorAll(".puredashboard-menu__item");
  items[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const picked = await p;
  ok(
    picked === "delete",
    "menu resolves selected value 'delete', got " + picked,
  );
  ok(
    !document.querySelector(".puredashboard-menu"),
    "menu removed from DOM after select",
  );

  // dismiss path resolves null
  const a2 = mount("button");
  const p2 = menu(a2, [{ label: "X", value: "x" }]);
  document.dispatchEvent(
    w.KeyboardEvent
      ? new w.KeyboardEvent("keydown", { key: "Escape" })
      : new w.Event("keydown"),
  );
  // if Escape didn't register in this jsdom, force-close via an outside pointerdown
  if (document.querySelector(".puredashboard-menu"))
    document.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true }));
  const r2 = await p2;
  ok(r2 === null, "dismiss resolves null, got " + r2);
}

// ============================ upload.js ============================
{
  const u = mount("puredashboard-upload");
  u.accept = "image/*,.pdf";
  u.multiple = true;
  u.maxSize = 1000;
  u.labels = { browse: "Drop here" };
  await tick();
  ok(u.querySelector(".puredashboard-upload__zone"), "upload zone renders");
  ok(
    u.querySelector(".puredashboard-upload__input").getAttribute("accept") ===
      "image/*,.pdf",
    "accept passed to input",
  );

  const png = new w.File([new Uint8Array(500)], "pic.png", {
    type: "image/png",
  });
  const big = new w.File([new Uint8Array(2000)], "big.png", {
    type: "image/png",
  });
  const txt = new w.File([new Uint8Array(10)], "note.txt", {
    type: "text/plain",
  });

  let emitted = null;
  u.addEventListener("files", (e) => {
    emitted = e.detail;
  });

  u._add([png]);
  await tick();
  ok(
    u.files.length === 1 && u.files[0].name === "pic.png",
    "accepts a valid png",
  );
  ok(emitted && emitted.length === 1, "emits files event");
  ok(
    u.querySelector(".puredashboard-upload__file .puredashboard-upload__name")
      .textContent === "pic.png",
    "renders file row",
  );

  u._add([big]);
  await tick();
  ok(
    u.error && /too large/.test(u.error),
    "rejects oversize file with error: " + u.error,
  );

  u._add([txt]);
  await tick();
  ok(
    u.error && /not allowed/.test(u.error),
    "rejects disallowed type: " + u.error,
  );

  // multiple accumulates; remove works
  ok(u.files.length === 1, "rejected files not added (still 1)");
  const png2 = new w.File([new Uint8Array(100)], "two.png", {
    type: "image/png",
  });
  u._add([png2]);
  await tick();
  ok(u.files.length === 2, "multiple=true accumulates → 2 files");
  u.querySelector("[data-rm]").dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(u.files.length === 1, "remove button drops a file → 1");

  // single-mode replaces
  const s = mount("puredashboard-upload");
  s.multiple = false;
  await tick();
  s._add([png]);
  s._add([png2]);
  await tick();
  ok(
    s.files.length === 1 && s.files[0].name === "two.png",
    "single mode keeps only the last file",
  );

  ok(typeof uploadFile === "function", "uploadFile helper exported");
}

// ============================ table: pagination ============================
{
  const t = mount("puredashboard-table");
  t.columns = [{ key: "n", label: "N", sortable: true }];
  t.rows = Array.from({ length: 12 }, (_, i) => ({ n: i }));
  t.pageSize = 5;
  t.pageSizes = [5, 10];
  await tick();
  ok(
    t.querySelectorAll("tbody tr").length === 5,
    "pageSize=5 → 5 rows, got " + t.querySelectorAll("tbody tr").length,
  );
  ok(t.querySelector(".puredashboard-table__pager"), "pager renders");
  ok(
    t
      .querySelector(".puredashboard-table__range")
      .textContent.includes("of 12"),
    "range shows total 12: " +
      t.querySelector(".puredashboard-table__range").textContent,
  );

  t.querySelector('[data-page="next"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    t.querySelector("tbody tr td").textContent === "5",
    "next page → first row n=5, got " +
      t.querySelector("tbody tr td").textContent,
  );

  t.page = 3;
  await tick();
  ok(
    t.querySelectorAll("tbody tr").length === 2,
    "last page → 2 rows (12=5+5+2)",
  );
  ok(
    t.querySelector('[data-page="next"]').disabled,
    "next disabled on last page",
  );

  let pc = null;
  t.addEventListener("pagechange", (e) => (pc = e.detail));
  t.querySelector('[data-page="prev"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(pc && pc.page === 2, "pagechange emits page 2: " + JSON.stringify(pc));

  // filtering resets to page 1
  const s = t.querySelector(".puredashboard-table__search");
  s.value = "1";
  fire(s, "input");
  await tick();
  ok((t.page || 1) === 1, "filter resets to page 1");
}

// ============================ isolation: two instances ============================
{
  const a = mount("puredashboard-table"),
    b = mount("puredashboard-table");
  const cols = [{ key: "name", label: "Name", sortable: true }];
  a.columns = cols;
  b.columns = cols;
  a.rows = [{ name: "c" }, { name: "a" }, { name: "b" }];
  b.rows = [{ name: "z" }, { name: "y" }, { name: "x" }];
  await tick();
  a.querySelector('[data-sort="name"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    a.querySelector("tbody tr td").textContent === "a",
    "table A sorted → 'a' first",
  );
  ok(
    b.querySelector("tbody tr td").textContent === "z",
    "table B unaffected → 'z' first",
  );
  ok(
    !b.sortKey,
    "table B keeps its own (empty) sort state — instances isolated",
  );

  // two uploads keep independent selections
  const ua = mount("puredashboard-upload"),
    ub = mount("puredashboard-upload");
  ua.multiple = true;
  ub.multiple = true;
  await tick();
  ua._add([new w.File([new Uint8Array(5)], "a1.png", { type: "image/png" })]);
  ub._add([
    new w.File([new Uint8Array(5)], "b1.png", { type: "image/png" }),
    new w.File([new Uint8Array(5)], "b2.png", { type: "image/png" }),
  ]);
  await tick();
  ok(
    ua.files.length === 1 && ub.files.length === 2,
    "two uploads hold independent file sets",
  );
}

// ============ upload: remove() must still detach the ELEMENT ============
// `remove` is also Element.prototype.remove(). Shadowing it outright made uploadEl.remove()
// a no-op for the DOM — and that is a method the ENGINE calls: Row.remove() in reactive.js
// is `for (const n of this.nodes) n.remove()`, so a keyed row whose top-level node is an
// upload could never be dropped. The two contracts do not overlap: no argument detaches,
// an id drops that file.
{
  const el = mount("puredashboard-upload");
  await tick();
  ok(el.isConnected === true, "remove(): the element starts connected");
  el.remove();
  ok(el.isConnected === false, "remove() with NO argument detaches the element, as the DOM defines it");

  const el2 = mount("puredashboard-upload");
  el2.multiple = true;
  el2._add([
    new w.File([new Uint8Array(4)], "a.png", { type: "image/png" }),
    new w.File([new Uint8Array(4)], "b.png", { type: "image/png" }),
  ]);
  await tick();
  ok(el2.items.length === 2, "remove(id): two files selected");
  el2.remove(el2.items[0].id);
  await tick();
  ok(el2.items.length === 1, "remove(id) still drops that FILE");
  ok(el2.isConnected === true, "…and leaves the element in the document");

}

// ============ upload: removeFile(id), the unambiguous name ============
// In its own block on purpose. Inside the previous one, a runtime without removeFile threw
// on the first call and the suite died before reaching the cases after it — so a revert
// showed one FAIL and a crash instead of a countable list. A crash tells the next reader
// less than named failures do.
{
  const hasRemoveFile =
    typeof document.createElement("puredashboard-upload").removeFile === "function";
  ok(hasRemoveFile, "removeFile(id) exists");

  // GUARDED, not merely asserted. Asserting existence and then calling it anyway still throws
  // on a runtime without it, and the suite dies before anything after this can report — which
  // is exactly how a revert check came back as "one FAIL and a crash" instead of a countable
  // list. I made that mistake once in this very block; the guard is the fix.
  //
  // The record, because two commit messages got it wrong. e4c7fa8 claimed this file "fails 5"
  // against the pre-fix source; it measured as ONE fail plus `TypeError: el3.removeFile is not
  // a function`, and the run never reached the rest. b9c633e corrected that — and named the
  // wrong commit, 4275413 instead of e4c7fa8. With the guard in place the same revert now
  // completes and names SEVEN failures, which is the number worth carrying.
  if (hasRemoveFile) {
    const el3 = mount("puredashboard-upload");
    el3.multiple = true;
    el3._add([
      new w.File([new Uint8Array(4)], "a.png", { type: "image/png" }),
      new w.File([new Uint8Array(4)], "b.png", { type: "image/png" }),
    ]);
    await tick();
    el3.removeFile(el3.items[0].id);
    await tick();
    ok(el3.items.length === 1, "removeFile(id) drops that file");
    ok(el3.isConnected === true, "removeFile(id) never detaches the element");
  }

  // Overloading `remove` is fragile and these are the edges, pinned as they behave rather
  // than as anyone would wish: an argument that matches no item is a silent no-op, and it
  // does NOT fall through to detaching — falling through would let a stale id nuke the whole
  // component, which is worse than doing nothing.
}

// ============ upload: the edges of the kept `remove` overload ============
{
  const el4 = mount("puredashboard-upload");
  el4.multiple = true;
  el4._add([new w.File([new Uint8Array(4)], "a.png", { type: "image/png" })]);
  await tick();
  el4.remove(null);
  await tick();
  ok(el4.isConnected === true && el4.items.length === 1, "remove(null) is a no-op, not a detach");
  el4.remove(0);
  await tick();
  ok(el4.isConnected === true && el4.items.length === 1, "remove(0) is a no-op — ids start at 1");
  el4.remove(99999);
  await tick();
  ok(el4.isConnected === true && el4.items.length === 1, "remove(staleId) is a no-op, not a detach");
  el4.remove();
  ok(el4.isConnected === false, "…and a bare remove() still detaches");

  // The hazard the value test could not see: an argument that IS undefined. `up.remove(sel?.id)`
  // with nothing selected is the ordinary migration case, and under `id === undefined` it
  // detached the uploader silently.
  const el5 = mount("puredashboard-upload");
  el5.multiple = true;
  el5._add([new w.File([new Uint8Array(4)], "a.png", { type: "image/png" })]);
  await tick();
  const nothingSelected = undefined;
  el5.remove(nothingSelected);
  await tick();
  ok(
    el5.isConnected === true,
    "remove(undefined-VALUED argument) is a no-op — it must not detach the element",
  );
  ok(el5.items.length === 1, "…and drops no file either");
}

// ============ upload: a thumbnail added while disconnected must not be re-minted ============
// The revoked flag lived on the ELEMENT, which stops being true of every item the moment one
// is added while disconnected: that item's thumb is live, and re-minting it overwrote a URL
// nobody revoked. Measured that way — created=4 revoked=1 live=3 for two items.
{
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  let created = 0, revoked = 0;
  URL.createObjectURL = () => `blob:stub2/${++created}`;
  URL.revokeObjectURL = () => { revoked++; };
  try {
    const u = mount("puredashboard-upload");
    u.multiple = true;
    u._add([new w.File([new Uint8Array(4)], "a.png", { type: "image/png" })]);
    await tick();
    u.remove();                       // disconnect -> revokes a.png's thumb
    await tick();
    u._add([new w.File([new Uint8Array(4)], "b.png", { type: "image/png" })]);  // added while OUT
    await tick();
    document.body.appendChild(u);     // reconnect -> must re-mint ONLY the dead one
    await tick();
    ok(u.items.length === 2, "disconnected add: two items");
    ok(
      created - revoked === u.items.length,
      `disconnected add: one live URL per item — created ${created}, revoked ${revoked}, items ${u.items.length}`,
    );
    ok(u.items.every((it) => it.thumb && !it.thumbDead), "disconnected add: every item has a live thumb");
  } finally {
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  }
}

// ============ upload: a relocation must not leave dead thumbnail URLs ============
// disconnectedCallback revokes every object URL, which is right for an element that is
// leaving. But a RELOCATION is a disconnect plus a reconnect — re-parenting a node is
// defined as a remove plus an insert, so a keyed repeat() reorder or a filter runs both —
// and after it every `it.thumb` still pointed at a blob that had been revoked. Measured in
// Chrome before the fix: one image, one reorder, thumbnail permanently broken with the URL
// string unchanged (revoked, not replaced). The File is still ours, so the URLs are
// re-minted on the way back in.
//
// The blob API is STUBBED here on purpose. Node's URL.createObjectURL does not accept a
// jsdom File, so unstubbed every thumb is null and none of this would be exercised — the
// behaviour under test is "re-mint on reconnect", not the browser's blob implementation.
{
  const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
  let n = 0;
  const revoked = [];
  URL.createObjectURL = () => `blob:stub/${++n}`;
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  try {
    const u = mount("puredashboard-upload");
    u._add([new w.File([new Uint8Array(10)], "a.png", { type: "image/png" })]);
    await tick();
    const first = u.items[0].thumb;
    ok(first === "blob:stub/1", `upload relocate: a thumbnail URL was minted — got ${first}`);

    const host = document.createElement("div");
    document.body.appendChild(host);
    host.appendChild(u);            // MOVE — disconnect + reconnect
    await tick();

    ok(revoked.includes(first), "upload relocate: the old URL was revoked on disconnect");
    const now = u.items[0].thumb;
    ok(now === "blob:stub/2", `upload relocate: a FRESH url replaced it — got ${now}`);
    ok(revoked.indexOf(now) === -1, "upload relocate: …and the fresh one has not been revoked");
    ok(u.items[0].file instanceof w.File, "upload relocate: the File is still held, which is what makes re-minting possible");

    // a second move keeps working — the flag is not one-shot
    host.remove();
    document.body.appendChild(u);
    await tick();
    ok(u.items[0].thumb === "blob:stub/3", `upload relocate: a second move re-mints again — got ${u.items[0].thumb}`);

    // a non-image has no thumbnail and must not acquire one
    const u2 = mount("puredashboard-upload");
    u2._add([new w.File([new Uint8Array(4)], "notes.txt", { type: "text/plain" })]);
    await tick();
    ok(u2.items[0].thumb === null, "upload relocate: a non-image starts with no thumbnail");
    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    host2.appendChild(u2);
    await tick();
    ok(u2.items[0].thumb === null, "upload relocate: …and does not get one from a move");
  } finally {
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
  }
}

// ============================ upload: managed upload (transport + status/events) ============================
{
  const u = mount("puredashboard-upload");
  u.multiple = true;
  u.uploader = (file, onProgress) => {
    onProgress(0.5);
    return Promise.resolve({ response: { ok: true, name: file.name } });
  };
  u._add([
    new w.File([new Uint8Array(10)], "a.png", { type: "image/png" }),
    new w.File([new Uint8Array(10)], "b.png", { type: "image/png" }),
  ]);
  await tick();
  const evs = [];
  ["uploadstart", "uploadprogress", "uploaddone", "uploadcomplete"].forEach(
    (n) => u.addEventListener(n, () => evs.push(n)),
  );
  const results = await u.upload("/x");
  await tick();
  ok(
    results.length === 2 && results.every((r) => r.ok),
    "upload → 2 ok results",
  );
  ok(
    u.items.every((it) => it.status === "done"),
    "all items status=done",
  );
  ok(
    ["uploadstart", "uploadprogress", "uploaddone", "uploadcomplete"].every(
      (n) => evs.includes(n),
    ),
    "lifecycle events fired: " + evs.join(","),
  );
  ok(
    u.querySelector('.puredashboard-upload__file[data-status="done"]'),
    "done status reflected in DOM",
  );

  const u2 = mount("puredashboard-upload");
  u2.uploader = () => Promise.reject(new Error("boom"));
  u2._add([new w.File([new Uint8Array(10)], "x.png", { type: "image/png" })]);
  await tick();
  let errEvt = null;
  u2.addEventListener("uploaderror", (e) => (errEvt = e.detail));
  await u2.upload("/x");
  await tick();
  ok(u2.items[0].status === "error", "failed upload → status=error");
  ok(
    errEvt && /boom/.test(errEvt.error),
    "uploaderror event fired: " + (errEvt && errEvt.error),
  );
}

// ============================ table: row selection ============================
{
  const t = mount("puredashboard-table");
  t.columns = [{ key: "name", label: "Name", sortable: true }];
  t.rows = [{ name: "a" }, { name: "b" }, { name: "c" }];
  t.rowKey = (r) => r.name;
  t.selectable = true;
  await tick();
  ok(
    t.querySelector(".js-puredashboard-table__check-all"),
    "select-all checkbox renders",
  );
  ok(
    t.querySelectorAll(".js-puredashboard-table__check").length === 3,
    "a checkbox per row",
  );

  let sc = null;
  t.addEventListener("selectionchange", (e) => (sc = e.detail));
  const cb = t.querySelector('.js-puredashboard-table__check[data-i="0"]');
  cb.checked = true;
  cb.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(
    t.selected.length === 1 && t.selected[0].name === "a",
    "select row 0 → selected=[a]",
  );
  ok(sc && sc.keys.length === 1, "selectionchange emitted");
  ok(
    t.querySelector("tr.puredashboard-table__row--selected"),
    "selected row gets .selected class",
  );

  const all = t.querySelector(".js-puredashboard-table__check-all");
  all.checked = true;
  all.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(t.selected.length === 3, "select-all → 3 selected");

  t.querySelector('[data-sort="name"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(t.selected.length === 3, "selection survives sort (keyed by rowKey)");

  t.clearSelection();
  await tick();
  ok(t.selected.length === 0, "clearSelection → 0 selected");
}

// ============================ upload: form-associated (multipart) ============================
{
  // jsdom has no ElementInternals; stub attachInternals to capture setFormValue so we
  // can verify _syncForm builds the right multipart FormData under the field name.
  // (The native form serialisation of that value on submit is a browser guarantee.)
  const captured = new WeakMap();
  const orig = w.HTMLElement.prototype.attachInternals;
  w.HTMLElement.prototype.attachInternals = function () {
    const el = this;
    return {
      setFormValue(v) {
        captured.set(el, v);
      },
    };
  };
  const u = document.createElement("puredashboard-upload");
  u.setAttribute("name", "attachments");
  u.multiple = true;
  document.body.appendChild(u);
  await tick();
  u._add([
    new w.File([new Uint8Array(10)], "a.png", { type: "image/png" }),
    new w.File([new Uint8Array(20)], "b.png", { type: "image/png" }),
  ]);
  await tick();
  const fv = captured.get(u);
  ok(
    fv instanceof w.FormData,
    "form-associated: setFormValue called with a FormData",
  );
  const files = fv ? [...fv.getAll("attachments")] : [];
  ok(
    files.length === 2,
    "2 files set under name 'attachments', got " + files.length,
  );
  ok(files[0] && files[0].name === "a.png", "first form file is a.png");
  u.remove(u.items[0].id);
  await tick();
  ok(
    [...captured.get(u).getAll("attachments")].length === 1,
    "removing a file updates the form value → 1",
  );
  w.HTMLElement.prototype.attachInternals = orig;
}

// ============================ table: bulk actions on selected ============================
{
  const t = mount("puredashboard-table");
  t.columns = [{ key: "name", label: "Name" }];
  t.rows = [{ name: "a" }, { name: "b" }, { name: "c" }];
  t.rowKey = (r) => r.name;
  t.selectable = true;
  t.bulkActions = [{ name: "delete", label: "Delete selected", danger: true }];
  await tick();
  ok(!t.querySelector("[data-bulk]"), "bulk bar hidden when nothing selected");
  const all = t.querySelector(".js-puredashboard-table__check-all");
  all.checked = true;
  all.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  ok(
    t.querySelector('[data-bulk="delete"]'),
    "bulk button appears once rows are selected",
  );
  let bulk = null;
  t.addEventListener("bulkaction", (e) => (bulk = e.detail));
  t.querySelector('[data-bulk="delete"]').dispatchEvent(
    new w.MouseEvent("click", { bubbles: true }),
  );
  await tick();
  ok(
    bulk && bulk.name === "delete" && bulk.rows.length === 3,
    "bulkaction emits { name, rows(3) }: " +
      JSON.stringify(bulk && [bulk.name, bulk.rows.length]),
  );
}

// ============================ i18n: labels override ============================
{
  const t = mount("puredashboard-table");
  t.columns = [{ key: "name", label: "Name" }];
  t.rows = [];
  t.labels = { filter: "Lọc…", empty: "Trống", actions: "Thao tác" };
  await tick();
  ok(
    t
      .querySelector(".puredashboard-table__search")
      .getAttribute("placeholder") === "Lọc…",
    "table filter placeholder localised",
  );
  ok(
    t.querySelector(".puredashboard-table__empty").textContent === "Trống",
    "table empty text localised",
  );

  const u = mount("puredashboard-upload");
  u.maxSize = 5;
  u.labels = { browse: "Kéo & thả tệp", tooLarge: (m) => "quá lớn " + m };
  await tick();
  ok(
    u.querySelector(".puredashboard-upload__label").textContent ===
      "Kéo & thả tệp",
    "upload prompt localised via labels.browse",
  );
  u._add([new w.File([new Uint8Array(10)], "big.png", { type: "image/png" })]);
  await tick();
  ok(/quá lớn/.test(u.error), "upload error localised: " + u.error);
  // defaults still apply for keys not overridden
  const u2 = mount("puredashboard-upload");
  await tick();
  ok(
    u2.querySelector(".puredashboard-upload__label").textContent ===
      "Drag & drop files here, or click to browse",
    "default English when no labels set",
  );
}

// ============================ <puredashboard-markdown> inside a Reactive component ===
{
  const { Reactive, html } = await import("../src/reactive.js");
  await import("../src/md.js"); // defines <puredashboard-markdown>
  class MdHost extends Reactive {
    static properties = { body: {} };
    render() {
      return html`<div class="wrap">
        <puredashboard-markdown
          .value=${this.body || ""}
        ></puredashboard-markdown>
      </div>`;
    }
  }
  MdHost.define("md-host-test");
  const h = mount("md-host-test");
  h.body = "# Hello\n\n**bold**";
  await tick();
  const md = h.querySelector("puredashboard-markdown");
  ok(
    md && md.querySelector("h1")?.textContent === "Hello",
    "<puredashboard-markdown .value=…> renders inside a Reactive template",
  );
  ok(md.querySelector("strong")?.textContent === "bold", "inline rendered too");
  // reactive update: change the bound value → re-renders in place
  h.body = "## Changed";
  await tick();
  ok(
    h.querySelector("puredashboard-markdown h2")?.textContent === "Changed" &&
      !h.querySelector("puredashboard-markdown h1"),
    "re-renders reactively when the bound value changes",
  );
}

console.log(`components.test.mjs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
