export interface CircuitBenchRow {
  contract: string;
  circuit: string;
  kParam: string;
  zkirInstructions: number;
  proverKeyMB: number;
  verifierKeyBytes: number;
  proveTime: string;
  roleNote: string;
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

export const CIRCUIT_ROLE_NOTES: Record<string, string> = {
  'ThumbSealVault.registerPasskey': 'One-time passkey commitment (6,364 B proof)',
  'ThumbSealVault.authorizeAction': 'Hot path: 1.93x faster paired (85.5 s -> 44.2 s), 50% smaller key',
  'ThumbSealVault.authorizeActionGrease': 'Isolated Chrome 20% GREASE suffix path',
  'ThumbSealVault.enrollBackupPasskey': 'One-time biometric UV=1 backup recovery',
  'WalletlessCounter.increment': 'Drop-in Counter migration example',
};

export const INITIAL_CIRCUIT_ROWS: CircuitBenchRow[] = [
  {
    contract: 'ThumbSealVault',
    circuit: 'registerPasskey',
    kParam: 'k=15',
    zkirInstructions: 65,
    proverKeyMB: 56.01,
    verifierKeyBytes: 2745,
    proveTime: '11.93 s',
    roleNote: CIRCUIT_ROLE_NOTES['ThumbSealVault.registerPasskey'],
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'authorizeAction',
    kParam: 'k=17',
    zkirInstructions: 1451,
    proverKeyMB: 224.04,
    verifierKeyBytes: 2745,
    proveTime: '27.76 s',
    roleNote: CIRCUIT_ROLE_NOTES['ThumbSealVault.authorizeAction'],
    highlight: true,
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'authorizeActionGrease',
    kParam: 'k=18',
    zkirInstructions: 1451,
    proverKeyMB: 448.04,
    verifierKeyBytes: 2745,
    proveTime: '80.95 s',
    roleNote: CIRCUIT_ROLE_NOTES['ThumbSealVault.authorizeActionGrease'],
  },
  {
    contract: 'ThumbSealVault',
    circuit: 'enrollBackupPasskey',
    kParam: 'k=18',
    zkirInstructions: 1498,
    proverKeyMB: 448.05,
    verifierKeyBytes: 2745,
    proveTime: 'Compiled',
    roleNote: CIRCUIT_ROLE_NOTES['ThumbSealVault.enrollBackupPasskey'],
  },
  {
    contract: 'WalletlessCounter',
    circuit: 'increment',
    kParam: 'k=17',
    zkirInstructions: 1334,
    proverKeyMB: 224.04,
    verifierKeyBytes: 2745,
    proveTime: '35.21 s',
    roleNote: CIRCUIT_ROLE_NOTES['WalletlessCounter.increment'],
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

export const AFTER_COUNTER_LINES: Array<{ text: string; added?: boolean }> = [
  { text: 'pragma language_version >= 0.20;' },
  { text: 'import CompactStandardLibrary;' },
  { text: 'import "./PasskeyAuth" prefix PA_;', added: true },
  { text: '' },
  { text: 'export ledger rpIdHash: Bytes<32>;', added: true },
  { text: 'export ledger origin: Bytes<27>;', added: true },
  { text: 'export ledger ownerCommit: Bytes<32>;', added: true },
  { text: 'export ledger round: Counter;' },
  { text: 'export ledger usedNonces: Set<Bytes<32>>;', added: true },
  { text: '' },
  { text: 'witness localPasskeyPub(): Secp256r1Point;', added: true },
  { text: 'witness localKeySalt(): Bytes<32>;', added: true },
  { text: 'witness localWebAuthnAssertion(): PA_WebAuthnAssertion;', added: true },
  { text: '' },
  { text: 'export circuit increment(scopeId: Bytes<32>): [] {', added: true },
  { text: '  const pk = localPasskeyPub();', added: true },
  { text: '  const salt = localKeySalt();', added: true },
  { text: '  assert(PA_commitPasskey(pk, salt) == ownerCommit, "Not owner");', added: true },
  { text: '  const chal = PA_deriveChallenge(', added: true },
  { text: '    "thumbseal:cnt:v1", rpIdHash, scopeId, pad(32, "increment")', added: true },
  { text: '  );', added: true },
  { text: '  PA_verifyWebAuthnAssertion<27>(', added: true },
  { text: '    pk, rpIdHash, origin, chal, false, localWebAuthnAssertion()', added: true },
  { text: '  );', added: true },
  { text: '  const nf = disclose(', added: true },
  { text: '    PA_deriveScopedNullifier(ownerCommit, rpIdHash, scopeId)', added: true },
  { text: '  );', added: true },
  { text: '  assert(!usedNonces.member(nf), "Replay");', added: true },
  { text: '  usedNonces.insert(nf);', added: true },
  { text: '  round.increment(1);' },
  { text: '}' },
];

export const AFTER_COUNTER_CODE = AFTER_COUNTER_LINES.map((l) => l.text).join('\n');

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
import { computePasskeyCommitment } from '@thumbseal/contracts';

// 1. One-tap TouchID / FaceID / Windows Hello enrollment (zero Lace extension)
const cred = await registerBrowserPasskey({
  rpId: 'thumbseal.pages.dev',
  rpName: 'ThumbSeal',
  origin: 'https://thumbseal.pages.dev',
  userName: 'member@thumbseal.app',
});

// 2. Bind exact Midnight scope + action into W3C WebAuthn challenge
const rpIdHash = computeRpIdHash(cred.rpId);
const challenge = deriveChallenge(
  DOMAIN_TAGS.ACTION,
  rpIdHash,
  deriveScopeId('dao:proposal:42'),
  deriveActionTag('vote:approve')
);

// 3. Sign inside Secure Enclave and feed packed witness into Compact 0.36.1
const { witness } = await signBrowserAction({ credential: cred, challenge });
const witnesses = createThumbSealWitnesses(computePasskeyCommitment);`;
