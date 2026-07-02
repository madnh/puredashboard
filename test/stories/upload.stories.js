import { el } from "./_util.js";

export default {
  tag: "puredashboard-upload",
  title: "Data display/Upload",
  stories: [
    { name: "Basic", render: () => el("puredashboard-upload", {
      multiple: true,
      accept: "image/*",
      labels: {
        browse: "Drop images here, or click to choose",
        hint: "PNG or JPG, up to 5 files",
      },
    }) },
  ],
};
