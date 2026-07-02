import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-rate",
  title: "Form/Rate",
  stories: [
    { name: "Basic", render: () => el("puredashboard-rate", { value: 3 }) },
    { name: "Allow half", notes: "half-star increments", render: () =>
      el("puredashboard-rate", { value: 2.5, allowHalf: true }) },
    { name: "Custom count", render: () => el("puredashboard-rate", { value: 6, count: 10 }) },
    { name: "Disabled", render: () => el("puredashboard-rate", { value: 4, disabled: true }) },
    { name: "Read-only", notes: "display-only; input ignored", render: () =>
      el("puredashboard-rate", { value: 3.5, allowHalf: true, readonly: true }) },
  ],
};
