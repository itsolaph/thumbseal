import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  Check,
  Copy,
  ExternalLink,
  Fingerprint,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  buildCanonicalClientDataJSON,
  bytesToHex,
  computeRpIdHash,
  deriveActionTag,
  deriveChallenge,
  deriveScopedNullifier,
  deriveScopeId,
  DOMAIN_TAGS,
  isWebAuthnSupported,
  preflightVerifyAssertion,
  registerBrowserPasskey,
  signBrowserAction,
  VirtualPasskeyAuthenticator,
  type ClientDataMode,
  type PasskeyCredential,
  type WebAuthnAssertionWitness,
} from '@thumbseal/sdk';
import { AsciiField } from './components/AsciiField';
import {
  AFTER_COUNTER_CODE,
  AFTER_COUNTER_LINES,
  BEFORE_COUNTER_CODE,
  CIRCUIT_ROLE_NOTES,
  INITIAL_CIRCUIT_ROWS,
  INITIAL_ECOSYSTEM_STATS,
  SDK_QUICKSTART_CODE,
  type CircuitBenchRow,
} from './data/benchmarks';
import {
  fetchBenchmarks,
  fetchHealth,
  postAuthorizeAction,
  postRegisterPasskey,
  type ActivityItem,
  type HealthResponse,
} from './lib/relayerClient';

const DEFAULT_RP_ID = 'thumbseal.pages.dev';
const DEFAULT_ORIGIN = 'https://thumbseal.pages.dev';
const REPO_URL = 'https://github.com/itsolaph/thumbseal';
const CLONE_CMD = 'git clone https://github.com/itsolaph/thumbseal.git';

type TabId = 'playground' | 'tamper' | 'quickstart';
type BusyAction = 'register-hw' | 'register-virtual' | 'authorize' | 'tamper' | null;
type AttackKind = 'replay' | 'phish' | 'tamperAction' | 'stripUp' | 'forgeSig';

const TAB_ORDER: TabId[] = ['playground', 'tamper', 'quickstart'];

const ATTACK_LABELS: Record<AttackKind, string> = {
  replay: 'Replay spent scope',
  phish: 'Phish origin',
  tamperAction: 'Tamper action tag',
  stripUp: 'Strip UP flag',
  forgeSig: 'Flip signature bit',
};

function shortHex(hex: string | undefined, n = 10): string {
  if (!hex) return 'awaiting witness';
  if (hex.length <= n * 2 + 2) return hex;
  return `${hex.slice(0, n)}...${hex.slice(-n)}`;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('playground');
  const [feedView, setFeedView] = useState<'session' | 'global'>('session');
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  // Relayer & live benchmark state
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [relayerChecked, setRelayerChecked] = useState(false);
  const [circuitRows, setCircuitRows] = useState<CircuitBenchRow[]>(INITIAL_CIRCUIT_ROWS);
  const [ecoStats, setEcoStats] = useState(INITIAL_ECOSYSTEM_STATS);

  // Passkey & signing state
  const [virtualAuth, setVirtualAuth] = useState<VirtualPasskeyAuthenticator | null>(null);
  const [credential, setCredential] = useState<PasskeyCredential | null>(null);
  const [registeredCommit, setRegisteredCommit] = useState<string>('');
  const [scopeLabel, setScopeLabel] = useState('dao:proposal:42');
  const [actionLabel, setActionLabel] = useState('vote:approve');
  const [requireBiometric, setRequireBiometric] = useState(true);
  const [simulateGrease, setSimulateGrease] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Proving progress & cancellation
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    playground: null,
    tamper: null,
    quickstart: null,
  });
  const step1Ref = useRef<HTMLDivElement | null>(null);
  const spentLocalNullifiersRef = useRef<Set<string>>(new Set());

  const [lastResult, setLastResult] = useState<{
    ok: boolean;
    tamperBlocked?: boolean;
    headline: string;
    detail: string;
    circuit?: string;
    nullifierHex?: string;
    proofBytes?: number;
    proveMs?: number;
    txId?: string | null;
    leakedBytes?: number;
  } | null>(null);
  const [lastAssertion, setLastAssertion] = useState<WebAuthnAssertionWitness | null>(null);
  const [sessionActivity, setSessionActivity] = useState<ActivityItem[]>([]);

  const busy = busyAction !== null;
  const rpId = health?.rpId || DEFAULT_RP_ID;
  const origin = health?.origin || DEFAULT_ORIGIN;
  const rpIdHashHex = useMemo(() => bytesToHex(computeRpIdHash(rpId)), [rpId]);

  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec((Date.now() - started) / 1000);
    }, 200);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [h, b] = await Promise.all([fetchHealth(), fetchBenchmarks()]);
      if (!active) return;
      setHealth(h);
      setRelayerChecked(true);
      if (b?.ecosystem?.metrics) {
        setEcoStats({
          measuredDate: String(b.ecosystem.measuredAt || '2026-11-22').slice(0, 10),
          totalProducts: b.ecosystem.totalProducts ?? INITIAL_ECOSYSTEM_STATS.totalProducts,
          reachableRepos: b.ecosystem.productsWithReachableRepo ?? INITIAL_ECOSYSTEM_STATS.reachableRepos,
          laceDependentRepos:
            b.ecosystem.metrics.mentionsLaceAmongReachableRepos ??
            INITIAL_ECOSYSTEM_STATS.laceDependentRepos,
          lacePercent:
            b.ecosystem.metrics.mentionsLacePercentOfReachableRepos ??
            INITIAL_ECOSYSTEM_STATS.lacePercent,
          reusablePasskeySdks: 0,
        });
      }
      if (Array.isArray(b?.zkir?.circuits) && b.zkir.circuits.length > 0) {
        setCircuitRows(
          b.zkir.circuits.map((c: any) => {
            const key = `${c.contract}.${c.circuit}`;
            return {
              contract: c.contract,
              circuit: c.circuit,
              kParam: c.k ? `k=${c.k}` : c.proverKeyMB < 100 ? 'k=15' : c.proverKeyMB < 300 ? 'k=17' : 'k=18',
              zkirInstructions: c.zkirInstructions,
              proverKeyMB: c.proverKeyMB,
              verifierKeyBytes: c.verifierKeyBytes,
              proveTime: c.proveMs ? `${(c.proveMs / 1000).toFixed(2)} s` : 'Compiled',
              roleNote: CIRCUIT_ROLE_NOTES[key] || c.note || 'Compiled ZKIR v3 circuit',
              highlight: c.circuit === 'authorizeAction',
            };
          })
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const canUseHardware = useMemo(() => {
    if (!isWebAuthnSupported()) return false;
    const host = window.location.hostname;
    return host === rpId || host === 'localhost' || host === '127.0.0.1';
  }, [rpId]);

  const copyText = async (target: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget((cur) => (cur === target ? null : cur)), 1800);
    } catch {
      setCopiedTarget(`${target}:err`);
      window.setTimeout(() => setCopiedTarget(null), 2000);
    }
  };

  const pushSessionActivity = (item: ActivityItem) => {
    setSessionActivity((prev) => [item, ...prev].slice(0, 14));
    setFeedView('session');
  };

  const cancelProving = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: TabId) => {
    const idx = TAB_ORDER.indexOf(current);
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_ORDER.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TAB_ORDER.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      const nextId = TAB_ORDER[nextIdx];
      setActiveTab(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  const handleRegister = async (kind: 'hardware' | 'virtual') => {
    setBusyAction(kind === 'hardware' ? 'register-hw' : 'register-virtual');
    setLastResult(null);
    setInputError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let cred: PasskeyCredential;
      if (kind === 'hardware') {
        cred = await registerBrowserPasskey({
          rpId: window.location.hostname === rpId ? rpId : window.location.hostname,
          rpName: 'ThumbSeal Midnight Auth',
          origin: window.location.origin,
          userName: `midnight-user-${Date.now().toString(36)}`,
          displayName: 'Midnight Passkey',
          label: 'Device Hardware Passkey',
        });
        setVirtualAuth(null);
      } else {
        const va = new VirtualPasskeyAuthenticator({
          rpId,
          origin,
          label: 'Virtual P-256 Passkey',
        });
        setVirtualAuth(va);
        cred = va.credential;
      }

      setCredential(cred);

      if (health?.ok) {
        const res = await postRegisterPasskey(cred, controller.signal);
        setRegisteredCommit(res.keyCommitHex);
        setHealth((prev) => (prev ? { ...prev, vault: res.ledger } : prev));
        pushSessionActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: 'registerPasskey',
          status: res.txId ? 'submitted' : 'proved',
          keyCommitHex: res.keyCommitHex,
          proofBytes: res.proofBytes,
          proveMs: res.proveMs,
          txId: res.txId ?? undefined,
          mode: health.mode,
        });
        setLastResult({
          ok: true,
          headline: 'Passkey commitment proved and inserted into HistoricMerkleTree<16>',
          detail: `Key commitment ${shortHex(res.keyCommitHex)} verified with ${res.leakedBytes} leaked bytes.`,
          circuit: 'registerPasskey',
          proofBytes: res.proofBytes,
          proveMs: res.proveMs,
          txId: res.txId,
          leakedBytes: res.leakedBytes,
        });
      } else {
        const pseudoCommit = bytesToHex(
          deriveActionTag(`${cred.publicKey.x.toString(16)}:${bytesToHex(cred.salt)}`)
        );
        setRegisteredCommit(pseudoCommit);
        pushSessionActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: 'registerPasskey',
          status: 'preflight',
          keyCommitHex: pseudoCommit,
          mode: 'local-preflight',
        });
        setLastResult({
          ok: true,
          headline: 'Passkey created in local P-256 preflight mode',
          detail:
            'Relayer offline: real P-256 key generated locally. Connect a ThumbSeal relayer with proof-server:9.0.2 to generate Halo2 proofs.',
          circuit: 'registerPasskey',
          leakedBytes: 0,
        });
      }
    } catch (err) {
      const cancelled = err instanceof DOMException && err.name === 'AbortError';
      setLastResult({
        ok: false,
        headline: cancelled ? 'Proving wait cancelled' : 'Passkey registration failed',
        detail: cancelled
          ? 'Stopped waiting for the relayer response. You can retry with Hardware passkey or Virtual P-256 key.'
          : err instanceof Error
            ? err.message
            : String(err),
      });
    } finally {
      abortRef.current = null;
      setBusyAction(null);
    }
  };

  const handleAuthorize = async (attack?: AttackKind) => {
    if (!credential) {
      setLastResult({
        ok: false,
        headline: 'Enroll a passkey in Step 1 first',
        detail: 'Create a Hardware passkey or Virtual P-256 key before signing an action.',
      });
      return;
    }

    const cleanScope = scopeLabel.trim();
    const cleanAction = actionLabel.trim();
    if (!cleanScope || !cleanAction) {
      setInputError('Both scope identifier and action tag are required.');
      return;
    }
    setInputError(null);

    setBusyAction(attack ? 'tamper' : 'authorize');
    setLastResult(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const rpHash = computeRpIdHash(rpId);
    const scopeId = deriveScopeId(cleanScope);
    const actionTag = deriveActionTag(cleanAction);
    const challenge = deriveChallenge(DOMAIN_TAGS.ACTION, rpHash, scopeId, actionTag);
    const mode: ClientDataMode = simulateGrease ? 2n : 0n;
    const targetCircuit = mode === 2n ? 'authorizeActionGrease' : 'authorizeAction';
    let submittedActionLabel = cleanAction;
    let activeCred = credential;

    try {
      let witness: WebAuthnAssertionWitness;

      if (credential.kind === 'hardware' && (!attack || attack === 'replay' || attack === 'tamperAction')) {
        const signed = await signBrowserAction({
          credential,
          challenge,
          userVerification: requireBiometric ? 'required' : 'preferred',
        });
        witness = signed.witness;
        if (attack === 'tamperAction') {
          submittedActionLabel = `${cleanAction}:tampered`;
        }
      } else {
        if (!virtualAuth && attack && credential.kind === 'hardware') {
          throw new Error(
            `${ATTACK_LABELS[attack]} mutates wire-level authenticatorData/clientDataJSON bytes that hardware Secure Enclaves refuse to forge. Click "Virtual P-256 key" in Step 1 to test wire-level tampering.`
          );
        }
        const signer =
          virtualAuth ??
          new VirtualPasskeyAuthenticator({ rpId, origin, label: 'Virtual P-256 Key' });
        activeCred = signer.credential;

        if (attack === 'phish') {
          const evilJson = buildCanonicalClientDataJSON(challenge, 'https://evil-phish.pages.dev', 0n);
          witness = signer.signAssertion({ challenge, overrideClientDataJSON: evilJson }).witness;
        } else if (attack === 'tamperAction') {
          witness = signer.signAssertion({ challenge, clientDataMode: mode }).witness;
          submittedActionLabel = `${cleanAction}:tampered`;
        } else if (attack === 'stripUp') {
          witness = signer.signAssertion({ challenge, flags: 0x04, clientDataMode: mode }).witness;
        } else if (attack === 'forgeSig') {
          witness = signer.signAssertion({ challenge, tamperDigest: true, clientDataMode: mode }).witness;
        } else {
          witness = signer.signAssertion({
            challenge,
            flags: requireBiometric ? 0x1d : 0x01,
            clientDataMode: mode,
          }).witness;
        }
      }

      setLastAssertion(witness);

      if (health?.ok) {
        const res = await postAuthorizeAction({
          cred: activeCred,
          scopeLabel: cleanScope,
          actionLabel: submittedActionLabel,
          requireBiometric,
          assertion: witness,
          tamperLabel: attack ? ATTACK_LABELS[attack] : undefined,
          signal: controller.signal,
        });
        setHealth((prev) => (prev ? { ...prev, vault: res.ledger } : prev));
        pushSessionActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: res.circuit,
          status: res.txId ? 'submitted' : 'proved',
          nullifierHex: res.nullifierHex,
          actionTagHex: res.actionTagHex,
          scopeLabel: cleanScope,
          actionLabel: submittedActionLabel,
          proofBytes: res.proofBytes,
          proveMs: res.proveMs,
          txId: res.txId ?? undefined,
          mode: health.mode,
        });
        setLastResult({
          ok: true,
          headline: `Authorized anonymously via ${res.circuit}`,
          detail: `Scoped nullifier ${shortHex(res.nullifierHex)} recorded. Serialized public ledger contains ${res.leakedBytes} leaked identity bytes.`,
          circuit: res.circuit,
          nullifierHex: res.nullifierHex,
          proofBytes: res.proofBytes,
          proveMs: res.proveMs,
          txId: res.txId,
          leakedBytes: res.leakedBytes,
        });
      } else {
        const expectedChal = deriveChallenge(
          DOMAIN_TAGS.ACTION,
          rpHash,
          scopeId,
          deriveActionTag(submittedActionLabel)
        );
        const nf = bytesToHex(
          deriveScopedNullifier(
            deriveActionTag(`${activeCred.publicKey.x.toString(16)}:${bytesToHex(activeCred.salt)}`),
            rpHash,
            scopeId
          )
        );
        if (spentLocalNullifiersRef.current.has(nf)) {
          throw new Error('Scoped nullifier already spent (replay blocked)');
        }
        const valid =
          bytesToHex(expectedChal) === bytesToHex(challenge) &&
          preflightVerifyAssertion({
            publicKey: activeCred.publicKey,
            rpIdHash: rpHash,
            origin,
            expectedChallenge: expectedChal,
            requireUv: requireBiometric,
            witness,
          });
        if (!valid) {
          throw new Error(
            attack === 'phish'
              ? 'Phished origin rejected (clientDataJSON hash mismatch)'
              : attack === 'stripUp'
                ? 'User Presence (UP) flag required'
                : attack === 'tamperAction'
                  ? 'Challenge mismatch on tampered action tag'
                  : 'Invalid secp256r1 WebAuthn signature'
          );
        }
        spentLocalNullifiersRef.current.add(nf);
        pushSessionActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: targetCircuit,
          status: 'preflight',
          nullifierHex: nf,
          scopeLabel: cleanScope,
          actionLabel: submittedActionLabel,
          mode: 'local-preflight',
        });
        setLastResult({
          ok: true,
          headline: 'P-256 WebAuthn assertion verified locally (preflight)',
          detail: `Nullifier ${shortHex(nf)} derived locally; 0 identity bytes disclosed.`,
          circuit: targetCircuit,
          nullifierHex: nf,
          leakedBytes: 0,
        });
      }
    } catch (err) {
      const cancelled = err instanceof DOMException && err.name === 'AbortError';
      const msg = err instanceof Error ? err.message : String(err);
      if (!cancelled) {
        pushSessionActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: targetCircuit,
          status: attack ? 'tamper-blocked' : 'reverted',
          tamperLabel: attack ? ATTACK_LABELS[attack] : undefined,
          scopeLabel: cleanScope,
          actionLabel: submittedActionLabel,
          reason: msg,
          mode: health?.mode || 'local-preflight',
        });
      }
      setLastResult({
        ok: false,
        tamperBlocked: Boolean(attack) && !cancelled,
        headline: cancelled
          ? 'Proving wait cancelled'
          : attack
            ? `Adversarial attack blocked: ${ATTACK_LABELS[attack]}`
            : 'Authorization reverted',
        detail: cancelled
          ? 'Stopped waiting for the relayer job. Your passkey stays enrolled.'
          : msg,
      });
    } finally {
      abortRef.current = null;
      setBusyAction(null);
    }
  };

  const globalActivity = health?.vault?.recentActivity ?? [];
  const activityFeed = feedView === 'session' ? sessionActivity : globalActivity;

  const statusText = !relayerChecked
    ? 'Checking relayer and proof-server status'
    : health?.ok
      ? health.mode === 'preview-live'
        ? 'Midnight Preview live (DUST sponsored, proof-server 9.0.2)'
        : 'Relayer online with Halo2 proof-server 9.0.2'
      : 'Local P-256 preflight verifier active';

  const scrollToPlayground = () => {
    document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => step1Ref.current?.focus(), 350);
  };

  return (
    <>
      <header className="nav-slab">
        <div className="container nav-inner">
          <a href="#top" className="wordmark">
            <Fingerprint size={20} strokeWidth={2} aria-hidden="true" />
            <span>ThumbSeal</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#playground">Playground</a>
            <a href="#boundary">Proof boundary</a>
            <a href="#migration">Migration</a>
            <a href="#benchmarks">Benchmarks</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="nav-ext">
              <span>GitHub</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </nav>
          <a href="#playground" className="key key--compact">
            Try passkey
          </a>
        </div>
        <nav className="nav-mobile" aria-label="Mobile sections">
          <a href="#playground">Playground</a>
          <a href="#boundary">Proof</a>
          <a href="#migration">Migration</a>
          <a href="#benchmarks">Benchmarks</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <AsciiField />
          <div className="container">
            <div className="hero-corridor">
              <div className="hero-backdrop">
                <h1>Passkeys replace wallets on Midnight.</h1>
              </div>
              <p className="lead">
                Verify TouchID or FaceID inside Compact 0.36.1 circuits with sponsored DUST.
              </p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="key key--primary"
                  onClick={scrollToPlayground}
                >
                  <Fingerprint size={18} aria-hidden="true" />
                  <span>Try passkey playground</span>
                </button>
                <a href="#boundary" className="key">
                  Inspect zero-leak proof
                </a>
              </div>
              <div className="cmd-chip">
                <code>{CLONE_CMD}</code>
                <button
                  type="button"
                  className="cmd-copy"
                  onClick={() => void copyText('clone', CLONE_CMD)}
                >
                  {copiedTarget === 'clone' ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  <span className="visually-hidden">
                    {copiedTarget === 'clone' ? 'Clone command copied' : 'Copy git clone command'}
                  </span>
                </button>
              </div>
              <div className="status-line" role="status" aria-live="polite">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>{statusText}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="playground" className="section">
          <div className="container">
            <div className="section-head">
              <h2>Sign with hardware, prove without a wallet</h2>
              <p className="lead">
                Enroll a P-256 passkey, sign a scoped action, and verify real circuit reverts on
                Compact 0.36.1, ZKIR v3, and Ledger 9.
              </p>
            </div>

            <div className="tray" role="tablist" aria-label="Playground modes">
              <button
                id="tab-playground"
                ref={(el) => {
                  tabRefs.current.playground = el;
                }}
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'playground'}
                aria-controls="panel-playground"
                tabIndex={activeTab === 'playground' ? 0 : -1}
                onClick={() => setActiveTab('playground')}
                onKeyDown={(e) => handleTabKeyDown(e, 'playground')}
              >
                Enroll and authorize
              </button>
              <button
                id="tab-tamper"
                ref={(el) => {
                  tabRefs.current.tamper = el;
                }}
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'tamper'}
                aria-controls="panel-tamper"
                tabIndex={activeTab === 'tamper' ? 0 : -1}
                onClick={() => setActiveTab('tamper')}
                onKeyDown={(e) => handleTabKeyDown(e, 'tamper')}
              >
                Adversarial tamper lab
              </button>
              <button
                id="tab-quickstart"
                ref={(el) => {
                  tabRefs.current.quickstart = el;
                }}
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'quickstart'}
                aria-controls="panel-quickstart"
                tabIndex={activeTab === 'quickstart' ? 0 : -1}
                onClick={() => setActiveTab('quickstart')}
                onKeyDown={(e) => handleTabKeyDown(e, 'quickstart')}
              >
                SDK quickstart
              </button>
            </div>

            {activeTab === 'quickstart' ? (
              <div
                id="panel-quickstart"
                role="tabpanel"
                aria-labelledby="tab-quickstart"
                className="code-block"
              >
                <div className="graphite-bar">
                  <span>packages/sdk/examples/walletless-flow.ts</span>
                  <button
                    type="button"
                    className="code-copy-btn"
                    onClick={() => void copyText('quickstart', SDK_QUICKSTART_CODE)}
                  >
                    {copiedTarget === 'quickstart' ? (
                      <>
                        <Check size={13} aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} aria-hidden="true" />
                        <span>Copy snippet</span>
                      </>
                    )}
                  </button>
                </div>
                <pre>{SDK_QUICKSTART_CODE}</pre>
              </div>
            ) : (
              <div
                id={activeTab === 'playground' ? 'panel-playground' : 'panel-tamper'}
                role="tabpanel"
                aria-labelledby={activeTab === 'playground' ? 'tab-playground' : 'tab-tamper'}
                className="workbench-grid"
              >
                <div className="cut">
                  <div className="panel-body">
                    <div className="field-group" ref={step1Ref} tabIndex={-1}>
                      <span className="field-label">Step 1: Passkey credential (stays on device)</span>
                      <div className="action-strip">
                        {canUseHardware && (
                          <button
                            type="button"
                            className="key key--primary key--compact"
                            disabled={busy}
                            onClick={() => void handleRegister('hardware')}
                          >
                            <Fingerprint size={16} aria-hidden="true" />
                            <span>
                              {busyAction === 'register-hw'
                                ? `Proving registerPasskey (${elapsedSec.toFixed(1)}s)...`
                                : 'Hardware passkey'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={
                            canUseHardware
                              ? 'key key--compact'
                              : 'key key--primary key--compact'
                          }
                          disabled={busy}
                          onClick={() => void handleRegister('virtual')}
                        >
                          <KeyRound size={16} aria-hidden="true" />
                          <span>
                            {busyAction === 'register-virtual'
                              ? `Proving registerPasskey (${elapsedSec.toFixed(1)}s)...`
                              : 'Virtual P-256 key'}
                          </span>
                        </button>
                      </div>
                      <p className="field-hint">
                        {credential
                          ? `Enrolled ${credential.label} (commit ${shortHex(registeredCommit, 8)}). Private key stays local.`
                          : 'No biometric sensor on this device? Virtual P-256 runs the exact same Halo2 k=15/k=17 circuits.'}
                      </p>
                    </div>

                    {activeTab === 'playground' ? (
                      <>
                        <div className="step-divider" />
                        <div className="field-group">
                          <span className="field-label">
                            Step 2: Authorize scoped action
                          </span>
                          <div className="field-row">
                            <label className="field-group">
                              <span className="field-sublabel">Scope (1 proof each)</span>
                              <input
                                type="text"
                                className="input-cut"
                                value={scopeLabel}
                                onChange={(e) => {
                                  setScopeLabel(e.target.value);
                                  if (inputError) setInputError(null);
                                }}
                                disabled={busy}
                              />
                            </label>
                            <label className="field-group">
                              <span className="field-sublabel">Action (bound in challenge)</span>
                              <input
                                type="text"
                                className="input-cut"
                                value={actionLabel}
                                onChange={(e) => {
                                  setActionLabel(e.target.value);
                                  if (inputError) setInputError(null);
                                }}
                                disabled={busy}
                              />
                            </label>
                          </div>
                          {inputError && <p className="field-error">{inputError}</p>}
                        </div>

                        <details className="adv-details">
                          <summary>Advanced WebAuthn circuit options</summary>
                          <div className="adv-body">
                            <label className="toggle-row">
                              <input
                                type="checkbox"
                                checked={requireBiometric}
                                onChange={(e) => setRequireBiometric(e.target.checked)}
                                disabled={busy}
                              />
                              <span>
                                Require biometric User Verification (UV bit) &mdash; enforces TouchID/FaceID check inside the circuit
                              </span>
                            </label>
                            {credential?.kind !== 'hardware' && (
                              <label className="toggle-row">
                                <input
                                  type="checkbox"
                                  checked={simulateGrease}
                                  onChange={(e) => setSimulateGrease(e.target.checked)}
                                  disabled={busy}
                                />
                                <span>
                                  Simulate Chrome 20% GREASE suffix &mdash; routes to isolated k=18 verifier sharing the same nullifier set
                                </span>
                              </label>
                            )}
                          </div>
                        </details>

                        <div className="action-strip">
                          <button
                            type="button"
                            className="key key--primary"
                            disabled={busy || !credential}
                            onClick={() => void handleAuthorize()}
                          >
                            <ShieldCheck size={18} aria-hidden="true" />
                            <span>
                              {busyAction === 'authorize'
                                ? `Proving Halo2 circuit (${elapsedSec.toFixed(1)}s)...`
                                : 'Sign and prove action'}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="key"
                            disabled={busy || !credential}
                            onClick={() =>
                              setScopeLabel(`dao:proposal:${Math.floor(100 + Math.random() * 899)}`)
                            }
                          >
                            Fresh scope
                          </button>
                          {busy && (
                            <button
                              type="button"
                              className="key key--compact"
                              onClick={cancelProving}
                            >
                              <X size={15} aria-hidden="true" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                        {!credential && !busy && (
                          <p className="field-hint">
                            Complete Step 1 above to enable signing and Halo2 proving.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="step-divider" />
                        <div className="field-group">
                          <span className="field-label">
                            Step 2: Send real adversarial payloads to ThumbSealVault / PasskeyAuth.compact
                          </span>
                          <p className="field-hint">
                            Each button constructs a real malformed assertion and submits it to the compiled Compact 0.36.1 verifier. Expected result: in-circuit assertion failure before proof acceptance.
                          </p>
                          <div className="tamper-grid">
                            <button
                              type="button"
                              className="key key--danger key--compact"
                              disabled={busy || !credential}
                              onClick={() => void handleAuthorize('replay')}
                            >
                              <ShieldAlert size={15} aria-hidden="true" />
                              <span>Replay spent scope</span>
                            </button>
                            <button
                              type="button"
                              className="key key--danger key--compact"
                              disabled={busy || !credential}
                              onClick={() => void handleAuthorize('phish')}
                            >
                              <ShieldAlert size={15} aria-hidden="true" />
                              <span>Phish origin</span>
                            </button>
                            <button
                              type="button"
                              className="key key--danger key--compact"
                              disabled={busy || !credential}
                              onClick={() => void handleAuthorize('tamperAction')}
                            >
                              <ShieldAlert size={15} aria-hidden="true" />
                              <span>Tamper action tag</span>
                            </button>
                            <button
                              type="button"
                              className="key key--danger key--compact"
                              disabled={busy || !credential}
                              onClick={() => void handleAuthorize('stripUp')}
                            >
                              <ShieldAlert size={15} aria-hidden="true" />
                              <span>Strip UP flag</span>
                            </button>
                            <button
                              type="button"
                              className="key key--danger key--compact"
                              disabled={busy || !credential}
                              onClick={() => void handleAuthorize('forgeSig')}
                            >
                              <ShieldAlert size={15} aria-hidden="true" />
                              <span>Flip signature bit</span>
                            </button>
                          </div>
                          {!credential && (
                            <p className="field-hint">
                              Enroll a Virtual P-256 key in Step 1 first to test all 5 attack vectors.
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="live-status-slot" role="status" aria-live="polite">
                      {busy ? (
                        <div className="result-banner">
                          <strong>
                            {busyAction === 'register-hw' || busyAction === 'register-virtual'
                              ? `Generating Halo2 k=15 proof for registerPasskey (${elapsedSec.toFixed(1)}s)`
                              : busyAction === 'tamper'
                                ? `Evaluating adversarial payload in PasskeyAuth.compact (${elapsedSec.toFixed(1)}s)`
                                : `Generating Halo2 ${simulateGrease ? 'k=18' : 'k=17'} proof (${elapsedSec.toFixed(1)}s)`}
                          </strong>
                          <span className="mono-msg">
                            {busyAction === 'authorize'
                              ? 'Signed locally -> checking witness constraints -> Halo2 ZKIR v3 proof (~28-44s on shared CPU)...'
                              : 'Running real Compact 0.36.1 circuit against proof-server 9.0.2...'}
                          </span>
                        </div>
                      ) : lastResult ? (
                        <div
                          className={`result-banner ${
                            lastResult.ok
                              ? 'result-banner--ok'
                              : lastResult.tamperBlocked
                                ? 'result-banner--blocked'
                                : 'result-banner--err'
                          }`}
                        >
                          <strong>{lastResult.headline}</strong>
                          <span className="mono-msg">{lastResult.detail}</span>
                          {lastResult.proveMs !== undefined && (
                            <span className="mono-msg">
                              Halo2 proof: {lastResult.proofBytes?.toLocaleString('en-US')} B in{' '}
                              {(lastResult.proveMs / 1000).toFixed(2)} s
                              {lastResult.txId ? ` | Preview tx ${shortHex(lastResult.txId, 10)}` : ''}
                            </span>
                          )}
                          {lastResult.ok && lastResult.nullifierHex && (
                            <a href="#boundary" className="result-jump">
                              <span>Inspect your live zero-leak witness in Proof boundary</span>
                              <ArrowDown size={14} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="cut cut--subtle">
                  <div className="panel-body">
                    <div className="activity-top">
                      <h3>Ledger activity</h3>
                      <div className="feed-switch" role="group" aria-label="Activity feed scope">
                        <button
                          type="button"
                          className={`feed-pill ${feedView === 'session' ? 'feed-pill--active' : ''}`}
                          onClick={() => setFeedView('session')}
                        >
                          This session ({sessionActivity.length})
                        </button>
                        <button
                          type="button"
                          className={`feed-pill ${feedView === 'global' ? 'feed-pill--active' : ''}`}
                          onClick={() => setFeedView('global')}
                        >
                          Relayer ({globalActivity.length})
                        </button>
                      </div>
                    </div>

                    {activityFeed.length === 0 ? (
                      <p className="activity-empty">
                        {feedView === 'session'
                          ? 'Enroll a passkey in Step 1 to generate your own verified Halo2 proof and scoped nullifier here.'
                          : 'No global relayer runs recorded yet.'}
                      </p>
                    ) : (
                      <div className="activity-list">
                        {activityFeed.slice(0, 6).map((item) => {
                          const isTamper = item.status === 'tamper-blocked';
                          const isErr = item.status === 'reverted';
                          return (
                            <div className="activity-row" key={item.id}>
                              <div className="activity-top">
                                <span className="activity-name">
                                  {item.tamperLabel ? `${item.circuit} (${item.tamperLabel})` : item.circuit}
                                </span>
                                <span
                                  className={`activity-meta ${
                                    isTamper
                                      ? 'activity-meta--blocked'
                                      : isErr
                                        ? 'activity-meta--err'
                                        : 'activity-meta--ok'
                                  }`}
                                >
                                  {isTamper ? 'blocked (expected)' : item.status}
                                  {item.proveMs ? ` ${(item.proveMs / 1000).toFixed(1)}s` : ''}
                                </span>
                              </div>
                              <span className={item.reason ? 'mono-msg' : 'mono-hash'}>
                                {item.reason
                                  ? item.reason
                                  : item.nullifierHex
                                    ? `nf ${shortHex(item.nullifierHex, 12)}`
                                    : `commit ${shortHex(item.keyCommitHex, 12)}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="spec-rows">
                      <div className="spec-row">
                        <span>Relying party</span>
                        <span className="mono-msg">{rpId}</span>
                      </div>
                      <div className="spec-row">
                        <span>Registry tree</span>
                        <span className="mono-msg">HistoricMerkleTree&lt;16&gt;</span>
                      </div>
                      <div className="spec-row">
                        <span>Key disclosure</span>
                        <span className="mono-msg">0 bytes on-chain</span>
                      </div>
                      <div className="spec-row">
                        <span>Proof engine</span>
                        <span className="mono-msg">Compact 0.36.1 / ZKIR v3 / Ledger 9</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section id="boundary" className="section section--tinted">
          <div className="container">
            <div className="section-head">
              <h2>What crosses the proof boundary</h2>
              <p className="lead">
                ThumbSealVault.compact imports PasskeyAuth.compact and enforces compile-time
                disclose() taint checks so public keys, blinding salts, and Merkle paths never reach
                Midnight ledger state.
              </p>
            </div>

            <div className="graphite-stage">
              <div className="graphite-bar">
                <span>ThumbSealVault.compact (Compact 0.36.1 / ZKIR v3)</span>
                <span>0 identity bytes disclosed on authorizeAction</span>
              </div>

              {/* Desktop mathematically row-aligned dual pane */}
              <div className="mapping-rows mapping-desktop">
                <div className="mapping-row">
                  <div className="graphite-pane-title">Private local witness (never leaves prover)</div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="graphite-pane-title">Public Midnight ledger state</div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">publicKey.x</span>
                    <span className="kv-val kv-val--hash">
                      {credential
                        ? shortHex(credential.publicKey.x.toString(16).padStart(64, '0'), 10)
                        : 'device secret'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">rpIdHash</span>
                    <span className="kv-val kv-val--hash">{shortHex(rpIdHashHex, 8)}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">publicKey.y</span>
                    <span className="kv-val kv-val--hash">
                      {credential
                        ? shortHex(credential.publicKey.y.toString(16).padStart(64, '0'), 10)
                        : 'device secret'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">origin</span>
                    <span className="kv-val">{origin}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">blindingSalt</span>
                    <span className="kv-val kv-val--hash">
                      {credential ? shortHex(bytesToHex(credential.salt), 10) : '32 B random'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">registeredCount</span>
                    <span className="kv-val num">{health?.vault?.registeredCount ?? 0}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">signature (r, s)</span>
                    <span className="kv-val kv-val--hash">
                      {lastAssertion
                        ? shortHex(lastAssertion.signature.r.toString(16).padStart(64, '0'), 10)
                        : 'P-256 low-S'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">authorizedCount</span>
                    <span className="kv-val num">{health?.vault?.authorizedCount ?? 0}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">merklePath[16]</span>
                    <span className="kv-val">proves historic root</span>
                  </div>
                  <div className="mapping-cell-bridge mapping-cell-bridge--cross" aria-hidden="true">
                    <span className="bridge-dot" />
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyTree.checkRoot</span>
                    <span className="kv-val kv-val--hash">
                      {health?.vault?.merkleRootField
                        ? shortHex(health.vault.merkleRootField, 9)
                        : 'historic root'}
                    </span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyCommit + scopeId</span>
                    <span className="kv-val">hashes to nullifier</span>
                  </div>
                  <div className="mapping-cell-bridge mapping-cell-bridge--cross" aria-hidden="true">
                    <span className="bridge-dot" />
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">usedNullifiers</span>
                    <span className="kv-val kv-val--hash">
                      {lastResult?.nullifierHex
                        ? shortHex(lastResult.nullifierHex, 9)
                        : 'unlinkable across scopes'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile semantic stacked groups (never interleaves private & public fields!) */}
              <div className="mapping-mobile">
                <div className="mapping-group">
                  <div className="graphite-pane-title">1. Private local witness (never leaves prover)</div>
                  <div className="kv-line">
                    <span className="kv-key">publicKey.x</span>
                    <span className="kv-val">
                      {credential
                        ? shortHex(credential.publicKey.x.toString(16).padStart(64, '0'), 8)
                        : 'device secret'}
                    </span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-key">publicKey.y</span>
                    <span className="kv-val">
                      {credential
                        ? shortHex(credential.publicKey.y.toString(16).padStart(64, '0'), 8)
                        : 'device secret'}
                    </span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-key">blindingSalt</span>
                    <span className="kv-val">
                      {credential ? shortHex(bytesToHex(credential.salt), 8) : '32 B random'}
                    </span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-key">signature (r, s)</span>
                    <span className="kv-val">
                      {lastAssertion
                        ? shortHex(lastAssertion.signature.r.toString(16).padStart(64, '0'), 8)
                        : 'P-256 low-S'}
                    </span>
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">merklePath[16]</span>
                    <span className="kv-val">proves historic root</span>
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyCommit + scopeId</span>
                    <span className="kv-val">hashes to nullifier</span>
                  </div>
                </div>

                <div className="mapping-mobile-wall">
                  <span>Zero-knowledge proof boundary &mdash; 0 identity bytes disclosed</span>
                </div>

                <div className="mapping-group">
                  <div className="graphite-pane-title">2. Public Midnight ledger state</div>
                  <div className="kv-line">
                    <span className="kv-key">rpIdHash</span>
                    <span className="kv-val">{shortHex(rpIdHashHex, 8)}</span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-key">origin</span>
                    <span className="kv-val">{origin}</span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-key">registeredCount / authorizedCount</span>
                    <span className="kv-val num">
                      {health?.vault?.registeredCount ?? 0} / {health?.vault?.authorizedCount ?? 0}
                    </span>
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyTree.checkRoot</span>
                    <span className="kv-val">
                      {health?.vault?.merkleRootField
                        ? shortHex(health.vault.merkleRootField, 8)
                        : 'historic root'}
                    </span>
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">usedNullifiers</span>
                    <span className="kv-val">
                      {lastResult?.nullifierHex
                        ? shortHex(lastResult.nullifierHex, 8)
                        : 'unlinkable across scopes'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="migration" className="section">
          <div className="container">
            <div className="section-head">
              <h2>One import to drop Lace</h2>
              <p className="lead">
                Import PasskeyAuth.compact into Midnight&apos;s starter Counter. Highlighted lines
                add in-circuit secp256r1 verification and replay-safe nullifiers, compiling to k=17.
              </p>
            </div>

            <div className="code-compare">
              <div className="code-block">
                <div className="graphite-bar">
                  <span>Before: standard Counter.compact</span>
                  <span>Requires Lace extension</span>
                </div>
                <pre>{BEFORE_COUNTER_CODE}</pre>
              </div>
              <div className="code-block">
                <div className="graphite-bar">
                  <span>After: WalletlessCounter.compact (k=17)</span>
                  <button
                    type="button"
                    className="code-copy-btn"
                    onClick={() => void copyText('counter', AFTER_COUNTER_CODE)}
                  >
                    {copiedTarget === 'counter' ? (
                      <>
                        <Check size={13} aria-hidden="true" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} aria-hidden="true" />
                        <span>Copy contract</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="code-diff">
                  {AFTER_COUNTER_LINES.map((line, i) => (
                    <span
                      key={i}
                      className={line.added ? 'code-line code-line--add' : 'code-line'}
                    >
                      <span className="code-gutter" aria-hidden="true">
                        {line.added ? '+' : ' '}
                      </span>
                      {line.text || ' '}
                    </span>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section id="benchmarks" className="section section--wide-gap section--tinted">
          <div className="container">
            <div className="section-head">
              <h2>Measured across the ecosystem</h2>
              <p className="lead">
                Reproducible scripts in packages/bench against the AKINDO Wave 1&ndash;3 corpus (
                {ecoStats.measuredDate}), compactc 0.36.1, and proof-server:9.0.2.
              </p>
            </div>

            <div className="figures-row">
              <div className="figure-cell">
                <span className="figure-big">{ecoStats.lacePercent}%</span>
                <span className="figure-label">
                  {ecoStats.laceDependentRepos} of {ecoStats.reachableRepos} reachable Midnight
                  Buildathon repos require Lace
                </span>
              </div>
              <div className="figure-cell">
                <span className="figure-big">1.93&times; &middot; &minus;50%</span>
                <span className="figure-label">
                  Faster paired proving (median 85.5 s &rarr; 44.2 s) &amp; prover key cut (448 MB
                  &rarr; 224 MB) via GREASE split
                </span>
              </div>
              <div className="figure-cell">
                <span className="figure-big">0 B</span>
                <span className="figure-label">
                  Passkey public key, salt, Merkle path, or ECDSA signature bytes disclosed on-chain
                </span>
              </div>
            </div>

            <div className="table-wrap cut">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Contract</th>
                    <th scope="col">Circuit</th>
                    <th scope="col">Halo2 k</th>
                    <th scope="col" className="num-col">ZKIR ops</th>
                    <th scope="col" className="num-col">Prover key</th>
                    <th scope="col" className="num-col">Verifier</th>
                    <th scope="col" className="num-col">Single-run prove</th>
                    <th scope="col">Role &amp; notes</th>
                  </tr>
                </thead>
                <tbody>
                  {circuitRows.map((row) => (
                    <tr
                      key={`${row.contract}.${row.circuit}`}
                      className={row.highlight ? 'row-highlight' : undefined}
                    >
                      <td>{row.contract}</td>
                      <td className="mono-cell">{row.circuit}</td>
                      <td className="mono-cell">{row.kParam}</td>
                      <td className="mono-cell num num-col">
                        {row.zkirInstructions.toLocaleString('en-US')}
                      </td>
                      <td className="mono-cell num num-col">{row.proverKeyMB.toFixed(2)} MB</td>
                      <td className="mono-cell num num-col">
                        {row.verifierKeyBytes.toLocaleString('en-US')} B
                      </td>
                      <td className="mono-cell num num-col">{row.proveTime}</td>
                      <td>{row.roleNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer-statement">
        <div className="container">
          <div className="footer-headline">
            Keep passkeys in hardware. Keep proofs private.
          </div>
          <div className="action-strip footer-cta">
            <a href="#playground" className="key key--primary">
              <Fingerprint size={17} aria-hidden="true" />
              <span>Run passkey playground</span>
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="key">
              <span>Inspect source on GitHub</span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          <div className="footer-meta">
            <span>
              ThumbSeal for Midnight Ledger 9 (Compact 0.36.1 / ZKIR v3) under Apache-2.0
              {health?.vault?.deployTxId && health?.vault?.contractAddress
                ? ` | Preview Vault ${shortHex(health.vault.contractAddress, 10)}`
                : ''}
            </span>
            <div className="footer-links">
              <a href="#playground">Playground</a>
              <a href="#boundary">Proof boundary</a>
              <a href={`${REPO_URL}/blob/main/packages/contracts/src/PasskeyAuth.compact`} target="_blank" rel="noreferrer">
                PasskeyAuth.compact
              </a>
              <a href={`${REPO_URL}/tree/main/packages/bench`} target="_blank" rel="noreferrer">
                Benchmarks
              </a>
              <a href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
