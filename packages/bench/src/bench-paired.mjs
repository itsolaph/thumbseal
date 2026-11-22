/**
 * Paired benchmark: bundled 3-mode authorizeAction (k=18, commit 87e2466) vs the split hot path (k=17).
 * Runs alternate on the same proof server so host load hits both sides equally.
 * Build the baseline first: npm --workspace @thumbseal/bench run baseline:compile
 * Licensed under the Apache License, Version 2.0.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createCircuitContext, createConstructorContext, sampleContractAddress } from '@midnight-ntwrk/compact-runtime';
import { proofDataIntoSerializedPreimage } from '@midnight-ntwrk/ledger-v9';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { computeRpIdHash, createThumbSealWitnesses, deriveActionTag, deriveChallenge, deriveScopeId, DOMAIN_TAGS, utf8ToBytes, VirtualPasskeyAuthenticator } from '@thumbseal/sdk';
import { computePasskeyCommitment, ThumbSealVault } from '@thumbseal/contracts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OLD_DIR = process.env.BASELINE_DIR || path.resolve(HERE, '../.baseline/managed/thumbseal-vault');
const NEW_DIR = path.resolve(HERE, '../../contracts/src/managed/thumbseal-vault');
const Old = await import(path.join(OLD_DIR, 'contract/index.js'));
const URL_ = process.env.PROOF_SERVER_URL || 'http://127.0.0.1:6300';
const RESULTS_DIR = path.resolve(HERE, '../results');
const RP_ID = 'thumbseal.pages.dev';
const ORIGIN = 'https://thumbseal.pages.dev';
const RP_ID_HASH = computeRpIdHash(RP_ID);
const ORIGIN_BYTES = utf8ToBytes(ORIGIN);
const ROUNDS = Number(process.env.ROUNDS || 3);

async function oneProve(mod, dir, tag) {
  const caller = '0'.repeat(64);
  const addr = sampleContractAddress();
  const c = new mod.Contract(createThumbSealWitnesses(computePasskeyCommitment));
  const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
  const init = await c.initialState(createConstructorContext({ credential: alice.credential }, caller), RP_ID_HASH, ORIGIN_BYTES, false);
  const state = init.currentContractState;
  const reg = await c.circuits.registerPasskey(createCircuitContext({ circuitId: 'registerPasskey', contractAddress: addr, coinPublicKeyOrZswapState: caller, contractState: state.data, privateState: { credential: alice.credential } }));
  state.data = reg.context.callContext.currentQueryContext.state;
  const scope = deriveScopeId('bench:paired:' + tag);
  const act = deriveActionTag('bench:vote:yes');
  const chal = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope, act);
  const sig = alice.signAssertion({ challenge: chal, clientDataMode: 0n });
  const res = await c.circuits.authorizeAction(createCircuitContext({ circuitId: 'authorizeAction', contractAddress: addr, coinPublicKeyOrZswapState: caller, contractState: state.data, privateState: { credential: alice.credential, pendingAssertion: sig.witness } }), scope, act, true);
  const pd = res.context.callProofDataTrace.at(-1);
  const pre = proofDataIntoSerializedPreimage(pd.input, pd.output, pd.publicTranscript, pd.privateTranscriptOutputs, 'authorizeAction');
  const prover = httpClientProvingProvider(URL_, new NodeZkConfigProvider(dir));
  await prover.check(pre, 'authorizeAction');
  const t0 = performance.now();
  await prover.prove(pre, 'authorizeAction');
  return Math.round(performance.now() - t0);
}

const out = { old: [], neu: [] };
for (let i = 0; i < ROUNDS; i++) {
  const o = await oneProve(Old, OLD_DIR, 'old' + i); out.old.push(o); console.log(`round ${i} old bundled: ${o} ms`);
  const n = await oneProve(ThumbSealVault, NEW_DIR, 'new' + i); out.neu.push(n); console.log(`round ${i} new split: ${n} ms`);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const report = {
  measuredAt: new Date().toISOString(),
  method: 'Alternating old/new proves of authorizeAction (standard clientDataJSON) on one proof-server:9.0.2 instance',
  baseline: { commit: '87e2466', k: 18, proverKeyMB: 448.05, proveMs: out.old, medianMs: median(out.old) },
  split: { k: 17, proverKeyMB: 224.04, proveMs: out.neu, medianMs: median(out.neu) },
  pairRatios: out.old.map((o, i) => Number((o / out.neu[i]).toFixed(2))),
  medianSpeedup: Number((median(out.old) / median(out.neu)).toFixed(2)),
};
await fs.mkdir(RESULTS_DIR, { recursive: true });
await fs.writeFile(path.join(RESULTS_DIR, 'paired-bundled-vs-split.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
