// dialog.js — modal & drawer overlays on the native <dialog> element. Zero-dep,
// no build, CSP-safe (layout/animation via CSSOM inline styles — no injected
// <style>; theme the .dlg-* classes and ::backdrop from your app stylesheet).
//
// Built on showModal() so the browser gives us, for free: top-layer stacking,
// focus trap, Esc-to-close, and (with closedby="any") backdrop light-dismiss. A
// fallback reproduces light-dismiss on browsers without `closedby` (Safari).
//
//   import { dialog, drawer } from "./vendor/puredashboard/dialog.js";
//
//   const d = dialog({
//     title: "Add node",
//     content: (body) => { body.append(myForm); },   // fn | Node | string(text)
//     onClose: (value) => { if (value === "ok") save(); },
//   }).show();
//   // later: d.close("ok");  →  d.closed resolves to "ok"
//
//   drawer({ position: "right", title: "Filters", content: (b) => {…} }).show();
//
// Contract: content is a function (body) => void | a DOM Node | a plain string
// (inserted as TEXT — safe). For trusted markup, pass a function and render into
// `body` yourself (e.g. body.appendChild(node) or your own html`` helper).

let _seq = 0;

export function dialog(opts = {}) {
  const position = opts.position || "center";       // center = modal; sides = drawer
  const isDrawer = position !== "center";
  const dismissable = opts.dismissable !== false;
  const seq = ++_seq;

  const el = document.createElement("dialog");
  el.className = "puredashboard-dialog puredashboard-dialog--" + position + (opts.className ? " " + opts.className : "");
  if (dismissable) el.setAttribute("closedby", "any");   // Esc + backdrop light-dismiss

  // ---- header (title + close button) — accessible name via aria-labelledby ----
  if (opts.title != null || opts.closeButton !== false) {
    const head = document.createElement("div");
    head.className = "puredashboard-dialog__head";
    if (opts.title != null) {
      const h = document.createElement("h2");
      h.className = "puredashboard-dialog__title"; h.id = "puredashboard-dialog__title-" + seq; h.textContent = opts.title;
      head.appendChild(h);
      el.setAttribute("aria-labelledby", h.id);
    } else if (opts.ariaLabel) {
      el.setAttribute("aria-label", opts.ariaLabel);
    }
    if (opts.closeButton !== false) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "puredashboard-dialog__close"; b.setAttribute("aria-label", "Close"); b.textContent = "×";
      b.addEventListener("click", () => ctrl.close("close"));
      head.appendChild(b);
    }
    el.appendChild(head);
  } else if (opts.ariaLabel) {
    el.setAttribute("aria-label", opts.ariaLabel);
  }

  // ---- body content -----------------------------------------------------------
  const body = document.createElement("div");
  body.className = "puredashboard-dialog__body";
  const c = opts.content;
  if (typeof c === "function") c(body);
  else if (c instanceof Node) body.appendChild(c);
  else if (typeof c === "string") body.textContent = c;
  el.appendChild(body);

  document.body.appendChild(el);

  // ---- drawer layout + slide (inline, CSP-safe) -------------------------------
  // Structural layout is inline (so a drawer works with no CSS), but the size is a
  // CSS var → the app themes width/height via --puredashboard-dialog-drawer-w / --puredashboard-dialog-drawer-h.
  const offscreen = { right: "translateX(100%)", left: "translateX(-100%)", top: "translateY(-100%)", bottom: "translateY(100%)" }[position];
  if (isDrawer) {
    Object.assign(el.style, { position: "fixed", margin: "0", maxWidth: "none", maxHeight: "none", transition: "transform .2s ease", transform: offscreen });
    const W = "var(--puredashboard-dialog-drawer-w, min(92vw, 380px))", H = "var(--puredashboard-dialog-drawer-h, 45vh)";
    // Reset the OPPOSITE inset to auto: the UA stylesheet gives a modal <dialog> a
    // default `inset: 0`, so pinning only `right`/`bottom` leaves the UA `left`/`top: 0`
    // in place and the panel sticks to the wrong edge. Set both axes explicitly.
    if (position === "right") Object.assign(el.style, { top: "0", right: "0", bottom: "0", left: "auto", height: "100%", width: W });
    if (position === "left") Object.assign(el.style, { top: "0", left: "0", bottom: "0", right: "auto", height: "100%", width: W });
    if (position === "top") Object.assign(el.style, { top: "0", left: "0", right: "0", bottom: "auto", width: "100%", height: H });
    if (position === "bottom") Object.assign(el.style, { bottom: "0", left: "0", right: "0", top: "auto", width: "100%", height: H });
  }

  // ---- light-dismiss fallback for browsers without closedby (Safari) ----------
  if (dismissable && !("closedBy" in HTMLDialogElement.prototype)) {
    el.addEventListener("click", (e) => {
      if (e.target !== el) return;                 // only clicks on the backdrop itself
      const r = el.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.top + r.height && r.left <= e.clientX && e.clientX <= r.left + r.width;
      if (!inside) ctrl.close("dismiss");
    });
  }

  // ---- lifecycle: a single idempotent teardown, driven either by our close() or
  // by the browser closing the dialog itself (Esc / native light-dismiss). --------
  let resolveClosed, torn = false;
  const closed = new Promise((res) => (resolveClosed = res));
  function teardown() {
    if (torn) return;
    torn = true;
    if (el.isConnected) el.remove();
    opts.onClose && opts.onClose(el.returnValue);
    resolveClosed(el.returnValue);
  }
  el.addEventListener("close", teardown);          // Esc / native closedby path

  const ctrl = {
    el, body, closed,
    show() {
      if (typeof el.showModal === "function") { try { el.showModal(); } catch { /* jsdom */ } }
      if (!el.open) el.open = true;                // fallback where modal isn't supported
      if (isDrawer) {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => (el.style.transform = "none"));
        else el.style.transform = "none";
      }
      return ctrl;
    },
    close(value) {
      if (value !== undefined) el.returnValue = value;
      const finish = () => {
        if (el.open) {
          if (typeof el.close === "function") { try { el.close(el.returnValue); } catch { /* jsdom */ } }
          if (el.open) { el.open = false; el.removeAttribute("open"); }   // env without close()
        }
        teardown();
      };
      if (isDrawer && el.isConnected && el.open) {  // animate out, then close + tear down
        el.style.transform = offscreen;
        let done = false;
        const fin = () => { if (done) return; done = true; el.removeEventListener("transitionend", fin); finish(); };
        el.addEventListener("transitionend", fin);
        setTimeout(fin, 300);                       // safety: fire even with no transition
      } else {
        finish();                                   // open → close+teardown; never-shown → teardown
      }
      return ctrl;
    },
  };
  return ctrl;
}

// drawer(opts) — a dialog that slides in from a side (default: right).
export const drawer = (opts = {}) => dialog({ ...opts, position: opts.position || "right" });

// ---- promise-based alert / confirm / prompt --------------------------------
// Drop-in-feeling replacements for window.alert/confirm/prompt, but non-blocking
// (return a Promise), styled, and accessible (role=alertdialog + aria-describedby,
// autofocus on the primary action). Esc / backdrop / close button = cancel.
let _hseq = 0;
function mkBtn(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = cls; b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
function message(text) {
  const p = document.createElement("p");
  p.className = "puredashboard-dialog__message"; p.id = "puredashboard-dialog__message-" + (++_hseq); p.textContent = text;
  return p;
}
function actions(...buttons) {
  const row = document.createElement("div");
  row.className = "puredashboard-dialog__actions"; row.append(...buttons);
  return row;
}

// alert(text, opts?) → Promise<void> (resolves when dismissed)
export function alert(text, opts = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const msg = message(text);
    const d = dialog({
      title: opts.title, ariaLabel: opts.title ? undefined : (opts.ariaLabel || "Alert"),
      className: "puredashboard-dialog--alert" + (opts.className ? " " + opts.className : ""),
      dismissable: opts.dismissable !== false, closeButton: !!opts.closeButton,
      content: (body) => {
        body.append(msg);
        const ok = mkBtn(opts.okText || "OK", opts.okClass || "puredashboard-dialog__button puredashboard-dialog__button--primary", () => d.close("ok"));
        ok.setAttribute("autofocus", "");
        body.append(actions(ok));
      },
      onClose: () => { if (!settled) { settled = true; resolve(); } },
    });
    d.el.setAttribute("role", "alertdialog");
    d.el.setAttribute("aria-describedby", msg.id);
    d.show();
  });
}

// confirm(text, opts?) → Promise<boolean> (true only if OK was chosen)
export function confirm(text, opts = {}) {
  return new Promise((resolve) => {
    let result = false, settled = false;
    const msg = message(text);
    const finish = (ok) => { result = ok; d.close(ok ? "ok" : "cancel"); };
    const d = dialog({
      title: opts.title, ariaLabel: opts.title ? undefined : (opts.ariaLabel || "Confirm"),
      className: "puredashboard-dialog--confirm" + (opts.className ? " " + opts.className : ""),
      dismissable: opts.dismissable !== false, closeButton: !!opts.closeButton,
      content: (body) => {
        body.append(msg);
        const cancel = mkBtn(opts.cancelText || "Cancel", opts.cancelClass || "puredashboard-dialog__button", () => finish(false));
        const ok = mkBtn(opts.okText || "OK", opts.okClass || ("puredashboard-dialog__button puredashboard-dialog__button--primary" + (opts.danger ? " puredashboard-dialog__button--danger" : "")), () => finish(true));
        ok.setAttribute("autofocus", "");
        body.append(actions(cancel, ok));
      },
      onClose: () => { if (!settled) { settled = true; resolve(result); } },  // Esc/backdrop → false
    });
    d.el.setAttribute("role", "alertdialog");
    d.el.setAttribute("aria-describedby", msg.id);
    d.show();
  });
}

// prompt(text, opts?) → Promise<string|null> (null if cancelled/dismissed)
export function prompt(text, opts = {}) {
  return new Promise((resolve) => {
    let result = null, settled = false, input;
    const msg = message(text);
    const finish = (ok) => { result = ok ? input.value : null; d.close(ok ? "ok" : "cancel"); };
    const d = dialog({
      title: opts.title, ariaLabel: opts.title ? undefined : (opts.ariaLabel || "Prompt"),
      className: "puredashboard-dialog--prompt" + (opts.className ? " " + opts.className : ""),
      dismissable: opts.dismissable !== false, closeButton: !!opts.closeButton,
      content: (body) => {
        body.append(msg);
        input = document.createElement("input");
        input.className = "puredashboard-dialog__input"; input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
        if (opts.inputType) input.type = opts.inputType;
        input.setAttribute("autofocus", "");
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } });
        body.append(input);
        const cancel = mkBtn(opts.cancelText || "Cancel", opts.cancelClass || "puredashboard-dialog__button", () => finish(false));
        const ok = mkBtn(opts.okText || "OK", opts.okClass || "puredashboard-dialog__button puredashboard-dialog__button--primary", () => finish(true));
        body.append(actions(cancel, ok));
      },
      onClose: () => { if (!settled) { settled = true; resolve(result); } },  // Esc/backdrop → null
    });
    d.el.setAttribute("aria-describedby", msg.id);
    d.show();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { try { input.select(); } catch { /* */ } });
  });
}
