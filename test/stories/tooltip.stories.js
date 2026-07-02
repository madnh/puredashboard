import { el, hstack } from "./_util.js";

export default {
  tag: "puredashboard-tooltip",
  title: "Overlay/Tooltip",
  stories: [
    { name: "Top (default)", notes: "hover/focus to show", render: () =>
      el("puredashboard-tooltip", { text: "Save changes" }, el("button", { type: "button" }, "Save")) },
    { name: "Bottom", notes: "hover/focus to show", render: () =>
      el("puredashboard-tooltip", { text: "Delete this row", placement: "bottom" },
        el("button", { type: "button" }, "Delete")) },
    { name: "Placements", notes: "hover/focus to show", render: () => hstack([
      el("puredashboard-tooltip", { text: "Top", placement: "top" }, el("button", { type: "button" }, "Top")),
      el("puredashboard-tooltip", { text: "Bottom", placement: "bottom" }, el("button", { type: "button" }, "Bottom")),
    ]) },
  ],
};
