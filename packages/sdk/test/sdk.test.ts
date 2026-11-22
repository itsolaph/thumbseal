import { describe, expect, it } from 'vitest';
import {
  buildCanonicalClientDataJSON,
  computeRpIdHash,
  concatBytes,
  decodeAuthenticatorData,
  deriveActionTag,
  deriveChallenge,
  deriveScopeId,
  deserializeCredential,
  detectClientDataMode,
  DOMAIN_TAGS,
  encodeChallengeForCircuit,
  encodeDerEcdsaSignature,
  extractP256PublicKeyFromCose,
  extractP256PublicKeyFromSpki,
  parseDerEcdsaSignature,
  preflightVerifyAssertion,
  randomBytes,
  SECP256R1_HALF_ORDER,
  SECP256R1_ORDER,
  serializeCredential,
  toBase64Url,
  utf8ToBytes,
  VirtualPasskeyAuthenticator,
} from '../src/index.js';
import { p256 } from '@noble/curves/nist.js';

const RP_ID = 'thumbseal.pages.dev';
const ORIGIN = 'https://thumbseal.pages.dev';

describe('@thumbseal/sdk crypto & WebAuthn primitives', () => {
  it('encodes 32-byte challenges into bijective base64url sextets with zero trailing bits', () => {
    for (let i = 0; i < 20; i++) {
      const chal = randomBytes(32);
      const enc = encodeChallengeForCircuit(chal);
      expect(enc.ascii).toBe(toBase64Url(chal));
      expect(enc.ascii.length).toBe(43);
      expect(enc.challengeBytes.length).toBe(32);
      expect(enc.challengeSextets.length).toBe(43);
      expect(enc.challengeSextets[42]).toBe(enc.challengeTail4 * 4n);
      // Verify 24-bit triplet arithmetic matches PasskeyAuth.compact
      for (let t = 0; t < 10; t++) {
        const lhs =
          enc.challengeBytes[3 * t] * 65536n +
          enc.challengeBytes[3 * t + 1] * 256n +
          enc.challengeBytes[3 * t + 2];
        const rhs =
          enc.challengeSextets[4 * t] * 262144n +
          enc.challengeSextets[4 * t + 1] * 4096n +
          enc.challengeSextets[4 * t + 2] * 64n +
          enc.challengeSextets[4 * t + 3];
        expect(lhs).toBe(rhs);
      }
      const tailLhs = enc.challengeBytes[30] * 256n + enc.challengeBytes[31];
      const tailRhs =
        enc.challengeSextets[40] * 1024n + enc.challengeSextets[41] * 16n + enc.challengeTail4;
      expect(tailLhs).toBe(tailRhs);
    }
  });

  it('parses ASN.1 DER signatures and normalizes high-S to canonical low-S', () => {
    const r = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
    const highS = SECP256R1_ORDER - 42n;
    expect(highS > SECP256R1_HALF_ORDER).toBe(true);
    const der = encodeDerEcdsaSignature({ r, s: highS });
    const parsed = parseDerEcdsaSignature(der);
    expect(parsed.r).toBe(r);
    expect(parsed.s).toBe(42n);
    expect(parsed.s <= SECP256R1_HALF_ORDER).toBe(true);
  });

  it('extracts valid secp256r1 points from both SPKI and COSE EC2 encodings', () => {
    const sk = p256.utils.randomSecretKey();
    const uncompressed = p256.getPublicKey(sk, false);
    // Synthetic 91-byte SPKI: 26-byte DER prefix + 65-byte uncompressed point
    const spki = concatBytes(new Uint8Array(26), uncompressed);
    const fromSpki = extractP256PublicKeyFromSpki(spki);

    // Synthetic COSE EC2 map containing -2 (0x21) bstr(32) X and -3 (0x22) bstr(32) Y
    const cose = concatBytes(
      new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
      uncompressed.slice(1, 33),
      new Uint8Array([0x22, 0x58, 0x20]),
      uncompressed.slice(33, 65)
    );
    const fromCose = extractP256PublicKeyFromCose(cose);

    expect(fromSpki.x).toBe(fromCose.x);
    expect(fromSpki.y).toBe(fromCose.y);
    expect(fromSpki.identity).toBe(false);
  });

  it('detects all 3 canonical W3C/Chromium clientDataJSON modes and rejects phished origins', () => {
    const chal = randomBytes(32);
    for (const mode of [0n, 1n, 2n] as const) {
      const json = buildCanonicalClientDataJSON(chal, ORIGIN, mode);
      expect(detectClientDataMode(json, ORIGIN, chal)).toBe(mode);
    }
    const phished = buildCanonicalClientDataJSON(chal, 'https://evil-phish.pages.dev', 0n);
    expect(() => detectClientDataMode(phished, ORIGIN, chal)).toThrow();
    const wrongType = utf8ToBytes(
      `{"type":"webauthn.create","challenge":"${toBase64Url(chal)}","origin":"${ORIGIN}","crossOrigin":false}`
    );
    expect(() => detectClientDataMode(wrongType, ORIGIN, chal)).toThrow();
  });

  it('signs and preflight-verifies assertions across modes 0/1/2 and rejects tampered payloads', () => {
    const auth = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const rpIdHash = computeRpIdHash(RP_ID);
    const scopeId = deriveScopeId('dao:proposal:1');
    const actionTag = deriveActionTag('vote:approve');
    const challenge = deriveChallenge(DOMAIN_TAGS.ACTION, rpIdHash, scopeId, actionTag);

    for (const mode of [0n, 1n, 2n] as const) {
      const signed = auth.signAssertion({ challenge, clientDataMode: mode });
      const decoded = decodeAuthenticatorData(signed.authenticatorData);
      expect(decoded.flagsUp).toBe(true);
      expect(decoded.flagsUv).toBe(true);
      expect(
        preflightVerifyAssertion({
          publicKey: auth.credential.publicKey,
          rpIdHash,
          origin: ORIGIN,
          expectedChallenge: challenge,
          requireUv: true,
          assertion: signed.witness,
        })
      ).toBe(true);
    }

    // Tampered digest must fail
    const bad = auth.signAssertion({ challenge, tamperDigest: true });
    expect(
      preflightVerifyAssertion({
        publicKey: auth.credential.publicKey,
        rpIdHash,
        origin: ORIGIN,
        expectedChallenge: challenge,
        requireUv: true,
        assertion: bad.witness,
      })
    ).toBe(false);

    // Missing UV flag must fail when requireUv = true, pass when requireUv = false
    const upOnly = auth.signAssertion({ challenge, flags: 0x01 });
    expect(
      preflightVerifyAssertion({
        publicKey: auth.credential.publicKey,
        rpIdHash,
        origin: ORIGIN,
        expectedChallenge: challenge,
        requireUv: true,
        assertion: upOnly.witness,
      })
    ).toBe(false);
    expect(
      preflightVerifyAssertion({
        publicKey: auth.credential.publicKey,
        rpIdHash,
        origin: ORIGIN,
        expectedChallenge: challenge,
        requireUv: false,
        assertion: upOnly.witness,
      })
    ).toBe(true);
  });

  it('round-trips PasskeyCredential serialization cleanly', () => {
    const auth = new VirtualPasskeyAuthenticator({ rpId: RP_ID, origin: ORIGIN });
    const restored = deserializeCredential(serializeCredential(auth.credential));
    expect(restored.credentialId).toBe(auth.credential.credentialId);
    expect(restored.publicKey.x).toBe(auth.credential.publicKey.x);
    expect(restored.publicKey.y).toBe(auth.credential.publicKey.y);
    expect(toBase64Url(restored.salt)).toBe(toBase64Url(auth.credential.salt));
  });
});
