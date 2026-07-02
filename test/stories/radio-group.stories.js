import { el } from "./_util.js";

const plans = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

export default {
  tag: "puredashboard-radio-group",
  title: "Form/Radio group",
  stories: [
    { name: "Basic", notes: "3 options, one selected", render: () =>
      el("puredashboard-radio-group", { options: plans, value: "pro", "aria-label": "Plan" }) },
    { name: "With a disabled option", render: () =>
      el("puredashboard-radio-group", { value: "us-east", "aria-label": "Region", options: [
        { value: "us-east", label: "US East (N. Virginia)" },
        { value: "eu-west", label: "EU West (Ireland)" },
        { value: "ap-south", label: "AP South (Mumbai) — coming soon", disabled: true },
      ] }) },
    { name: "Required + error", render: () =>
      el("puredashboard-radio-group", { options: plans, required: true, "aria-label": "Plan", error: "Please choose a plan." }) },
    { name: "Disabled group", render: () =>
      el("puredashboard-radio-group", { options: plans, value: "starter", disabled: true, "aria-label": "Plan" }) },
  ],
};
