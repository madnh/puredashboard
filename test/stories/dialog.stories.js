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
  ],
};
