import { el } from "./_util.js";

export default {
  tag: "puredashboard-collapse",
  title: "Data display/Collapse",
  stories: [
    { name: "Accordion", notes: "one open at a time; opening one closes the rest", render: () =>
      el("puredashboard-collapse", { value: "billing", items: [
        { key: "billing", header: "Billing", content: "Manage your plan and invoices." },
        { key: "security", header: "Security", content: "Two-factor and active sessions." },
        { key: "team", header: "Team", content: "Invite members and set roles." },
      ] }) },
    { name: "Multiple open", notes: "items open/close independently", render: () =>
      el("puredashboard-collapse", { multiple: true, value: ["a", "c"], items: [
        { key: "a", header: "Overview", content: "A summary of this section." },
        { key: "b", header: "Details", content: "The finer print lives here." },
        { key: "c", header: "Advanced", content: "Rarely-touched knobs." },
      ] }) },
    { name: "With disabled item", render: () =>
      el("puredashboard-collapse", { value: "one", items: [
        { key: "one", header: "Enabled", content: "This one toggles normally." },
        { key: "two", header: "Also enabled", content: "So does this one." },
        { key: "locked", header: "Locked (disabled)", content: "You can't open me.", disabled: true },
      ] }) },
    { name: "Heading level + no regions", notes: "headingLevel=4 (aria-level) and regions=false: a long FAQ adds no landmarks", render: () =>
      el("puredashboard-collapse", { headingLevel: 4, regions: false, multiple: true, items: [
        { key: "q1", header: "Can I export data?", content: "Yes, as CSV or JSON." },
        { key: "q2", header: "Is there an API?", content: "Every page is backed by one." },
        { key: "q3", header: "Where is it hosted?", content: "Wherever you run the binary." },
      ] }) },
  ],
};
