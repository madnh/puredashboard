import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-checkbox",
  title: "Form/Checkbox",
  stories: [
    { name: "Default", render: () => el("puredashboard-checkbox", { label: "Enable auto-scaling" }) },
    { name: "Checked", render: () => el("puredashboard-checkbox", { label: "Ship access logs to S3", checked: true }) },
    { name: "Indeterminate", notes: "tri-state (aria-checked=mixed)", render: () =>
      el("puredashboard-checkbox", { label: "Select all regions", indeterminate: true }) },
    { name: "States", render: () => vstack([
      el("puredashboard-checkbox", { label: "Unchecked" }),
      el("puredashboard-checkbox", { label: "Checked", checked: true }),
      el("puredashboard-checkbox", { label: "Disabled", disabled: true }),
      el("puredashboard-checkbox", { label: "Disabled + checked", disabled: true, checked: true }),
    ]) },
    { name: "Required + error", render: () =>
      el("puredashboard-checkbox", { label: "I accept the terms of service", required: true, error: "You must accept to continue." }) },
  ],
};
