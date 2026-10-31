// colors.js — deterministyczny ekstraktor kolorow z SVG + helpery WCAG/HSV (zero-dep).
// UMD: dziala w Node (require) i w przegladarce (window.OG.colors).
(function (root) {
  "use strict";

  const NAMED = { white: "#FFFFFF", black: "#000000" };

  function norm(hex) {
    if (!hex) return null;
    hex = String(hex).trim().toLowerCase();
    if (NAMED[hex]) hex = NAMED[hex];
    if (hex[0] !== "#") return null;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 || /[^0-9a-f]/.test(h)) return null;
    return "#" + h.toUpperCase();
  }

  function rgb(hex) {
    const h = hex.slice(1);
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  function hsv(hex) {
    const { r, g, b } = rgb(hex);
    const R = r / 255, G = g / 255, B = b / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
    let hh = 0;
    if (d) {
      if (mx === R) hh = ((G - B) / d) % 6;
      else if (mx === G) hh = (B - R) / d + 2;
      else hh = (R - G) / d + 4;
      hh *= 60; if (hh < 0) hh += 360;
    }
    return { h: hh, s: mx ? d / mx : 0, v: mx };
  }

  function _lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(hex) { const { r, g, b } = rgb(hex); return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b); }
  function contrast(a, b) { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); }

  function isNeutral(hex) { const { s, v } = hsv(hex); return s < 0.18 || v < 0.16 || (v > 0.93 && s < 0.1); }
  function dist(a, b) { const x = rgb(a), y = rgb(b); return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b); }

  function ctaScore(hex) {
    const { h, s } = hsv(hex);
    let base;
    if (h >= 70 && h <= 170) base = 3;
    else if (h <= 45 || h >= 330) base = 3;
    else if (h > 45 && h < 70) base = 2.5;
    else if (h >= 180 && h <= 275) base = 1;
    else base = 2;
    return base + s * 0.5;
  }

  function extractColors(svg) {
    const found = {};
    let m;
    const reHex = /#[0-9a-fA-F]{3,6}\b/g;
    while ((m = reHex.exec(svg))) { const n = norm(m[0]); if (n) found[n] = (found[n] || 0) + 1; }
    const reNamed = /(?:fill|stop-color|stroke)\s*[:=]\s*["']?\s*(white|black)\b/gi;
    while ((m = reNamed.exec(svg))) { const n = norm(m[1]); if (n) found[n] = (found[n] || 0) + 1; }

    const all = Object.entries(found).map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count);
    const chromatic = [];
    for (const c of all) {
      if (isNeutral(c.hex)) continue;
      if (chromatic.some((k) => dist(k.hex, c.hex) < 28)) continue;
      chromatic.push(c);
    }
    return { chromatic, all };
  }

  const api = { norm, rgb, hsv, lum, contrast, isNeutral, dist, ctaScore, extractColors };
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.OG = root.OG || {}; root.OG.colors = api; }
})(typeof self !== "undefined" ? self : this);
