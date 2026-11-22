/**
 * Drop-in Midnight Compact witness factories for ThumbSealVault and WalletlessCounter.
 * Keeps passkey public keys, blinding salts, Merkle paths, and WebAuthn signatures
 * strictly inside the client's local ZK witness boundary.
 * Licensed under the Apache License, Version 2.0.
 */

import {
  MerkleTreePath,
  Secp256r1Point,
  ThumbSealPrivateState,
  WebAuthnAssertionWitness,
} from './types.js';

export interface VaultLedgerView {
  keyTree: {
    findPathForLeaf(leaf: Uint8Array): MerkleTreePath | undefined;
  };
}

export interface WitnessContextLike<L, PS> {
  readonly privateState: PS;
  readonly ledger: L;
}

export type CommitPasskeyFn = (pk: Secp256r1Point, salt: Uint8Array) => Uint8Array;

/**
 * Builds the complete Witnesses<ThumbSealPrivateState> object required by ThumbSealVault.compact.
 * Pass `commitPasskey` (e.g. from @thumbseal/contracts) to auto-resolve Merkle paths from ledger.keyTree.
 */
export function createThumbSealWitnesses(commitPasskey?: CommitPasskeyFn) {
  return {
    localPasskeyPub(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Secp256r1Point] {
      return [ctx.privateState, ctx.privateState.credential.publicKey];
    },

    localKeySalt(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Uint8Array] {
      return [ctx.privateState, ctx.privateState.credential.salt];
    },

    localKeyPath(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, MerkleTreePath] {
      if (ctx.privateState.merklePathOverride) {
        return [ctx.privateState, ctx.privateState.merklePathOverride];
      }
      if (!commitPasskey) {
        throw new Error(
          'No merklePathOverride in privateState and no commitPasskey helper provided to resolve ledger.keyTree'
        );
      }
      const keyCommit = commitPasskey(
        ctx.privateState.credential.publicKey,
        ctx.privateState.credential.salt
      );
      const found = ctx.ledger.keyTree.findPathForLeaf(keyCommit);
      if (!found) {
        throw new Error('Local passkey commitment not found in ledger.keyTree');
      }
      return [ctx.privateState, found];
    },

    localWebAuthnAssertion(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, WebAuthnAssertionWitness] {
      if (!ctx.privateState.pendingAssertion) {
        throw new Error('No pendingAssertion loaded in ThumbSealPrivateState');
      }
      return [ctx.privateState, ctx.privateState.pendingAssertion];
    },

    localBackupPasskeyPub(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Secp256r1Point] {
      if (!ctx.privateState.pendingBackup) {
        throw new Error('No pendingBackup loaded in ThumbSealPrivateState');
      }
      return [ctx.privateState, ctx.privateState.pendingBackup.publicKey];
    },

    localBackupKeySalt(
      ctx: WitnessContextLike<VaultLedgerView, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Uint8Array] {
      if (!ctx.privateState.pendingBackup) {
        throw new Error('No pendingBackup loaded in ThumbSealPrivateState');
      }
      return [ctx.privateState, ctx.privateState.pendingBackup.salt];
    },
  };
}

/**
 * Builds the Witnesses<ThumbSealPrivateState> object for WalletlessCounter.compact.
 */
export function createWalletlessCounterWitnesses() {
  return {
    localPasskeyPub(
      ctx: WitnessContextLike<unknown, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Secp256r1Point] {
      return [ctx.privateState, ctx.privateState.credential.publicKey];
    },
    localKeySalt(
      ctx: WitnessContextLike<unknown, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, Uint8Array] {
      return [ctx.privateState, ctx.privateState.credential.salt];
    },
    localWebAuthnAssertion(
      ctx: WitnessContextLike<unknown, ThumbSealPrivateState>
    ): [ThumbSealPrivateState, WebAuthnAssertionWitness] {
      if (!ctx.privateState.pendingAssertion) {
        throw new Error('No pendingAssertion loaded in ThumbSealPrivateState');
      }
      return [ctx.privateState, ctx.privateState.pendingAssertion];
    },
  };
}
