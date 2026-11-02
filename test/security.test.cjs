const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

test('subscription without consent cannot reach MailerLite', async () => {
  const { default: worker } = await import('../worker/worker.mjs');
  let calls = 0;
  const response = await worker.fetch(new Request('https://example.invalid/subscribe', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ funnel: 'demo', email: 'test@example.invalid', rodo: false }),
  }), { FUNNELS: { get: async () => { calls++; return null; } } });
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('non-object JSON returns 400 without accessing subscriptions', async () => {
  const { default: worker } = await import('../worker/worker.mjs');
  let calls = 0;
  for (const body of [null, [], true, 42, 'demo']) {
    const response = await worker.fetch(new Request('https://example.invalid/subscribe', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), { FUNNELS: { get: async () => { calls++; return null; } } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
  }
  assert.equal(calls, 0);
});

test('build rejects traversal before accessing assets or writing output', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lme-security-'));
  try {
    for (const brief of [{ slug: '../escape' }, { slug: 'safe', delivery: { file: '../../escape.txt' } }]) {
      const filename = path.join(dir, 'brief.json');
      writeFileSync(filename, JSON.stringify(brief));
      const result = spawnSync(process.execPath, ['src/buildFunnel.mjs', filename], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.ok(!result.stderr.includes('Brak pliku logo'));
    }
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(dir).startsWith('lme-security-'));
    rmSync(dir, { recursive: true, force: true });
  }
});
