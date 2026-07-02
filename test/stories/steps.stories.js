import { el } from "./_util.js";

const steps = [
  { label: "Account", description: "Your details" },
  { label: "Billing", description: "Payment method" },
  { label: "Done" },
];

export default {
  tag: "puredashboard-steps",
  title: "Navigation/Steps",
  stories: [
    { name: "Basic", notes: "current is 0-based (step 2 of 3 active)", render: () =>
      el("puredashboard-steps", { current: 1, steps }) },
    { name: "Vertical", render: () =>
      el("puredashboard-steps", { current: 1, vertical: true, steps }) },
    { name: "Clickable", notes: "each step is a button emitting stepchange", render: () =>
      el("puredashboard-steps", { current: 1, clickable: true, steps }) },
  ],
};
