import { el, vstack, hstack } from "./_util.js";

export default {
  tag: "puredashboard-color",
  title: "Form/Color",
  stories: [
    { name: "Basic", render: () => el("puredashboard-color", { value: "#4f9cf9" }) },
    { name: "Show value", notes: "hex shown alongside the swatch", render: () =>
      el("puredashboard-color", { value: "#4f9cf9", showValue: true }) },
    { name: "Sizes", render: () => hstack([
      el("puredashboard-color", { size: "sm", value: "#22c55e" }),
      el("puredashboard-color", { size: "md", value: "#f59e0b" }),
      el("puredashboard-color", { size: "lg", value: "#ef4444" }),
    ]) },
    { name: "Disabled", render: () => el("puredashboard-color", { value: "#4f9cf9", disabled: true }) },
  ],
};
