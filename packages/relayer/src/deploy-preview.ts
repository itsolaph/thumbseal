/**
 * Deploy ThumbSealVault + WalletlessCounter live to Midnight Preview (Ledger 9)
 * and execute real on-chain registerPasskey + authorizeAction verification transactions.
 * Licensed under the Apache License, Version 2.0.
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  bytesToHex,
  computeRpIdHash,
  createThumbSealWitnesses,
  createWalletlessCounterWitnesses,
  deriveActionTag,
  deriveChallenge,
  deriveScopeId,
  DOMAIN_TAGS,
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
  type PreviewDeploymentRecord,
} from './config.js';
import { createPreviewContractProviders, createRelayerWallet } from './wallet.js';

async function main() {
  console.log('=== ThumbSeal Midnight Preview (Ledger 9) Live Deployment ===');
  const wallet = await createRelayerWallet();
  try {
    console.log('Relayer unshielded address:', wallet.unshieldedAddress);
    await wallet.waitForSync(900_000);
    await wallet.saveSnapshot();

    const bal = await wallet.getBalances();
    console.log('Synced Balances -> tNIGHT:', bal.unshieldedNight.toString(), 'tDUST:', bal.dustBalance.toString());

    if (bal.dustBalance === 0n && bal.unshieldedNight === 0n) {
      throw new Error(
        `Burner wallet has 0 tNIGHT and 0 tDUST on Midnight Preview. Fund ${wallet.unshieldedAddress} at https://faucet.preview.midnight.network/ first.`
      );
    }

    if (bal.dustBalance === 0n) {
      const dustRes = await wallet.ensureDustRegistered();
      console.log('DUST ready:', dustRes.dustBalance.toString(), 'regTxId:', dustRes.regTxId ?? 'existing');
      await wallet.saveSnapshot();
    }

    const rpIdHash = computeRpIdHash(THUMBSEAL_RP_ID);
    const originBytes = utf8ToBytes(THUMBSEAL_ORIGIN);
    if (originBytes.length !== 27) {
      throw new Error(`THUMBSEAL_ORIGIN must be 27 bytes, got ${originBytes.length}`);
    }

    const bootstrapAuth = new VirtualPasskeyAuthenticator({
      rpId: THUMBSEAL_RP_ID,
      origin: THUMBSEAL_ORIGIN,
      label: 'Preview Genesis Passkey',
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

    console.log(`1/4 Deploying ThumbSealVault (rpId=${THUMBSEAL_RP_ID}, origin=${THUMBSEAL_ORIGIN})...`);
    const deployedVault = await deployContract(vaultProviders as any, {
      compiledContract: compiledVault as any,
      args: [rpIdHash, originBytes, false],
      privateStateId: 'thumbseal-vault-deployer',
      initialPrivateState: { credential: bootstrapAuth.credential },
    } as any);

    const vaultAddress = deployedVault.deployTxData.public.contractAddress;
    const vaultDeployTxId = deployedVault.deployTxData.public.txId;
    console.log('ThumbSealVault DEPLOYED on Midnight Preview!');
    console.log('  Vault Contract Address:', vaultAddress);
    console.log('  Vault Deploy Tx ID    :', vaultDeployTxId);

    const record: PreviewDeploymentRecord = {
      network: 'preview',
      deployedAt: new Date().toISOString(),
      rpId: THUMBSEAL_RP_ID,
      origin: THUMBSEAL_ORIGIN,
      vaultAddress,
      vaultDeployTxId,
      relayerUnshieldedAddress: wallet.unshieldedAddress,
    };
    savePreviewDeployment(record);

    // 2/4 Execute real live registerPasskey on Preview!
    try {
      console.log('2/4 Executing live on-chain registerPasskey tx on Midnight Preview...');
      const regTx = await (deployedVault as any).callTx.registerPasskey();
      record.sampleRegisterTxId = regTx?.public?.txId;
      record.sampleKeyCommitHex = regTx?.private?.result
        ? bytesToHex(regTx.private.result)
        : bytesToHex(computePasskeyCommitment(bootstrapAuth.credential.publicKey, bootstrapAuth.credential.salt));
      console.log('  Live registerPasskey Tx ID:', record.sampleRegisterTxId);
      console.log('  Key Commit                :', record.sampleKeyCommitHex);
      savePreviewDeployment(record);

      // 3/4 Execute real live authorizeAction on Preview!
      console.log('3/4 Executing live on-chain authorizeAction tx on Midnight Preview...');
      const scopeId = deriveScopeId('preview:genesis:verify');
      const actionTag = deriveActionTag('vault:smoke-verified');
      const challenge = deriveChallenge(DOMAIN_TAGS.ACTION, rpIdHash, scopeId, actionTag);
      const signed = bootstrapAuth.signAssertion({ challenge, flags: 0x1d, clientDataMode: 0n });
      await (vaultProviders.privateStateProvider as any).forContract(record.vaultAddress).set('thumbseal-vault-deployer', {
        credential: bootstrapAuth.credential,
        pendingAssertion: signed.witness,
      });
      const authTx = await (deployedVault as any).callTx.authorizeAction(scopeId, actionTag, true);
      record.sampleAuthorizeTxId = authTx?.public?.txId;
      if (authTx?.private?.result) {
        record.sampleNullifierHex = bytesToHex(authTx.private.result);
      }
      console.log('  Live authorizeAction Tx ID:', record.sampleAuthorizeTxId);
      console.log('  Scoped Nullifier          :', record.sampleNullifierHex ?? 'recorded');
      savePreviewDeployment(record);
    } catch (err) {
      console.warn('Live Vault smoke tx failed (Vault deploy succeeded):', err);
    }

    // 4/4 Deploy WalletlessCounter example on Midnight Preview!
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
      console.log('4/4 Deploying WalletlessCounter example on Midnight Preview...');
      const deployedCounter = await deployContract(counterProviders as any, {
        compiledContract: compiledCounter as any,
        args: [rpIdHash, originBytes, ownerCommit],
        privateStateId: 'thumbseal-counter-deployer',
        initialPrivateState: { credential: bootstrapAuth.credential },
      } as any);
      record.counterAddress = deployedCounter.deployTxData.public.contractAddress;
      record.counterDeployTxId = deployedCounter.deployTxData.public.txId;
      console.log('WalletlessCounter DEPLOYED on Midnight Preview!');
      console.log('  Counter Contract Address:', record.counterAddress);
      console.log('  Counter Deploy Tx ID    :', record.counterDeployTxId);
      savePreviewDeployment(record);
    } catch (err) {
      console.warn('WalletlessCounter deploy failed (Vault succeeded):', err);
    }

    console.log('=== DONE! Saved deployments/preview.json ===');
  } finally {
    await wallet.close();
  }
}

main().catch((err) => {
  console.error('Preview deployment failed:', err);
  process.exit(1);
});
