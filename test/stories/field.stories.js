import { el, vstack } from "./_util.js";

// <puredashboard-field> wraps ONE control the author puts inside: it adds the visible label,
// hint and error around it and wires their ids into the control's inner native field.
const field = (props, control) => el("puredashboard-field", props, [control]);

export default {
  tag: "puredashboard-field",
  title: "Form/Field",
  stories: [
    { name: "Label + hint", notes: "click the label: focus moves into the custom control", render: () =>
      field({ label: "Email", hint: "We never share it." },
        el("puredashboard-input", { name: "email", type: "email", placeholder: "you@example.com" })) },
    { name: "Error", notes: "the error is an alert; the inner field is aria-invalid", render: () =>
      field({ label: "Region", error: "Please choose a region." },
        el("puredashboard-select", { options: ["North America", "Europe", "Asia"], placeholder: "Pick one…" })) },
    { name: "Any control", notes: "library controls and plain native inputs alike", render: () => vstack([
      field({ label: "Starts at", hint: "Local time" }, el("puredashboard-datetime", { value: "2026-10-07T09:30" })),
      field({ label: "Replicas" }, el("puredashboard-number", { value: 3, min: 1, max: 9 })),
      field({ label: "Notes", hint: "Plain <textarea>" }, el("textarea", { rows: 2 })),
    ]) },
  ],
};
