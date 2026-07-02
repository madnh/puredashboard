// Visual harness — screenshot every component (all its stories) from PureBook,
// in light + dark, for review / visual-regression. Dev-only; runs in the Docker
// image below. Zero impact on the shipped library.
//
// It serves the mounted web tree over HTTP (ES modules need http, not file://),
// drives headless Chromium via Playwright, and writes PNGs to $OUT.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.env.WEB_ROOT || "/work/web";
const OUT = process.env.OUT || "/out";
const PORT = Number(process.env.PORT || 8731);
const THEMES = (process.env.THEMES || "dark,light").split(",");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

// --- tiny static file server rooted at the web tree ---
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(PORT, r));

fs.mkdirSync(OUT, { recursive: true });
const base = `http://127.0.0.1:${PORT}/test/gallery.html`;
const browser = await chromium.launch();
const errors = [];

async function ready(page) {
  await page.waitForFunction(() => document.querySelector("puredashboard-gallery")?.dataset.ready === "1", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(150);
}

// discover component tags from the gallery sidebar
const probe = await browser.newPage();
await probe.goto(base, { waitUntil: "networkidle" });
await ready(probe);
const tags = await probe.evaluate(() => [...document.querySelectorAll(".puredashboard-gallery__item")].map((b) => b.dataset.tag));
await probe.close();
console.log(`shooting ${tags.length} components × ${THEMES.length} themes`);

for (const theme of THEMES) {
  // one contact sheet per theme
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.5 });
  sheet.on("pageerror", (e) => errors.push(`overview.${theme}: ${e.message}`));
  await sheet.goto(`${base}?overview=1&theme=${theme}`, { waitUntil: "networkidle" });
  await ready(sheet);
  await sheet.screenshot({ path: path.join(OUT, `_overview.${theme}.png`), fullPage: true });
  await sheet.close();

  for (const tag of tags) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
    p.on("pageerror", (e) => errors.push(`${tag}.${theme}: ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${tag}.${theme}: ${m.text()}`); });
    await p.goto(`${base}?c=${tag}&theme=${theme}`, { waitUntil: "networkidle" });
    await ready(p);
    await p.screenshot({ path: path.join(OUT, `${tag.replace(/^puredashboard-/, "")}.${theme}.png`), fullPage: true });
    await p.close();
  }
}

await browser.close();
server.close();
if (errors.length) { console.error("VISUAL ERRORS:\n" + errors.join("\n")); process.exit(1); }
console.log(`done → ${OUT}`);
