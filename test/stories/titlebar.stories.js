import { el, t } from "./_util.js";

// Wrap each bar in a bordered "window" box so the titlebar reads as the top of a
// frameless desktop window (a faux body sits below it).
const windowBox = (bar, bodyText) => el("div", {
  style: "width:100%;max-width:520px;border:1px solid var(--border,#d0d5dd);border-radius:10px;overflow:hidden;box-shadow:var(--shadow-2,0 4px 12px rgba(0,0,0,.12))",
}, [
  bar,
  el("div", {
    style: "height:120px;padding:16px;background:var(--bg,#f4f6fa);color:var(--muted,#5b6472);font-size:var(--font-size-md,13px)",
  }, [t(bodyText)]),
]);

// A trailing toolbar action button (author child → trailing region).
const action = (label) => el("button", {
  type: "button",
  style: "height:26px;padding:0 10px;border:1px solid var(--border,#d0d5dd);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:var(--font-size-sm,12px);cursor:pointer",
}, [t(label)]);

export default {
  tag: "puredashboard-titlebar",
  title: "Layout/Titlebar",
  stories: [
    {
      name: "macOS style",
      notes: "platform=mac: title is centered, a left inset is reserved for the OS traffic lights, and no custom window buttons are drawn. Trailing children remain a toolbar.",
      render: () => windowBox(
        el("puredashboard-titlebar", { platform: "mac", title: "Photos" }, [
          action("Share"),
          action("Edit"),
        ]),
        "macOS window body. The traffic-light inset keeps the centered title clear of the OS buttons.",
      ),
    },
    {
      name: "Windows style",
      notes: "platform=windows with controls: left-aligned title + minimize / maximize / close buttons on the right. The buttons emit bubbling minimize / maximizetoggle / close events for the host to wire to its window API.",
      render: () => windowBox(
        el("puredashboard-titlebar", { platform: "windows", controls: true }, [
          el("span", { "data-titlebar-leading": true, style: "font-weight:600;padding-inline-start:4px" }, [t("Acme")]),
          el("span", { "data-titlebar-center": true }, [t("Untitled — Acme")]),
        ]),
        "Windows window body. Try the minimize / maximize / close buttons (they dispatch CustomEvents).",
      ),
    },
    {
      name: "Maximized state",
      notes: "the maximized attribute swaps the maximize glyph for a restore glyph (and its aria-label). Reflect the real window state back onto the component after a maximizetoggle.",
      render: () => windowBox(
        el("puredashboard-titlebar", { platform: "windows", controls: true, maximized: true, title: "Report.xlsx" }, [
          action("Save"),
        ]),
        "The center button now shows a RESTORE glyph because the window is maximized.",
      ),
    },
  ],
};
