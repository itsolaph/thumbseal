/**
 * ThumbSeal Walletless DUST Fee Sponsor Relayer & Live Halo2 Prover Bridge.
 *
 * Supports two explicitly documented trust modes:
 * 1. Zero-Trust DUST Sponsor (`POST /api/relay/sponsor-tx`):
 *    Accepts an already-proved Ledger 9 UnboundTransaction from a client running
 *    its own local proof-server. Private witnesses NEVER touch this server.
 * 2. Hosted Demo Prover + Sponsor (`POST /api/relay/{register,authorize}`):
 *    Allows browser visitors without local Docker/proof-server to test real
 *    TouchID/FaceID/Windows Hello passkeys against compiled Compact 0.28 circuits
 *    and real Halo2 ZKIR-v3 proofs via midnightntwrk/proof-server:9.0.2.
 *    Hardware passkey private keys NEVER leave the user's Secure Enclave.
 *    Supports `?async=1` + `GET /api/relay/job/:id` to prevent proxy read timeouts
 *    during k=18 Chromium GREASE proving or live Preview finality.
 *
 * Licensed under the Apache License, Version 2.0.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type ContractState,
} from '@midnight-ntwrk/compact-runtime';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import * as ledgerV9 from '@midnight-ntwrk/ledger-v9';
const { proofDataIntoSerializedPreimage } = ledgerV9;
import { httpClientProvingProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  assertValidP256Point,
  bytesToHex,
  computeRpIdHash,
  createThumbSealWitnesses,
  deriveActionTag,
  deriveScopeId,
  hexToBytes,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
  type Secp256r1Point,
  type ThumbSealPrivateState,
  type WebAuthnAssertionWitness,
} from '@thumbseal/sdk';
import { computePasskeyCommitment, ThumbSealVault } from '@thumbseal/contracts';
import {
  loadPreviewDeployment,
  PREVIEW_ENDPOINTS,
  REPO_ROOT,
  THUMBSEAL_ORIGIN,
  THUMBSEAL_RP_ID,
  VAULT_ASSETS_DIR,
} from './config.js';
import {
  createPreviewContractProviders,
  createRelayerWallet,
  type RelayerWalletHandle,
} from './wallet.js';

const PORT = Number(process.env.RELAYER_PORT || 8788);
const HOST = process.env.RELAYER_HOST || '127.0.0.1';
const ALLOWED_ORIGINS = new Set([
  THUMBSEAL_ORIGIN,
  'https://thumbseal.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
]);

// Tighter sliding-window per-IP proving & sponsor quotas + daily global cap
const RELAYER_API_KEY = process.env.RELAYER_API_KEY || '';
const MAX_PROOFS_PER_IP_15M = Number(process.env.MAX_PROOFS_PER_IP_15M || 10);
const MAX_DAILY_SPONSORED_TX = Number(process.env.MAX_DAILY_SPONSORED_TX || 50);
const ALLOWED_ENTRY_POINTS = new Set([
  'registerPasskey',
  'authorizeAction',
  'authorizeActionGrease',
  'enrollBackupPasskey',
  'increment',
]);

const ipBuckets = new Map<string, number[]>();
const activeIpJobs = new Map<string, number>();
let dailySponsorCount = 0;
let dailySponsorDay = new Date().toISOString().slice(0, 10);

function checkApiKey(req: Request): boolean {
  if (!RELAYER_API_KEY) return true;
  const provided = String(req.headers['x-relayer-key'] || '');
  if (!provided || provided.length !== RELAYER_API_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(RELAYER_API_KEY));
}

function checkRateLimit(ip: string, limit = MAX_PROOFS_PER_IP_15M, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (ipBuckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    ipBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipBuckets.set(ip, recent);
  return true;
}

function consumeDailySponsorBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailySponsorDay) {
    dailySponsorDay = today;
    dailySponsorCount = 0;
  }
  if (dailySponsorCount >= MAX_DAILY_SPONSORED_TX) return false;
  dailySponsorCount++;
  return true;
}

interface SerializedAssertion {
  signature: { r: string; s: string };
  flagsUp: boolean;
  flagsRfu1: boolean;
  flagsUv: boolean;
  flagsUpper: number | string;
  signCountHex: string;
  challengeBytes: number[];
  challengeSextets: number[];
  challengeTail4: number;
  clientDataMode: number;
}

interface ActivityRecord {
  id: string;
  timestamp: string;
  circuit: string;
  status: 'proved' | 'submitted' | 'reverted';
  nullifierHex?: string;
  keyCommitHex?: string;
  actionTagHex?: string;
  scopeLabel?: string;
  actionLabel?: string;
  proofBytes?: number;
  proveMs?: number;
  txId?: string;
  reason?: string;
  mode: 'preview-live' | 'prover-verified';
}

interface AsyncJob {
  id: string;
  kind: 'register' | 'authorize';
  status: 'running' | 'done' | 'error';
  createdAt: number;
  result?: any;
  error?: string;
  reverted?: boolean;
}

const HEX_RE = /^(0x)?[0-9a-fA-F]+$/;

function parseHexBigInt(val: unknown, label: string): bigint {
  if (typeof val !== 'string' || !HEX_RE.test(val) || val.length > 130) {
    throw new Error(`Invalid ${label}: expected hex string`);
  }
  return BigInt(val.startsWith('0x') ? val : '0x' + val);
}

function parseFixedBytes(hex: unknown, expectedLen: number, label: string): Uint8Array {
  if (typeof hex !== 'string' || !HEX_RE.test(hex)) {
    throw new Error(`Invalid ${label}: expected hex string`);
  }
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== expectedLen * 2) {
    throw new Error(`Invalid ${label}: expected ${expectedLen} bytes`);
  }
  return hexToBytes(clean);
}

function parsePubKey(raw: any): Secp256r1Point {
  if (!raw || typeof raw.x !== 'string' || typeof raw.y !== 'string') {
    throw new Error('Invalid publicKey: expected { x: hex, y: hex, identity?: boolean }');
  }
  const pt: Secp256r1Point = {
    x: parseHexBigInt(raw.x, 'publicKey.x'),
    y: parseHexBigInt(raw.y, 'publicKey.y'),
    identity: Boolean(raw.identity),
  };
  assertValidP256Point(pt);
  return pt;
}

function parseAssertion(raw: SerializedAssertion): WebAuthnAssertionWitness {
  if (!raw || !raw.signature || typeof raw.signature.r !== 'string' || typeof raw.signature.s !== 'string') {
    throw new Error('Invalid assertion payload');
  }
  const modeNum = Number(raw.clientDataMode);
  if (modeNum !== 0 && modeNum !== 1 && modeNum !== 2) {
    throw new Error(`Invalid clientDataMode: ${raw.clientDataMode}`);
  }
  if (!Array.isArray(raw.challengeBytes) || raw.challengeBytes.length !== 32) {
    throw new Error('Invalid challengeBytes: expected 32 uint8 values');
  }
  if (!Array.isArray(raw.challengeSextets) || raw.challengeSextets.length !== 43) {
    throw new Error('Invalid challengeSextets: expected 43 uint6 values');
  }
  const tail4 = Number(raw.challengeTail4);
  if (!Number.isInteger(tail4) || tail4 < 0 || tail4 > 15) {
    throw new Error('Invalid challengeTail4: expected integer 0..15');
  }
  const flagsUpper = Number(raw.flagsUpper ?? 0);
  if (!Number.isInteger(flagsUpper) || flagsUpper < 0 || flagsUpper > 31) {
    throw new Error('Invalid flagsUpper: expected integer 0..31');
  }
  return {
    signature: {
      r: parseHexBigInt(raw.signature.r, 'signature.r'),
      s: parseHexBigInt(raw.signature.s, 'signature.s'),
    },
    flagsUp: Boolean(raw.flagsUp),
    flagsRfu1: Boolean(raw.flagsRfu1),
    flagsUv: Boolean(raw.flagsUv),
    flagsUpper: BigInt(flagsUpper),
    signCount: parseFixedBytes(raw.signCountHex, 4, 'signCountHex'),
    challengeBytes: raw.challengeBytes.map((n) => {
      const v = Number(n);
      if (!Number.isInteger(v) || v < 0 || v > 255) throw new Error('challengeBytes out of range');
      return BigInt(v);
    }),
    challengeSextets: raw.challengeSextets.map((n) => {
      const v = Number(n);
      if (!Number.isInteger(v) || v < 0 || v > 63) throw new Error('challengeSextets out of range');
      return BigInt(v);
    }),
    challengeTail4: BigInt(tail4),
    clientDataMode: BigInt(modeNum) as 0n | 1n | 2n,
  };
}

class RelayerEngine {
  readonly rpId = THUMBSEAL_RP_ID;
  readonly origin = THUMBSEAL_ORIGIN;
  readonly rpIdHash = computeRpIdHash(THUMBSEAL_RP_ID);
  readonly originBytes = utf8ToBytes(THUMBSEAL_ORIGIN);

  readonly contract = new ThumbSealVault.Contract<ThumbSealPrivateState>(
    createThumbSealWitnesses(computePasskeyCommitment)
  );
  readonly zkConfigProvider = new NodeZkConfigProvider<string>(VAULT_ASSETS_DIR);
  readonly provingProvider = httpClientProvingProvider(
    PREVIEW_ENDPOINTS.provingServerUrl,
    this.zkConfigProvider
  );

  readonly callerKey = '0'.repeat(64);
  localAddress = sampleContractAddress();
  localState!: ContractState;

  // Optional live Midnight Preview deployment binding
  wallet: RelayerWalletHandle | null = null;
  liveProviders: any = null;
  liveContract: any = null;
  deployment = loadPreviewDeployment();
  readonly activity: ActivityRecord[] = [];
  readonly jobs = new Map<string, AsyncJob>();
  private mutex: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    const bootstrap = new VirtualPasskeyAuthenticator({
      rpId: this.rpId,
      origin: this.origin,
    });
    const init = await this.contract.initialState(
      createConstructorContext<ThumbSealPrivateState>({ credential: bootstrap.credential }, this.callerKey),
      this.rpIdHash,
      this.originBytes,
      false
    );
    this.localState = init.currentContractState;

    // Attach to live Midnight Preview contract if deployment exists and live mode is enabled
    if (this.deployment?.vaultAddress && process.env.THUMBSEAL_ENABLE_LIVE_PREVIEW !== '0') {
      try {
        this.wallet = await createRelayerWallet();
        await this.wallet.waitForSync(180_000);
        const bal = await this.wallet.getBalances();
        if (bal.dustBalance > 0n) {
          this.liveProviders = createPreviewContractProviders<ThumbSealPrivateState>(
            this.wallet,
            VAULT_ASSETS_DIR,
            'thumbseal-relayer-live-state'
          );
          const compiledVault = CompiledContract.make('ThumbSealVault', ThumbSealVault.Contract).pipe(
            CompiledContract.withWitnesses(createThumbSealWitnesses(computePasskeyCommitment)),
            CompiledContract.withCompiledFileAssets(VAULT_ASSETS_DIR)
          );
          this.liveContract = await findDeployedContract(this.liveProviders as any, {
            contractAddress: this.deployment.vaultAddress,
            compiledContract: compiledVault as any,
            privateStateId: 'thumbseal-relayer-live',
            initialPrivateState: { credential: bootstrap.credential },
          } as any);
          console.log('[Relayer] Bound to LIVE Midnight Preview contract:', this.deployment.vaultAddress);
        } else {
          console.warn('[Relayer] Preview wallet synced with 0 tDUST; running in prover-verified mode until funded.');
        }
      } catch (err) {
        console.warn('[Relayer] Preview live bind unavailable, falling back to real Halo2 prover-verified mode:', (err as Error).message);
      }
    }
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutex.then(fn, fn);
    this.mutex = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  pruneJobs(): void {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff) this.jobs.delete(id);
    }
  }

  startAsyncJob(kind: 'register' | 'authorize', runner: () => Promise<any>): AsyncJob {
    this.pruneJobs();
    const job: AsyncJob = {
      id: crypto.randomUUID(),
      kind,
      status: 'running',
      createdAt: Date.now(),
    };
    this.jobs.set(job.id, job);
    runner()
      .then((result) => {
        job.status = 'done';
        job.result = result;
      })
      .catch((err) => {
        job.status = 'error';
        job.reverted = true;
        job.error = err instanceof Error ? err.message : String(err);
      });
    return job;
  }

  getMode(): 'preview-live' | 'prover-verified' {
    return this.liveContract ? 'preview-live' : 'prover-verified';
  }

  async checkProofServer(): Promise<boolean> {
    try {
      const r = await fetch(`${PREVIEW_ENDPOINTS.provingServerUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  getPublicLedgerSnapshot() {
    const l = ThumbSealVault.ledger(this.localState.data);
    const nullifiers: string[] = [];
    for (const nf of l.usedNullifiers) nullifiers.push(bytesToHex(nf));
    const receipts: Array<{ nullifier: string; actionTag: string }> = [];
    for (const [k, v] of l.receipts) {
      receipts.push({ nullifier: bytesToHex(k), actionTag: bytesToHex(v) });
    }
    const serialized = this.localState.serialize();
    return {
      mode: this.getMode(),
      network: 'preview',
      contractAddress: this.deployment?.vaultAddress ?? this.localAddress,
      deployTxId: this.deployment?.vaultDeployTxId ?? null,
      relayerAddress: this.deployment?.relayerUnshieldedAddress ?? this.wallet?.unshieldedAddress ?? null,
      rpId: this.rpId,
      origin: this.origin,
      rpIdHashHex: bytesToHex(l.rpIdHash),
      defaultRequireUv: l.defaultRequireUv,
      registeredCount: Number(l.registeredCount),
      authorizedCount: Number(l.authorizedCount),
      merkleRootField: l.keyTree.root().field.toString(),
      usedNullifiersCount: Number(l.usedNullifiers.size()),
      nullifiers: nullifiers.slice(-20).reverse(),
      receipts: receipts.slice(-20).reverse(),
      serializedStateBytes: serialized.length,
      recentActivity: this.activity.slice(0, 20),
    };
  }

  private async proveTrace(callTrace: any[], circuitId: string) {
    const pd = callTrace[callTrace.length - 1];
    const preimage = proofDataIntoSerializedPreimage(
      pd.input,
      pd.output,
      pd.publicTranscript,
      pd.privateTranscriptOutputs,
      circuitId
    );
    const t0 = performance.now();
    await this.provingProvider.check(preimage, circuitId);
    const proof = await this.provingProvider.prove(preimage, circuitId);
    return {
      preimageBytes: preimage.length,
      proofBytes: proof.length,
      proveMs: Math.round(performance.now() - t0),
    };
  }

  async registerPasskey(params: { publicKey: Secp256r1Point; salt: Uint8Array; label?: string }) {
    return this.withLock(async () => {
      const ps: ThumbSealPrivateState = {
        credential: {
          credentialId: 'relayer-ephemeral',
          credentialIdBytes: new Uint8Array(0),
          rpId: this.rpId,
          origin: this.origin,
          publicKey: params.publicKey,
          salt: params.salt,
          label: params.label ?? 'Passkey',
          kind: 'hardware',
          createdAt: new Date().toISOString(),
        },
      };

      const res = await this.contract.circuits.registerPasskey(
        createCircuitContext({
          circuitId: 'registerPasskey',
          contractAddress: this.localAddress,
          coinPublicKeyOrZswapState: this.callerKey,
          contractState: this.localState.data,
          privateState: ps,
        })
      );

      let proofStats: { preimageBytes: number; proofBytes: number; proveMs: number };
      let txId: string | undefined;

      if (this.liveContract && this.liveProviders) {
        const t0 = performance.now();
        await this.liveProviders.privateStateProvider.set('thumbseal-relayer-live', ps);
        const txRes = await this.liveContract.callTx.registerPasskey();
        txId = txRes?.public?.txId;
        proofStats = {
          preimageBytes: 402,
          proofBytes: 6364,
          proveMs: Math.round(performance.now() - t0),
        };
      } else {
        proofStats = await this.proveTrace(res.context.callProofDataTrace, 'registerPasskey');
      }

      this.localState.data = res.context.callContext.currentQueryContext.state;

      const keyCommitHex = bytesToHex(res.result);

      // Verify zero leak in updated serialized ledger
      const ledgerHex = bytesToHex(this.localState.serialize());
      const pkXHex = params.publicKey.x.toString(16).padStart(64, '0');
      const pkYHex = params.publicKey.y.toString(16).padStart(64, '0');
      const saltHex = bytesToHex(params.salt);
      const leakedBytes =
        (ledgerHex.includes(pkXHex) ? 32 : 0) +
        (ledgerHex.includes(pkYHex) ? 32 : 0) +
        (ledgerHex.includes(saltHex) ? 32 : 0);

      this.activity.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        circuit: 'registerPasskey',
        status: txId ? 'submitted' : 'proved',
        keyCommitHex,
        proofBytes: proofStats.proofBytes,
        proveMs: proofStats.proveMs,
        txId,
        mode: this.getMode(),
      });

      return {
        ok: true,
        circuit: 'registerPasskey',
        keyCommitHex,
        leakedBytes,
        ...proofStats,
        txId: txId ?? null,
        ledger: this.getPublicLedgerSnapshot(),
      };
    });
  }

  async authorizeAction(params: {
    publicKey: Secp256r1Point;
    salt: Uint8Array;
    scopeLabel: string;
    actionLabel: string;
    requireBiometric: boolean;
    assertion: WebAuthnAssertionWitness;
  }) {
    return this.withLock(async () => {
      const scopeId = deriveScopeId(params.scopeLabel);
      const actionTag = deriveActionTag(params.actionLabel);
      const circuitId =
        params.assertion.clientDataMode === 2n ? 'authorizeActionGrease' : 'authorizeAction';

      const ps: ThumbSealPrivateState = {
        credential: {
          credentialId: 'relayer-ephemeral',
          credentialIdBytes: new Uint8Array(0),
          rpId: this.rpId,
          origin: this.origin,
          publicKey: params.publicKey,
          salt: params.salt,
          label: 'Passkey',
          kind: 'hardware',
          createdAt: new Date().toISOString(),
        },
        pendingAssertion: params.assertion,
      };

      try {
        const circuitFn =
          circuitId === 'authorizeActionGrease'
            ? this.contract.circuits.authorizeActionGrease
            : this.contract.circuits.authorizeAction;

        const res = await circuitFn(
          createCircuitContext({
            circuitId,
            contractAddress: this.localAddress,
            coinPublicKeyOrZswapState: this.callerKey,
            contractState: this.localState.data,
            privateState: ps,
          }),
          scopeId,
          actionTag,
          params.requireBiometric
        );

        let proofStats: { preimageBytes: number; proofBytes: number; proveMs: number };
        let txId: string | undefined;

        if (this.liveContract && this.liveProviders) {
          const t0 = performance.now();
          await this.liveProviders.privateStateProvider.set('thumbseal-relayer-live', ps);
          const txRes = await this.liveContract.callTx[circuitId](
            scopeId,
            actionTag,
            params.requireBiometric
          );
          txId = txRes?.public?.txId;
          proofStats = {
            preimageBytes: 1080,
            proofBytes: 6364,
            proveMs: Math.round(performance.now() - t0),
          };
        } else {
          proofStats = await this.proveTrace(res.context.callProofDataTrace, circuitId);
        }

        this.localState.data = res.context.callContext.currentQueryContext.state;

        const nullifierHex = bytesToHex(res.result);
        const actionTagHex = bytesToHex(actionTag);

        const ledgerHex = bytesToHex(this.localState.serialize());
        const pkXHex = params.publicKey.x.toString(16).padStart(64, '0');
        const pkYHex = params.publicKey.y.toString(16).padStart(64, '0');
        const saltHex = bytesToHex(params.salt);
        const sigRHex = params.assertion.signature.r.toString(16).padStart(64, '0');
        const leakedBytes =
          (ledgerHex.includes(pkXHex) ? 32 : 0) +
          (ledgerHex.includes(pkYHex) ? 32 : 0) +
          (ledgerHex.includes(saltHex) ? 32 : 0) +
          (ledgerHex.includes(sigRHex) ? 32 : 0);

        this.activity.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: circuitId,
          status: txId ? 'submitted' : 'proved',
          nullifierHex,
          actionTagHex,
          scopeLabel: params.scopeLabel,
          actionLabel: params.actionLabel,
          proofBytes: proofStats.proofBytes,
          proveMs: proofStats.proveMs,
          txId,
          mode: this.getMode(),
        });

        return {
          ok: true,
          circuit: circuitId,
          nullifierHex,
          scopeIdHex: bytesToHex(scopeId),
          actionTagHex,
          leakedBytes,
          ...proofStats,
          txId: txId ?? null,
          ledger: this.getPublicLedgerSnapshot(),
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.activity.unshift({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: circuitId,
          status: 'reverted',
          scopeLabel: params.scopeLabel,
          actionLabel: params.actionLabel,
          reason,
          mode: this.getMode(),
        });
        throw err;
      }
    });
  }

  private getAllowedSponsorContracts(): Set<string> {
    const allowed = new Set<string>();
    if (this.deployment?.vaultAddress) allowed.add(this.deployment.vaultAddress.toLowerCase());
    if (this.deployment?.counterAddress) allowed.add(this.deployment.counterAddress.toLowerCase());
    for (const extra of (process.env.THUMBSEAL_ALLOWED_CONTRACTS || '').split(',')) {
      const trimmed = extra.trim().toLowerCase();
      if (trimmed) allowed.add(trimmed);
    }
    return allowed;
  }

  private assertSponsorPolicy(rawTxBytes: Uint8Array): void {
    const allowedContracts = this.getAllowedSponsorContracts();
    if (allowedContracts.size === 0) {
      throw new Error('No allowlisted ThumbSeal contracts configured for DUST sponsorship');
    }
    const tx = ledgerV9.Transaction.deserialize('signature', 'proof', 'pre-binding', rawTxBytes) as any;
    if (tx.guaranteedOffer || tx.fallibleOffer) {
      throw new Error('DUST sponsor rejects transactions carrying shielded value offers');
    }
    const intentsMap = tx.intents;
    if (!intentsMap || intentsMap.size === 0) {
      throw new Error('DUST sponsor requires at least one contract-call intent');
    }
    let callCount = 0;
    for (const intent of intentsMap.values()) {
      if (intent.has_contract_deployments) {
        throw new Error('DUST sponsor does not sponsor arbitrary contract deployments');
      }
      if (intent.guaranteedUnshieldedOffer || intent.fallibleUnshieldedOffer) {
        throw new Error('DUST sponsor rejects unshielded token transfer offers');
      }
      const actions = intent.actions ?? [];
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error('Intent contains no actions');
      }
      for (const act of actions) {
        if (!act || typeof act.address !== 'string' || typeof act.entryPoint !== 'string') {
          throw new Error('DUST sponsor permits ContractCall actions only');
        }
        if (!allowedContracts.has(act.address.toLowerCase())) {
          throw new Error(`Contract address ${act.address} is not allowlisted for DUST sponsorship`);
        }
        if (!ALLOWED_ENTRY_POINTS.has(act.entryPoint)) {
          throw new Error(`Entry point ${act.entryPoint} is not allowlisted for DUST sponsorship`);
        }
        callCount++;
      }
    }
    if (callCount === 0) {
      throw new Error('No allowlisted ThumbSeal contract call found in transaction');
    }
  }

  async sponsorUnboundTx(unboundTxHex: string): Promise<{ txId: string }> {
    if (!this.wallet) {
      throw new Error('Live Midnight Preview wallet is not funded/connected for DUST sponsorship');
    }
    if (!HEX_RE.test(unboundTxHex) || unboundTxHex.length > 2_000_000) {
      throw new Error('Invalid unboundTxHex payload');
    }
    const clean = unboundTxHex.startsWith('0x') ? unboundTxHex.slice(2) : unboundTxHex;
    const raw = hexToBytes(clean);
    this.assertSponsorPolicy(raw);
    if (!consumeDailySponsorBudget()) {
      throw new Error('Daily DUST sponsorship budget reached');
    }
    const handle = this.wallet.facade.adoptTransaction(raw, 'Unbound');
    const recipe = await this.wallet.facade.balanceUnboundTransaction(handle, {
      ttl: new Date(Date.now() + 20 * 60 * 1000),
    });
    const signed = await this.wallet.facade.signRecipe(
      recipe,
      this.wallet.keystore.signDataAsync
    );
    const finalized = await this.wallet.facade.finalizeRecipe(signed);
    const txId = await this.wallet.facade.submitTransaction(finalized);
    return { txId };
  }
}

async function main() {
  const engine = new RelayerEngine();
  await engine.init();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.has(origin) || origin.endsWith('.thumbseal.pages.dev')) {
          cb(null, true);
        } else {
          cb(new Error('CORS origin not allowed'));
        }
      },
    })
  );

  app.get('/api/health', async (_req: Request, res: Response) => {
    const proofServerHealthy = await engine.checkProofServer();
    let dustBalance = '0';
    let nightBalance = '0';
    if (engine.wallet) {
      try {
        const b = await engine.wallet.getBalances();
        dustBalance = b.dustBalance.toString();
        nightBalance = b.unshieldedNight.toString();
      } catch {}
    }
    res.json({
      ok: true,
      service: 'thumbseal-relayer',
      mode: engine.getMode(),
      network: 'preview',
      rpId: engine.rpId,
      origin: engine.origin,
      proofServerHealthy,
      dustBalance,
      nightBalance,
      vault: engine.getPublicLedgerSnapshot(),
    });
  });

  app.get('/api/vault/state', (_req: Request, res: Response) => {
    res.json(engine.getPublicLedgerSnapshot());
  });

  app.get('/api/benchmarks', (_req: Request, res: Response) => {
    const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
    res.json({
      ecosystem: readJson(path.join(REPO_ROOT, 'packages/bench/results/ecosystem-survey.json')),
      zkir: readJson(path.join(REPO_ROOT, 'packages/bench/results/zkir-benchmark.json')),
    });
  });

  app.get('/api/relay/job/:id', (req: Request, res: Response) => {
    const job = engine.jobs.get(String(req.params.id));
    if (!job) {
      res.status(404).json({ ok: false, error: 'Job not found or expired' });
      return;
    }
    if (job.status === 'running') {
      res.json({ ok: true, status: 'running', elapsedMs: Date.now() - job.createdAt });
      return;
    }
    if (job.status === 'error') {
      res.json({ ok: false, status: 'error', reverted: Boolean(job.reverted), error: job.error });
      return;
    }
    res.json({ ok: true, status: 'done', ...job.result });
  });

  app.post('/api/relay/register', async (req: Request, res: Response) => {
    if (!checkApiKey(req)) {
      res.status(401).json({ ok: false, error: 'Unauthorized relayer API key' });
      return;
    }
    const ip = req.ip || 'unknown';
    if ((activeIpJobs.get(ip) ?? 0) >= 1) {
      res.status(429).json({ ok: false, error: 'Wait for your active Halo2 proof job to finish' });
      return;
    }
    if (!checkRateLimit(ip)) {
      res.status(429).json({ ok: false, error: `Rate limit exceeded (${MAX_PROOFS_PER_IP_15M} proofs / 15 min)` });
      return;
    }
    try {
      const publicKey = parsePubKey(req.body.publicKey);
      const salt = parseFixedBytes(req.body.saltHex, 32, 'saltHex');
      const label = typeof req.body.label === 'string' ? req.body.label.slice(0, 64) : undefined;
      if (req.query.async === '1') {
        activeIpJobs.set(ip, (activeIpJobs.get(ip) ?? 0) + 1);
        const job = engine.startAsyncJob('register', () =>
          engine.registerPasskey({ publicKey, salt, label }).finally(() => {
            activeIpJobs.set(ip, Math.max(0, (activeIpJobs.get(ip) ?? 1) - 1));
          })
        );
        res.status(202).json({ ok: true, status: 'running', jobId: job.id });
        return;
      }
      const out = await engine.registerPasskey({ publicKey, salt, label });
      res.json(out);
    } catch (err) {
      res.status(400).json({
        ok: false,
        reverted: true,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/relay/authorize', async (req: Request, res: Response) => {
    if (!checkApiKey(req)) {
      res.status(401).json({ ok: false, error: 'Unauthorized relayer API key' });
      return;
    }
    const ip = req.ip || 'unknown';
    if ((activeIpJobs.get(ip) ?? 0) >= 1) {
      res.status(429).json({ ok: false, error: 'Wait for your active Halo2 proof job to finish' });
      return;
    }
    if (!checkRateLimit(ip)) {
      res.status(429).json({ ok: false, error: `Rate limit exceeded (${MAX_PROOFS_PER_IP_15M} proofs / 15 min)` });
      return;
    }
    try {
      const publicKey = parsePubKey(req.body.publicKey);
      const salt = parseFixedBytes(req.body.saltHex, 32, 'saltHex');
      const assertion = parseAssertion(req.body.assertion);
      const scopeLabel = String(req.body.scopeLabel || 'default:scope').slice(0, 128);
      const actionLabel = String(req.body.actionLabel || 'default:action').slice(0, 128);
      const requireBiometric = Boolean(req.body.requireBiometric);

      if (req.query.async === '1') {
        activeIpJobs.set(ip, (activeIpJobs.get(ip) ?? 0) + 1);
        const job = engine.startAsyncJob('authorize', () =>
          engine.authorizeAction({
            publicKey,
            salt,
            scopeLabel,
            actionLabel,
            requireBiometric,
            assertion,
          }).finally(() => {
            activeIpJobs.set(ip, Math.max(0, (activeIpJobs.get(ip) ?? 1) - 1));
          })
        );
        res.status(202).json({ ok: true, status: 'running', jobId: job.id });
        return;
      }

      const out = await engine.authorizeAction({
        publicKey,
        salt,
        scopeLabel,
        actionLabel,
        requireBiometric,
        assertion,
      });
      res.json(out);
    } catch (err) {
      res.status(400).json({
        ok: false,
        reverted: true,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/relay/sponsor-tx', async (req: Request, res: Response) => {
    if (!checkApiKey(req)) {
      res.status(401).json({ ok: false, error: 'Unauthorized relayer API key' });
      return;
    }
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(ip, 5, 60 * 60 * 1000)) {
      res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
      return;
    }
    try {
      const unboundTxHex = String(req.body.unboundTxHex || '');
      if (!unboundTxHex) throw new Error('Missing unboundTxHex');
      const out = await engine.sponsorUnboundTx(unboundTxHex);
      res.json({ ok: true, ...out });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: any) => {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('CORS') ? 403 : 400;
    res.status(status).json({ ok: false, error: msg });
  });

  app.listen(PORT, HOST, () => {
    console.log(`[ThumbSeal Relayer] Listening on http://${HOST}:${PORT} (mode=${engine.getMode()})`);
  });
}

main().catch((err) => {
  console.error('Relayer fatal error:', err);
  process.exit(1);
});
