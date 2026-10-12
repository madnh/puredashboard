// Tests for ../src/dialog.js — modal & drawer logic in jsdom. jsdom doesn't do
// real modal/top-layer/focus-trap (those are verified in a real browser via
// Playwright), but the observable contract — structure, a11y wiring, open/close,
// returnValue, the closed promise, cleanup, close-button, light-dismiss fallback,
// and drawer layout/slide — is all exercised here.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const raf = () => new Promise((r) => setTimeout(r, 30));

function install(url = "http://localhost/") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  const w = dom.window;
  for (const k of [
    "window",
    "document",
    "HTMLElement",
    "HTMLDialogElement",
    "Node",
    "Event",
    "MouseEvent",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ])
    global[k] = w[k];
  return w;
}

const w = install();
const { dialog, drawer, alert, confirm, prompt } =
  await import("../src/dialog.js");
const lastDialog = () =>
  [...document.querySelectorAll("dialog.puredashboard-dialog")].pop();

// ============================ modal: structure + a11y =======================
{
  const d = dialog({ title: "Add node", content: "hello world" });
  const el = document.querySelector(
    "dialog.puredashboard-dialog.puredashboard-dialog--center",
  );
  ok(
    el === d.el && el.parentNode === document.body,
    "modal: appended to body with puredashboard-dialog--center class",
  );
  const h = el.querySelector(".puredashboard-dialog__title");
  ok(h && h.textContent === "Add node", "modal: title rendered");
  ok(
    el.getAttribute("aria-labelledby") === h.id && h.id,
    "modal: aria-labelledby points at the title",
  );
  ok(
    el.querySelector(".puredashboard-dialog__body").textContent ===
      "hello world",
    "modal: string content inserted as text",
  );
  ok(
    el.getAttribute("closedby") === "any",
    "modal: dismissable → closedby=any",
  );
  d.close();
  await d.closed;
}

// ===================== content as Node and as function ======================
{
  const node = document.createElement("p");
  node.textContent = "node-content";
  const d1 = dialog({ title: "N", content: node });
  ok(
    d1.el.querySelector(".puredashboard-dialog__body p")?.textContent ===
      "node-content",
    "content: DOM Node appended",
  );
  d1.close();
  await d1.closed;

  let gotBody = null;
  const d2 = dialog({
    title: "F",
    content: (body) => {
      gotBody = body;
      body.append(document.createElement("form"));
    },
  });
  ok(
    gotBody === d2.body &&
      d2.el.querySelector(".puredashboard-dialog__body form"),
    "content: function receives body and renders",
  );
  d2.close();
  await d2.closed;
}

// ===================== open / close / returnValue / cleanup =================
{
  let closedWith = null;
  const d = dialog({ title: "T", onClose: (v) => (closedWith = v) });
  d.show();
  ok(d.el.open === true, "open: show() opens the dialog");
  d.close("ok");
  const v = await d.closed;
  ok(v === "ok", "close: closed promise resolves to returnValue: " + v);
  ok(closedWith === "ok", "close: onClose called with returnValue");
  ok(!d.el.isConnected, "close: element removed from DOM on close");
}

// =============================== close button ===============================
{
  const d = dialog({ title: "X" }).show();
  const btn = d.el.querySelector(".puredashboard-dialog__close");
  ok(
    btn && btn.getAttribute("aria-label") === "Close",
    "close-btn: present with aria-label",
  );
  btn.click();
  ok(
    (await d.closed) === "close",
    "close-btn: click closes with value 'close'",
  );
}

// ===================== light-dismiss fallback (no closedby) =================
{
  const hasNative = "closedBy" in w.HTMLDialogElement.prototype;
  const d = dialog({ title: "Y" }).show();
  if (hasNative) {
    ok(
      true,
      "light-dismiss: native closedby present — fallback intentionally not attached",
    );
    d.close();
    await d.closed;
  } else {
    // backdrop click: target is the dialog itself, coords outside its (0×0 in jsdom) box
    d.el.dispatchEvent(
      new w.MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }),
    );
    ok(
      (await d.closed) === "dismiss",
      "light-dismiss: backdrop click closes via fallback",
    );
  }
}

// ===================== drawer: layout + slide-in ============================
{
  const d = drawer({ position: "left", title: "Filters", content: "f" });
  ok(
    d.el.classList.contains("puredashboard-dialog--left"),
    "drawer: position class puredashboard-dialog--left",
  );
  ok(
    d.el.style.position === "fixed" && d.el.style.height === "100%",
    "drawer: fixed full-height layout",
  );
  ok(
    d.el.style.transform === "translateX(-100%)",
    "drawer: starts offscreen: " + d.el.style.transform,
  );
  d.show();
  await raf();
  ok(
    d.el.open === true && d.el.style.transform === "none",
    "drawer: show() opens + slides in (transform none)",
  );
  // default side is right
  const r = drawer({ title: "R" });
  ok(
    r.el.classList.contains("puredashboard-dialog--right"),
    "drawer: defaults to right",
  );
}

// =============================== confirm ====================================
{
  const p = confirm("Delete it?", { title: "Confirm", danger: true });
  const el = lastDialog();
  ok(el.getAttribute("role") === "alertdialog", "confirm: role=alertdialog");
  ok(
    el.getAttribute("aria-describedby") ===
      el.querySelector(".puredashboard-dialog__message").id,
    "confirm: aria-describedby → message",
  );
  ok(
    el.querySelector(".puredashboard-dialog__message").textContent ===
      "Delete it?",
    "confirm: message text",
  );
  const okBtn = el.querySelector(".puredashboard-dialog__button--primary");
  ok(okBtn.hasAttribute("autofocus"), "confirm: primary button autofocus");
  ok(
    okBtn.classList.contains("puredashboard-dialog__button--danger"),
    "confirm: danger styles the OK button",
  );
  okBtn.click();
  ok((await p) === true, "confirm: OK → true");
}
{
  const p = confirm("Sure?");
  lastDialog()
    .querySelector(
      ".puredashboard-dialog__button:not(.puredashboard-dialog__button--primary)",
    )
    .click(); // Cancel
  ok((await p) === false, "confirm: Cancel → false");
}
{
  const p = confirm("Sure?");
  lastDialog().dispatchEvent(
    new w.MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 }),
  ); // backdrop
  ok((await p) === false, "confirm: backdrop dismiss → false");
}

// ============== class override: reuse the app's own button styles ===========
{
  const p = confirm("Sure?", {
    okClass: "btn btn-primary",
    cancelClass: "btn",
  });
  const el = lastDialog();
  const buttons = [
    ...el.querySelectorAll(".puredashboard-dialog__actions button"),
  ];
  ok(
    buttons.some((b) => b.className === "btn btn-primary") &&
      buttons.some((b) => b.className === "btn"),
    "style: okClass/cancelClass let the app supply its own button classes",
  );
  ok(
    !el.querySelector(".puredashboard-dialog__button--primary"),
    "style: default .puredashboard-dialog__button--primary not applied when okClass given",
  );
  buttons.find((b) => b.className === "btn btn-primary").click();
  ok((await p) === true, "style: overridden OK button still resolves true");
}

// =============================== alert ======================================
{
  let resolved = false;
  const p = alert("Saved.", { title: "Note" }).then(() => (resolved = true));
  const el = lastDialog();
  ok(el.getAttribute("role") === "alertdialog", "alert: role=alertdialog");
  ok(
    el.querySelectorAll(
      ".puredashboard-dialog__actions .puredashboard-dialog__button",
    ).length === 1,
    "alert: single OK button",
  );
  el.querySelector(".puredashboard-dialog__button--primary").click();
  await p;
  ok(resolved, "alert: resolves when OK clicked");
}

// =============================== prompt =====================================
{
  const p = prompt("New name?", { defaultValue: "old" });
  const el = lastDialog();
  const input = el.querySelector(".puredashboard-dialog__input");
  ok(
    input && input.value === "old",
    "prompt: input prefilled with defaultValue",
  );
  input.value = "newname";
  el.querySelector(".puredashboard-dialog__button--primary").click();
  ok((await p) === "newname", "prompt: OK → input value");
}
{
  const p = prompt("New name?");
  lastDialog()
    .querySelector(
      ".puredashboard-dialog__button:not(.puredashboard-dialog__button--primary)",
    )
    .click(); // Cancel
  ok((await p) === null, "prompt: Cancel → null");
}
{
  const p = prompt("New name?");
  const input = lastDialog().querySelector(".puredashboard-dialog__input");
  input.value = "viaEnter";
  input.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  ok((await p) === "viaEnter", "prompt: Enter key submits → value");
}

// ---- size: a modal is a FIXED width (default md), drawers take the same names ----
{
  const w = (d) => d.el.style.getPropertyValue("--puredashboard-dialog-w");
  const cls = (d) => [...d.el.classList].filter((c) => /--size|--sized/.test(c)).join(" ");
  const def = dialog({ title: "x" });
  ok(cls(def) === "puredashboard-dialog--sized puredashboard-dialog--size-md" && w(def) === "var(--puredashboard-dialog-w-md, 560px)", "default size is md: a fixed 560px width through a themable var — got " + cls(def) + " / " + w(def));
  const lg = dialog({ size: "lg" });
  ok(w(lg) === "var(--puredashboard-dialog-w-lg, 800px)" && lg.el.classList.contains("puredashboard-dialog--size-lg"), "size lg → 800px");
  const xl = dialog({ size: "xl" });
  ok(w(xl) === "var(--puredashboard-dialog-w-xl, 1140px)", "size xl → 1140px");
  const sm = dialog({ size: "sm" });
  ok(w(sm) === "var(--puredashboard-dialog-w-sm, 400px)", "size sm → 400px");
  const num = dialog({ size: 640 });
  ok(w(num) === "640px" && num.el.classList.contains("puredashboard-dialog--size-custom"), "a number is px");
  const css = dialog({ size: "70vw" });
  ok(w(css) === "70vw" && css.el.classList.contains("puredashboard-dialog--size-custom"), "a CSS length passes through");
  const full = dialog({ size: "full" });
  ok(w(full) === "100vw" && full.el.classList.contains("puredashboard-dialog--size-full"), "full → the viewport (CSS caps it to 100vw − 32px and sets the height)");
  const auto = dialog({ size: "auto" });
  ok(!auto.el.classList.contains("puredashboard-dialog--sized") && w(auto) === "", "auto → shrink-to-content (no fixed width)");
  const dr = drawer({ size: "lg" });
  ok(dr.el.style.width === "min(100vw, var(--puredashboard-dialog-drawer-w-lg, 560px))", "drawer size lg → 560px wide: " + dr.el.style.width);
  const top = drawer({ position: "top", size: "sm" });
  ok(top.el.style.height === "min(100vh, var(--puredashboard-dialog-drawer-h-sm, 30vh))", "a top drawer's size is its height: " + top.el.style.height);
  const plain = drawer({});
  ok(plain.el.style.width === "var(--puredashboard-dialog-drawer-w, min(92vw, 380px))" && !plain.el.classList.contains("puredashboard-dialog--sized"), "a drawer without size keeps the 380px default and is never --sized");
  for (const d of [def, lg, xl, sm, num, css, full, auto, dr, top, plain]) d.el.remove();
  const cssText = readFileSync(new URL("../src/dialog.css", import.meta.url), "utf8");
  ok(/\.puredashboard-dialog--sized\s*\{\s*width:\s*min\(var\(--puredashboard-dialog-w\),\s*calc\(100vw - 32px\)\);\s*max-width:\s*none/.test(cssText), "CSS: a sized dialog takes --puredashboard-dialog-w, capped to the viewport");
  ok(/max-height:\s*var\(--puredashboard-dialog-max-h,\s*85vh\)/.test(cssText), "CSS: the height cap is themable (--puredashboard-dialog-max-h)");
}

// ---- helpers fit their message unless sized ----
{
  const p = alert("hi");
  await raf();
  const el = lastDialog();
  ok(el.classList.contains("puredashboard-dialog--alert") && !el.classList.contains("puredashboard-dialog--sized"), "alert() stays shrink-to-content (size auto)");
  el.querySelector(".puredashboard-dialog__button").click();
  await p;
  const p2 = confirm("wide?", { size: "lg" });
  await raf();
  ok(lastDialog().classList.contains("puredashboard-dialog--size-lg"), "confirm({ size }) widens it");
  lastDialog().querySelector(".puredashboard-dialog__button").click();
  await p2;
}

// ---- the agent API lists the imperative functions, with the size guidance ----
{
  const lines = readFileSync(new URL("../src/_components.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const fn = (n) => lines.find((r) => r.function === n);
  for (const n of ["dialog", "drawer", "alert", "menu", "toast"]) ok(!!fn(n), `_components.jsonl has a line for ${n}()`);
  const d = fn("dialog");
  ok(d && /size/.test(d.summary) && /"lg"/.test(d.params[0].desc) && /size: "lg"/.test(d.example || ""), "dialog()'s line names `size` in its summary, its params and its example");
}

// ---- CSS contract: the body's scrollbar matches the sider's; dark theme says dark ----
{
  const css = readFileSync(new URL("../src/dialog.css", import.meta.url), "utf8");
  ok(/\.puredashboard-dialog__body\s*\{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:\s*transparent transparent/.test(css), "dialog body: thin scrollbar, invisible at rest");
  ok(/\.puredashboard-dialog:hover \.puredashboard-dialog__body,\s*\.puredashboard-dialog:focus-within \.puredashboard-dialog__body\s*\{[^}]*scrollbar-color:\s*var\(--puredashboard-dialog-scrollbar/.test(css), "dialog body: the thumb shows on hover / focus-within");
  const tokens = readFileSync(new URL("../src/theme/tokens.css", import.meta.url), "utf8");
  ok(/:root\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark;\s*\}/.test(tokens), "tokens: a forced dark theme sets color-scheme: dark (native scrollbars/controls follow the theme, not the OS)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
