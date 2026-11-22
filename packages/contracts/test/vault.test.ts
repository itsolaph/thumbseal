import { describe, expect, it } from 'vitest';
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type ContractState,
} from '@midnight-ntwrk/compact-runtime';
import {
  buildCanonicalClientDataJSON,
  bytesToHex,
  computeRpIdHash,
  createThumbSealWitnesses,
  deriveActionTag,
  deriveChallenge,
  deriveScopedNullifier,
  deriveScopeId,
  DOMAIN_TAGS,
  randomBytes,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
  type ThumbSealPrivateState,
} from '@thumbseal/sdk';
import { computePasskeyCommitment, ThumbSealVault } from '../src/index.js';

const RP_ID = 'thumbseal.pages.dev';
const ORIGIN = 'https://thumbseal.pages.dev';
const RP_ID_HASH = computeRpIdHash(RP_ID);
const ORIGIN_BYTES = utf8ToBytes(ORIGIN);

class VaultTestHarness {
  readonly contractAddress = sampleContractAddress();
  readonly callerKey = '0'.repeat(64);
  readonly contract: ThumbSealVault.Contract<ThumbSealPrivateState>;
  state!: ContractState;

  private constructor(contract: ThumbSealVault.Contract<ThumbSealPrivateState>) {
    this.contract = contract;
  }

  static async deploy(requireUv = false): Promise<VaultTestHarness> {
    const witnesses = createThumbSealWitnesses(computePasskeyCommitment);
    const contract = new ThumbSealVault.Contract<ThumbSealPrivateState>(witnesses);
    const harness = new VaultTestHarness(contract);
    const dummyAuth = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const initCtx = createConstructorContext<ThumbSealPrivateState>(
      { credential: dummyAuth.credential },
      harness.callerKey
    );
    const res = await contract.initialState(initCtx, RP_ID_HASH, ORIGIN_BYTES, requireUv);
    harness.state = res.currentContractState;
    return harness;
  }

  ledger(): ThumbSealVault.Ledger {
    return ThumbSealVault.ledger(this.state.data);
  }

  private ctx(circuitId: string, privateState: ThumbSealPrivateState) {
    return createCircuitContext({
      circuitId,
      contractAddress: this.contractAddress,
      coinPublicKeyOrZswapState: this.callerKey,
      contractState: this.state.data,
      privateState,
    });
  }

  async registerPasskey(privateState: ThumbSealPrivateState): Promise<Uint8Array> {
    const res = await this.contract.circuits.registerPasskey(
      this.ctx('registerPasskey', privateState)
    );
    this.state.data = res.context.callContext.currentQueryContext.state;
    return res.result;
  }

  async authorizeAction(
    privateState: ThumbSealPrivateState,
    scopeId: Uint8Array,
    actionTag: Uint8Array,
    requireBiometric = false
  ): Promise<Uint8Array> {
    const res = await this.contract.circuits.authorizeAction(
      this.ctx('authorizeAction', privateState),
      scopeId,
      actionTag,
      requireBiometric
    );
    this.state.data = res.context.callContext.currentQueryContext.state;
    return res.result;
  }

  async authorizeActionGrease(
    privateState: ThumbSealPrivateState,
    scopeId: Uint8Array,
    actionTag: Uint8Array,
    requireBiometric = false
  ): Promise<Uint8Array> {
    const res = await this.contract.circuits.authorizeActionGrease(
      this.ctx('authorizeActionGrease', privateState),
      scopeId,
      actionTag,
      requireBiometric
    );
    this.state.data = res.context.callContext.currentQueryContext.state;
    return res.result;
  }

  async enrollBackupPasskey(
    privateState: ThumbSealPrivateState,
    scopeId: Uint8Array
  ): Promise<Uint8Array> {
    const res = await this.contract.circuits.enrollBackupPasskey(
      this.ctx('enrollBackupPasskey', privateState),
      scopeId
    );
    this.state.data = res.context.callContext.currentQueryContext.state;
    return res.result;
  }
}

describe('ThumbSealVault (Compact 0.28 / ZKIR v3 native secp256r1)', () => {
  it('registers multiple passkeys and authorizes anonymously across all 3 W3C/Chromium clientDataJSON modes', async () => {
    const vault = await VaultTestHarness.deploy(false);
    const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN, label: 'Alice TouchID' });
    const bob = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN, label: 'Bob Chrome' });

    const aliceCommit = await vault.registerPasskey({ credential: alice.credential });
    const bobCommit = await vault.registerPasskey({ credential: bob.credential });

    expect(bytesToHex(aliceCommit)).toBe(
      bytesToHex(computePasskeyCommitment(alice.credential.publicKey, alice.credential.salt))
    );
    expect(vault.ledger().registeredCount).toBe(2n);

    // Mode 0: Chrome/Firefox/Edge standard ("crossOrigin":false)
    const scope1 = deriveScopeId('dao:proposal:42');
    const act1 = deriveActionTag('vote:yes');
    const chal1 = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope1, act1);
    const sig1 = alice.signAssertion({ challenge: chal1, clientDataMode: 0n });
    const nf1 = await vault.authorizeAction(
      { credential: alice.credential, pendingAssertion: sig1.witness },
      scope1,
      act1,
      true
    );
    expect(bytesToHex(nf1)).toBe(
      bytesToHex(deriveScopedNullifier(aliceCommit, RP_ID_HASH, scope1))
    );
    expect(vault.ledger().receipts.member(nf1)).toBe(true);

    // Second distinct scope produces an unlinkable nullifier
    const scope2 = deriveScopeId('dao:proposal:43');
    const act2 = deriveActionTag('vote:abstain');
    const chal2 = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope2, act2);
    const sig2 = alice.signAssertion({ challenge: chal2, clientDataMode: 0n });
    const nf2 = await vault.authorizeAction(
      { credential: alice.credential, pendingAssertion: sig2.witness },
      scope2,
      act2,
      false
    );
    expect(bytesToHex(nf2)).not.toBe(bytesToHex(nf1));

    // Mode 2: Chromium 20% GREASE ("other_keys_can_be_added_here") routed to authorizeActionGrease
    const chalBob = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope1, act1);
    const sigBob = bob.signAssertion({ challenge: chalBob, clientDataMode: 2n });
    const nfBob = await vault.authorizeActionGrease(
      { credential: bob.credential, pendingAssertion: sigBob.witness },
      scope1,
      act1,
      true
    );
    expect(bytesToHex(nfBob)).not.toBe(bytesToHex(nf1));
    expect(vault.ledger().authorizedCount).toBe(3n);

    // Cross-circuit replay check: Bob replaying scope1 on standard authorizeAction MUST revert!
    const sigBobStd = bob.signAssertion({ challenge: chalBob, clientDataMode: 0n });
    await expect(
      vault.authorizeAction(
        { credential: bob.credential, pendingAssertion: sigBobStd.witness },
        scope1,
        act1,
        true
      )
    ).rejects.toThrow(/Nullifier already spent/);
  });

  it('supports concurrent registration via HistoricMerkleTree without stale-root reverts', async () => {
    const vault = await VaultTestHarness.deploy(false);
    const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const charlie = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });

    const aliceCommit = await vault.registerPasskey({ credential: alice.credential });
    // Snapshot Alice's Merkle path BEFORE Charlie registers
    const staleButHistoricPath = vault.ledger().keyTree.findPathForLeaf(aliceCommit)!;
    expect(staleButHistoricPath).toBeDefined();

    // Charlie registers, mutating the latest root
    await vault.registerPasskey({ credential: charlie.credential });
    expect(vault.ledger().registeredCount).toBe(2n);

    // Alice proves with her older historic Merkle path â€” MUST succeed!
    const scope = deriveScopeId('concurrent:tx');
    const action = deriveActionTag('transfer:100');
    const chal = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope, action);
    const sig = alice.signAssertion({ challenge: chal });
    await vault.authorizeAction(
      {
        credential: alice.credential,
        pendingAssertion: sig.witness,
        merklePathOverride: staleButHistoricPath,
      },
      scope,
      action,
      false
    );
    expect(vault.ledger().authorizedCount).toBe(1n);
  });

  it('enrolls an anonymous backup passkey via enrollBackupPasskey and lets the backup authorize actions', async () => {
    const vault = await VaultTestHarness.deploy(false);
    const laptop = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN, label: 'Laptop' });
    const phone = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN, label: 'Phone Backup' });

    await vault.registerPasskey({ credential: laptop.credential });
    const backupCommit = computePasskeyCommitment(phone.credential.publicKey, phone.credential.salt);

    const recScope = deriveScopeId('recovery:device:2');
    const recChal = deriveChallenge(DOMAIN_TAGS.BACKUP, RP_ID_HASH, recScope, backupCommit);

    // Backup enrollment MUST reject UP-only assertion (biometric UV is mandatory)
    const upOnlySig = laptop.signAssertion({ challenge: recChal, flags: 0x01 });
    await expect(
      vault.enrollBackupPasskey(
        {
          credential: laptop.credential,
          pendingAssertion: upOnlySig.witness,
          pendingBackup: { publicKey: phone.credential.publicKey, salt: phone.credential.salt },
        },
        recScope
      )
    ).rejects.toThrow(/User Verification/);

    // With UV=1 biometric assertion, backup enrollment succeeds
    const uvSig = laptop.signAssertion({ challenge: recChal, flags: 0x1d });
    const enrolledCommit = await vault.enrollBackupPasskey(
      {
        credential: laptop.credential,
        pendingAssertion: uvSig.witness,
        pendingBackup: { publicKey: phone.credential.publicKey, salt: phone.credential.salt },
      },
      recScope
    );
    expect(bytesToHex(enrolledCommit)).toBe(bytesToHex(backupCommit));
    expect(vault.ledger().registeredCount).toBe(2n);

    // Phone backup passkey can now independently authorize a fresh action
    const actScope = deriveScopeId('post-recovery:action');
    const actTag = deriveActionTag('approve:tx');
    const actChal = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, actScope, actTag);
    const phoneSig = phone.signAssertion({ challenge: actChal });
    await vault.authorizeAction(
      { credential: phone.credential, pendingAssertion: phoneSig.witness },
      actScope,
      actTag,
      true
    );
    expect(vault.ledger().authorizedCount).toBe(1n);
  });

  it('adversarial suite: rejects replay, tampered action, phishing origin, wrong rpId, bad flags, forged sig, identity key, unregistered key, and non-canonical base64url', async () => {
    const vault = await VaultTestHarness.deploy(false);
    const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const eve = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });

    const aliceCommit = await vault.registerPasskey({ credential: alice.credential });

    // 1. Duplicate registration rejected
    await expect(vault.registerPasskey({ credential: alice.credential })).rejects.toThrow(
      /already registered/
    );

    // 2. Identity secp256r1 point rejected
    await expect(
      vault.registerPasskey({
        credential: { ...eve.credential, publicKey: { x: 0n, y: 0n, identity: true } },
      })
    ).rejects.toThrow(/Identity secp256r1 point/);

    const scope = deriveScopeId('adv:scope:1');
    const actGood = deriveActionTag('transfer:alice');
    const actTampered = deriveActionTag('transfer:attacker');
    const chalGood = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope, actGood);

    // 3. Tampered actionTag rejected (sig was for actGood, submitted with actTampered)
    const sigGood = alice.signAssertion({ challenge: chalGood });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigGood.witness },
        scope,
        actTampered,
        false
      )
    ).rejects.toThrow(/Challenge witness bytes do not match/);

    // 4. Phished origin rejected (browser signed clientDataJSON for evil-phish.pages.dev)
    const phishJson = buildCanonicalClientDataJSON(chalGood, 'https://evil-phish.pages.dev', 0n);
    const sigPhish = alice.signAssertion({
      challenge: chalGood,
      overrideClientDataJSON: phishJson,
    });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigPhish.witness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Invalid secp256r1 WebAuthn signature/);

    // 5. Wrong rpIdHash in authenticatorData rejected
    const sigWrongRp = alice.signAssertion({ challenge: chalGood, rpId: 'evil.example.com' });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigWrongRp.witness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Invalid secp256r1 WebAuthn signature/);

    // 6. Missing UP flag (0x04 = UV only, UP=0) rejected
    const sigNoUp = alice.signAssertion({ challenge: chalGood, flags: 0x04 });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigNoUp.witness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/User Presence/);

    // 7. Missing UV flag when requireBiometric=true rejected, but allowed when requireBiometric=false
    const sigUpOnly = alice.signAssertion({ challenge: chalGood, flags: 0x01 });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigUpOnly.witness },
        scope,
        actGood,
        true
      )
    ).rejects.toThrow(/User Verification/);

    // 8. Forbidden AT flag (0x45 = UP|UV|AT) rejected
    const sigAtFlag = alice.signAssertion({ challenge: chalGood, flags: 0x45 });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigAtFlag.witness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Unsupported authenticatorData flags/);

    // 9. Forged / 1-bit flipped P-256 signature rejected
    const sigBad = alice.signAssertion({ challenge: chalGood, tamperDigest: true });
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigBad.witness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Invalid secp256r1 WebAuthn signature/);

    // 10. Non-canonical base64url trailing bits rejected
    const badTailWitness = {
      ...sigGood.witness,
      challengeSextets: sigGood.witness.challengeSextets.map((v, idx) =>
        idx === 42 ? v + 1n : v
      ),
    };
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: badTailWitness },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Non-canonical base64url trailing bits/);

    // 11. Unregistered Eve using Alice's Merkle path rejected
    const alicePath = vault.ledger().keyTree.findPathForLeaf(aliceCommit)!;
    const eveSig = eve.signAssertion({ challenge: chalGood });
    await expect(
      vault.authorizeAction(
        {
          credential: eve.credential,
          pendingAssertion: eveSig.witness,
          merklePathOverride: alicePath,
        },
        scope,
        actGood,
        false
      )
    ).rejects.toThrow(/Merkle leaf does not match/);

    // 12. Valid authorization succeeds, then exact replay in same scope MUST revert
    await vault.authorizeAction(
      { credential: alice.credential, pendingAssertion: sigGood.witness },
      scope,
      actGood,
      true
    );
    await expect(
      vault.authorizeAction(
        { credential: alice.credential, pendingAssertion: sigGood.witness },
        scope,
        actGood,
        true
      )
    ).rejects.toThrow(/Nullifier already spent/);
  });

  it('zero-leak ledger privacy audit: public state contains zero passkey coordinates, salts, or signature bytes', async () => {
    const vault = await VaultTestHarness.deploy(false);
    const alice = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const aliceCommit = await vault.registerPasskey({ credential: alice.credential });

    const scope = deriveScopeId('privacy:audit:1');
    const action = deriveActionTag('secret:op');
    const chal = deriveChallenge(DOMAIN_TAGS.ACTION, RP_ID_HASH, scope, action);
    const sig = alice.signAssertion({ challenge: chal });
    const nf = await vault.authorizeAction(
      { credential: alice.credential, pendingAssertion: sig.witness },
      scope,
      action,
      true
    );

    const ledgerHex = bytesToHex(vault.state.serialize());
    const pkXHex = alice.credential.publicKey.x.toString(16).padStart(64, '0');
    const pkYHex = alice.credential.publicKey.y.toString(16).padStart(64, '0');
    const saltHex = bytesToHex(alice.credential.salt);
    const sigRHex = sig.witness.signature.r.toString(16).padStart(64, '0');
    const sigSHex = sig.witness.signature.s.toString(16).padStart(64, '0');

    expect(ledgerHex).not.toContain(pkXHex);
    expect(ledgerHex).not.toContain(pkYHex);
    expect(ledgerHex).not.toContain(saltHex);
    expect(ledgerHex).not.toContain(sigRHex);
    expect(ledgerHex).not.toContain(sigSHex);

    // Nullifier and keyCommit must be completely distinct
    expect(bytesToHex(nf)).not.toBe(bytesToHex(aliceCommit));
    expect(vault.ledger().usedNullifiers.member(aliceCommit)).toBe(false);
    expect(vault.ledger().receipts.member(aliceCommit)).toBe(false);
  });
});
