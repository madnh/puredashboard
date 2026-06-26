// Tests for ../src/toast.js — stack/append/dismiss/auto-dismiss/types in jsdom.
// jsdom has no Popover API, so this exercises the fallback path + all the DOM/timer
// logic; the top-layer (above-modal) behavior is verified in a real browser.
import { JSDOM } from "jsdom";

let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
const w = dom.window;
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "Node",
  "Event",
  "requestAnimationFrame",
  "cancelAnimationFrame",
])
  global[k] = w[k];

const { toast } = await import("../src/toast.js");
const stackEl = () => document.querySelector(".puredashboard-toast-stack");
// fully remove a toast synchronously (jsdom fires no real transitionend)
const kill = (t) => {
  t.close();
  t.el.dispatchEvent(new w.Event("transitionend"));
};

// ============================ structure =====================================
{
  const t = toast("Saved");
  const s = stackEl();
  ok(
    s && s.parentNode === document.body,
    "stack: created and attached to body",
  );
  ok(
    !s.hasAttribute("popover") && s.style.zIndex === "9999",
    "stack: fallback path in jsdom (no popover → high z-index)",
  );
  ok(
    t.el.classList.contains("puredashboard-toast") &&
      t.el.classList.contains("puredashboard-toast--info"),
    "toast: default type=info classes",
  );
  ok(t.el.getAttribute("role") === "status", "toast: info → role=status");
  ok(
    t.el.querySelector(".puredashboard-toast__message").textContent === "Saved",
    "toast: message text",
  );
  ok(
    t.el.querySelector(".puredashboard-toast__close"),
    "toast: dismissable → close button present",
  );
  kill(t);
}

// ============================ types / roles =================================
{
  const e = toast.error("Boom");
  ok(
    e.el.classList.contains("puredashboard-toast--error") &&
      e.el.getAttribute("role") === "alert",
    "error: toast-error + role=alert",
  );
  const wn = toast.warn("Careful");
  ok(wn.el.getAttribute("role") === "alert", "warn: role=alert");
  const su = toast.success("Done");
  ok(
    su.el.classList.contains("puredashboard-toast--success") &&
      su.el.getAttribute("role") === "status",
    "success: toast-success + role=status",
  );
  kill(e);
  kill(wn);
  kill(su);
}

// ============================ stacking ======================================
{
  ok(
    stackEl().children.length === 0,
    "stack: empty after previous toasts killed",
  );
  const a = toast("A"),
    b = toast("B"),
    c = toast("C");
  ok(
    stackEl().children.length === 3,
    "stack: multiple toasts coexist: " + stackEl().children.length,
  );
  kill(a);
  kill(b);
  kill(c);
  ok(stackEl().children.length === 0, "stack: emptied after closing all");
}

// ============================ auto-dismiss ==================================
{
  const t = toast("bye", { duration: 30 });
  ok(t.el.isConnected, "auto: present right after creation");
  await sleep(60); // duration elapses → close() initiated
  t.el.dispatchEvent(new w.Event("transitionend")); // finish the exit
  ok(!t.el.isConnected, "auto: removed after its duration");
}

// ============================ sticky (duration 0) ===========================
{
  const t = toast("stay", { duration: 0 });
  await sleep(60);
  ok(t.el.isConnected, "sticky: duration 0 → not auto-dismissed");
  kill(t);
  ok(!t.el.isConnected, "sticky: manual close() still works");
}

// ============================ dismissable:false =============================
{
  const t = toast("no-x", { dismissable: false });
  ok(
    !t.el.querySelector(".puredashboard-toast__close"),
    "dismissable:false → no close button",
  );
  kill(t);
}

// ============================ close button ==================================
{
  let closedCb = false;
  const t = toast("click-me", { onClose: () => (closedCb = true) });
  t.el.querySelector(".puredashboard-toast__close").click();
  t.el.dispatchEvent(new w.Event("transitionend"));
  ok(!t.el.isConnected, "close-btn: click removes the toast");
  ok(closedCb, "close-btn: onClose callback fired");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
