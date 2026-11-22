import { describe, expect, it } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import {
  computeRpIdHash,
  createWalletlessCounterWitnesses,
  deriveChallenge,
  deriveScopeId,
  DOMAIN_TAGS,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
  type ThumbSealPrivateState,
} from '@thumbseal/sdk';
import { computePasskeyCommitment, WalletlessCounter } from '../src/index.js';

const RP_ID = 'thumbseal.pages.dev';
const ORIGIN = 'https://thumbseal.pages.dev';
const RP_ID_HASH = computeRpIdHash(RP_ID);
const ORIGIN_BYTES = utf8ToBytes(ORIGIN);

function pad32(s: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(utf8ToBytes(s).slice(0, 32), 0);
  return out;
}

describe('WalletlessCounter (Before/After 15-line migration example)', () => {
  it('increments with owner passkey assertion, blocks replay, and blocks non-owner passkey', async () => {
    const owner = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const intruder = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const ownerCommit = computePasskeyCommitment(owner.credential.publicKey, owner.credential.salt);

    const contract = new WalletlessCounter.Contract<ThumbSealPrivateState>(
      createWalletlessCounterWitnesses()
    );
    const addr = sampleContractAddress();
    const caller = '0'.repeat(64);
    const init = await contract.initialState(
      createConstructorContext({ credential: owner.credential }, caller),
      RP_ID_HASH,
      ORIGIN_BYTES,
      ownerCommit
    );
    let state = init.currentContractState;

    const scope1 = deriveScopeId('counter:step:1');
    const chal1 = deriveChallenge(DOMAIN_TAGS.COUNTER, RP_ID_HASH, scope1, pad32('increment'));
    const ownerSig = owner.signAssertion({ challenge: chal1 });

    // Happy path increment
    const res = await contract.circuits.increment(
      createCircuitContext({
        circuitId: 'increment',
        contractAddress: addr,
        coinPublicKeyOrZswapState: caller,
        contractState: state.data,
        privateState: { credential: owner.credential, pendingAssertion: ownerSig.witness },
      }),
      scope1
    );
    state.data = res.context.callContext.currentQueryContext.state;
    expect(WalletlessCounter.ledger(state.data).round).toBe(1n);

    // Replay same scope MUST revert
    await expect(
      contract.circuits.increment(
        createCircuitContext({
          circuitId: 'increment',
          contractAddress: addr,
          coinPublicKeyOrZswapState: caller,
          contractState: state.data,
          privateState: { credential: owner.credential, pendingAssertion: ownerSig.witness },
        }),
        scope1
      )
    ).rejects.toThrow(/already used/);

    // Intruder passkey on fresh scope MUST revert
    const scope2 = deriveScopeId('counter:step:2');
    const chal2 = deriveChallenge(DOMAIN_TAGS.COUNTER, RP_ID_HASH, scope2, pad32('increment'));
    const intruderSig = intruder.signAssertion({ challenge: chal2 });
    await expect(
      contract.circuits.increment(
        createCircuitContext({
          circuitId: 'increment',
          contractAddress: addr,
          coinPublicKeyOrZswapState: caller,
          contractState: state.data,
          privateState: { credential: intruder.credential, pendingAssertion: intruderSig.witness },
        }),
        scope2
      )
    ).rejects.toThrow(/does not match counter owner/);
  });
});
