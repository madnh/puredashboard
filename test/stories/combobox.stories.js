import { el, vstack } from "./_util.js";

const regions = [
  { value: "na", label: "North America" },
  { value: "sa", label: "South America" },
  { value: "eu", label: "Europe" },
  { value: "af", label: "Africa" },
  { value: "as", label: "Asia" },
  { value: "oc", label: "Oceania" },
];

export default {
  tag: "puredashboard-combobox",
  title: "Form/Combobox",
  stories: [
    { name: "Basic", notes: "type to filter the options", render: () =>
      el("puredashboard-combobox", { options: regions, value: "eu" }) },
    { name: "Placeholder", render: () =>
      el("puredashboard-combobox", { options: regions, placeholder: "Pick a region…" }) },
    { name: "Allow custom", notes: "typed values with no match are accepted as free text", render: () =>
      el("puredashboard-combobox", { options: regions, allowCustom: true, placeholder: "Region or free text…" }) },
    { name: "Disabled", render: () =>
      el("puredashboard-combobox", { options: regions, value: "as", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-combobox", { options: regions, required: true, error: "Please choose a region." }) },
  ],
};
