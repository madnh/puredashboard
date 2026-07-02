import { el } from "./_util.js";

// Card-like wrapper so a lone figure reads as a dashboard tile.
const card = (kid) => el("div", {
  style: "border:1px solid var(--border,#ddd);border-radius:8px;padding:16px;min-width:160px",
}, [kid]);

const stat = (props) => card(el("puredashboard-statistic", props));

export default {
  tag: "puredashboard-statistic",
  title: "Data display/Statistic",
  stories: [
    { name: "Basic", render: () => stat({ title: "Active users", value: 112893 }) },
    { name: "Prefix / suffix / precision", render: () => el("puredashboard-space", { direction: "horizontal", size: "md" }, [
      stat({ title: "Revenue", value: 1234567.5, prefix: "$", precision: 2 }),
      stat({ title: "Conversion", value: 63.4, suffix: "%", precision: 1 }),
    ]) },
    { name: "Trend up", render: () => stat({ title: "Sales", value: 8846, suffix: "%", trend: "up" }) },
    { name: "Trend down", render: () => stat({ title: "Bounce rate", value: 11.28, suffix: "%", precision: 2, trend: "down" }) },
    { name: "Loading", render: () => stat({ title: "Pending", value: 0, loading: true }) },
  ],
};
