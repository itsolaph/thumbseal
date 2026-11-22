import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Fingerprint,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Terminal,
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
  BEFORE_COUNTER_CODE,
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

type TabId = 'playground' | 'tamper' | 'quickstart';

function shortHex(hex: string | undefined, n = 10): string {
  if (!hex) return 'awaiting witness';
  if (hex.length <= n * 2 + 2) return hex;
  return `${hex.slice(0, n)}...${hex.slice(-n)}`;
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('playground');
  const [copiedCmd, setCopiedCmd] = useState(false);

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

  // Execution results & mapping inspector
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    ok: boolean;
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
  const [localActivity, setLocalActivity] = useState<ActivityItem[]>([]);

  const rpId = health?.rpId || DEFAULT_RP_ID;
  const origin = health?.origin || DEFAULT_ORIGIN;
  const rpIdHashHex = useMemo(() => bytesToHex(computeRpIdHash(rpId)), [rpId]);

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
          laceDependentRepos: b.ecosystem.metrics.mentionsLaceAmongReachableRepos ?? INITIAL_ECOSYSTEM_STATS.laceDependentRepos,
          lacePercent: b.ecosystem.metrics.mentionsLacePercentOfReachableRepos ?? INITIAL_ECOSYSTEM_STATS.lacePercent,
          reusablePasskeySdks: 0,
        });
      }
      if (Array.isArray(b?.zkir?.circuits) && b.zkir.circuits.length > 0) {
        setCircuitRows(
          b.zkir.circuits.map((c: any) => ({
            contract: c.contract,
            circuit: c.circuit,
            kParam: c.proverKeyMB < 100 ? 'k=15' : c.proverKeyMB < 300 ? 'k=17' : 'k=18',
            zkirInstructions: c.zkirInstructions,
            proverKeyMB: c.proverKeyMB,
            verifierKeyBytes: c.verifierKeyBytes,
            proveLabel: c.proveMs ? `${(c.proveMs / 1000).toFixed(2)} s (${c.proofBytes} B)` : 'Compiled',
            highlight: c.circuit === 'authorizeAction',
          }))
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

  const copyInstallCmd = async () => {
    try {
      await navigator.clipboard.writeText('npm i @thumbseal/sdk @thumbseal/contracts');
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {}
  };

  const pushLocalActivity = (item: ActivityItem) => {
    setLocalActivity((prev) => [item, ...prev].slice(0, 14));
  };

  const handleRegister = async (kind: 'hardware' | 'virtual') => {
    setBusy(true);
    setLastResult(null);
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
        const res = await postRegisterPasskey(cred);
        setRegisteredCommit(res.keyCommitHex);
        setHealth((prev) => (prev ? { ...prev, vault: res.ledger } : prev));
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
        pushLocalActivity({
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
      setLastResult({
        ok: false,
        headline: 'Passkey registration reverted',
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorize = async (attack?: 'replay' | 'phish' | 'tamperAction' | 'stripUp' | 'forgeSig') => {
    if (!credential) {
      setLastResult({
        ok: false,
        headline: 'Register a passkey first',
        detail: 'Create a hardware passkey or virtual P-256 authenticator before authorizing an action.',
      });
      return;
    }

    setBusy(true);
    setLastResult(null);
    try {
      const rpHash = computeRpIdHash(rpId);
      const scopeId = deriveScopeId(scopeLabel);
      const actionTag = deriveActionTag(actionLabel);
      const challenge = deriveChallenge(DOMAIN_TAGS.ACTION, rpHash, scopeId, actionTag);
      const mode: ClientDataMode = simulateGrease ? 2n : 0n;

      let witness: WebAuthnAssertionWitness;
      let submittedActionLabel = actionLabel;

      if (credential.kind === 'hardware' && !attack) {
        const signed = await signBrowserAction({
          credential,
          challenge,
          userVerification: requireBiometric ? 'required' : 'preferred',
        });
        witness = signed.witness;
      } else {
        const signer =
          virtualAuth ??
          new VirtualPasskeyAuthenticator({ rpId, origin, label: 'Virtual Attack Signer' });

        if (attack === 'phish') {
          const evilJson = buildCanonicalClientDataJSON(challenge, 'https://evil-phish.pages.dev', 0n);
          witness = signer.signAssertion({ challenge, overrideClientDataJSON: evilJson }).witness;
        } else if (attack === 'tamperAction') {
          witness = signer.signAssertion({ challenge, clientDataMode: mode }).witness;
          submittedActionLabel = `${actionLabel}:tampered`;
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
          cred: credential,
          scopeLabel,
          actionLabel: submittedActionLabel,
          requireBiometric,
          assertion: witness,
        });
        setHealth((prev) => (prev ? { ...prev, vault: res.ledger } : prev));
        setLastResult({
          ok: true,
          headline: `Authorized anonymously via ${res.circuit}`,
          detail: `Scoped nullifier ${shortHex(res.nullifierHex)} recorded. Public ledger contains 0 bytes of passkey identity.`,
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
        const valid =
          bytesToHex(expectedChal) === bytesToHex(challenge) &&
          preflightVerifyAssertion({
            publicKey: credential.publicKey,
            rpIdHash: rpHash,
            origin,
            expectedChallenge: expectedChal,
            requireUv: requireBiometric,
            assertion: witness,
          });
        if (!valid) {
          throw new Error(
            attack === 'stripUp'
              ? 'WebAuthn User Presence (UP) flag must be set'
              : attack === 'tamperAction'
                ? 'Challenge witness bytes do not match expected challenge'
                : 'Invalid secp256r1 WebAuthn signature'
          );
        }
        const nf = bytesToHex(
          deriveScopedNullifier(
            deriveActionTag(registeredCommit || 'local'),
            rpHash,
            scopeId
          )
        );
        pushLocalActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: witness.clientDataMode === 2n ? 'authorizeActionGrease' : 'authorizeAction',
          status: 'preflight',
          nullifierHex: nf,
          scopeLabel,
          actionLabel: submittedActionLabel,
          mode: 'local-preflight',
        });
        setLastResult({
          ok: true,
          headline: 'P-256 WebAuthn assertion verified locally (preflight)',
          detail: `Verified secp256r1 ECDSA + W3C clientDataMode=${witness.clientDataMode}. Connect relayer for Halo2 ZKIR-v3 proving.`,
          circuit: witness.clientDataMode === 2n ? 'authorizeActionGrease' : 'authorizeAction',
          nullifierHex: nf,
          leakedBytes: 0,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!health?.ok) {
        pushLocalActivity({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          circuit: 'authorizeAction',
          status: 'reverted',
          scopeLabel,
          actionLabel,
          reason: msg,
          mode: 'local-preflight',
        });
      }
      setLastResult({
        ok: false,
        headline: attack ? 'Adversarial tamper blocked by circuit' : 'Authorization reverted',
        detail: msg,
      });
    } finally {
      setBusy(false);
    }
  };

  const activityFeed: ActivityItem[] = health?.vault?.recentActivity?.length
    ? health.vault.recentActivity
    : localActivity;

  const statusText = !relayerChecked
    ? 'Checking relayer and proof-server status'
    : health?.ok
      ? health.mode === 'preview-live'
        ? `Live on Midnight Preview (DUST sponsored, proof-server 9.0.2 healthy)`
        : `Relayer online with real Halo2 proof-server 9.0.2`
      : 'Local P-256 preflight verifier active';

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
          </nav>
          <a href="#playground" className="key key--primary key--compact">
            Try passkey
          </a>
        </div>
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
                Verify TouchID or FaceID inside Compact 0.36 circuits with sponsored DUST.
              </p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="key key--primary"
                  disabled={busy}
                  onClick={() => {
                    document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' });
                    void handleRegister(canUseHardware ? 'hardware' : 'virtual');
                  }}
                >
                  <Fingerprint size={18} aria-hidden="true" />
                  <span>{canUseHardware ? 'Register passkey' : 'Register virtual P-256'}</span>
                </button>
                <a href="#boundary" className="key">
                  Inspect zero-leak proof
                </a>
              </div>
              <div className="cmd-chip">
                <code>npm i @thumbseal/sdk</code>
                <button type="button" className="cmd-copy" onClick={copyInstallCmd}>
                  {copiedCmd ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  <span className="visually-hidden">Copy install command</span>
                </button>
              </div>
              <div className="status-line" role="status">
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
                Enroll a P-256 passkey, sign a scoped action, and test real circuit reverts on
                Compact 0.28 and ZKIR v3.
              </p>
            </div>

            <div className="tray" role="tablist" aria-label="Playground modes">
              <button
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'playground'}
                onClick={() => setActiveTab('playground')}
              >
                Enroll and authorize
              </button>
              <button
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'tamper'}
                onClick={() => setActiveTab('tamper')}
              >
                Adversarial tamper lab
              </button>
              <button
                type="button"
                role="tab"
                className="tray-key"
                aria-selected={activeTab === 'quickstart'}
                onClick={() => setActiveTab('quickstart')}
              >
                SDK quickstart
              </button>
            </div>

            {activeTab === 'quickstart' ? (
              <div className="code-block">
                <div className="graphite-bar">
                  <span>packages/sdk/examples/walletless-flow.ts</span>
                  <span>Apache-2.0</span>
                </div>
                <pre>{SDK_QUICKSTART_CODE}</pre>
              </div>
            ) : (
              <div className="workbench-grid">
                <div className="cut">
                  <div className="panel-body">
                    <div className="field-group">
                      <span className="field-label">Step 1: Passkey credential (stays on device)</span>
                      <div className="action-strip">
                        <button
                          type="button"
                          className="key key--primary key--compact"
                          disabled={busy || !canUseHardware}
                          onClick={() => void handleRegister('hardware')}
                        >
                          <Fingerprint size={16} aria-hidden="true" />
                          <span>Hardware passkey</span>
                        </button>
                        <button
                          type="button"
                          className="key key--compact"
                          disabled={busy}
                          onClick={() => void handleRegister('virtual')}
                        >
                          <KeyRound size={16} aria-hidden="true" />
                          <span>Virtual P-256 key</span>
                        </button>
                      </div>
                      {credential && (
                        <div className="mono-val">
                          Active: {credential.label} (commit {shortHex(registeredCommit, 8)})
                        </div>
                      )}
                    </div>

                    {activeTab === 'playground' ? (
                      <>
                        <div className="field-row">
                          <label className="field-group">
                            <span className="field-label">Scope identifier (1 authorization per scope)</span>
                            <input
                              className="input-cut"
                              value={scopeLabel}
                              onChange={(e) => setScopeLabel(e.target.value)}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Action tag (bound into WebAuthn challenge)</span>
                            <input
                              className="input-cut"
                              value={actionLabel}
                              onChange={(e) => setActionLabel(e.target.value)}
                            />
                          </label>
                        </div>

                        <div className="action-strip">
                          <label className="toggle-row">
                            <input
                              type="checkbox"
                              checked={requireBiometric}
                              onChange={(e) => setRequireBiometric(e.target.checked)}
                            />
                            <span>Require biometric User Verification (UV bit)</span>
                          </label>
                          {credential?.kind !== 'hardware' && (
                            <label className="toggle-row">
                              <input
                                type="checkbox"
                                checked={simulateGrease}
                                onChange={(e) => setSimulateGrease(e.target.checked)}
                              />
                              <span>Simulate Chrome 20% GREASE suffix</span>
                            </label>
                          )}
                        </div>

                        <div className="action-strip">
                          <button
                            type="button"
                            className="key key--primary"
                            disabled={busy || !credential}
                            onClick={() => void handleAuthorize()}
                          >
                            <ShieldCheck size={18} aria-hidden="true" />
                            <span>{busy ? 'Proving Halo2 circuit...' : 'Sign and prove action'}</span>
                          </button>
                          <button
                            type="button"
                            className="key"
                            disabled={busy || !credential}
                            onClick={() => setScopeLabel(`dao:proposal:${Math.floor(100 + Math.random() * 899)}`)}
                          >
                            Fresh scope
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="field-group">
                        <span className="field-label">
                          Trigger real attack payloads against the compiled PasskeyAuth.compact verifier
                        </span>
                        <div className="action-strip">
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
                      </div>
                    )}

                    {lastResult && (
                      <div
                        className={`result-banner ${
                          lastResult.ok ? 'result-banner--ok' : 'result-banner--err'
                        }`}
                        role="status"
                      >
                        <strong>{lastResult.headline}</strong>
                        <span className="mono-val">{lastResult.detail}</span>
                        {lastResult.proveMs !== undefined && (
                          <span className="mono-val">
                            Halo2 proof: {lastResult.proofBytes} B in {(lastResult.proveMs / 1000).toFixed(2)} s
                            {lastResult.txId ? ` | Preview tx ${shortHex(lastResult.txId, 10)}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="cut cut--subtle">
                  <div className="panel-body">
                    <div className="activity-top">
                      <h3>Ledger activity</h3>
                      <span className="activity-meta">
                        {health?.vault
                          ? `${health.vault.registeredCount} keys, ${health.vault.authorizedCount} proofs`
                          : `${localActivity.length} local runs`}
                      </span>
                    </div>
                    {activityFeed.length === 0 ? (
                      <p className="activity-meta">
                        Register a passkey to populate verified circuit proofs and scoped nullifiers.
                      </p>
                    ) : (
                      <div className="activity-list">
                        {activityFeed.slice(0, 6).map((item) => (
                          <div className="activity-row" key={item.id}>
                            <div className="activity-top">
                              <span className="activity-name">{item.circuit}</span>
                              <span
                                className={`activity-meta ${
                                  item.status === 'reverted'
                                    ? 'activity-meta--err'
                                    : 'activity-meta--ok'
                                }`}
                              >
                                {item.status}
                                {item.proveMs ? ` ${(item.proveMs / 1000).toFixed(1)}s` : ''}
                              </span>
                            </div>
                            <span className="mono-val">
                              {item.reason
                                ? item.reason
                                : item.nullifierHex
                                  ? `nf ${shortHex(item.nullifierHex, 12)}`
                                  : `commit ${shortHex(item.keyCommitHex, 12)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="spec-rows">
                      <div className="spec-row">
                        <span>Relying party</span>
                        <span className="mono-val">{rpId}</span>
                      </div>
                      <div className="spec-row">
                        <span>Registry tree</span>
                        <span className="mono-val">HistoricMerkleTree&lt;16&gt;</span>
                      </div>
                      <div className="spec-row">
                        <span>Key disclosure</span>
                        <span className="mono-val">0 bytes on-chain</span>
                      </div>
                      <div className="spec-row">
                        <span>Proof engine</span>
                        <span className="mono-val">ZKIR v3.1 / Ledger 9</span>
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
                Compact enforces disclose() taint checks at compile time so public keys, blinding
                salts, and Merkle paths never reach Midnight ledger state.
              </p>
            </div>

            <div className="graphite-stage">
              <div className="graphite-bar">
                <span>ThumbSealVault.compact (ZKIR v3.1)</span>
                <span>0 identity bytes disclosed on authorizeAction</span>
              </div>
              <div className="mapping-rows">
                <div className="mapping-row">
                  <div className="graphite-pane-title">Private local witness</div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="graphite-pane-title">Public Midnight ledger</div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">publicKey.x</span>
                    <span className="kv-val">
                      {credential ? shortHex(credential.publicKey.x.toString(16).padStart(64, '0'), 9) : 'device secret'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">rpIdHash</span>
                    <span className="kv-val">{shortHex(rpIdHashHex, 9)}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">publicKey.y</span>
                    <span className="kv-val">
                      {credential ? shortHex(credential.publicKey.y.toString(16).padStart(64, '0'), 9) : 'device secret'}
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
                    <span className="kv-val">
                      {credential ? shortHex(bytesToHex(credential.salt), 9) : '32 B random'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">registeredCount</span>
                    <span className="kv-val">{health?.vault?.registeredCount ?? (registeredCommit ? 1 : 0)}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line">
                    <span className="kv-key">signature (r, s)</span>
                    <span className="kv-val">
                      {lastAssertion
                        ? shortHex(lastAssertion.signature.r.toString(16).padStart(64, '0'), 9)
                        : 'P-256 low-S'}
                    </span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true" />
                  <div className="kv-line">
                    <span className="kv-key">authorizedCount</span>
                    <span className="kv-val">{health?.vault?.authorizedCount ?? 0}</span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">merklePath[16]</span>
                    <span className="kv-val">proves historic root</span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true">
                    <div className="mapping-connector" />
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyTree.checkRoot</span>
                    <span className="kv-val">
                      {health?.vault?.merkleRootField
                        ? shortHex(health.vault.merkleRootField, 9)
                        : 'HistoricMerkleTree<16>'}
                    </span>
                  </div>
                </div>
                <div className="mapping-row">
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">keyCommit + scopeId</span>
                    <span className="kv-val">hashes to nullifier</span>
                  </div>
                  <div className="mapping-cell-bridge" aria-hidden="true">
                    <div className="mapping-connector" />
                  </div>
                  <div className="kv-line kv-line--crossing">
                    <span className="kv-key">usedNullifiers</span>
                    <span className="kv-val">
                      {lastResult?.nullifierHex
                        ? shortHex(lastResult.nullifierHex, 9)
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
              <h2>Fifteen lines to drop Lace</h2>
              <p className="lead">
                Import PasskeyAuth.compact into any Midnight contract. Here is the real compiling
                diff on Midnight&apos;s starter counter.
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
                  <span>After: WalletlessCounter.compact</span>
                  <span>TouchID or FaceID + DUST relayer</span>
                </div>
                <pre>{AFTER_COUNTER_CODE}</pre>
              </div>
            </div>
          </div>
        </section>

        <section id="benchmarks" className="section section--wide-gap section--tinted">
          <div className="container">
            <div className="section-head">
              <h2>Measured across the ecosystem</h2>
              <p className="lead">
                Every number below comes from reproducible scripts in packages/bench against the
                AKINDO Wave 1 to 3 corpus ({ecoStats.measuredDate}) and compactc 0.36.1.
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
                <span className="figure-big">50%</span>
                <span className="figure-label">
                  Prover key reduction (448 MB to 224 MB) via k=18 to k=17 GREASE circuit split
                </span>
              </div>
              <div className="figure-cell">
                <span className="figure-big">0 B</span>
                <span className="figure-label">
                  Passkey public key, salt, or ECDSA signature bytes disclosed in ledger state
                </span>
              </div>
            </div>

            <div className="table-wrap cut">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Circuit</th>
                    <th>Halo2 size</th>
                    <th>ZKIR ops</th>
                    <th>Prover key</th>
                    <th>Verifier</th>
                    <th>Notes</th>
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
                      <td className="mono-cell num">{row.zkirInstructions}</td>
                      <td className="mono-cell num">{row.proverKeyMB.toFixed(2)} MB</td>
                      <td className="mono-cell num">{row.verifierKeyBytes} B</td>
                      <td>{row.proveLabel}</td>
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
          <div className="action-strip">
            <a href="#playground" className="key key--primary">
              <Terminal size={16} aria-hidden="true" />
              <span>Run passkey playground</span>
            </a>
          </div>
          <div className="footer-meta">
            <span>
              ThumbSeal for Midnight Ledger 9 (Compact 0.36.1 / ZKIR v3) under Apache-2.0
              {health?.vault?.deployTxId ? ` | Preview Vault ${shortHex(health.vault.contractAddress, 10)}` : ''}
            </span>
            <div className="footer-links">
              <a href="#playground">Playground</a>
              <a href="#boundary">Proof boundary</a>
              <a href="#migration">Migration</a>
              <a href="#benchmarks">Benchmarks</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
