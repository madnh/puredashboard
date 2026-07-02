import { el, vstack } from "./_util.js";

const a = (p) => el("puredashboard-alert", p);

export default {
  tag: "puredashboard-alert",
  title: "Feedback/Alert",
  stories: [
    { name: "Types", render: () => vstack([
      a({ type: "success", title: "Deployed", message: "api-gateway is live." }),
      a({ type: "info", message: "A new version is available." }),
      a({ type: "warning", message: "Approaching your monthly quota." }),
      a({ type: "error", title: "Error", message: "billing-cron failed its health check." }),
    ]) },
    { name: "Closable", render: () => a({ type: "warning", title: "Heads up", message: "You can dismiss this.", closable: true }) },
  ],
};
