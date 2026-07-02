import { el } from "./_util.js";

const SAMPLE = [
  "# Release notes",
  "",
  "This build is **stable** and ready to ship.",
  "",
  "- Faster cold start",
  "- Fixed `billing-cron` health check",
  "- New docs at [the guide](https://example.com/guide)",
  "",
  "Run `make -C test` to verify.",
].join("\n");

export default {
  tag: "puredashboard-markdown",
  title: "Data display/Markdown",
  stories: [
    { name: "Basic", render: () => el("puredashboard-markdown", { value: SAMPLE }) },
  ],
};
