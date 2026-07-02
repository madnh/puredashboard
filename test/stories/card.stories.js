import { el, t } from "./_util.js";

export default {
  tag: "puredashboard-card",
  title: "Data display/Card",
  stories: [
    { name: "Basic", render: () => el("puredashboard-card", { title: "Revenue" }, [
      el("p", {}, [t("Monthly recurring revenue is up 12% over the last 30 days.")]),
    ]) },
    { name: "With footer + extra action", render: () => el("puredashboard-card", { title: "api-gateway" }, [
      el("puredashboard-button", { variant: "text", "data-card-extra": "" }, [t("Export")]),
      el("p", {}, [t("3 instances healthy, 0 degraded.")]),
      el("div", { "data-card-footer": "" }, [t("Updated just now")]),
    ]) },
    { name: "Flat (no border)", render: () => el("puredashboard-card", { title: "Notes", bordered: false }, [
      el("p", {}, [t("A borderless surface for embedding inside another panel.")]),
    ]) },
  ],
};
