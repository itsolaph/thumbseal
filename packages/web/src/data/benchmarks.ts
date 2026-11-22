export interface CircuitBenchRow {
  contract: string;
  circuit: string;
  kParam: string;
  zkirInstructions: number;
  proverKeyMB: number;
  verifierKeyBytes: number;
  proveLabel: string;
  highlight?: boolean;
}

export const INITIAL_ECOSYSTEM_STATS = {
  measuredDate: '2026-11-22',
  totalProducts: 249,
  reachableRepos: 173,
  laceDependentRepos: 104,
  lacePercent: 60.1,
  reusablePasskeySdks: 0,
};

export const INITIAL_CIRCUIT_ROWS: CircuitBenchRow[] = [
  {
    contract: 'ThumbSealVault',
    circuit: 'registerPasskey',
    kParam: 'k=15',
    zkirInstructions: 65,
    proverKeyMB: 56.01,
    verifierKeyBytes: 2745,
    proveLabel: '9.57 s warm (6,364 B proof)',
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'authorizeAction',
    kParam: 'k=17 (down from k=18)',
    zkirInstructions: 1451,
    proverKeyMB: 224.04,
    verifierKeyBytes: 2745,
    proveLabel: '33.52 s warm (3.6x faster, 50% smaller key)',
    highlight: true,
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'authorizeActionGrease',
    kParam: 'k=18',
    zkirInstructions: 1451,
    proverKeyMB: 448.04,
    verifierKeyBytes: 2745,
    proveLabel: '121.15 s (isolated Chrome 20% GREASE)',
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'enrollBackupPasskey',
    kParam: 'k=18',
    zkirInstructions: 1498,
    proverKeyMB: 448.05,
    verifierKeyBytes: 2745,
    proveLabel: 'One-time biometric UV=1 recovery',
  },
  {
    contract: 'WalletlessCounter',
    circuit: 'increment',
    kParam: 'k=17',
    zkirInstructions: 1334,
    proverKeyMB: 224.04,
    verifierKeyBytes: 2745,
    proveLabel: '33.23 s warm (15-line migration)',
  },
];

export const BEFORE_COUNTER_CODE = `pragma language_version >= 0.20;
import CompactStandardLibrary;

export ledger round: Counter;

// Standard Midnight starter:
// Requires Lace browser extension,
// funded tNIGHT/tDUST wallet, and
// seed phrase onboarding before
// a user can increment once.
export circuit increment(): [] {
  round.increment(1);
}`;

export const AFTER_COUNTER_CODE = `pragma language_version >= 0.20;
import CompactStandardLibrary;
import "./PasskeyAuth" prefix PA_;

export ledger rpIdHash: Bytes<32>;
export ledger origin: Bytes<27>;
export ledger ownerCommit: Bytes<32>;
export ledger round: Counter;
export ledger usedNonces: Set<Bytes<32>>;

witness localPasskeyPub(): Secp256r1Point;
witness localKeySalt(): Bytes<32>;
witness localWebAuthnAssertion(): PA_WebAuthnAssertion;

export circuit increment(scopeId: Bytes<32>): [] {
  const pk = localPasskeyPub();
  const salt = localKeySalt();
  assert(PA_commitPasskey(pk, salt) == ownerCommit, "Not owner");
  const chal = PA_deriveChallenge(
    "thumbseal:cnt:v1", rpIdHash, scopeId, pad(32, "increment")
  );
  PA_verifyWebAuthnAssertion<27>(
    pk, rpIdHash, origin, chal, false, localWebAuthnAssertion()
  );
  const nf = disclose(
    PA_deriveScopedNullifier(ownerCommit, rpIdHash, scopeId)
  );
  assert(!usedNonces.member(nf), "Replay");
  usedNonces.insert(nf);
  round.increment(1);
}`;

export const SDK_QUICKSTART_CODE = `import {
  registerBrowserPasskey,
  signBrowserAction,
  computeRpIdHash,
  deriveChallenge,
  deriveScopeId,
  deriveActionTag,
  DOMAIN_TAGS,
  createThumbSealWitnesses,
} from '@thumbseal/sdk';
import { computePasskeyCommitment, ThumbSealVault } from '@thumbseal/contracts';

// 1. One-tap TouchID / FaceID / Windows Hello enrollment (zero Lace extension)
const cred = await registerBrowserPasskey({
  rpId: 'thumbseal.pages.dev',
  rpName: 'ThumbSeal',
  origin: 'https://thumbseal.pages.dev',
  userName: 'demo@thumbseal.app',
});

// 2. Bind exact Midnight scope + action into W3C WebAuthn challenge
const rpIdHash = computeRpIdHash(cred.rpId);
const challenge = deriveChallenge(
  DOMAIN_TAGS.ACTION,
  rpIdHash,
  deriveScopeId('dao:proposal:42'),
  deriveActionTag('vote:approve')
);

// 3. Sign inside Secure Enclave and feed packed witness into Compact 0.36
const { witness } = await signBrowserAction({ credential: cred, challenge });
const witnesses = createThumbSealWitnesses(computePasskeyCommitment);`;
