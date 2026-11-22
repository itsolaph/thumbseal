/**
 * @thumbseal/contracts â€” Compiled Compact 0.28 / ZKIR v3 contracts and commitment utilities.
 * Licensed under the Apache License, Version 2.0.
 */

import {
  CompactTypeBytes,
  CompactTypeVector,
  convertBigintToBytes,
  persistentCommit,
  type Secp256r1Point,
} from '@midnight-ntwrk/compact-runtime';

export * as ThumbSealVault from './managed/thumbseal-vault/contract/index.js';
export * as WalletlessCounter from './managed/walletless-counter/contract/index.js';

const VEC2_BYTES32 = new CompactTypeVector(2, new CompactTypeBytes(32));

/**
 * Computes the exact hiding passkey commitment matching PasskeyAuth.commitPasskey(pk, salt)
 * inside Compact 0.28 / ZKIR v3 circuits.
 */
export function computePasskeyCommitment(pk: Secp256r1Point, salt: Uint8Array): Uint8Array {
  if (pk.identity) {
    throw new Error('Identity secp256r1 point is not a valid passkey');
  }
  if (salt.length !== 32) {
    throw new Error(`Expected 32-byte salt, got ${salt.length}`);
  }
  const xBytes = convertBigintToBytes(32, pk.x, 'computePasskeyCommitment.x');
  const yBytes = convertBigintToBytes(32, pk.y, 'computePasskeyCommitment.y');
  return persistentCommit(VEC2_BYTES32, [xBytes, yBytes], salt);
}
