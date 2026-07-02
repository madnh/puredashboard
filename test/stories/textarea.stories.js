import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-textarea",
  title: "Form/Textarea",
  stories: [
    { name: "Basic", render: () => el("puredashboard-textarea", { placeholder: "Notes…" }) },
    { name: "Rows", notes: "rows=6", render: () =>
      el("puredashboard-textarea", { rows: 6, placeholder: "A taller field…" }) },
    { name: "Auto-grow", notes: "grows to fit content as you type", render: () =>
      el("puredashboard-textarea", { autoGrow: true, value: "Type more lines and the field grows.", placeholder: "Type…" }) },
    { name: "Disabled", render: () =>
      el("puredashboard-textarea", { value: "Read only content.", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-textarea", { required: true, error: "This field is required." }) },
  ],
};
