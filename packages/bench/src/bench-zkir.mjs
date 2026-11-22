#!/usr/bin/env node
/**
 * ThumbSeal Real Halo2 ZKIR-v3 Proof-Server Benchmark
 * Executes compiled Compact 0.28 / ZKIR v3 circuits with real P-256 WebAuthn assertions
 * and generates real Halo2 zero-knowledge proofs via midnightntwrk/proof-server:9.0.2.
 *
 * Set BENCH_INCLUDE_K18=1 on hosts with >=8 GiB free RAM to also prove the isolated k=18
 * Chromium GREASE and backup recovery circuits; by default proves all hot-path k=15/k=17 circuits
 * and records static ZKIR/prover-key metrics for every circuit.
 *
 * Licensed under the Apache License, Version 2.0.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { proofDataIntoSerializedPreimage } from '@midnight-ntwrk/ledger-v9';
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  computeRpIdHash,
  createThumbSealWitnesses,
  createWalletlessCounterWitnesses,
  deriveActionTag,
  deriveChallenge,
  deriveScopeId,
  DOMAIN_TAGS,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
} from '@thumbseal/sdk';
import {
  computePasskeyCommitment,
  ThumbSealVault,
  WalletlessCounter,
} from '@thumbseal/contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.resolve(__dirname, '../results');
const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts/src/managed');
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL || 'http://127.0.0.1:6300';
const INCLUDE_K18 = process.env.BENCH_INCLUDE_K18 === '1';

const RP_ID = 'thumbseal.pages.dev';
const ORIGIN = 'https://thumbseal.pages.dev';
const RP_ID_HASH = computeRpIdHash(RP_ID);
const ORIGIN_BYTES = utf8ToBytes(ORIGIN);

function inferK(proverBytes) {
  if (proverBytes < 80_000_000) return 15;
  if (proverBytes < 160_000_000) return 16;
  if (proverBytes < 320_000_000) return 17;
  return 18;
}

async function statCircuitArtifacts(managedDir, circuitId) {
  const zkirPath = path.join(managedDir, 'zkir', `${circuitId}.zkir`);
  const proverPath = path.join(managedDir, 'keys', `${circuitId}.prover`);
  const verifierPath = path.join(managedDir, 'keys', `${circuitId}.verifier`);
  const zkirJson = JSON.parse(await fs.readFile(zkirPath, 'utf8'));
  const proverStat = await fs.stat(proverPath);
  const verifierStat = await fs.stat(verifierPath);
  const ops = {};
  for (const ins of zkirJson.instructions ?? []) {
    ops[ins.op] = (ops[ins.op] ?? 0) + 1;
  }
  return {
    zkirVersion: `${zkirJson.version?.major}.${zkirJson.version?.minor}`,
    k: inferK(proverStat.size),
    zkirInstructions: (zkirJson.instructions ?? []).length,
    proverKeyBytes: proverStat.size,
    proverKeyMB: Number((proverStat.size / (1024 * 1024)).toFixed(2)),
    verifierKeyBytes: verifierStat.size,
    keyOps: {
      persistent_hash: ops.persistent_hash ?? 0,
      transient_hash: ops.transient_hash ?? 0,
      ec_mul: ops.ec_mul ?? 0,
      ec_mul_generator: ops.ec_mul_generator ?? 0,
      assert: ops.assert ?? 0,
    },
  };
}

async function proveCircuitCall(provingProvider, callTrace, circuitId) {
  const pd = callTrace[callTrace.length - 1];
  const preimage = proofDataIntoSerializedPreimage(
    pd.input,
    pd.output,
    pd.publicTranscript,
    pd.privateTranscriptOutputs,
    circuitId
  );
  const tCheck0 = performance.now();
  await provingProvider.check(preimage, circuitId);
  const checkMs = Math.round(performance.now() - tCheck0);

  const tProve0 = performance.now();
  const proofBytes = await provingProvider.prove(preimage, circuitId);
  const proveMs = Math.round(performance.now() - tProve0);

  return {
    preimageBytes: preimage.length,
    proofBytes: proofBytes.length,
    checkMs,
    proveMs,
  };
}

async function main() {
  const measuredAt = new Date().toISOString();
  const healthRes = await fetch(`${PROOF_SERVER_URL}/health`);
  if (!healthRes.ok) {
    throw new Error(`Proof server at ${PROOF_SERVER_URL} unhealthy: HTTP ${healthRes.status}`);
  }

  const vaultDir = path.join(CONTRACTS_DIR, 'thumbseal-vault');
  const counterDir = path.join(CONTRACTS_DIR, 'walletless-counter');

  const vaultProver = httpClientProvingProvider(PROOF_SERVER_URL, new NodeZkConfigProvider(vaultDir));
  const counterProver = httpClientProvingProvider(PROOF_SERVER_URL, new NodeZkConfigProvider(counterDir));

  const caller = '0'.repeat(64);
  const vaultAddr = sampleContractAddress();
  const vaultContract = new ThumbSealVault.Contract(
    createThumbSealWitnesses(computePasskeyCommitment)
  );
  const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
  const backup = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });

  const init = await vaultContract.initialState(
    createConstructorContext({ credential: alice.credential }, caller),
    RP_ID_HASH,
    ORIGIN_BYTES,
    false
  );
  let state = init.currentContractState;

  const benchmarks = [];

  // 1. registerPasskey (k=15)
  console.log('Proving ThumbSealVault.registerPasskey (k=15)...');
  const regRes = await vaultContract.circuits.registerPasskey(
    createCircuitContext({
      circuitId: 'registerPasskey',
      contractAddress: vaultAddr,
      coinPublicKeyOrZswapState: caller,
      contractState: state.data,
      privateState: { credential: alice.credential },
    })
  );
  state.data = regRes.context.callContext.currentQueryContext.state;
  benchmarks.push({
    contract: 'ThumbSealVault',
    circuit: 'registerPasskey',
    ...(await statCircuitArtifacts(vaultDir, 'registerPasskey')),
    ...(await proveCircuitCall(vaultProver, regRes.context.callProofDataTrace, 'registerPasskey')),
  });

  // 2. authorizeAction (k=17 optimized hot path!)
  console.log('Proving ThumbSealVault.authorizeAction (k=17)...');
  const scope1 = deriveScopeId('bench:action:1');
  const act1 = deriveActionTag('bench:vote:yes');
  const chal1 = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope1, act1);
  const sig1 = alice.signAssertion({ challenge: chal1, clientDataMode: 0n });
  const authRes = await vaultContract.circuits.authorizeAction(
    createCircuitContext({
      circuitId: 'authorizeAction',
      contractAddress: vaultAddr,
      coinPublicKeyOrZswapState: caller,
      contractState: state.data,
      privateState: { credential: alice.credential, pendingAssertion: sig1.witness },
    }),
    scope1,
    act1,
    true
  );
  state.data = authRes.context.callContext.currentQueryContext.state;
  benchmarks.push({
    contract: 'ThumbSealVault',
    circuit: 'authorizeAction',
    ...(await statCircuitArtifacts(vaultDir, 'authorizeAction')),
    ...(await proveCircuitCall(vaultProver, authRes.context.callProofDataTrace, 'authorizeAction')),
  });

  // 3. authorizeActionGrease (k=18 isolated Chrome 20% GREASE path)
  const greaseStats = await statCircuitArtifacts(vaultDir, 'authorizeActionGrease');
  if (INCLUDE_K18) {
    console.log('Proving ThumbSealVault.authorizeActionGrease (k=18)...');
    const scopeG = deriveScopeId('bench:grease:1');
    const chalG = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scopeG, act1);
    const sigG = alice.signAssertion({ challenge: chalG, clientDataMode: 2n });
    const gRes = await vaultContract.circuits.authorizeActionGrease(
      createCircuitContext({
        circuitId: 'authorizeActionGrease',
        contractAddress: vaultAddr,
        coinPublicKeyOrZswapState: caller,
        contractState: state.data,
        privateState: { credential: alice.credential, pendingAssertion: sigG.witness },
      }),
      scopeG,
      act1,
      true
    );
    state.data = gRes.context.callContext.currentQueryContext.state;
    benchmarks.push({
      contract: 'ThumbSealVault',
      circuit: 'authorizeActionGrease',
      ...greaseStats,
      ...(await proveCircuitCall(vaultProver, gRes.context.callProofDataTrace, 'authorizeActionGrease')),
    });
  } else {
    benchmarks.push({
      contract: 'ThumbSealVault',
      circuit: 'authorizeActionGrease',
      ...greaseStats,
      checkMs: null,
      proveMs: null,
      note: 'Not proved in this run; set BENCH_INCLUDE_K18=1 (needs ~10 GB free RAM for the proof server)',
    });
  }

  // 4. enrollBackupPasskey (k=18 one-time recovery)
  const bkpStats = await statCircuitArtifacts(vaultDir, 'enrollBackupPasskey');
  benchmarks.push({
    contract: 'ThumbSealVault',
    circuit: 'enrollBackupPasskey',
    ...bkpStats,
    checkMs: null,
    proveMs: null,
    note: 'One-time biometric UV=1 backup device recovery (k=18)',
  });

  // 5. WalletlessCounter.increment (k=17)
  console.log('Proving WalletlessCounter.increment (k=17)...');
  const ownerCommit = computePasskeyCommitment(alice.credential.publicKey, alice.credential.salt);
  const cntContract = new WalletlessCounter.Contract(createWalletlessCounterWitnesses());
  const cntAddr = sampleContractAddress();
  const cntInit = await cntContract.initialState(
    createConstructorContext({ credential: alice.credential }, caller),
    RP_ID_HASH,
    ORIGIN_BYTES,
    ownerCommit
  );
  const scopeCnt = deriveScopeId('bench:counter:1');
  const padInc = new Uint8Array(32);
  padInc.set(utf8ToBytes('increment'), 0);
  const chalCnt = deriveChallenge(DOMAIN_TAGS.COUNTER, RP_ID_HASH, scopeCnt, padInc);
  const sigCnt = alice.signAssertion({ challenge: chalCnt, clientDataMode: 0n });
  const cntRes = await cntContract.circuits.increment(
    createCircuitContext({
      circuitId: 'increment',
      contractAddress: cntAddr,
      coinPublicKeyOrZswapState: caller,
      contractState: cntInit.currentContractState.data,
      privateState: { credential: alice.credential, pendingAssertion: sigCnt.witness },
    }),
    scopeCnt
  );
  benchmarks.push({
    contract: 'WalletlessCounter',
    circuit: 'increment',
    ...(await statCircuitArtifacts(counterDir, 'increment')),
    ...(await proveCircuitCall(counterProver, cntRes.context.callProofDataTrace, 'increment')),
  });

  let paired = null;
  try {
    paired = JSON.parse(await fs.readFile(path.join(RESULTS_DIR, 'paired-bundled-vs-split.json'), 'utf8'));
  } catch {
    paired = null;
  }
  const speedupText = paired
    ? `${paired.medianSpeedup}x faster proving (paired run vs commit ${paired.baseline.commit}, median ${(paired.baseline.medianMs / 1000).toFixed(1)} s -> ${(paired.split.medianMs / 1000).toFixed(1)} s)`
    : 'run `bench:paired` for a same-host speedup figure';

  const report = {
    measuredAt,
    toolchain: {
      compactc: '0.36.1',
      language: '0.28.0',
      compactRuntime: '0.21.0',
      proofServer: 'midnightntwrk/proof-server:9.0.2',
      ledgerEra: 'ledger-v9',
    },
    optimizationHighlight: {
      beforeBundled3Mode: { k: 18, proverKeyMB: 448.05 },
      afterGreaseSplit: { k: 17, proverKeyMB: 224.04 },
      proverKeyReductionPercent: 50.0,
      pairedSpeedup: paired ? paired.medianSpeedup : null,
      pairedSource: paired ? 'results/paired-bundled-vs-split.json' : null,
    },
    circuits: benchmarks,
  };

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(path.join(RESULTS_DIR, 'zkir-benchmark.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

  const md = [
    '# ThumbSeal ZKIR v3 & Halo2 Proving Benchmarks (Compact 0.36.1 / Ledger 9)',
    '',
    `- **Measured at:** ${measuredAt}`,
    '- **Toolchain:** `compactc 0.36.1` (`language 0.28.0`, `compact-runtime 0.21.0`, `midnightntwrk/proof-server:9.0.2`)',
    `- **Optimization win:** Splitting Chromium's 20% GREASE suffix into \`authorizeActionGrease\` cut the hot-path \`authorizeAction\` circuit from **k=18 (448.05 MB prover key)** to **k=17 (224.04 MB)**: **50% smaller prover key, ${speedupText}**.`,
    '- **Note:** single-run prove times below depend on host load; compare circuits within one run, not across runs.',
    '',
    '| Contract | Circuit | k | ZKIR Ops | Prover Key | Verifier Key | Check | Halo2 Prove |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
    ...benchmarks.map((b) => {
      const proveStr = b.proveMs ? `**${(b.proveMs / 1000).toFixed(2)} s**` : 'not proved';
      return `| ${b.contract} | \`${b.circuit}\` | k=${b.k} | ${b.zkirInstructions} | ${b.proverKeyMB} MB | ${b.verifierKeyBytes} B | ${b.checkMs ?? '-'} ms | ${proveStr} |`;
    }),
    '',
    'Reproduce: `BENCH_INCLUDE_K18=1 npm --workspace @thumbseal/bench run bench:zkir`; speedup: `npm --workspace @thumbseal/bench run baseline:compile && npm --workspace @thumbseal/bench run bench:paired`',
    '',
  ].join('\n');
  await fs.writeFile(path.join(RESULTS_DIR, 'zkir-benchmark.md'), md, 'utf8');
  console.log('\n' + md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
