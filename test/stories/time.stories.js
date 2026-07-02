import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-time",
  title: "Form/Time",
  stories: [
    { name: "Basic", render: () => el("puredashboard-time", { value: "09:30" }) },
    { name: "Step (seconds)", notes: "step=1 admits a seconds segment", render: () =>
      el("puredashboard-time", { value: "09:30:15", step: 1 }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-time", { size: "sm", value: "09:30" }),
      el("puredashboard-time", { size: "md", value: "09:30" }),
      el("puredashboard-time", { size: "lg", value: "09:30" }),
    ]) },
    { name: "Disabled", render: () => el("puredashboard-time", { value: "09:30", disabled: true }) },
  ],
};
