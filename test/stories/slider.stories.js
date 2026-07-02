import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-slider",
  title: "Form/Slider",
  stories: [
    { name: "Basic", render: () => el("puredashboard-slider", { value: "40" }) },
    { name: "Show value", render: () => el("puredashboard-slider", { value: "65", showValue: true }) },
    { name: "Custom min/max/step", notes: "0–10 in steps of 2", render: () =>
      el("puredashboard-slider", { min: 0, max: 10, step: 2, value: "6", showValue: true }) },
    { name: "Disabled", render: () => vstack([
      el("puredashboard-slider", { value: "30", disabled: true }),
      el("puredashboard-slider", { value: "80", disabled: true, showValue: true }),
    ]) },
  ],
};
