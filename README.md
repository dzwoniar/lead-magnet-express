# Lead Magnet Express

Generator landing page z briefu JSON i logo SVG oraz opcjonalny Cloudflare Worker zapisujący subskrybenta w MailerLite. Projekt pokazuje zamianę konfiguracji w samodzielny plik HTML i granicę między demonstracją formularza a integracją API.

**Status: prototyp.** Przykład ma pusty endpoint i działa bez wysyłki danych. Repozytorium zawiera syntetyczne logo, brief i plik do pobrania; nie zawiera kluczy usług ani danych subskrybentów.

## Uruchomienie

Node.js 22+; CI używa Node 24. Brak zależności npm, więc instalacja nie jest potrzebna.

```sh
npm test
npm run build
npm run panel
```

Otwórz `output/checklista-przyklad/index.html` lub `panel/intake.html`. CLI: `node src/buildFunnel.mjs briefs/przyklad.json`. Slug musi zawierać małe litery, cyfry i myślniki; nazwa pliku pobrania nie może zawierać ścieżki. Brief i SVG są zaufanym wejściem operatora.

## Architektura

| Ścieżka | Odpowiedzialność |
| --- | --- |
| [src/buildFunnel.mjs](src/buildFunnel.mjs) | Brief, logo, tokeny kolorów i zapis plików |
| [src/lib/deriveTokens.js](src/lib/deriveTokens.js) | Wyprowadzenie palety i kontrastów z logo |
| [src/lib/renderLanding.js](src/lib/renderLanding.js) | HTML, walidacja formularza i widok podziękowania |
| [worker/worker.mjs](worker/worker.mjs) | Walidacja, honeypot, serwerowa kontrola zgody i MailerLite |
| [test/smoke-worker.mjs](test/smoke-worker.mjs) | Test integracji z atrapami fetch i KV, bez wysyłki |
| [test/security.test.cjs](test/security.test.cjs) | Brak zgody, niepoprawny typ JSON i próby wyjścia poza ścieżkę outputu |

Przeglądarka przekazuje `funnel`, dane formularza i zgodę do Workera. Worker odczytuje konfigurację z KV `FUNNELS`; klucz API pobiera z sekretu `ML_KEY_<ACCOUNT>`. Klucz nigdy nie jest częścią HTML. Formularz bez endpointu tylko przełącza widok.

## Konfiguracja integracji

[worker/wrangler.toml](worker/wrangler.toml) wymaga własnego bindingu KV. Dla wybranego konta ustaw sekret przez `wrangler secret put`, a w KV dodaj konfigurację `{ "account": "demo", "groupId": "twoja-grupa" }`. Następnie ustaw endpoint w swoim briefie. Nie zapisuj realnych sekretów, identyfikatorów kont ani baz odbiorców w repozytorium.

## Ograniczenia

Worker nie ma współdzielonego rate limitu ani kompletnej ochrony antyspamowej; CORS jest otwarty i nie stanowi mechanizmu uwierzytelnienia. Przed uruchomieniem dla rzeczywistych odbiorców potrzebne są kontrola nadużyć, konfiguracja dozwolonych źródeł i własne zasady przetwarzania danych. Awaria integracji może zapisać dane kontaktowe w prywatnym KV z TTL 72 h. Nie publikuj eksportów KV.

Materiał do pobrania leży obok HTML, więc jego adres nie jest chroniony logowaniem. Testy korzystają wyłącznie z atrap usług. CI nie wdraża Workera ani strony.
