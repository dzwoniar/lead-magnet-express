// renderLanding.js — landing lead magnetu z briefu (slot-fill). UMD: Node + przegladarka.
// render(brief, logoSrc, tokens, opts):
//   opts.inlineCss (string) -> wklej base+landing CSS inline (samowystarczalny plik, dziala z file:///srcdoc);
//   tokens -> obiekt z deriveTokens.finalize() (brand/accent/on-* z logo).
(function (root) {
  "use strict";
  const dt = (typeof require === "function") ? require("./deriveTokens") : (root.OG && root.OG.deriveTokens);
  const { tokensCss } = dt;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const ICON = {
    check: '<svg class="point-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
    party: '<svg class="thanks-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
  };

  function render(brief, logoSrc, tokens, opts) {
    opts = opts || {};
    const brand = brief.brand || {};
    const form = brief.form || {};
    const thanks = brief.thankyou || {};
    const delivery = brief.delivery || {};
    const bullets = (brief.bullets || []).map((b) => `<li>${ICON.check} ${esc(b)}</li>`).join("\n          ");

    const rodoText = brief.rodoText || "Wyrażam zgodę na przetwarzanie moich danych w celu otrzymania materiału i informacji od nadawcy.";
    const rodoHtml = brief.privacyUrl
      ? `${esc(rodoText)} <a href="${esc(brief.privacyUrl)}" target="_blank" rel="noopener">Polityka prywatności</a>.`
      : esc(rodoText);

    const downloadBtn = delivery.mode === "download" && delivery.file
      ? `<a class="btn btn-primary with-arrow" id="lm-download" href="${esc(delivery.file)}" download>${esc(thanks.buttonLabel || "Pobierz materiał")} <span class="arrow">→</span></a>`
      : "";

    const thanksBody = brief.doubleOptin
      ? esc(thanks.doubleOptinBody || "Sprawdź skrzynkę i potwierdź zapis — a materiał czeka na Ciebie poniżej.")
      : esc(thanks.body || "Materiał jest gotowy do pobrania poniżej.");

    const tokenStyle = tokens ? `<style>${tokensCss(tokens, brand.name || "", "")}</style>` : "";
    const cssHead = opts.inlineCss
      ? `<style>${opts.inlineCss}</style>${tokenStyle}`
      : `<link rel="stylesheet" href="base.css" />
  <link rel="stylesheet" href="landing.css" />${tokenStyle ? "\n  " + tokenStyle : ""}`;

    const cfg = {
      endpoint: brief.endpoint || "",
      funnel: brief.slug || "",
    };

    return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(brief.h1 || brand.name || "Lead magnet")}</title>
  <meta name="description" content="${esc(brief.sub || brief.h1 || "")}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  ${cssHead}
</head>
<body>
  <header class="site-header">
    <div class="container">
      <img class="brand-logo" src="${esc(logoSrc)}" alt="${esc(brand.name || "logo")}" />
    </div>
  </header>

  <section class="hero">
    <span class="drop" aria-hidden="true"></span>
    <span class="drop2" aria-hidden="true"></span>
    <div class="container">
      <div class="hero-copy">
        ${brief.kicker ? `<p class="hero-kicker">${esc(brief.kicker)}</p>` : ""}
        <h1>${esc(brief.h1 || "")}</h1>
        ${brief.sub ? `<p class="hero-sub">${esc(brief.sub)}</p>` : ""}
        <ul class="hero-points">
          ${bullets}
        </ul>
      </div>

      <div class="card lead-card">
        <div class="card-body">
          <form id="lm-form" novalidate>
            <h2>${esc(form.title || "Odbierz za darmo")}</h2>
            <p class="sub">${esc(form.sub || "Wpisz dane, a materiał wyląduje u Ciebie od razu.")}</p>
            <div class="form-error" id="lm-error" role="alert"></div>
            <input class="field" type="text" name="name" placeholder="${esc(form.nameLabel || "Imię")}" autocomplete="given-name" />
            <input class="field" type="email" name="email" placeholder="${esc(form.emailLabel || "E-mail")}" autocomplete="email" required />
            <div class="hp-field" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" /></div>
            <label class="rodo"><input type="checkbox" name="rodo" /><span>${rodoHtml}</span></label>
            <button class="btn btn-primary with-arrow" type="submit">${esc(form.submit || "Wysyłam")} <span class="arrow">→</span></button>
          </form>
          <div class="thanks" id="lm-thanks">
            ${ICON.party}
            <h2>${esc(thanks.title || "Gotowe!")}</h2>
            <p>${thanksBody}</p>
            ${downloadBtn}
          </div>
        </div>
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <span>© ${esc(brand.name || "")}</span>
      ${brief.privacyUrl ? `<a href="${esc(brief.privacyUrl)}" target="_blank" rel="noopener">Polityka prywatności</a>` : ""}
    </div>
  </footer>

  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var form = document.getElementById("lm-form");
    var thanksEl = document.getElementById("lm-thanks");
    var errEl = document.getElementById("lm-error");
    if (!form) return;

    function showError(msg) { errEl.textContent = msg; errEl.classList.add("show"); }
    function clearError() { errEl.textContent = ""; errEl.classList.remove("show"); }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearError();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var hp = form.elements.website.value;
      var rodo = form.elements.rodo.checked;
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { showError("Podaj poprawny adres e-mail."); return; }
      if (!rodo) { showError("Zaznacz zgodę na przetwarzanie danych."); return; }
      if (!CFG.endpoint) { form.style.display = "none"; thanksEl.classList.add("show"); return; }

      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      var prev = btn.innerHTML;
      btn.textContent = "Wysyłam…";

      fetch(CFG.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ funnel: CFG.funnel, name: name, email: email, website: hp, rodo: rodo }),
      }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { ok: res.ok && d.ok, data: d }; }); })
        .then(function (r) {
          if (r.ok) { form.style.display = "none"; thanksEl.classList.add("show"); }
          else { showError((r.data && r.data.error) || "Coś poszło nie tak — spróbuj za chwilę."); btn.disabled = false; btn.innerHTML = prev; }
        })
        .catch(function () { showError("Brak połączenia — spróbuj za chwilę."); btn.disabled = false; btn.innerHTML = prev; });
    });
  })();
  </script>
</body>
</html>
`;
  }

  const api = { render };
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.OG = root.OG || {}; root.OG.renderLanding = api; }
})(typeof self !== "undefined" ? self : this);
