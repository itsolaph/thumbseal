/**
 * Deterministic software NIST P-256 (secp256r1) WebAuthn Virtual Authenticator.
 * Produces real W3C WebAuthn authenticatorData, clientDataJSON (modes 0/1/2),
 * and ASN.1 DER ECDSA P-256 signatures for automated QA tests and headless demo environments.
 * Licensed under the Apache License, Version 2.0.
 */

import { p256 } from '@noble/curves/nist.js';
import {
  bigIntToBytes32BE,
  buildCanonicalClientDataJSON,
  bytesToBigIntBE,
  computeRpIdHash,
  concatBytes,
  encodeDerEcdsaSignature,
  packWebAuthnAssertionWitness,
  randomBytes,
  sha256,
  toBase64Url,
} from './crypto.js';
import { ClientDataMode, PasskeyCredential, WebAuthnAssertionWitness } from './types.js';

export interface VirtualSignOptions {
  challenge: Uint8Array;
  origin?: string;
  rpId?: string;
  flags?: number;
  clientDataMode?: ClientDataMode;
  /** Override signing digest or signature for adversarial tamper testing. */
  tamperDigest?: boolean;
  /** Override raw clientDataJSON bytes (e.g. phishing origin test). */
  overrideClientDataJSON?: Uint8Array;
}

export class VirtualPasskeyAuthenticator {
  readonly secretKey: Uint8Array;
  readonly credential: PasskeyCredential;
  private signCounter = 0;

  constructor(params: {
    rpId: string;
    origin: string;
    label?: string;
    secretKey?: Uint8Array;
    salt?: Uint8Array;
  }) {
    this.secretKey = params.secretKey ?? p256.utils.randomSecretKey();
    const uncompressed = p256.getPublicKey(this.secretKey, false);
    const x = bytesToBigIntBE(uncompressed.slice(1, 33));
    const y = bytesToBigIntBE(uncompressed.slice(33, 65));
    const salt = params.salt ?? randomBytes(32);
    const credentialIdBytes = sha256(concatBytes(uncompressed, salt)).slice(0, 24);

    this.credential = {
      credentialId: toBase64Url(credentialIdBytes),
      credentialIdBytes,
      rpId: params.rpId,
      origin: params.origin,
      publicKey: { x, y, identity: false },
      salt,
      label: params.label ?? 'Virtual P-256 Passkey',
      kind: 'virtual',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Produces raw W3C WebAuthn assertion buffers (authenticatorData, clientDataJSON, signatureDer)
   * PLUS the ready-to-prove Compact WebAuthnAssertionWitness.
   */
  signAssertion(opts: VirtualSignOptions): {
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    signatureDer: Uint8Array;
    signingDigest: Uint8Array;
    witness: WebAuthnAssertionWitness;
  } {
    this.signCounter += 1;
    const rpIdHash = computeRpIdHash(opts.rpId ?? this.credential.rpId);
    // Default flags: UP(0x01) | UV(0x04) | BE(0x08) | BS(0x10) = 0x1d (matches Apple/Google synced passkeys)
    const flags = opts.flags ?? 0x1d;
    const signCount = new Uint8Array(4);
    signCount[0] = (this.signCounter >>> 24) & 0xff;
    signCount[1] = (this.signCounter >>> 16) & 0xff;
    signCount[2] = (this.signCounter >>> 8) & 0xff;
    signCount[3] = this.signCounter & 0xff;

    const authenticatorData = concatBytes(rpIdHash, new Uint8Array([flags]), signCount);
    const mode = opts.clientDataMode ?? 0n;
    const clientDataJSON =
      opts.overrideClientDataJSON ??
      buildCanonicalClientDataJSON(opts.challenge, opts.origin ?? this.credential.origin, mode);

    const clientDataHash = sha256(clientDataJSON);
    let signingDigest = sha256(concatBytes(authenticatorData, clientDataHash));
    if (opts.tamperDigest) {
      signingDigest = new Uint8Array(signingDigest);
      signingDigest[0] ^= 0xff;
    }

    const compactSig = p256.sign(signingDigest, this.secretKey, {
      prehash: false,
      lowS: true,
    });
    const r = bytesToBigIntBE(compactSig.slice(0, 32));
    const s = bytesToBigIntBE(compactSig.slice(32, 64));
    const signatureDer = encodeDerEcdsaSignature({ r, s });

    // If caller overrode clientDataJSON (e.g. phishing origin test), pack witness using the
    // contract's expected origin & challenge so the ZK circuit observes the invalid signature!
    const witness = opts.overrideClientDataJSON
      ? packWebAuthnAssertionWitness({
          authenticatorData,
          clientDataJSON: buildCanonicalClientDataJSON(
            opts.challenge,
            this.credential.origin,
            mode
          ),
          signatureDer,
          expectedOrigin: this.credential.origin,
          expectedChallenge: opts.challenge,
        })
      : packWebAuthnAssertionWitness({
          authenticatorData,
          clientDataJSON,
          signatureDer,
          expectedOrigin: opts.origin ?? this.credential.origin,
          expectedChallenge: opts.challenge,
        });

    return {
      authenticatorData,
      clientDataJSON,
      signatureDer,
      signingDigest,
      witness,
    };
  }
}
