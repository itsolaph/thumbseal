/**
 * Browser WebAuthn Passkey Client (TouchID / FaceID / Windows Hello / YubiKey)
 * for walletless Midnight dApps. Zero Lace extension required.
 * Licensed under the Apache License, Version 2.0.
 */

import {
  extractP256PublicKeyFromCose,
  extractP256PublicKeyFromSpki,
  fromBase64Url,
  packWebAuthnAssertionWitness,
  randomBytes,
  toBase64Url,
  utf8ToBytes,
} from './crypto.js';
import { PasskeyCredential, WebAuthnAssertionWitness } from './types.js';

export function isWebAuthnSupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.navigator !== 'undefined' &&
    typeof globalThis.navigator.credentials?.create === 'function' &&
    typeof globalThis.PublicKeyCredential !== 'undefined'
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await globalThis.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export interface RegisterBrowserPasskeyOptions {
  rpId: string;
  rpName: string;
  origin: string;
  userName: string;
  displayName?: string;
  label?: string;
}

/**
 * Triggers the device's native Passkey prompt (TouchID, FaceID, Windows Hello, or FIDO2 key)
 * requesting an ES256 (secp256r1 / P-256) credential and extracts the uncompressed (x, y) key.
 */
export async function registerBrowserPasskey(
  opts: RegisterBrowserPasskeyOptions
): Promise<PasskeyCredential> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn (navigator.credentials) is unavailable in this environment');
  }

  const challenge = randomBytes(32);
  const userId = randomBytes(16);

  const created = (await globalThis.navigator.credentials.create({
    publicKey: {
      challenge: challenge.buffer as ArrayBuffer,
      rp: { id: opts.rpId, name: opts.rpName },
      user: {
        id: userId.buffer as ArrayBuffer,
        name: opts.userName,
        displayName: opts.displayName ?? opts.userName,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256 / secp256r1
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!created) {
    throw new Error('Passkey creation was cancelled by the user');
  }

  const response = created.response as AuthenticatorAttestationResponse;
  let publicKey;
  if (typeof response.getPublicKey === 'function') {
    const spkiBuf = response.getPublicKey();
    if (spkiBuf) {
      publicKey = extractP256PublicKeyFromSpki(new Uint8Array(spkiBuf));
    }
  }
  if (!publicKey) {
    publicKey = extractP256PublicKeyFromCose(new Uint8Array(response.attestationObject));
  }

  const credentialIdBytes = new Uint8Array(created.rawId);
  const salt = randomBytes(32);

  return {
    credentialId: toBase64Url(credentialIdBytes),
    credentialIdBytes,
    rpId: opts.rpId,
    origin: opts.origin,
    publicKey,
    salt,
    label: opts.label ?? `${opts.displayName ?? opts.userName} (Passkey)`,
    kind: 'hardware',
    createdAt: new Date().toISOString(),
  };
}

export interface SignBrowserActionOptions {
  credential: PasskeyCredential;
  challenge: Uint8Array;
  userVerification?: UserVerificationRequirement;
}

/**
 * Triggers a native WebAuthn assertion for the exact 32-byte Midnight circuit challenge
 * and returns a packed PasskeyAuth_WebAuthnAssertion witness.
 */
export async function signBrowserAction(opts: SignBrowserActionOptions): Promise<{
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signatureDer: Uint8Array;
  witness: WebAuthnAssertionWitness;
}> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn (navigator.credentials) is unavailable in this environment');
  }

  const assertion = (await globalThis.navigator.credentials.get({
    publicKey: {
      challenge: opts.challenge.buffer as ArrayBuffer,
      rpId: opts.credential.rpId,
      allowCredentials: [
        {
          type: 'public-key',
          id: opts.credential.credentialIdBytes.buffer as ArrayBuffer,
        },
      ],
      userVerification: opts.userVerification ?? 'preferred',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Passkey assertion was cancelled by the user');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new Uint8Array(response.clientDataJSON);
  const signatureDer = new Uint8Array(response.signature);

  const witness = packWebAuthnAssertionWitness({
    authenticatorData,
    clientDataJSON,
    signatureDer,
    expectedOrigin: opts.credential.origin,
    expectedChallenge: opts.challenge,
  });

  return { authenticatorData, clientDataJSON, signatureDer, witness };
}

/**
 * Serializes/deserializes PasskeyCredential safely for localStorage (device-local only).
 */
export function serializeCredential(cred: PasskeyCredential): string {
  return JSON.stringify({
    credentialId: cred.credentialId,
    rpId: cred.rpId,
    origin: cred.origin,
    publicKey: {
      x: cred.publicKey.x.toString(16),
      y: cred.publicKey.y.toString(16),
      identity: cred.publicKey.identity,
    },
    salt: toBase64Url(cred.salt),
    label: cred.label,
    kind: cred.kind,
    createdAt: cred.createdAt,
  });
}

export function deserializeCredential(raw: string): PasskeyCredential {
  const parsed = JSON.parse(raw);
  return {
    credentialId: parsed.credentialId,
    credentialIdBytes: fromBase64Url(parsed.credentialId),
    rpId: parsed.rpId,
    origin: parsed.origin,
    publicKey: {
      x: BigInt('0x' + parsed.publicKey.x),
      y: BigInt('0x' + parsed.publicKey.y),
      identity: Boolean(parsed.publicKey.identity),
    },
    salt: fromBase64Url(parsed.salt),
    label: parsed.label,
    kind: parsed.kind,
    createdAt: parsed.createdAt,
  };
}

export { utf8ToBytes };
