import { el } from "./_util.js";

export default {
  tag: "puredashboard-timeline",
  title: "Data display/Timeline",
  stories: [
    { name: "Basic (mode=right)", notes: "dots left, content right", render: () =>
      el("puredashboard-timeline", { mode: "right", items: [
        { label: "09:24", content: "Deployed v1.4.0", color: "success" },
        { label: "09:31", content: "Autoscaled to 8 nodes", color: "accent" },
        { label: "09:47", content: "billing-cron failed health check", color: "error" },
        { label: "10:02", content: "Keys rotated", color: "muted" },
      ] }) },
    { name: "Pending", render: () =>
      el("puredashboard-timeline", { mode: "right", items: [
        { label: "Queued", content: "Build queued", color: "muted" },
        { label: "Running", content: "Tests running", color: "accent" },
      ], pending: "Deploying…" }) },
    { name: "Alternate", render: () =>
      el("puredashboard-timeline", { mode: "alternate", items: [
        { content: "Created", color: "success" },
        { content: "Updated", color: "accent" },
        { content: "Archived", color: "muted" },
      ] }) },
  ],
};
