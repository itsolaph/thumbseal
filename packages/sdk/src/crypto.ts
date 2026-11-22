/**
 * Pure isomorphic WebAuthn / secp256r1 / RFC 4648 base64url / ASN.1 DER / COSE crypto helpers.
 * Zero Node-only dependencies â€” runs identically in browser (Vite/React) and Node.js (Vitest/Relayer).
 * Licensed under the Apache License, Version 2.0.
 */

import { p256 } from '@noble/curves/nist.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import {
  ClientDataMode,
  DOMAIN_TAGS,
  Secp256r1EcdsaSignature,
  Secp256r1Point,
  WEBAUTHN_JSON_SEGMENTS,
  WebAuthnAssertionWitness,
} from './types.js';

export const SECP256R1_ORDER =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
export const SECP256R1_HALF_ORDER = SECP256R1_ORDER >> 1n;

const UTF8_ENC = new TextEncoder();
const UTF8_DEC = new TextDecoder();
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function utf8ToBytes(s: string): Uint8Array {
  return UTF8_ENC.encode(s);
}

export function bytesToUtf8(b: Uint8Array): string {
  return UTF8_DEC.decode(b);
}

export function sha256(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid hex length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < bytes.length; i++) {
    v = (v << 8n) | BigInt(bytes[i]);
  }
  return v;
}

export function bigIntToBytes32BE(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('Negative bigint cannot be encoded as unsigned 32 bytes');
  const out = new Uint8Array(32);
  let cur = n;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(cur & 0xffn);
    cur >>= 8n;
  }
  if (cur !== 0n) throw new Error('BigInt overflows 32 bytes');
  return out;
}

export function bigIntToBytes32LE(n: bigint): Uint8Array {
  const be = bigIntToBytes32BE(n);
  return be.reverse();
}

export function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64URL_ALPHABET[(n >> 18) & 63] +
      B64URL_ALPHABET[(n >> 12) & 63] +
      B64URL_ALPHABET[(n >> 6) & 63] +
      B64URL_ALPHABET[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64URL_ALPHABET[(n >> 18) & 63] + B64URL_ALPHABET[(n >> 12) & 63];
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      B64URL_ALPHABET[(n >> 18) & 63] +
      B64URL_ALPHABET[(n >> 12) & 63] +
      B64URL_ALPHABET[(n >> 6) & 63];
  }
  return out;
}

export function fromBase64Url(str: string): Uint8Array {
  const map = new Map<string, number>();
  for (let i = 0; i < B64URL_ALPHABET.length; i++) map.set(B64URL_ALPHABET[i], i);
  const clean = str.replace(/=+$/, '');
  if (clean.length % 4 === 1) {
    throw new Error(`Invalid base64url length: ${clean.length}`);
  }
  const bits: number[] = [];
  for (const ch of clean) {
    const v = map.get(ch);
    if (v === undefined) throw new Error(`Invalid base64url character: ${ch}`);
    bits.push(v);
  }
  const byteLen = Math.floor((bits.length * 6) / 8);
  const out = new Uint8Array(byteLen);
  let bitBuf = 0;
  let bitCount = 0;
  let outIdx = 0;
  for (const v of bits) {
    bitBuf = (bitBuf << 6) | v;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out[outIdx++] = (bitBuf >> bitCount) & 0xff;
    }
  }
  // Enforce RFC 4648 canonical zero trailing bits
  if (bitCount > 0 && (bitBuf & ((1 << bitCount) - 1)) !== 0) {
    throw new Error('Non-canonical base64url encoding (non-zero trailing bits)');
  }
  return out;
}

export function assertValidP256Point(pt: Secp256r1Point): void {
  if (pt.identity || (pt.x === 0n && pt.y === 0n)) {
    throw new Error('Invalid secp256r1 public key: point at infinity');
  }
  const xBytes = bigIntToBytes32BE(pt.x);
  const yBytes = bigIntToBytes32BE(pt.y);
  const uncompressed = new Uint8Array(65);
  uncompressed[0] = 0x04;
  uncompressed.set(xBytes, 1);
  uncompressed.set(yBytes, 33);
  p256.Point.fromBytes(uncompressed).assertValidity();
}

/**
 * Produces the exact witness tuple required by PasskeyAuth.verifyAndEncodeChallengeBase64Url:
 * 32 bytes, 43 canonical 6-bit base64url sextets, 4-bit tail, and 43-char ASCII string.
 */
export function encodeChallengeForCircuit(challenge: Uint8Array): {
  ascii: string;
  challengeBytes: bigint[];
  challengeSextets: bigint[];
  challengeTail4: bigint;
} {
  if (challenge.length !== 32) {
    throw new Error(`Expected 32-byte challenge, got ${challenge.length}`);
  }
  const challengeBytes: bigint[] = Array.from(challenge, (b) => BigInt(b));
  const challengeSextets: bigint[] = [];
  for (let t = 0; t < 10; t++) {
    const b0 = challenge[3 * t];
    const b1 = challenge[3 * t + 1];
    const b2 = challenge[3 * t + 2];
    const word = (b0 << 16) | (b1 << 8) | b2;
    challengeSextets.push(
      BigInt((word >> 18) & 63),
      BigInt((word >> 12) & 63),
      BigInt((word >> 6) & 63),
      BigInt(word & 63)
    );
  }
  const tail16 = (challenge[30] << 8) | challenge[31];
  const s40 = (tail16 >> 10) & 63;
  const s41 = (tail16 >> 4) & 63;
  const tail4 = tail16 & 15;
  const s42 = tail4 << 2;
  challengeSextets.push(BigInt(s40), BigInt(s41), BigInt(s42));

  const ascii = challengeSextets.map((s) => B64URL_ALPHABET[Number(s)]).join('');
  return {
    ascii,
    challengeBytes,
    challengeSextets,
    challengeTail4: BigInt(tail4),
  };
}

/** Computes rpIdHash = SHA-256(rpId). */
export function computeRpIdHash(rpId: string): Uint8Array {
  return sha256(utf8ToBytes(rpId));
}

/** Derives a deterministic 32-byte scopeId from a human-readable label. */
export function deriveScopeId(label: string): Uint8Array {
  return sha256(utf8ToBytes(`thumbseal:scope:${label}`));
}

/** Derives a deterministic 32-byte actionTag from a human-readable label. */
export function deriveActionTag(label: string): Uint8Array {
  return sha256(utf8ToBytes(`thumbseal:action:${label}`));
}

/**
 * Matches PasskeyAuth.deriveChallenge(domainTag, rpIdHash, scopeId, actionTag) bit-for-bit.
 * domainTag MUST be 16 ASCII bytes (e.g. DOMAIN_TAGS.ACTION).
 */
export function deriveChallenge(
  domainTag: string,
  rpIdHash: Uint8Array,
  scopeId: Uint8Array,
  actionTag: Uint8Array
): Uint8Array {
  const tagBytes = utf8ToBytes(domainTag);
  if (tagBytes.length !== 16) throw new Error(`domainTag must be 16 bytes, got ${tagBytes.length}`);
  if (rpIdHash.length !== 32) throw new Error('rpIdHash must be 32 bytes');
  if (scopeId.length !== 32) throw new Error('scopeId must be 32 bytes');
  if (actionTag.length !== 32) throw new Error('actionTag must be 32 bytes');
  return sha256(concatBytes(tagBytes, rpIdHash, scopeId, actionTag));
}

/**
 * Matches PasskeyAuth.deriveScopedNullifier(keyCommit, rpIdHash, scopeId) bit-for-bit.
 */
export function deriveScopedNullifier(
  keyCommit: Uint8Array,
  rpIdHash: Uint8Array,
  scopeId: Uint8Array
): Uint8Array {
  const tagBytes = utf8ToBytes(DOMAIN_TAGS.NULLIFIER);
  return sha256(concatBytes(tagBytes, keyCommit, rpIdHash, scopeId));
}

/**
 * Builds exact canonical W3C clientDataJSON bytes for a given challenge, origin, and mode.
 */
export function buildCanonicalClientDataJSON(
  challenge: Uint8Array,
  origin: string,
  mode: ClientDataMode = 0n
): Uint8Array {
  const b64 = toBase64Url(challenge);
  const suffix =
    mode === 0n
      ? WEBAUTHN_JSON_SEGMENTS.SUFFIX_CROSS
      : mode === 1n
        ? WEBAUTHN_JSON_SEGMENTS.SUFFIX_PLAIN
        : WEBAUTHN_JSON_SEGMENTS.SUFFIX_GREASE;
  return utf8ToBytes(
    `${WEBAUTHN_JSON_SEGMENTS.PREFIX_GET}${b64}${WEBAUTHN_JSON_SEGMENTS.MID_ORIGIN}${origin}${suffix}`
  );
}

/**
 * Detects which in-circuit clientDataJSON mode matches a real browser's returned bytes.
 * Throws a clear diagnostic error if origin, type, challenge, or extra keys mismatch.
 */
export function detectClientDataMode(
  clientDataJSON: Uint8Array,
  expectedOrigin: string,
  expectedChallenge: Uint8Array
): ClientDataMode {
  const text = bytesToUtf8(clientDataJSON);
  for (const mode of [0n, 1n, 2n] as const) {
    const candidate = bytesToUtf8(
      buildCanonicalClientDataJSON(expectedChallenge, expectedOrigin, mode)
    );
    if (text === candidate) return mode;
  }
  throw new Error(
    `Browser clientDataJSON does not match supported canonical W3C modes for origin "${expectedOrigin}". Received: ${text}`
  );
}

/**
 * Parses a 37-byte W3C WebAuthn authenticatorData buffer into exact PasskeyAuth flags & fields.
 */
export function decodeAuthenticatorData(authData: Uint8Array): {
  rpIdHash: Uint8Array;
  flags: number;
  flagsUp: boolean;
  flagsRfu1: boolean;
  flagsUv: boolean;
  flagsUpper: bigint;
  signCount: Uint8Array;
  signCountNumber: number;
} {
  if (authData.length !== 37) {
    throw new Error(
      `Expected 37-byte standard WebAuthn get() authenticatorData, got ${authData.length} bytes`
    );
  }
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount = authData.slice(33, 37);
  const signCountNumber =
    ((signCount[0] << 24) | (signCount[1] << 16) | (signCount[2] << 8) | signCount[3]) >>> 0;
  return {
    rpIdHash,
    flags,
    flagsUp: (flags & 0x01) !== 0,
    flagsRfu1: (flags & 0x02) !== 0,
    flagsUv: (flags & 0x04) !== 0,
    flagsUpper: BigInt((flags >> 3) & 0x1f),
    signCount,
    signCountNumber,
  };
}

/**
 * Parses an ASN.1 DER-encoded ECDSA signature from WebAuthn into normalized low-S { r, s }.
 */
export function parseDerEcdsaSignature(der: Uint8Array): Secp256r1EcdsaSignature {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('Invalid DER signature: missing SEQUENCE tag');
  const seqLen = der[offset++];
  if (offset + seqLen !== der.length) {
    throw new Error('Invalid DER signature: SEQUENCE length mismatch');
  }
  const readInt = (): bigint => {
    if (der[offset++] !== 0x02) throw new Error('Invalid DER signature: missing INTEGER tag');
    const len = der[offset++];
    if (len === 0 || offset + len > der.length) {
      throw new Error('Invalid DER signature: INTEGER length out of bounds');
    }
    let slice = der.slice(offset, offset + len);
    offset += len;
    if (slice[0] === 0x00 && slice.length > 1) slice = slice.slice(1);
    if (slice.length > 32) throw new Error('Invalid DER signature: integer > 32 bytes');
    return bytesToBigIntBE(slice);
  };
  const r = readInt();
  const sRaw = readInt();
  if (offset !== der.length) throw new Error('Invalid DER signature: trailing bytes');
  if (r <= 0n || r >= SECP256R1_ORDER || sRaw <= 0n || sRaw >= SECP256R1_ORDER) {
    throw new Error('Invalid ECDSA signature scalar out of secp256r1 order');
  }
  // Canonical low-S normalization
  const s = sRaw > SECP256R1_HALF_ORDER ? SECP256R1_ORDER - sRaw : sRaw;
  return { r, s };
}

/**
 * Encodes { r, s } as ASN.1 DER (used by VirtualAuthenticator to match real WebAuthn output).
 */
export function encodeDerEcdsaSignature(sig: Secp256r1EcdsaSignature): Uint8Array {
  const encodeInt = (v: bigint): Uint8Array => {
    let b = bigIntToBytes32BE(v);
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    b = b.slice(i);
    if (b[0] & 0x80) {
      return concatBytes(new Uint8Array([0x02, b.length + 1, 0x00]), b);
    }
    return concatBytes(new Uint8Array([0x02, b.length]), b);
  };
  const rDer = encodeInt(sig.r);
  const sDer = encodeInt(sig.s);
  return concatBytes(new Uint8Array([0x30, rDer.length + sDer.length]), rDer, sDer);
}

/**
 * Extracts a secp256r1 (x, y) point from an X.509 SubjectPublicKeyInfo (SPKI) buffer
 * returned by AuthenticatorAttestationResponse.getPublicKey().
 */
export function extractP256PublicKeyFromSpki(spki: Uint8Array): Secp256r1Point {
  // Standard P-256 SPKI is 91 bytes: 26-byte DER header + 0x04 + X(32) + Y(32)
  if (spki.length < 65) throw new Error(`SPKI buffer too short (${spki.length} bytes)`);
  const uncompressed = spki.slice(spki.length - 65);
  if (uncompressed[0] !== 0x04) {
    throw new Error('Expected uncompressed P-256 point prefix 0x04 in SPKI');
  }
  const x = bytesToBigIntBE(uncompressed.slice(1, 33));
  const y = bytesToBigIntBE(uncompressed.slice(33, 65));
  // Validate point lies on secp256r1 curve
  p256.Point.fromBytes(uncompressed);
  return { x, y, identity: false };
}

/**
 * Minimal CBOR/COSE EC2 P-256 public key extractor from raw attestationObject
 * (fallback when AuthenticatorAttestationResponse.getPublicKey() is unavailable).
 */
export function extractP256PublicKeyFromCose(coseKey: Uint8Array): Secp256r1Point {
  // Search for COSE map keys -2 (0x21) followed by 32-byte bstr (0x58 0x20)
  // and -3 (0x22) followed by 32-byte bstr (0x58 0x20).
  const findCoord = (keyByte: number): Uint8Array => {
    for (let i = 0; i <= coseKey.length - 35; i++) {
      if (coseKey[i] === keyByte && coseKey[i + 1] === 0x58 && coseKey[i + 2] === 0x20) {
        return coseKey.slice(i + 3, i + 35);
      }
    }
    throw new Error(`COSE P-256 coordinate key 0x${keyByte.toString(16)} not found`);
  };
  const xBytes = findCoord(0x21);
  const yBytes = findCoord(0x22);
  const uncompressed = concatBytes(new Uint8Array([0x04]), xBytes, yBytes);
  p256.Point.fromBytes(uncompressed);
  return {
    x: bytesToBigIntBE(xBytes),
    y: bytesToBigIntBE(yBytes),
    identity: false,
  };
}

/**
 * Packs raw WebAuthn get() response buffers into a Compact PasskeyAuth_WebAuthnAssertion witness.
 */
export function packWebAuthnAssertionWitness(params: {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signatureDer: Uint8Array;
  expectedOrigin: string;
  expectedChallenge: Uint8Array;
}): WebAuthnAssertionWitness {
  const decodedAuth = decodeAuthenticatorData(params.authenticatorData);
  const clientDataMode = detectClientDataMode(
    params.clientDataJSON,
    params.expectedOrigin,
    params.expectedChallenge
  );
  const signature = parseDerEcdsaSignature(params.signatureDer);
  const chal = encodeChallengeForCircuit(params.expectedChallenge);
  return {
    signature,
    flagsUp: decodedAuth.flagsUp,
    flagsRfu1: decodedAuth.flagsRfu1,
    flagsUv: decodedAuth.flagsUv,
    flagsUpper: decodedAuth.flagsUpper,
    signCount: decodedAuth.signCount,
    challengeBytes: chal.challengeBytes,
    challengeSextets: chal.challengeSextets,
    challengeTail4: chal.challengeTail4,
    clientDataMode,
  };
}

/**
 * Verifies a packed WebAuthnAssertionWitness off-chain using @noble/curves/nist p256
 * (useful as a pre-flight check before paying ZK proof-server latency).
 */
export function preflightVerifyAssertion(params: {
  publicKey: Secp256r1Point;
  rpIdHash: Uint8Array;
  origin: string;
  expectedChallenge: Uint8Array;
  requireUv: boolean;
  assertion: WebAuthnAssertionWitness;
}): boolean {
  const { publicKey, rpIdHash, origin, expectedChallenge, requireUv, assertion } = params;
  if (publicKey.identity) return false;
  if (!assertion.flagsUp) return false;
  if (requireUv && !assertion.flagsUv) return false;
  if (assertion.flagsUpper >= 4n) return false;

  const authFlags =
    (assertion.flagsUp ? 1 : 0) |
    (assertion.flagsRfu1 ? 2 : 0) |
    (assertion.flagsUv ? 4 : 0) |
    (Number(assertion.flagsUpper) << 3);

  const clientDataJSON = buildCanonicalClientDataJSON(
    expectedChallenge,
    origin,
    assertion.clientDataMode
  );
  const clientDataHash = sha256(clientDataJSON);
  const signingDigest = sha256(
    concatBytes(rpIdHash, new Uint8Array([authFlags]), assertion.signCount, clientDataHash)
  );

  const compactSig = concatBytes(
    bigIntToBytes32BE(assertion.signature.r),
    bigIntToBytes32BE(assertion.signature.s)
  );
  const pubBytes = concatBytes(
    new Uint8Array([0x04]),
    bigIntToBytes32BE(publicKey.x),
    bigIntToBytes32BE(publicKey.y)
  );
  return p256.verify(compactSig, signingDigest, pubBytes, { prehash: false });
}
