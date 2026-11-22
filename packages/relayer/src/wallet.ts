/**
 * Midnight Ledger 9 (Preview) Relayer Wallet & Provider Factory.
 * Manages shielded/unshielded/DUST sync, optional state snapshot persistence,
 * automatic NIGHT -> DUST registration, and Ledger 9 MidnightProviders.
 * Licensed under the Apache License, Version 2.0.
 */

import fs from 'node:fs';
import path from 'node:path';
import { firstValueFrom, filter, timeout, tap } from 'rxjs';
import * as ledgerV9 from '@midnight-ntwrk/ledger-v9';
import { WalletSeeds } from '@midnight-ntwrk/wallet-sdk-hd';
import { WalletFacade, type FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
  type MidnightProviders,
} from '@midnight-ntwrk/midnight-js-types';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { loadRelayerSecrets, PREVIEW_ENDPOINTS } from './config.js';

export interface RelayerWalletHandle {
  facade: WalletFacade;
  keystore: UnshieldedKeystore;
  unshieldedAddress: string;
  shieldedSecretKeys: ledgerV9.ZswapSecretKeys;
  dustSecretKey: ledgerV9.DustSecretKey;
  seeds: WalletSeeds;
  waitForSync: (timeoutMs?: number) => Promise<FacadeState>;
  getBalances: () => Promise<{
    unshieldedNight: bigint;
    dustBalance: bigint;
    shieldedBalances: Record<string, bigint>;
    isSynced: boolean;
    protocolVersion: number;
  }>;
  ensureDustRegistered: () => Promise<{ registered: boolean; dustBalance: bigint; regTxId?: string }>;
  saveSnapshot: () => Promise<void>;
  close: () => Promise<void>;
}

interface WalletSnapshot {
  savedAt: string;
  address: string;
  shielded?: string;
  unshielded?: string;
  dust?: string;
}

function getCacheFilePath(): string | null {
  return process.env.THUMBSEAL_WALLET_CACHE_FILE || null;
}

function loadSnapshot(expectedAddr: string): WalletSnapshot | null {
  const p = getCacheFilePath();
  if (!p || !fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as WalletSnapshot;
    if (parsed.address !== expectedAddr) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createRelayerWallet(): Promise<RelayerWalletHandle> {
  const secrets = loadRelayerSecrets();
  const seeds = WalletSeeds.fromMasterSeed(secrets.masterSeed);
  const keystore = createKeystore(
    { kind: 'schnorr', secret: seeds.unshielded },
    PREVIEW_ENDPOINTS.networkId
  );
  const unshieldedPublicKey = PublicKey.fromKeyStore(keystore);
  const shieldedSecretKeys = ledgerV9.ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = ledgerV9.DustSecretKey.fromSeed(seeds.dust);
  const snapshot = loadSnapshot(unshieldedPublicKey.address);
  if (snapshot) {
    console.log('[Wallet] Restoring cached Midnight Preview snapshot from', snapshot.savedAt);
  }

  const txHistoryStorage = new NoOpTransactionHistoryStorage();

  const configuration = {
    networkId: PREVIEW_ENDPOINTS.networkId,
    indexerClientConnection: {
      indexerHttpUrl: PREVIEW_ENDPOINTS.indexerHttpUrl,
      indexerWsUrl: PREVIEW_ENDPOINTS.indexerWsUrl,
    },
    relayURL: new URL(PREVIEW_ENDPOINTS.nodeWsUrl),
    provingServerUrl: new URL(PREVIEW_ENDPOINTS.provingServerUrl),
    txHistoryStorage,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  let shieldedRef: any = null;
  let unshieldedRef: any = null;
  let dustRef: any = null;

  const facade = await WalletFacade.init({
    configuration: configuration as any,
    shielded: (cfg) => {
      const api = ShieldedWallet(cfg as any);
      shieldedRef = snapshot?.shielded ? api.restore(snapshot.shielded) : api.startWithSeed(seeds.shielded);
      return shieldedRef;
    },
    unshielded: (cfg) => {
      const api = UnshieldedWallet(cfg as any);
      unshieldedRef = snapshot?.unshielded ? api.restore(snapshot.unshielded) : api.startWithPublicKey(unshieldedPublicKey);
      return unshieldedRef;
    },
    dust: (cfg) => {
      const api = DustWallet(cfg as any);
      dustRef = snapshot?.dust
        ? api.restore(snapshot.dust)
        : api.startWithSeed(seeds.dust, ledgerV9.LedgerParameters.initialParameters().dust);
      return dustRef;
    },
  });

  await facade.start(seeds);

  const saveSnapshot = async (): Promise<void> => {
    const p = getCacheFilePath();
    if (!p) return;
    try {
      const snap: WalletSnapshot = {
        savedAt: new Date().toISOString(),
        address: unshieldedPublicKey.address,
      };
      const sh = (facade as any).shielded ?? shieldedRef;
      const un = (facade as any).unshielded ?? unshieldedRef;
      const du = (facade as any).dust ?? dustRef;
      if (typeof sh?.serializeState === 'function') {
        snap.shielded = await sh.serializeState();
      }
      if (typeof un?.serializeState === 'function') {
        snap.unshielded = await un.serializeState();
      }
      if (typeof du?.serializeState === 'function') {
        snap.dust = await du.serializeState();
      }
      if (snap.shielded || snap.unshielded || snap.dust) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(snap), { mode: 0o600 });
        console.log('[Wallet] Saved Midnight Preview snapshot to cache');
      }
    } catch (err) {
      console.warn('[Wallet] Snapshot save skipped:', err instanceof Error ? err.message : String(err));
    }
  };

  const waitForSync = async (timeoutMs = 900_000): Promise<FacadeState> => {
    let lastLog = 0;
    return firstValueFrom(
      facade.state().pipe(
        tap((s) => {
          const now = Date.now();
          if (now - lastLog >= 10_000 || s.isSynced) {
            lastLog = now;
            const sh = s.shielded?.progress;
            const du = s.dust?.progress;
            const un = s.unshielded?.progress?.isStrictlyComplete?.() ?? false;
            console.log(
              `[WalletSync] isSynced=${s.isSynced} unshielded=${un} shielded=${sh?.appliedIndex ?? 0n}/${sh?.highestRelevantWalletIndex ?? 0n} dust=${du?.appliedIndex ?? 0n}/${du?.highestRelevantWalletIndex ?? 0n} tDUST=${s.dust.balance(new Date()).toString()}`
            );
          }
        }),
        filter((s) => s.isSynced),
        timeout(timeoutMs)
      )
    );
  };

  const getBalances = async () => {
    const state = await firstValueFrom(facade.state());
    const nativeToken = ledgerV9.nativeToken().raw;
    const unshieldedNight =
      (state.unshielded.balances as Record<string, bigint>)[nativeToken] ?? 0n;
    const dustBalance = state.dust.balance(new Date());
    return {
      unshieldedNight,
      dustBalance,
      shieldedBalances: state.shielded.balances as Record<string, bigint>,
      isSynced: state.isSynced,
      protocolVersion: 9,
    };
  };

  const ensureDustRegistered = async () => {
    const state = await waitForSync();
    const curDust = state.dust.balance(new Date());
    if (curDust > 0n) {
      return { registered: false, dustBalance: curDust };
    }
    const availableUtxos = (state.unshielded.availableCoins as any[]).filter(
      (u) => !u.meta?.registeredForDustGeneration
    );
    console.log('[Wallet] Unshielded UTXOs available for DUST registration:', availableUtxos.length);
    if (availableUtxos.length === 0) {
      // Already registered, wait for DUST to accrue
      console.log('[Wallet] UTXOs already registered for DUST; waiting for tDUST balance > 0...');
      const updated = await firstValueFrom(
        facade.state().pipe(
          filter((s) => s.dust.balance(new Date()) > 0n),
          timeout(180_000)
        )
      );
      return { registered: false, dustBalance: updated.dust.balance(new Date()) };
    }
    console.log('[Wallet] Submitting NIGHT -> DUST registration transaction...');
    const recipe = await facade.registerNightUtxosForDustGeneration(
      availableUtxos,
      keystore.getPublicKey(),
      keystore.signDataAsync
    );
    const finalized = await facade.finalizeRecipe(recipe);
    const regTxId = await facade.submitTransaction(finalized);
    console.log('[Wallet] NIGHT -> DUST registration tx submitted:', regTxId);
    const updated = await firstValueFrom(
      facade.state().pipe(
        filter((s) => s.dust.balance(new Date()) > 0n),
        timeout(180_000)
      )
    );
    const finalDust = updated.dust.balance(new Date());
    console.log('[Wallet] tDUST accruing! Balance:', finalDust.toString());
    return { registered: true, dustBalance: finalDust, regTxId: String(regTxId) };
  };

  return {
    facade,
    keystore,
    unshieldedAddress: unshieldedPublicKey.address,
    shieldedSecretKeys,
    dustSecretKey,
    seeds,
    waitForSync,
    getBalances,
    ensureDustRegistered,
    saveSnapshot,
    close: async () => {
      await saveSnapshot();
      await facade.stop();
    },
  };
}

export function createPreviewContractProviders<PS>(
  wallet: RelayerWalletHandle,
  zkConfigDir: string,
  privateStateStoreName: string
): MidnightProviders<string, string, PS> {
  const secrets = loadRelayerSecrets();
  const zkConfigProvider = new NodeZkConfigProvider<string>(zkConfigDir);
  const publicDataProvider = indexerPublicDataProvider({
    queryURL: PREVIEW_ENDPOINTS.indexerHttpUrl,
    subscriptionURL: PREVIEW_ENDPOINTS.indexerWsUrl,
  });
  const proofProvider = httpClientProofProvider(
    PREVIEW_ENDPOINTS.provingServerUrl,
    zkConfigProvider
  );
  const privateStateProvider = levelPrivateStateProvider<string, PS>({
    privateStateStoreName,
    accountId: wallet.unshieldedAddress,
    privateStoragePasswordProvider: () => secrets.privateStatePassword,
  });

  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => wallet.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => wallet.shieldedSecretKeys.encryptionPublicKey,
    balanceTx: async (tx, ttl) => {
      const handle = wallet.facade.adoptTransaction(tx.serialize(), 'Unbound');
      const recipe = await wallet.facade.balanceUnboundTransaction(handle, {
        ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
      });
      const signed = await wallet.facade.signRecipe(recipe, wallet.keystore.signDataAsync);
      const finalized = await wallet.facade.finalizeRecipe(signed);
      return finalized.serialize();
    },
  });

  const midnightProvider = createLedger9MidnightProvider(async (tx) => {
    const handle = wallet.facade.adoptTransaction(tx.serialize(), 'Finalized');
    return wallet.facade.submitTransaction(handle);
  });

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
    config: { networkId: PREVIEW_ENDPOINTS.networkId, ttlSeconds: 1800 },
  } as unknown as MidnightProviders<string, string, PS>;
}
