// buildFunnel.mjs — CLI: brief.json + logo SVG -> output/<slug>/index.html (samowystarczalny).
// Uzycie: node src/buildFunnel.mjs briefs/przyklad.json
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const deriveTokens = require("./lib/deriveTokens.js");
const renderLanding = require("./lib/renderLanding.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const briefPath = process.argv[2];
if (!briefPath) {
  console.error("Uzycie: node src/buildFunnel.mjs <sciezka-do-brief.json>");
  process.exit(1);
}
if (!fs.existsSync(briefPath)) {
  console.error(`Brak pliku briefu: ${briefPath}`);
  process.exit(1);
}

const brief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
if (!brief.slug || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(brief.slug)) {
  console.error("Brief musi miec pole \"slug\" (nazwa folderu wyjsciowego).");
  process.exit(1);
}

if (brief.delivery?.file && (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(brief.delivery.file) || brief.delivery.file.includes('..'))) {
  console.error('delivery.file musi być samą nazwą pliku, bez ścieżki.');
  process.exit(1);
}

const briefDir = path.dirname(path.resolve(briefPath));
const logoRel = (brief.brand && brief.brand.logo) || null;
if (!logoRel) {
  console.error("Brief musi miec pole brand.logo (sciezka do SVG wzgledem pliku briefu).");
  process.exit(1);
}
const logoPath = path.resolve(briefDir, logoRel);
if (!fs.existsSync(logoPath)) {
  console.error(`Brak pliku logo: ${logoPath}`);
  process.exit(1);
}

const svg = fs.readFileSync(logoPath, "utf8");
const tokens = deriveTokens.finalize(deriveTokens.analyze(svg));
const logoData = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");

const css =
  fs.readFileSync(path.join(ROOT, "templates", "base.css"), "utf8") +
  "\n" +
  fs.readFileSync(path.join(ROOT, "templates", "landing.css"), "utf8");

const html = renderLanding.render(brief, logoData, tokens, { inlineCss: css });

const outDir = path.join(ROOT, "output", brief.slug);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

// Plik lead magnetu (delivery.mode=download): kopiuj obok index.html.
let deliveryNote = "brak (delivery.mode != download)";
if (brief.delivery && brief.delivery.mode === "download" && brief.delivery.file) {
  const src = path.resolve(briefDir, "assets", brief.delivery.file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, brief.delivery.file));
    deliveryNote = brief.delivery.file;
  } else {
    deliveryNote = `UWAGA: nie znaleziono ${src} — wrzuc plik do output/${brief.slug}/ przed publikacja`;
  }
}

console.log("=== LME build ===");
console.log(`Brief:     ${briefPath}`);
console.log(`Tokeny:    brand=${tokens.brand} accent=${tokens.accent} (brand-ink=${tokens.brandInk})`);
console.log(`Output:    output/${brief.slug}/index.html`);
console.log(`Lead magnet: ${deliveryNote}`);
console.log(`Endpoint:  ${brief.endpoint || "(pusty — formularz w trybie demo, bez wysylki)"}`);
