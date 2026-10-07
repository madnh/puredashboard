import { el, vstack } from "./_util.js";

const regions = [
  { value: "na", label: "North America" },
  { value: "sa", label: "South America" },
  { value: "eu", label: "Europe" },
  { value: "af", label: "Africa" },
  { value: "as", label: "Asia" },
  { value: "oc", label: "Oceania" },
];

export default {
  tag: "puredashboard-combobox",
  title: "Form/Combobox",
  stories: [
    { name: "Basic", notes: "type to filter the options", render: () =>
      el("puredashboard-combobox", { options: regions, value: "eu" }) },
    { name: "Placeholder", render: () =>
      el("puredashboard-combobox", { options: regions, placeholder: "Pick a region…" }) },
    { name: "Allow custom", notes: "typed values with no match are accepted as free text", render: () =>
      el("puredashboard-combobox", { options: regions, allowCustom: true, placeholder: "Region or free text…" }) },
    { name: "Disabled", render: () =>
      el("puredashboard-combobox", { options: regions, value: "as", disabled: true }) },
    { name: "Error", render: () =>
      el("puredashboard-combobox", { options: regions, required: true, error: "Please choose a region." }) },
    { name: "Multiple", notes: "value is a string[]; chips, the list stays open, a pick toggles; Backspace removes the last chip", render: () =>
      el("puredashboard-combobox", { multiple: true, options: regions, value: ["eu", "as"], placeholder: "Pick regions…" }) },
    { name: "Clearable", notes: "a clear button while a value is set", render: () =>
      el("puredashboard-combobox", { options: regions, value: "oc", clearable: true }) },
    { name: "Server search", notes: "serverFilter + loading: the app answers comboboxsearch with new options (a fake 400 ms fetch here)", render: () => {
      const c = el("puredashboard-combobox", { options: [], serverFilter: true, placeholder: "Search regions…" });
      let seq = 0;
      const fetchFor = (text) => {
        const my = ++seq; c.loading = true;
        setTimeout(() => {
          if (my !== seq) return; // a newer keystroke won
          const q = (text || "").toLowerCase();
          c.options = regions.filter((r) => r.label.toLowerCase().includes(q));
          c.loading = false;
        }, 400);
      };
      c.addEventListener("comboboxopen", () => fetchFor(""));
      c.addEventListener("comboboxsearch", (e) => fetchFor(e.detail.text));
      return c;
    } },
  ],
};
