/**
 * Midnight Ledger 9 (Preview) Relayer Wallet & Provider Factory.
 * Manages shielded/unshielded/DUST sync, automatic NIGHT -> DUST registration,
 * and Ledger 9 MidnightProviders for contract deployment and sponsored tx submission.
 * Licensed under the Apache License, Version 2.0.
 */

import { firstValueFrom, filter, timeout } from 'rxjs';
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
  ensureDustRegistered: () => Promise<{ registered: boolean; dustBalance: bigint }>;
  close: () => Promise<void>;
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

  const facade = await WalletFacade.init({
    configuration: configuration as any,
    shielded: (cfg) => ShieldedWallet(cfg as any).startWithSeed(seeds.shielded),
    unshielded: (cfg) => UnshieldedWallet(cfg as any).startWithPublicKey(unshieldedPublicKey),
    dust: (cfg) =>
      DustWallet(cfg as any).startWithSeed(
        seeds.dust,
        ledgerV9.LedgerParameters.initialParameters().dust
      ),
  });

  await facade.start(seeds);

  const waitForSync = async (timeoutMs = 120_000): Promise<FacadeState> => {
    return firstValueFrom(
      facade.state().pipe(
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
    if (availableUtxos.length === 0) {
      return { registered: false, dustBalance: curDust };
    }
    const recipe = await facade.registerNightUtxosForDustGeneration(
      availableUtxos,
      keystore.getPublicKey(),
      keystore.signDataAsync
    );
    const finalized = await facade.finalizeRecipe(recipe);
    await facade.submitTransaction(finalized);
    // Wait briefly for DUST generation to register on-chain
    const updated = await firstValueFrom(
      facade.state().pipe(
        filter((s) => s.dust.balance(new Date()) > 0n),
        timeout(90_000)
      )
    );
    return { registered: true, dustBalance: updated.dust.balance(new Date()) };
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
    close: async () => {
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
    config: { networkId: PREVIEW_ENDPOINTS.networkId },
  } as unknown as MidnightProviders<string, string, PS>;
}
