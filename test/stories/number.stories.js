import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-number",
  title: "Form/Number",
  stories: [
    { name: "Basic", render: () => el("puredashboard-number", { value: "3" }) },
    { name: "Min/max/step", notes: "0–10 in steps of 2", render: () =>
      el("puredashboard-number", { min: 0, max: 10, step: 2, value: "4" }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-number", { size: "sm", value: "1" }),
      el("puredashboard-number", { size: "md", value: "2" }),
      el("puredashboard-number", { size: "lg", value: "3" }),
    ]) },
    { name: "Disabled", render: () => el("puredashboard-number", { value: "8", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-number", { min: 1, max: 5, value: "9", error: "Must be between 1 and 5." }) },
  ],
};
