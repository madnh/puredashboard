import { el } from "./_util.js";

export default {
  tag: "puredashboard-breadcrumb",
  title: "Navigation/Breadcrumb",
  stories: [
    { name: "Basic", notes: "last crumb is the current page", render: () =>
      el("puredashboard-breadcrumb", { items: [
        { label: "Home", href: "#/" },
        { label: "Services", href: "#/services" },
        { label: "api-gateway" },
      ] }) },
    { name: "Two levels", render: () =>
      el("puredashboard-breadcrumb", { items: [
        { label: "Home", href: "#/" },
        { label: "Settings" },
      ] }) },
  ],
};
