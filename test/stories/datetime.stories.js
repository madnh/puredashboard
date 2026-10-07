import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-datetime",
  title: "Form/Datetime",
  stories: [
    { name: "Basic", notes: "local date and time, no time zone (yyyy-mm-ddTHH:mm)", render: () =>
      el("puredashboard-datetime", { value: "2026-10-07T09:30" }) },
    { name: "Min / max", notes: "office hours this week; out-of-range values are invalid", render: () =>
      el("puredashboard-datetime", { value: "2026-10-07T09:30", min: "2026-10-05T08:00", max: "2026-10-09T18:00" }) },
    { name: "Step (seconds)", notes: "step=1 admits a seconds segment", render: () =>
      el("puredashboard-datetime", { value: "2026-10-07T09:30:15", step: 1 }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-datetime", { size: "sm", value: "2026-10-07T09:30" }),
      el("puredashboard-datetime", { size: "md", value: "2026-10-07T09:30" }),
      el("puredashboard-datetime", { size: "lg", value: "2026-10-07T09:30" }),
    ]) },
    { name: "Error", render: () => el("puredashboard-datetime", { required: true, error: "Pick a start time." }) },
    { name: "Disabled", render: () => el("puredashboard-datetime", { value: "2026-10-07T09:30", disabled: true }) },
  ],
};
