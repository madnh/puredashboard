import { el, hstack, vstack } from "./_util.js";

// <puredashboard-copy> writes a value to the system clipboard on click and reports the
// result for a moment (check / cross + an off-screen announcement). The value can be
// text, rich HTML, or an IMAGE (URL, Blob, <img>, <canvas>) — images go out as PNG.
//
// Note when trying these: the async Clipboard API needs a SECURE CONTEXT. Served from
// http://localhost the gallery counts as one; over plain HTTP on a LAN address the text
// copies still work (legacy execCommand fallback) but the image / HTML ones report the
// failure state instead of silently doing nothing.

const TOKEN = "ghp_9xK2mQ7vR4tL8wN1pS6yB3cF5dH0jA";
const SNIPPET = `import "LIB/copy.js";
const c = document.createElement("puredashboard-copy");
c.value = "npm i";`;

// A small generated PNG so the image story needs no network round-trip.
const chart = () => {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 120;
  c.style.cssText = "border-radius:8px; border:1px solid var(--border); display:block";
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 320, 0);
  g.addColorStop(0, "#3b82f6"); g.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 120);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  [30, 62, 45, 88, 70, 100].forEach((h, i) => ctx.fillRect(16 + i * 50, 120 - h - 12, 34, h));
  return c;
};

const copy = (props, ariaLabel) => {
  const c = el("puredashboard-copy", props);
  if (ariaLabel) c.setAttribute("aria-label", ariaLabel);
  c.addEventListener("copied", (e) => console.log("copied:", e.detail.type, e.detail.value ?? e.detail.blob));
  c.addEventListener("copyerror", (e) => console.warn("copy failed:", e.detail.error.message));
  return c;
};
const mono = (text, id) => el("code", { id, textContent: text, style: "font-family:var(--font-mono,ui-monospace,monospace); font-size:12px; padding:4px 8px; border-radius:6px; background:var(--panel-2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:340px" });
const note = (text) => el("div", { style: "font-size:12px;color:var(--muted)", textContent: text });

export default {
  tag: "puredashboard-copy",
  title: "General/Copy",
  stories: [
    { name: "Copy text", notes: "icon-only (named 'Copy' by default), with a label, or showing the value itself as the label", render: () =>
      vstack([
        hstack([copy({ value: "npm i puredashboard" }), mono("npm i puredashboard")]),
        hstack([copy({ value: "npm i puredashboard", label: "Copy" })]),
        hstack([copy({ value: TOKEN, showValue: true, variant: "text", size: "sm" })]),
      ]) },

    { name: "From another element", notes: "point `from` at the element holding the value — an <input> gives its .value, anything else its textContent", render: () => {
      const field = el("puredashboard-input", { value: "web-01.prod.internal" });
      field.setAttribute("id", "story-copy-host");
      return vstack([
        hstack([mono(TOKEN, "story-copy-token"), copy({ from: "#story-copy-token", variant: "text" }, "Copy the token")]),
        hstack([field, copy({ from: "#story-copy-host input", variant: "text" }, "Copy the hostname")]),
        note("`from` is a plain CSS selector, resolved against the document on every click — so the value stays live."),
      ]);
    } },

    { name: "Copy an image", notes: "a <canvas>, an <img> or an image URL — normalised to PNG (the one format clipboards take). Needs a secure context; paste into a chat or an image editor to check", render: () => {
      const canvas = chart();
      return vstack([
        canvas,
        hstack([
          copy({ value: canvas, label: "Copy chart" }),
          copy({ value: canvas, type: "image" }, "Copy the chart image"),
        ]),
        note("Cross-origin URLs need CORS: without it the canvas is tainted and the button reports the failure."),
      ]);
    } },

    { name: "Copy a table (paste into Excel)", notes: "point `from` at a <table> — no `type` needed. Excel/Sheets read the text/html half and rebuild the grid; the text/plain half is TSV, so even a plain-text paste lands one cell per column", render: () => {
      const rows = [["api-gateway", "us-east-1", "184203"], ["auth-service", "eu-west-1", "91044"], ["billing-cron", "eu-west-1", "812"]];
      const table = el("table", { id: "story-copy-table", style: "border-collapse:collapse; font-size:13px" }, [
        el("thead", {}, [el("tr", {}, ["Service", "Region", "Req/day"].map((h) => el("th", { textContent: h, style: "text-align:left; padding:6px 12px; border-bottom:1px solid var(--border)" })))]),
        el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c) => el("td", { textContent: c, style: "padding:6px 12px; border-bottom:1px solid var(--border)" }))))),
      ]);
      return vstack([
        table,
        hstack([
          copy({ from: "#story-copy-table", label: "Copy table" }),
          copy({ from: "#story-copy-table", type: "text", label: "…as plain text", variant: "text" }),
        ]),
        note("A <puredashboard-table> works the same way — aim `from` at the inner <table> (e.g. \"#svc table\") so you copy the grid, not the toolbar around it."),
      ]);
    } },

    { name: "Rich HTML", notes: "type=\"html\" writes text/html AND a plain-text flattening, so pasting into a rich editor keeps the markup and pasting into a terminal still works", render: () =>
      vstack([
        hstack([copy({ value: "<b>web-01</b> — <i>healthy</i>", type: "html", label: "Copy formatted" })]),
        note("Paste into a document editor to see the bold/italic survive."),
      ]) },

    { name: "In a code block", notes: "the everyday placement: a borderless button in the corner of a snippet", render: () => {
      const pre = el("pre", { id: "story-copy-snippet", textContent: SNIPPET, style: "margin:0; padding:12px 44px 12px 12px; border-radius:10px; background:var(--panel-2); font-size:12px; overflow:auto" });
      return el("div", { style: "position:relative; max-width:520px" }, [
        pre,
        el("div", { style: "position:absolute; top:6px; right:6px" }, [copy({ from: "#story-copy-snippet", variant: "text", size: "sm" }, "Copy the snippet")]),
      ]);
    } },

    { name: "Sizes and variants", notes: "sm · md (default) · lg, bordered or borderless — sized like <puredashboard-toggle>, so they line up in one toolbar", render: () =>
      vstack([
        hstack([copy({ value: "a", size: "sm" }), copy({ value: "a" }), copy({ value: "a", size: "lg" })]),
        hstack([copy({ value: "a", size: "sm", variant: "text" }), copy({ value: "a", variant: "text" }), copy({ value: "a", size: "lg", variant: "text" })]),
        hstack([copy({ value: "a", label: "Copy", size: "sm" }), copy({ value: "a", label: "Copy" }), copy({ value: "a", label: "Copy", size: "lg" })]),
      ]) },

    { name: "States", notes: "success · failure · disabled · a sticky feedback you clear yourself (feedback=0)", render: () =>
      vstack([
        hstack([copy({ value: "works", label: "Copy" }), note("→ turns green for 1.6s")]),
        hstack([copy({ value: "https://example.com/nope.png", type: "image", label: "Broken image" }), note("→ reports the failure (fetch/CORS)")]),
        hstack([copy({ value: "x", label: "Copy", disabled: true }), note("→ disabled: the native button blocks it")]),
        hstack([copy({ value: "x", label: "Copy", feedback: 0 }), note("→ feedback=0 keeps the state until the next click")]),
        hstack([copy({ value: "x", labels: { copy: "Sao chép", copied: "Đã sao chép", failed: "Sao chép thất bại" }, label: "Sao chép" })]),
      ]) },
  ],
};
