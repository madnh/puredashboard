// menu.js — anchored dropdown / action menu. Zero-dep, no build, CSP-safe. Same
// imperative family as dialog.js / toast.js. Theme via the .menu-* classes.
//
// Uses popover="auto" so the menu lives in the TOP LAYER (above page content,
// escapes overflow:hidden ancestors) and gets light-dismiss (click-outside) + Esc
// for free. Falls back to a fixed, high-z-index element where the Popover API is
// unavailable. Navigation items are real <a href> (open-in-new-tab etc. keep
// working); action items are <button>s.
//
//   menu(anchorEl, [
//     { label: "Open",   href: "#/nodes/web" },          // a real link
//     { label: "Rename", icon: "pencil", value: "rename" },
//     { separator: true },
//     { label: "Delete", value: "delete", danger: true },
//   ]).then((picked) => { /* picked = "rename" | "delete" | null (dismissed) */ });
//
// item: { label, value?, href?, icon?, danger?, disabled?, onSelect?, separator? }
//   icon: optional inline SVG markup string or a DOM node — kept dependency-free so
//   this module stands alone.
// opts: { placement: "bottom-start"|"bottom-end" (default bottom-start), className }

/**
 * Open an anchored dropdown / action menu in the top layer; resolve with the chosen
 * value. Imperative (same family as dialog.js / toast.js) — not a custom element.
 *
 * @function menu
 * @param {HTMLElement} anchor - Element to position under (usually the trigger button).
 * @param {Array<Object>} items - Each `{ label, value?, href?, icon?, danger?, disabled?, onSelect?, separator? }`. `icon` = SVG markup string or DOM node; `href` makes a real `<a>` link.
 * @param {Object} [opts] - `{ placement?: "bottom-start"|"bottom-end", className?: string }`.
 * @returns {Promise<*>} The picked item's `value`, or `null` if dismissed (Esc / click-outside).
 *
 * @example
 * const picked = await menu(btn, [
 *   { label: "Rename", value: "rename" },
 *   { separator: true },
 *   { label: "Delete", value: "delete", danger: true },
 * ]);   // → "rename" | "delete" | null
 */
export function menu(anchor, items, opts = {}) {
  const m = document.createElement("div");
  m.className = "puredashboard-menu" + (opts.className ? " " + opts.className : "");
  m.setAttribute("role", "menu");
  Object.assign(m.style, { position: "fixed", margin: "0", padding: "4px", inset: "auto" });
  const usePopover = typeof m.showPopover === "function";
  if (usePopover) m.setAttribute("popover", "auto");
  else m.style.zIndex = "9998";

  let settle;
  const done = new Promise((res) => (settle = res));
  let closed = false;
  function close(value) {
    if (closed) return; closed = true;
    try { if (usePopover && m.matches(":popover-open")) m.hidePopover(); } catch { /* */ }
    m.remove();
    document.removeEventListener("keydown", onKey, true);
    if (!usePopover) document.removeEventListener("pointerdown", onOutside, true);
    settle(value ?? null);
  }

  items.forEach((it) => {
    if (it.separator) { const hr = document.createElement("div"); hr.className = "puredashboard-menu__separator"; hr.setAttribute("role", "separator"); m.appendChild(hr); return; }
    const nav = !!it.href;
    const el = document.createElement(nav ? "a" : "button");
    el.className = "puredashboard-menu__item js-puredashboard-menu__item" + (it.danger ? " puredashboard-menu__item--danger" : "");
    el.setAttribute("role", "menuitem");
    if (nav) { el.href = it.href; if (it.target) el.target = it.target; }
    else { el.type = "button"; }
    if (it.disabled) { el.setAttribute("aria-disabled", "true"); el.tabIndex = -1; }
    if (it.icon) {
      const s = document.createElement("span"); s.className = "puredashboard-menu__icon";
      if (typeof it.icon === "string") s.innerHTML = it.icon;          // trusted SVG markup
      else if (it.icon && it.icon.nodeType) s.appendChild(it.icon);
      el.appendChild(s);
    }
    const lbl = document.createElement("span"); lbl.className = "puredashboard-menu__label"; lbl.textContent = it.label; el.appendChild(lbl);
    el.addEventListener("click", (e) => {
      if (it.disabled) { e.preventDefault(); return; }
      if (it.onSelect) it.onSelect(it);
      if (nav) { close(it.value ?? null); return; }   // let the link navigate; just close
      e.preventDefault();
      close(it.value ?? null);
    });
    m.appendChild(el);
  });

  document.body.appendChild(m);
  position(m, anchor, opts.placement || "bottom-start");
  try { if (usePopover) m.showPopover(); } catch { /* */ }
  if (!usePopover) document.addEventListener("pointerdown", onOutside, true);
  document.addEventListener("keydown", onKey, true);

  // focus the first enabled item for keyboard users
  const first = m.querySelector(".js-puredashboard-menu__item:not([aria-disabled])");
  if (first) first.focus();

  function onOutside(e) { if (!m.contains(e.target) && e.target !== anchor) close(null); }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(null); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const its = [...m.querySelectorAll(".js-puredashboard-menu__item:not([aria-disabled])")];
    if (!its.length) return;
    const cur = its.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (cur + 1) % its.length : (cur - 1 + its.length) % its.length;
    its[next].focus();
  }

  return done;
}

// position pins the menu under (or above, if it would overflow) the anchor, aligned
// to its start or end edge, clamped to the viewport.
function position(m, anchor, placement) {
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth || 180, mh = m.offsetHeight || 200;
  const gap = 4;
  let top = r.bottom + gap;
  if (top + mh > window.innerHeight && r.top - gap - mh > 0) top = r.top - gap - mh; // flip up
  let left = placement === "bottom-end" ? r.right - mw : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
  m.style.top = top + "px";
  m.style.left = left + "px";
  m.style.minWidth = Math.max(r.width, 160) + "px";
}
