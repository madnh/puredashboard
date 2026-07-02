import { el, hstack } from "./_util.js";

// A tiny inline placeholder image (a solid teal square) as a data: URL, so the
// story is self-contained and needs no network.
const IMG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='64'%20height='64'%20fill='%230ea5a4'/%3E%3C/svg%3E";

export default {
  tag: "puredashboard-avatar",
  title: "Data display/Avatar",
  stories: [
    { name: "Image", render: () => el("puredashboard-avatar", { src: IMG, name: "Ada Lovelace" }) },
    { name: "Initials", render: () => hstack([
      el("puredashboard-avatar", { name: "Ada Lovelace" }),
      el("puredashboard-avatar", { name: "Grace Hopper" }),
      el("puredashboard-avatar", { name: "cher" }),
    ]) },
    { name: "Sizes", render: () => hstack([
      el("puredashboard-avatar", { name: "Ada Lovelace", size: "sm" }),
      el("puredashboard-avatar", { name: "Ada Lovelace", size: "md" }),
      el("puredashboard-avatar", { name: "Ada Lovelace", size: "lg" }),
    ]) },
    { name: "Square shape", render: () => hstack([
      el("puredashboard-avatar", { src: IMG, name: "Ada Lovelace", shape: "square" }),
      el("puredashboard-avatar", { name: "Grace Hopper", shape: "square" }),
    ]) },
    { name: "Placeholder", render: () => el("puredashboard-avatar", {}) },
  ],
};
