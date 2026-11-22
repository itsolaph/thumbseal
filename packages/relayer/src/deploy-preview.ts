/**
 * Deploys ThumbSealVault (and WalletlessCounter example) LIVE to Midnight Preview (Ledger 9).
 * Automatically registers unshielded tNIGHT UTXOs for DUST generation if needed.
 * Licensed under the Apache License, Version 2.0.
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  computeRpIdHash,
  createThumbSealWitnesses,
  createWalletlessCounterWitnesses,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
  type ThumbSealPrivateState,
} from '@thumbseal/sdk';
import {
  computePasskeyCommitment,
  ThumbSealVault,
  WalletlessCounter,
} from '@thumbseal/contracts';
import {
  COUNTER_ASSETS_DIR,
  savePreviewDeployment,
  THUMBSEAL_ORIGIN,
  THUMBSEAL_RP_ID,
  VAULT_ASSETS_DIR,
} from './config.js';
import { createPreviewContractProviders, createRelayerWallet } from './wallet.js';

async function main() {
  console.log('Initializing Midnight Preview relayer wallet...');
  const wallet = await createRelayerWallet();
  try {
    console.log('Relayer unshielded address:', wallet.unshieldedAddress);
    await wallet.waitForSync(120_000);
    const bal = await wallet.getBalances();
    console.log('Balances -> tNIGHT:', bal.unshieldedNight.toString(), 'tDUST:', bal.dustBalance.toString());

    if (bal.dustBalance === 0n && bal.unshieldedNight === 0n) {
      throw new Error(
        `Burner wallet has 0 tNIGHT and 0 tDUST on Midnight Preview. Fund ${wallet.unshieldedAddress} at https://faucet.preview.midnight.network/ first.`
      );
    }

    if (bal.dustBalance === 0n) {
      console.log('Registering unshielded tNIGHT UTXOs for DUST generation...');
      const dustRes = await wallet.ensureDustRegistered();
      console.log('DUST ready:', dustRes.dustBalance.toString());
    }

    const rpIdHash = computeRpIdHash(THUMBSEAL_RP_ID);
    const originBytes = utf8ToBytes(THUMBSEAL_ORIGIN);
    if (originBytes.length !== 27) {
      throw new Error(`THUMBSEAL_ORIGIN must be 27 bytes, got ${originBytes.length}`);
    }

    const bootstrapAuth = new VirtualPasskeyAuthenticator({
      rpId: THUMBSEAL_RP_ID,
      origin: THUMBSEAL_ORIGIN,
      label: 'Bootstrap Key',
    });

    const vaultProviders = createPreviewContractProviders<ThumbSealPrivateState>(
      wallet,
      VAULT_ASSETS_DIR,
      'thumbseal-vault-preview-state'
    );

    const compiledVault = CompiledContract.make('ThumbSealVault', ThumbSealVault.Contract).pipe(
      CompiledContract.withWitnesses(createThumbSealWitnesses(computePasskeyCommitment)),
      CompiledContract.withCompiledFileAssets(VAULT_ASSETS_DIR)
    );

    console.log(`Deploying ThumbSealVault (rpId=${THUMBSEAL_RP_ID}, origin=${THUMBSEAL_ORIGIN})...`);
    const deployedVault = await deployContract(vaultProviders as any, {
      compiledContract: compiledVault as any,
      args: [rpIdHash, originBytes, false],
      privateStateId: 'thumbseal-vault-deployer',
      initialPrivateState: { credential: bootstrapAuth.credential },
    } as any);

    const vaultAddress = deployedVault.deployTxData.public.contractAddress;
    const vaultDeployTxId = deployedVault.deployTxData.public.txId;
    console.log('ThumbSealVault deployed!');
    console.log('  Contract Address:', vaultAddress);
    console.log('  Deploy Tx ID    :', vaultDeployTxId);

    // Also deploy WalletlessCounter example
    let counterAddress: string | undefined;
    let counterDeployTxId: string | undefined;
    try {
      const counterProviders = createPreviewContractProviders<ThumbSealPrivateState>(
        wallet,
        COUNTER_ASSETS_DIR,
        'thumbseal-counter-preview-state'
      );
      const compiledCounter = CompiledContract.make(
        'WalletlessCounter',
        WalletlessCounter.Contract
      ).pipe(
        CompiledContract.withWitnesses(createWalletlessCounterWitnesses()),
        CompiledContract.withCompiledFileAssets(COUNTER_ASSETS_DIR)
      );
      const ownerCommit = computePasskeyCommitment(
        bootstrapAuth.credential.publicKey,
        bootstrapAuth.credential.salt
      );
      console.log('Deploying WalletlessCounter example...');
      const deployedCounter = await deployContract(counterProviders as any, {
        compiledContract: compiledCounter as any,
        args: [rpIdHash, originBytes, ownerCommit],
        privateStateId: 'thumbseal-counter-deployer',
        initialPrivateState: { credential: bootstrapAuth.credential },
      } as any);
      counterAddress = deployedCounter.deployTxData.public.contractAddress;
      counterDeployTxId = deployedCounter.deployTxData.public.txId;
      console.log('WalletlessCounter deployed!');
      console.log('  Contract Address:', counterAddress);
      console.log('  Deploy Tx ID    :', counterDeployTxId);
    } catch (err) {
      console.warn('WalletlessCounter deploy skipped/failed (Vault succeeded):', err);
    }

    savePreviewDeployment({
      network: 'preview',
      deployedAt: new Date().toISOString(),
      rpId: THUMBSEAL_RP_ID,
      origin: THUMBSEAL_ORIGIN,
      vaultAddress,
      vaultDeployTxId,
      counterAddress,
      counterDeployTxId,
      relayerUnshieldedAddress: wallet.unshieldedAddress,
    });
    console.log('Saved deployments/preview.json');
  } finally {
    await wallet.close();
  }
}

main().catch((err) => {
  console.error('Preview deployment failed:', err);
  process.exit(1);
});
