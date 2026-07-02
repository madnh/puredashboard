import { el, t, hstack } from "./_util.js";

export default {
  tag: "puredashboard-badge",
  title: "Data display/Badge",
  stories: [
    { name: "Count on a button", render: () => el("puredashboard-badge", { count: 5 }, [
      el("puredashboard-button", {}, [t("Inbox")]),
    ]) },
    { name: "Overflow (max)", render: () => el("puredashboard-badge", { count: 128, max: 99 }, [
      el("puredashboard-button", {}, [t("Alerts")]),
    ]) },
    { name: "Dot", render: () => el("puredashboard-badge", { dot: true }, [
      el("puredashboard-button", { variant: "text" }, [t("Notifications")]),
    ]) },
    { name: "Standalone", render: () => hstack([
      el("puredashboard-badge", { count: 3, standalone: true }),
      el("puredashboard-badge", { count: 250, max: 99, standalone: true }),
      el("puredashboard-badge", { dot: true, standalone: true }),
    ]) },
    { name: "Colors", render: () => hstack([
      el("puredashboard-badge", { count: 5, standalone: true }),
      el("puredashboard-badge", { count: 5, color: "accent", standalone: true }),
      el("puredashboard-badge", { count: 5, color: "success", standalone: true }),
      el("puredashboard-badge", { count: 5, color: "warning", standalone: true }),
      el("puredashboard-badge", { count: 5, color: "neutral", standalone: true }),
    ]) },
  ],
};
