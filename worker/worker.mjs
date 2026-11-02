// worker.mjs — Cloudflare Worker LME: POST /subscribe -> subskrybent do grupy MailerLite.
// Zero zaleznosci. Konfiguracja:
//   KV binding FUNNELS: klucz = slug funnela, wartosc = {"account":"akademia","groupId":"123456"}
//   Sekrety: ML_KEY_<ACCOUNT> (np. ML_KEY_AKADEMIA) = klucz API MailerLite (connect API, Bearer).
// Honeypot: pole "website" wypelnione -> udajemy sukces (bot nie dostaje sygnalu).
// Awaria ML: wpis "fail:<ts>" w KV (TTL 72h, NFR-03) + {ok:false} dla klienta.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function readBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return request.json();
  const fd = await request.formData();
  return Object.fromEntries(fd.entries());
}

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ ok: false, error: "Niepoprawne dane." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Niepoprawne dane." }, 400);
  }

  // Honeypot (EC-08): udawany sukces.
  if (body.website) return json({ ok: true });

  if (!validEmail(body.email)) return json({ ok: false, error: "Podaj poprawny adres e-mail." }, 400);
  if (body.rodo !== true && body.rodo !== "on") return json({ ok: false, error: "Potwierdź zgodę na zapis." }, 400);
  if (!body.funnel || typeof body.funnel !== "string") return json({ ok: false, error: "Brak identyfikatora funnela." }, 400);

  const funnel = await env.FUNNELS.get(body.funnel, "json");
  if (!funnel || !funnel.account || !funnel.groupId) {
    return json({ ok: false, error: "Nieznany funnel." }, 404);
  }

  const apiKey = env["ML_KEY_" + String(funnel.account).toUpperCase()];
  if (!apiKey) return json({ ok: false, error: "Funnel nie jest skonfigurowany." }, 500);

  // MailerLite connect API: POST /subscribers = upsert (EC-03: duplikat -> aktualizacja, bez bledu).
  const payload = {
    email: body.email,
    groups: [String(funnel.groupId)],
  };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (name) payload.fields = { name };

  let mlRes;
  try {
    mlRes = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    await logFail(env, { funnel: body.funnel, email: body.email, name, reason: "fetch: " + String(err) });
    return json({ ok: false, error: "Chwilowy problem z zapisem — spróbuj za moment." }, 502);
  }

  if (mlRes.status === 200 || mlRes.status === 201) return json({ ok: true });

  const detail = await mlRes.text().catch(() => "");
  await logFail(env, { funnel: body.funnel, email: body.email, name, reason: `ML HTTP ${mlRes.status}: ${detail.slice(0, 300)}` });
  return json({ ok: false, error: "Chwilowy problem z zapisem — spróbuj za moment." }, 502);
}

async function logFail(env, entry) {
  // Log awaryjny (Flow C): retencja 72h, do recznego dosypania po awarii. Bez danych poza niezbednymi.
  const key = `fail:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  try {
    await env.FUNNELS.put(key, JSON.stringify({ ...entry, at: new Date().toISOString() }), { expirationTtl: 259200 });
  } catch {
    // KV niedostepne — nie blokujemy odpowiedzi.
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/health") return json({ ok: true });
    if (url.pathname === "/subscribe" && request.method === "POST") return handleSubscribe(request, env);
    return json({ ok: false, error: "Not found" }, 404);
  },
};
