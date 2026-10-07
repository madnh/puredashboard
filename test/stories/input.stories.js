import { el, vstack } from "./_util.js";

export default {
  tag: "puredashboard-input",
  title: "Form/Input",
  stories: [
    { name: "Basic", render: () => el("puredashboard-input", { type: "email", placeholder: "you@example.com" }) },
    { name: "Sizes", render: () => vstack([
      el("puredashboard-input", { size: "sm", placeholder: "small" }),
      el("puredashboard-input", { size: "md", placeholder: "medium" }),
      el("puredashboard-input", { size: "lg", placeholder: "large" }),
    ]) },
    { name: "Invalid", render: () => el("puredashboard-input", { value: "not-an-email", error: "That email looks invalid." }) },
    { name: "Disabled", render: () => el("puredashboard-input", { value: "read only", disabled: true }) },
    { name: "Native attributes", notes: "list / maxlength / inputmode on the host reach the inner <input>: here a datalist of suggestions", render: () => {
      const id = "pd-story-regions";
      const dl = el("datalist", { id }, ["us-east-1", "eu-west-1", "ap-south-1"].map((v) => el("option", { value: v })));
      const i = el("puredashboard-input", { placeholder: "Region (suggestions)" });
      i.setAttribute("list", id); i.setAttribute("maxlength", "16");
      return el("div", {}, [dl, i]);
    } },
  ],
};
