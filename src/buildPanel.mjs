// buildPanel.mjs — generuje panel/intake.html (samowystarczalny: libki UMD + CSS inline).
// Uzycie: node src/buildPanel.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}

// "</script" w zrodle libek (renderLanding ma <script> w template literalu) zamknelby
// tag <script> panelu — escapujemy do "<\/script" (semantyka JS bez zmian).
function safeInline(src) {
  return src.replace(/<\/script/g, "<\\/script");
}

const libs = ["src/lib/colors.js", "src/lib/deriveTokens.js", "src/lib/renderLanding.js"]
  .map(read)
  .map(safeInline)
  .join("\n;\n"); // ';' miedzy IIFE — pulapka ASI (nauka z generatora Overflow)

const landingCss = read("templates/base.css") + "\n" + read("templates/landing.css");

// Logika panelu: bez backticków (osadzana w template literalu ponizej).
const PANEL_JS = `
(function () {
  "use strict";
  var CSS = window.__LME_CSS__;
  var state = { logoSvg: null, logoName: null };

  function $(id) { return document.getElementById(id); }
  function val(id) { return $(id).value.trim(); }

  function collectBrief() {
    return {
      slug: val("f-slug") || "moj-lead-magnet",
      brand: { name: val("f-brand"), logo: state.logoName || "logo.svg" },
      kicker: val("f-kicker"),
      h1: val("f-h1"),
      sub: val("f-sub"),
      bullets: [val("f-b1"), val("f-b2"), val("f-b3")].filter(Boolean),
      form: { title: val("f-ftitle"), sub: val("f-fsub"), submit: val("f-fsubmit") },
      thankyou: { title: val("f-ttitle"), body: val("f-tbody"), buttonLabel: val("f-tbtn") },
      rodoText: val("f-rodo"),
      privacyUrl: val("f-privacy"),
      delivery: { mode: "download", file: val("f-file") },
      doubleOptin: $("f-doi").checked,
      endpoint: val("f-endpoint"),
      ml: { account: val("f-account"), groupId: val("f-group") }
    };
  }

  var PLACEHOLDER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32"><rect width="32" height="32" rx="6" fill="#1B4D8C"/><text x="42" y="22" font-family="Arial" font-size="16" font-weight="bold" fill="#0F1011">LOGO</text></svg>';

  function currentHtml() {
    var svg = state.logoSvg || PLACEHOLDER_SVG;
    var tokens = OG.deriveTokens.finalize(OG.deriveTokens.analyze(svg));
    var logoData = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    return OG.renderLanding.render(collectBrief(), logoData, tokens, { inlineCss: CSS });
  }

  var t = null;
  function update() {
    clearTimeout(t);
    t = setTimeout(function () {
      try {
        $("preview").srcdoc = currentHtml();
        $("panel-error").textContent = "";
      } catch (err) {
        $("panel-error").textContent = "Blad podgladu: " + err.message;
      }
    }, 150);
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  $("f-logo").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/svg/i.test(file.type) && !/\\.svg$/i.test(file.name)) {
      $("panel-error").textContent = "Logo musi byc plikiem SVG.";
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      state.logoSvg = String(reader.result);
      state.logoName = file.name;
      update();
    };
    reader.readAsText(file);
  });

  document.querySelectorAll("input[type=text], input[type=url], textarea, input[type=checkbox]").forEach(function (el) {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  $("btn-brief").addEventListener("click", function () {
    var brief = collectBrief();
    download(brief.slug + ".json", JSON.stringify(brief, null, 2), "application/json");
  });

  $("btn-page").addEventListener("click", function () {
    var brief = collectBrief();
    download("index.html", currentHtml(), "text/html");
  });

  update();
})();
`;

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>LME — panel funnela lead magnetu</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: #F4F6F6; color: #0F1011; }
  header.bar { background: #0F1011; color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px; }
  header.bar h1 { font-size: 16px; margin: 0; font-weight: 700; }
  header.bar span { font-size: 12.5px; opacity: .7; }
  .wrap { display: grid; grid-template-columns: 420px 1fr; gap: 0; height: calc(100vh - 48px); }
  .pane { overflow-y: auto; padding: 18px 20px 60px; background: #fff; border-right: 1px solid #E8ECEE; }
  .prev { padding: 14px; }
  .prev iframe { width: 100%; height: 100%; border: 1px solid #D5DCDF; border-radius: 8px; background: #fff; }
  fieldset { border: 1px solid #E8ECEE; border-radius: 10px; margin: 0 0 16px; padding: 12px 14px 14px; }
  legend { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #45494D; padding: 0 6px; }
  label { display: block; font-size: 12.5px; font-weight: 600; margin: 10px 0 4px; color: #292B2D; }
  input[type=text], input[type=url], textarea { width: 100%; padding: 9px 11px; border: 1px solid #D5DCDF; border-radius: 8px; font: inherit; font-size: 13.5px; }
  textarea { resize: vertical; min-height: 54px; }
  .chk { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 13px; }
  .hint { font-size: 11.5px; color: #45494D; margin: 3px 0 0; }
  .actions { position: sticky; bottom: 0; background: #fff; padding: 12px 0 0; border-top: 1px solid #E8ECEE; display: flex; gap: 10px; }
  button { flex: 1; padding: 12px; border: 0; border-radius: 999px; font: inherit; font-weight: 700; cursor: pointer; }
  #btn-page { background: #0F1011; color: #fff; }
  #btn-brief { background: #E8ECEE; color: #0F1011; }
  #panel-error { color: #B3261E; font-size: 12.5px; min-height: 16px; margin-top: 8px; }
  @media (max-width: 980px) { .wrap { grid-template-columns: 1fr; height: auto; } .prev { height: 70vh; } }
</style>
</head>
<body>
<header class="bar"><h1>Lead Magnet Express</h1><span>brief → landing z formularzem → MailerLite. Edytujesz pola, podgląd aktualizuje się sam.</span></header>
<div class="wrap">
  <div class="pane">
    <fieldset>
      <legend>Marka</legend>
      <label for="f-brand">Nazwa marki</label>
      <input type="text" id="f-brand" value="Twoja Marka" maxlength="60" />
      <label for="f-logo">Logo (SVG)</label>
      <input type="file" id="f-logo" accept=".svg,image/svg+xml" />
      <p class="hint">Kolory marki (brand/CTA) wyprowadzą się z logo automatycznie.</p>
    </fieldset>

    <fieldset>
      <legend>Treść landingu</legend>
      <label for="f-kicker">Kicker (chip nad tytułem)</label>
      <input type="text" id="f-kicker" value="Darmowy materiał" maxlength="40" />
      <label for="f-h1">Nagłówek H1</label>
      <textarea id="f-h1" maxlength="90">Odbierz checklistę, która oszczędza godziny pracy co tydzień</textarea>
      <label for="f-sub">Podtytuł (opcjonalny)</label>
      <textarea id="f-sub" maxlength="160">Konkretna, sprawdzona w praktyce lista kroków — bez teorii i lania wody.</textarea>
      <label>3 bullety wartości</label>
      <input type="text" id="f-b1" value="Gotowe kroki do wdrożenia od razu" maxlength="80" />
      <input type="text" id="f-b2" value="Sprawdzone na realnych projektach" maxlength="80" style="margin-top:6px" />
      <input type="text" id="f-b3" value="Zero teorii — samo mięso" maxlength="80" style="margin-top:6px" />
    </fieldset>

    <fieldset>
      <legend>Formularz</legend>
      <label for="f-ftitle">Tytuł karty</label>
      <input type="text" id="f-ftitle" value="Odbierz za darmo" maxlength="50" />
      <label for="f-fsub">Tekst pod tytułem</label>
      <input type="text" id="f-fsub" value="Wpisz dane, a materiał wyląduje u Ciebie od razu." maxlength="100" />
      <label for="f-fsubmit">Tekst przycisku</label>
      <input type="text" id="f-fsubmit" value="Wysyłam" maxlength="30" />
      <label for="f-rodo">Tekst zgody RODO</label>
      <textarea id="f-rodo" maxlength="300">Wyrażam zgodę na przetwarzanie moich danych w celu otrzymania materiału i informacji od nadawcy.</textarea>
      <label for="f-privacy">Link do polityki prywatności (URL)</label>
      <input type="url" id="f-privacy" value="" placeholder="https://..." />
    </fieldset>

    <fieldset>
      <legend>Po zapisie (strona podziękowania)</legend>
      <label for="f-ttitle">Tytuł</label>
      <input type="text" id="f-ttitle" value="Gotowe!" maxlength="50" />
      <label for="f-tbody">Treść</label>
      <textarea id="f-tbody" maxlength="300">Materiał jest gotowy do pobrania poniżej.</textarea>
      <label for="f-tbtn">Tekst przycisku pobierania</label>
      <input type="text" id="f-tbtn" value="Pobierz PDF" maxlength="40" />
      <label for="f-file">Nazwa pliku lead magnetu (leży obok index.html)</label>
      <input type="text" id="f-file" value="lead-magnet.pdf" maxlength="80" />
      <div class="chk"><input type="checkbox" id="f-doi" /><label for="f-doi" style="margin:0">Konto ma double opt-in (zmienia komunikat)</label></div>
    </fieldset>

    <fieldset>
      <legend>Konfiguracja (admin/IT)</legend>
      <label for="f-slug">Slug funnela (identyfikator)</label>
      <input type="text" id="f-slug" value="moj-lead-magnet" maxlength="60" pattern="[a-z0-9-]+" />
      <label for="f-endpoint">Endpoint Workera (puste = tryb demo bez wysyłki)</label>
      <input type="url" id="f-endpoint" value="" placeholder="https://lme-worker.twoja-subdomena.workers.dev/subscribe" />
      <label for="f-account">Konto MailerLite (nazwa sekretu)</label>
      <input type="text" id="f-account" value="" placeholder="np. akademia" maxlength="40" />
      <label for="f-group">ID grupy MailerLite</label>
      <input type="text" id="f-group" value="" placeholder="np. 123456789" maxlength="30" />
      <p class="hint">Te dwa pola trafiają tylko do brief.json (dla IT do wpisu w KV) — nie na stronę.</p>
    </fieldset>

    <div id="panel-error"></div>
    <div class="actions">
      <button id="btn-brief" type="button">Pobierz brief.json</button>
      <button id="btn-page" type="button">Pobierz stronę</button>
    </div>
  </div>
  <div class="prev"><iframe id="preview" title="Podgląd landingu"></iframe></div>
</div>

<script>window.__LME_CSS__ = ${JSON.stringify(landingCss)};</script>
<script>
${libs}
</script>
<script>
${PANEL_JS}
</script>
</body>
</html>
`;

const outPath = path.join(ROOT, "panel", "intake.html");
fs.writeFileSync(outPath, html, "utf8");
console.log(`Panel wygenerowany: panel/intake.html (${(html.length / 1024).toFixed(0)} KB)`);
