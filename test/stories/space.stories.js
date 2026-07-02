import { el, t } from "./_util.js";

const b = (label, props) => el("puredashboard-button", props, [t(label)]);
const tag = (label) => el("span", {
  style: "padding:2px 8px;border:1px solid var(--border,#ccc);border-radius:4px;font-size:12px",
}, [t(label)]);

export default {
  tag: "puredashboard-space",
  title: "Layout/Space",
  stories: [
    { name: "Horizontal", render: () => el("puredashboard-space", { direction: "horizontal" }, [
      b("Save", { variant: "primary" }), b("Cancel"), b("More"),
    ]) },
    { name: "Vertical", render: () => el("puredashboard-space", { direction: "vertical" }, [
      b("First", { variant: "primary" }), b("Second"), b("Third"),
    ]) },
    { name: "Sizes", render: () => el("puredashboard-space", { direction: "vertical", size: "lg" }, [
      el("puredashboard-space", { size: "sm" }, [tag("sm"), tag("sm"), tag("sm")]),
      el("puredashboard-space", { size: "md" }, [tag("md"), tag("md"), tag("md")]),
      el("puredashboard-space", { size: "lg" }, [tag("lg"), tag("lg"), tag("lg")]),
    ]) },
    { name: "Wrapping tags", render: () => el("puredashboard-space", {
      direction: "horizontal", size: "sm",
      style: "max-width:220px",
    }, ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].map(tag)) },
  ],
};
