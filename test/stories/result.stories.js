import { el, t } from "./_util.js";

const btn = (props, label) => el("puredashboard-button", props, [t(label)]);

export default {
  tag: "puredashboard-result",
  title: "Feedback/Result",
  stories: [
    { name: "Success", render: () => el("puredashboard-result", {
      status: "success",
      title: "Payment confirmed",
      subtitle: "Order #10241 is on its way.",
    }, [btn({ variant: "primary" }, "Go to dashboard")]) },
    { name: "Error", render: () => el("puredashboard-result", {
      status: "error",
      title: "Deployment failed",
      subtitle: "billing-cron did not pass its health check.",
    }, [btn({}, "Retry")]) },
    { name: "404", render: () => el("puredashboard-result", {
      status: "404",
      title: "Page not found",
      subtitle: "The page you visited does not exist.",
    }, [btn({ variant: "primary" }, "Back home")]) },
  ],
};
