import {
  bytesToHex,
  type PasskeyCredential,
  type WebAuthnAssertionWitness,
} from '@thumbseal/sdk';

export const RELAYER_BASE =
  (import.meta as any).env?.VITE_RELAYER_URL?.replace(/\/$/, '') || '';

export interface LedgerSnapshot {
  mode: 'preview-live' | 'prover-verified' | 'local-preflight';
  network: string;
  contractAddress: string;
  deployTxId: string | null;
  relayerAddress: string | null;
  rpId: string;
  origin: string;
  rpIdHashHex: string;
  defaultRequireUv: boolean;
  registeredCount: number;
  authorizedCount: number;
  merkleRootField: string;
  usedNullifiersCount: number;
  nullifiers: string[];
  receipts: Array<{ nullifier: string; actionTag: string }>;
  serializedStateBytes: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  circuit: string;
  status: 'proved' | 'submitted' | 'reverted' | 'tamper-blocked' | 'preflight';
  tamperLabel?: string;
  nullifierHex?: string;
  keyCommitHex?: string;
  actionTagHex?: string;
  scopeLabel?: string;
  actionLabel?: string;
  proofBytes?: number;
  proveMs?: number;
  txId?: string;
  reason?: string;
  mode: string;
}

export interface HealthResponse {
  ok: boolean;
  mode: 'preview-live' | 'prover-verified';
  network: string;
  rpId: string;
  origin: string;
  proofServerHealthy: boolean;
  dustBalance: string;
  nightBalance: string;
  vault: LedgerSnapshot;
}

export function serializeAssertionForApi(w: WebAuthnAssertionWitness) {
  return {
    signature: {
      r: w.signature.r.toString(16).padStart(64, '0'),
      s: w.signature.s.toString(16).padStart(64, '0'),
    },
    flagsUp: w.flagsUp,
    flagsRfu1: w.flagsRfu1,
    flagsUv: w.flagsUv,
    flagsUpper: Number(w.flagsUpper),
    signCountHex: bytesToHex(w.signCount),
    challengeBytes: w.challengeBytes.map((x) => Number(x)),
    challengeSextets: w.challengeSextets.map((x) => Number(x)),
    challengeTail4: Number(w.challengeTail4),
    clientDataMode: Number(w.clientDataMode),
  };
}

export function serializePubKeyForApi(cred: PasskeyCredential) {
  return {
    x: cred.publicKey.x.toString(16).padStart(64, '0'),
    y: cred.publicKey.y.toString(16).padStart(64, '0'),
    identity: cred.publicKey.identity,
  };
}

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${RELAYER_BASE}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export async function fetchBenchmarks(): Promise<{ ecosystem: any; zkir: any } | null> {
  try {
    const res = await fetch(`${RELAYER_BASE}/api/benchmarks`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled by user', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled by user', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollRelayJob(jobId: string, signal?: AbortSignal, maxWaitMs = 240_000): Promise<any> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await sleepWithAbort(1500, signal);
    const pollRes = await fetch(`${RELAYER_BASE}/api/relay/job/${encodeURIComponent(jobId)}`, {
      signal: signal ?? AbortSignal.timeout(10_000),
    });
    const data = await pollRes.json();
    if (data.status === 'running') continue;
    if (data.status === 'error' || !data.ok) {
      throw new Error(data.error || 'Relayer circuit execution reverted');
    }
    return data;
  }
  throw new Error('Halo2 proving timed out waiting for relayer job');
}

export async function postRegisterPasskey(cred: PasskeyCredential, signal?: AbortSignal) {
  const res = await fetch(`${RELAYER_BASE}/api/relay/register?async=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      publicKey: serializePubKeyForApi(cred),
      saltHex: bytesToHex(cred.salt),
      label: cred.label,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (data.status === 'running' && data.jobId) {
    return pollRelayJob(data.jobId, signal);
  }
  return data;
}

export async function postAuthorizeAction(params: {
  cred: PasskeyCredential;
  scopeLabel: string;
  actionLabel: string;
  requireBiometric: boolean;
  assertion: WebAuthnAssertionWitness;
  tamperLabel?: string;
  signal?: AbortSignal;
}) {
  const res = await fetch(`${RELAYER_BASE}/api/relay/authorize?async=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      publicKey: serializePubKeyForApi(params.cred),
      saltHex: bytesToHex(params.cred.salt),
      scopeLabel: params.scopeLabel,
      actionLabel: params.actionLabel,
      requireBiometric: params.requireBiometric,
      tamperLabel: params.tamperLabel,
      assertion: serializeAssertionForApi(params.assertion),
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  if (data.status === 'running' && data.jobId) {
    return pollRelayJob(data.jobId, params.signal);
  }
  return data;
}
