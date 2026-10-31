// smoke-worker.mjs — test dymny workera bez deployu (Node 18+: globalne Request/Response).
// Uruchom: npm test
import worker from "../worker/worker.mjs";

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

// Mock srodowiska
const kvPuts = [];
const env = {
  FUNNELS: {
    get: async (key, type) => (key === "demo" ? { account: "test", groupId: "42" } : null),
    put: async (key, value, opts) => { kvPuts.push({ key, value, opts }); },
  },
  ML_KEY_TEST: "fake-api-key",
};

// Przechwycenie fetch do MailerLite
let mlCalls = [];
let mlResponder = () => new Response(JSON.stringify({ data: { id: "1" } }), { status: 201 });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("connect.mailerlite.com")) {
    mlCalls.push({ url: String(url), init });
    return mlResponder();
  }
  return realFetch(url, init);
};

function post(body) {
  return new Request("https://lme.test/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rodo: true, ...body }),
  });
}

console.log("=== smoke-worker ===");

// 1. /health
{
  const res = await worker.fetch(new Request("https://lme.test/health"), env);
  const d = await res.json();
  check("GET /health -> ok", res.status === 200 && d.ok === true);
}

// 2. poprawny zapis -> ML wolane z dobrym payloadem
{
  mlCalls = [];
  const res = await worker.fetch(post({ funnel: "demo", name: "Jan", email: "jan@example.com", website: "" }), env);
  const d = await res.json();
  const sent = mlCalls[0] ? JSON.parse(mlCalls[0].init.body) : {};
  check("zapis -> 200 ok:true", res.status === 200 && d.ok === true);
  check("ML: email + grupa 42 + imie", sent.email === "jan@example.com" && sent.groups && sent.groups[0] === "42" && sent.fields && sent.fields.name === "Jan");
  check("ML: Bearer z sekretu konta", mlCalls[0].init.headers.authorization === "Bearer fake-api-key");
}

// 3. honeypot -> udawany sukces, ML NIE wolane
{
  mlCalls = [];
  const res = await worker.fetch(post({ funnel: "demo", email: "bot@spam.com", website: "http://spam" }), env);
  const d = await res.json();
  check("honeypot -> ok:true bez ML", d.ok === true && mlCalls.length === 0);
}

// 4. zly email -> 400
{
  const res = await worker.fetch(post({ funnel: "demo", email: "niepoprawny" }), env);
  const d = await res.json();
  check("zly email -> 400 ok:false", res.status === 400 && d.ok === false);
}

// 5. nieznany funnel -> 404
{
  const res = await worker.fetch(post({ funnel: "nie-ma", email: "a@b.pl" }), env);
  check("nieznany funnel -> 404", res.status === 404);
}

// 6. awaria ML -> 502 + wpis w logu awaryjnym (TTL 72h)
{
  mlResponder = () => new Response("boom", { status: 500 });
  kvPuts.length = 0;
  const res = await worker.fetch(post({ funnel: "demo", email: "a@b.pl" }), env);
  const d = await res.json();
  const failEntry = kvPuts.find((p) => p.key.startsWith("fail:"));
  check("awaria ML -> 502 ok:false", res.status === 502 && d.ok === false);
  check("log awaryjny w KV z TTL 72h", !!failEntry && failEntry.opts.expirationTtl === 259200);
}

// 7. OPTIONS (CORS preflight)
{
  const res = await worker.fetch(new Request("https://lme.test/subscribe", { method: "OPTIONS" }), env);
  check("OPTIONS -> 204 + CORS", res.status === 204 && res.headers.get("access-control-allow-origin") === "*");
}

globalThis.fetch = realFetch;
console.log(failures === 0 ? "WSZYSTKIE TESTY PASS" : `${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
