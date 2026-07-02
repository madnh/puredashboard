import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-date",
  title: "Form/Date",
  stories: [
    { name: "Basic", render: () => el("puredashboard-date", { value: "2026-07-02" }) },
    { name: "Min / max", notes: "constrained to 2026", render: () =>
      el("puredashboard-date", { value: "2026-07-02", min: "2026-01-01", max: "2026-12-31" }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-date", { size: "sm", value: "2026-07-02" }),
      el("puredashboard-date", { size: "md", value: "2026-07-02" }),
      el("puredashboard-date", { size: "lg", value: "2026-07-02" }),
    ]) },
    { name: "Disabled", render: () => el("puredashboard-date", { value: "2026-07-02", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-date", { required: true, error: "A date is required." }) },
  ],
};
