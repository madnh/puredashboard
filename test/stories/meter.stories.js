import { el, vstack } from "./_util.js";

// <puredashboard-meter> is a GAUGE for a reading inside a known range (disk, memory,
// quota, a score) — role="meter". Its neighbour <puredashboard-progress> reports how far
// a task has got (role="progressbar"). Same look, different meaning: pick by meaning.

const meter = (props) => el("puredashboard-meter", props);

export default {
  tag: "puredashboard-meter",
  title: "Feedback/Meter",
  stories: [
    { name: "Basic", notes: "label + reading above the track; the read-out is the percent of the range", render: () =>
      vstack([
        meter({ label: "Disk used", value: 24 }),
        meter({ label: "Requests of quota", value: 720, max: 1000 }),
        meter({ label: "No read-out", value: 60, showValue: false }),
      ], "lg") },

    { name: "Colour zones", notes: "low / high / optimum — the native <meter> semantics: optimum → green, suboptimal → amber, furthest → red", render: () =>
      vstack([
        meter({ label: "Disk used — healthy", value: 22, low: 60, high: 80, optimum: 0 }),
        meter({ label: "Disk used — filling up", value: 71, low: 60, high: 80, optimum: 0 }),
        meter({ label: "Disk used — critical", value: 94, low: 60, high: 80, optimum: 0 }),
      ], "lg") },

    { name: "Optimum in the middle", notes: "when the ideal reading sits in the middle band, BOTH ends are merely suboptimal (never red)", render: () =>
      vstack([
        meter({ label: "Pool utilisation — too idle", value: 12, min: 0, max: 100, low: 40, high: 70, optimum: 55 }),
        meter({ label: "Pool utilisation — just right", value: 55, min: 0, max: 100, low: 40, high: 70, optimum: 55 }),
        meter({ label: "Pool utilisation — too hot", value: 92, min: 0, max: 100, low: 40, high: 70, optimum: 55 }),
      ], "lg") },

    { name: "Units & locale", notes: "`format` takes Intl.NumberFormat options and applies them to the RAW value", render: () =>
      vstack([
        meter({ label: "Storage", value: 8.5, max: 16, format: { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }, locale: "en-US" }),
        meter({ label: "Bandwidth this month", value: 412000, max: 1000000, format: { notation: "compact" }, locale: "en-US" }),
        meter({ label: "Ngân sách", value: 7200000, max: 12000000, format: { style: "currency", currency: "VND", maximumFractionDigits: 0 }, locale: "vi-VN", low: 6000000, high: 10000000, optimum: 0 }),
      ], "lg") },

    { name: "Sizes", notes: "sm · md (default) · lg — track thickness only", render: () =>
      vstack([
        meter({ label: "sm", value: 40, size: "sm" }),
        meter({ label: "md", value: 60 }),
        meter({ label: "lg", value: 80, size: "lg" }),
      ], "lg") },

    { name: "Meter vs progress", notes: "same bar, different meaning: a meter is a reading that moves either way, progress advances toward done", render: () =>
      vstack([
        meter({ label: "Meter — memory in use (role=meter)", value: 62, low: 50, high: 85, optimum: 0 }),
        el("puredashboard-progress", { value: 62 }),
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: "↑ progress (role=progressbar) — a task 62% of the way to done" }),
      ], "lg") },
  ],
};
