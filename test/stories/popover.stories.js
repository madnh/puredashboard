import { el } from "./_util.js";

export default {
  tag: "puredashboard-popover",
  title: "Overlay/Popover",
  stories: [
    { name: "Basic", notes: "click to open", render: () =>
      el("puredashboard-popover", { placement: "bottom-start" }, [
        el("button", { type: "button", "data-popover-trigger": "" }, "Options"),
        el("div", { "data-popover-content": "" }, "A floating panel in the top layer."),
      ]) },
    { name: "Placement bottom-end", notes: "click to open", render: () =>
      el("puredashboard-popover", { placement: "bottom-end" }, [
        el("button", { type: "button", "data-popover-trigger": "" }, "Menu"),
        el("div", { "data-popover-content": "" }, "Aligned to the trigger's end edge."),
      ]) },
    { name: "Rich content", notes: "click to open", render: () =>
      el("puredashboard-popover", { placement: "right" }, [
        el("button", { type: "button", "data-popover-trigger": "" }, "Details"),
        el("div", { "data-popover-content": "" }, [
          el("strong", null, "web-01"),
          el("div", null, "Region: us-east-1"),
        ]),
      ]) },
  ],
};
