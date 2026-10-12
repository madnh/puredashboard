import { el } from "./_util.js";
import { dialog, drawer, confirm, prompt, alert } from "../../src/dialog.js";

// dialog/drawer are IMPERATIVE overlays (functions, not custom elements), so each
// story renders a trigger button you click to open the overlay in the top layer.

const trigger = (label, onClick) => {
  const b = el("button", { className: "puredashboard-dialog__button puredashboard-dialog__button--primary", textContent: label });
  b.addEventListener("click", onClick);
  return b;
};

// a Cancel + primary action row wired to `close(value)`
const footerActions = (close, okLabel) => (foot) => {
  const row = el("div", { className: "puredashboard-dialog__actions" });
  const cancel = el("button", { className: "puredashboard-dialog__button", textContent: "Cancel" });
  cancel.addEventListener("click", () => close("cancel"));
  const ok = el("button", { className: "puredashboard-dialog__button puredashboard-dialog__button--primary", textContent: okLabel || "OK" });
  ok.addEventListener("click", () => close("ok"));
  row.append(cancel, ok);
  foot.append(row);
};

// a long body so the scrollable body + pinned footer are visible
const longBody = (n) => (body) => {
  for (let i = 1; i <= n; i++) {
    const p = document.createElement("p");
    p.textContent = "Item " + i + " — a long enough list to make the body scroll.";
    body.append(p);
  }
};

const openDrawer = (position, okLabel) => {
  const d = drawer({ position, title: "Drawer — " + position, content: longBody(30), footer: footerActions((v) => d.close(v), okLabel) });
  d.show();
};

export default {
  tag: "dialog",
  title: "Overlay/Dialog & drawer",
  stories: [
    { name: "Modal dialog", notes: "header + scrollable body + pinned footer", render: () =>
      trigger("Open dialog", () => {
        const d = dialog({ title: "Edit service", content: longBody(20), footer: footerActions((v) => d.close(v), "Save") });
        d.show();
      }) },
    { name: "Sizes", notes: 'size: "sm" 400 · "md" 560 (default) · "lg" 800 · "xl" 1140 · "full" · "auto" (fit the content) — a fixed width capped to the viewport; pick it from the content. The second row sizes a drawer the same way', render: () => {
      const sizes = ["sm", "md", "lg", "xl", "full", "auto"];
      const what = { sm: "a message or one field", md: "a short form (the default)", lg: "a two-column form or a table", xl: "a wide table or side-by-side panes", full: "an editor or a large preview", auto: "shrink to the content" };
      const open = (size) => {
        const d = dialog({ title: `size: "${size}"`, size, content: (b) => { b.append(el("p", { textContent: "For " + what[size] + "." })); longBody(3)(b); }, actions: [{ label: "Close", value: "close", variant: "primary" }] });
        d.show();
      };
      const row1 = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, sizes.map((z) => trigger(z, () => open(z))));
      const row2 = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px" }, ["sm", "md", "lg", "xl"].map((z) => {
        const b = el("button", { className: "puredashboard-dialog__button", textContent: "drawer " + z });
        b.addEventListener("click", () => { const d = drawer({ title: `drawer size: "${z}"`, size: z, content: longBody(12), actions: [{ label: "Close", value: "close" }] }); d.show(); });
        return b;
      }));
      return el("div", {}, [row1, row2]);
    } },
    { name: "Drawer — right", notes: "slides in from the edge; body scrolls, footer stays pinned", render: () =>
      trigger("Open right drawer", () => openDrawer("right", "Apply")) },
    { name: "Drawer — other edges", notes: "left / top / bottom", render: () => {
      const wrap = el("puredashboard-space", { size: "sm" });
      wrap.append(
        trigger("Left", () => openDrawer("left", "Apply")),
        trigger("Top", () => openDrawer("top", "Apply")),
        trigger("Bottom", () => openDrawer("bottom", "Apply")),
      );
      return wrap;
    } },
    { name: "confirm / prompt / alert", notes: "promise-based, non-blocking helpers", render: () => {
      const wrap = el("puredashboard-space", { size: "sm" });
      wrap.append(
        trigger("confirm()", () => confirm("Delete this service?", { title: "Confirm", danger: true })),
        trigger("prompt()", () => prompt("New name?", { title: "Rename", defaultValue: "web-01" })),
        trigger("alert()", () => alert("Saved.", { title: "Done" })),
      );
      return wrap;
    } },
    { name: "Footer actions", notes: "actions: library-rendered <puredashboard-button>s; a click closes with that value, or runs onclick", render: () =>
      trigger("Open with actions", () => {
        dialog({ title: "Delete service?", content: "billing-cron will stop and its history is removed.", actions: [
          { label: "Cancel", value: "cancel" },
          { label: "Delete", value: "ok", variant: "primary", danger: true },
        ] }).show();
      }) },
  ],
};
