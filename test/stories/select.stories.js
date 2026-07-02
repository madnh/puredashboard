import { el, vstack } from "./_util.js";

const regions = [
  { value: "us-east", label: "US East (N. Virginia)" },
  { value: "eu-west", label: "EU West (Ireland)" },
  { value: "ap-south", label: "AP South (Mumbai)" },
];

export default {
  tag: "puredashboard-select",
  title: "Form/Select",
  stories: [
    { name: "Basic", render: () => el("puredashboard-select", { options: regions, value: "eu-west" }) },
    { name: "Placeholder", render: () =>
      el("puredashboard-select", { options: regions, placeholder: "Choose a region" }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-select", { size: "sm", options: regions, value: "us-east" }),
      el("puredashboard-select", { size: "md", options: regions, value: "us-east" }),
      el("puredashboard-select", { size: "lg", options: regions, value: "us-east" }),
    ]) },
    { name: "Disabled", render: () =>
      el("puredashboard-select", { options: regions, value: "ap-south", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-select", { options: regions, placeholder: "Choose a region", required: true, error: "A region is required." }) },
  ],
};
