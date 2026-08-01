import { el, vstack } from "./_util.js";

// <puredashboard-lazy> defers building expensive content until it is needed. The stories
// below log to the console when each item actually renders — scroll the story and watch.

const SAMPLE = (i) => ({
  service: `api-gateway-${i}`,
  region: ["us-east-1", "eu-west-1", "ap-southeast-1"][i % 3],
  replicas: 2 + (i % 5),
  health: { status: i % 7 === 0 ? "degraded" : "healthy", lastCheck: "2026-08-01T09:0" + (i % 6) + ":00Z", latencyMs: 40 + i },
  limits: { cpu: "500m", memory: "512Mi" },
  tags: ["prod", "team-core", `shard-${i % 4}`],
});

// One heavy row: a JSON tree (parses + builds a node per key) wrapped in a lazy.
const lazyRow = (i, props = {}) => {
  const lz = el("puredashboard-lazy", Object.assign({ height: "148px" }, props));
  lz.render = (host) => {
    const v = document.createElement("puredashboard-json-view");
    v.data = SAMPLE(i);
    v.level = 1;
    host.style.setProperty("border", "1px solid var(--border)");
    host.style.setProperty("border-radius", "10px");
    host.style.setProperty("padding", "8px");
    return v;
  };
  lz.addEventListener("render", (e) => console.log(`lazy row ${i} rendered (${e.detail.reason})`));
  return lz;
};

const scroller = (kids) =>
  el("div", { style: "height:320px;overflow:auto;display:grid;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px" }, kids);

export default {
  tag: "puredashboard-lazy",
  title: "Data display/Lazy",
  stories: [
    { name: "Scroll to render", notes: "20 JSON trees; only the ones near the viewport are built — scroll and watch the console", render: () =>
      scroller(Array.from({ length: 20 }, (_, i) => lazyRow(i))) },

    { name: "Custom fallback", notes: "a [data-lazy-fallback] child is shown while waiting instead of the built-in shimmer", render: () => {
      const lz = lazyRow(1, { trigger: "manual" });
      const sk = el("puredashboard-skeleton", { variant: "text", lines: 3 });
      sk.setAttribute("data-lazy-fallback", "");
      lz.append(sk);
      const btn = el("puredashboard-button", { variant: "primary" }, [document.createTextNode("Render now")]);
      btn.addEventListener("click", () => lz.renderNow());
      return vstack([lz, btn], "lg");
    } },

    { name: "Markup only (<template>)", notes: "no JS at all: the heavy markup sits in a <template>, inert until it scrolls in", render: () => {
      const wrap = el("div", { style: "display:grid;gap:12px" });
      wrap.innerHTML = `
        <puredashboard-lazy height="120px">
          <template>
            <puredashboard-markdown></puredashboard-markdown>
          </template>
        </puredashboard-lazy>`;
      // fill the markdown value once it exists (the template content is inert until then)
      wrap.querySelector("puredashboard-lazy").addEventListener("render", (e) => {
        e.target.querySelector("puredashboard-markdown").value = "## Rendered on demand\n\nThe `<template>` content was **inert** until this element scrolled into view.";
      });
      return wrap;
    } },

    { name: "unrender (long lists)", notes: "tears the content down again when it scrolls far out of view, keeping the height — check the console", render: () =>
      scroller(Array.from({ length: 20 }, (_, i) => {
        const lz = lazyRow(i, { unrender: true, rootMargin: "0px" });
        lz.addEventListener("unrender", () => console.log(`lazy row ${i} unrendered`));
        return lz;
      })) },

    { name: "Triggers", notes: "visible (default) · idle · eager · manual", render: () =>
      vstack([
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: 'trigger="idle" — renders when the browser is next idle' }),
        lazyRow(2, { trigger: "idle" }),
        el("div", { style: "font-size:12px;color:var(--muted)", textContent: 'trigger="eager" — renders straight away (opt out without changing the markup)' }),
        lazyRow(3, { trigger: "eager" }),
      ], "lg") },
  ],
};
