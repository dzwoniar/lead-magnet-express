// deriveTokens.js — z kolorow logo -> tokeny (dwufazowy: brand=UI, accent=CTA). Zero API.
// UMD: Node (require) + przegladarka (window.OG.deriveTokens).
(function (root) {
  "use strict";
  const colors = (typeof require === "function") ? require("./colors") : (root.OG && root.OG.colors);
  const { rgb, lum, contrast, ctaScore, extractColors, isNeutral } = colors;

  const WHITE = "#FFFFFF";
  const BLACK3 = "#0F1011";
  const FALLBACK = "#1B4D8C";

  function toHex(r, g, b) {
    return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function mix(hex, t, amt) { const c = rgb(hex); return toHex(c.r + (t.r - c.r) * amt, c.g + (t.g - c.g) * amt, c.b + (t.b - c.b) * amt); }
  function tone(hex, amt) { return lum(hex) > 0.4 ? mix(hex, { r: 0, g: 0, b: 0 }, amt) : mix(hex, { r: 255, g: 255, b: 255 }, amt); }
  function onColor(bg) { return contrast(BLACK3, bg) >= contrast(WHITE, bg) ? "var(--black3)" : "var(--white)"; }

  function analyze(svg) {
    const { chromatic } = extractColors(svg);
    let brand, accent, mono = false, note;
    if (chromatic.length === 0) {
      brand = FALLBACK; accent = tone(FALLBACK, 0.2);
      note = "brak kolorow chromatycznych -> fallback";
    } else if (chromatic.length === 1) {
      brand = chromatic[0].hex; accent = tone(brand, 0.22); mono = true;
      note = `mono (1 kolor ${brand}) -> accent = drugi ton ${accent}`;
    } else {
      const [a, b] = chromatic.slice(0, 2);
      if (ctaScore(a.hex) >= ctaScore(b.hex)) { accent = a.hex; brand = b.hex; }
      else { accent = b.hex; brand = a.hex; }
      note = `2 kolory -> brand(UI)=${brand}, accent(CTA)=${accent}`;
    }
    const brand2 = chromatic.length >= 2 ? (brand === chromatic[0].hex ? chromatic[1].hex : chromatic[0].hex) : accent;
    return { brand, accent, brand2, mono, note, chromatic };
  }

  function readableOnWhite(hex) {
    let amt = 0, c = hex;
    while (contrast(c, WHITE) < 4.5 && amt < 0.9) { amt += 0.08; c = mix(hex, { r: 0, g: 0, b: 0 }, amt); }
    return c;
  }

  // paleta "do 4" (parytet Figmy: 4 kolory, min 1 wyrozniajacy): accent, brand, brand2,
  // + 4-ty = kolejny chromatyczny z logo albo JEDEN neutralny ink. Dedupe po hex, max 4.
  function paletteColors(t) {
    const out = [];
    const push = (hex, role) => {
      if (!hex || out.length >= 4 || out.some((c) => c.hex === hex)) return;
      out.push({ hex, role, chromatic: !isNeutral(hex) });
    };
    push(t.accent, "accent");
    push(t.brand, "brand");
    push(t.brand2, "brand2");
    (t.chromatic || []).forEach((c) => push(c.hex, "brand3"));
    const ink = readableOnWhite(t.brand);
    push(out.some((c) => c.hex === ink) ? BLACK3 : ink, "neutral");
    return out;
  }

  function finalize(t) {
    return {
      brand: t.brand, accent: t.accent, brand2: t.brand2 || t.accent,
      colors: paletteColors(t),
      brandInk: readableOnWhite(t.brand),
      onAccent: onColor(t.accent), onBrand: onColor(t.brand),
    };
  }

  function tokensCss(t, company, label) {
    return `/* tokens — ${company}${label ? " / " + label : ""} (logo->Brand DETERMINISTYCZNY z SVG, bez API).
   brand=UI, accent=CTA (dwufazowo); on-* auto WCAG; neutrale/spacing/typografia stale. */
:root {
  --brand: ${t.brand};
  --brand-ink: ${t.brandInk};
  --brand-2: ${t.brand2};
  --accent: ${t.accent};
  --accent-contrast: ${t.onAccent};
  --on-brand: ${t.onBrand};
  --white: #FFFFFF;
  --light1: #F4F6F6; --light2: #E8ECEE; --light3: #D5DCDF;
  --black1: #45494D;  --black2: #292B2D;  --black3: #0F1011;
  --padding-horizontal: 24px; --padding-vertical: 24px;
  --section-padding: 100px; --section-gap: 48px; --cards-gap: 20px;
  --border-radius: 0px;
  --font-title: "Inter", "Geist", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-body:  "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}`;
  }

  const api = { analyze, finalize, tokensCss, tone };
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.OG = root.OG || {}; root.OG.deriveTokens = api; }
})(typeof self !== "undefined" ? self : this);
