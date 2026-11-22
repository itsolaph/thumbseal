# ThumbSeal

**Walletless WebAuthn Passkey Auth Module, TypeScript SDK, and DUST Fee Sponsor Relayer for Midnight (Compact 0.36.1 / ZKIR v3 / Ledger 9).**

- **Live Walletless Playground:** [https://thumbseal.pages.dev](https://thumbseal.pages.dev)
- **Live Midnight Preview (Ledger 9) Contracts:** Deployed & DUST-sponsored ([`deployments/preview.json`](deployments/preview.json))

### Live Midnight Preview (Ledger 9) Deployment

| Artifact | Address / Tx ID | Verification |
|---|---|---|
| `ThumbSealVault` Contract | `39142ea476d78abe96a549839d861cdcdf5bad6e2cbd62d44eaa03eee05678bd` | Deployed on Midnight Preview (`rpId=thumbseal.pages.dev`) |
| `ThumbSealVault` Deploy Tx | `006cde2598e787e3d775db5a235e195b32db55f01abfd318dcf7c9d99dd4d6445e` | [Midnight Preview Explorer](https://explorer.preview.midnight.network) |
| Live `registerPasskey` Tx | `004e508896c76484f1e71449f738183513762c5ac73f0c443e0d3d83b4ab2532ba` | Real Halo2 `k=15` proof (`6,364 B`, key commit `d6c7c0ca...784d`) |
| Live `authorizeAction` Tx | `0080b995a05c64cbfb6a151fb9f173e8844e2d36a668f94b450224d13019378cd0` | Real Halo2 `k=17` proof (`6,364 B`, nullifier `39690e80...4512`, **0 B leaked**) |
| `WalletlessCounter` Contract | `d6f01535a11ba2428557bb2e22eb6b020348e0eb483507d1cbacc24a47cd2e48` | 15-line migration example deployed on Midnight Preview |
| `WalletlessCounter` Deploy Tx | `00f8fdc0425c97640318e34e3dfb16e006c4016fd49169ecad1fc0ab6360e4c0ae` | [Midnight Preview Explorer](https://explorer.preview.midnight.network) |
| NIGHT → DUST Sponsor Reg Tx | `001cfe84c4b8b648e4446d3690cff46396a3f3bb02fb0d9213222462ad54b92380` | Relayer sponsor address `mn_addr_preview1j0mmyy8fw8xx96qd5lqx7u843hcg2u5e5qpzkuq9gmr68f3urw6qw7k7fz` |

ThumbSeal replaces browser wallet extensions and seed phrases with hardware-backed TouchID, FaceID, Windows Hello, and FIDO2 security keys. A user taps their device biometric sensor once, proves membership in an anonymous `HistoricMerkleTree<16>` inside a Compact `secp256r1` (NIST P-256) zero-knowledge circuit, and lets a DUST sponsor relayer cover transaction fees — disclosing **zero bytes** of passkey public keys, blinding salts, Merkle paths, or ECDSA signatures to the public Midnight ledger.

> **Why now:** Midnight upgraded Mainnet, Preview, and Preprod to **Ledger 9** in November 2026, unlocking native `secp256r1` elliptic-curve operations in Compact `0.36.1` (`ZKIR v3`). In our empirical scan of the AKINDO *Build Privacy-First Apps on Midnight* Wave 1–3 corpus (`packages/bench/results/ecosystem-survey.json`), **104 of 173 reachable public repositories (60.1%)** still require the Lace browser wallet extension, and **0** ship a reusable drop-in Compact Passkey Auth module, browser SDK, and DUST sponsor relayer.

---

## Architecture

```text
User Device (TouchID / FaceID / Windows Hello)
  │
  │  1. navigator.credentials.create() -> P-256 public key (x, y) + local 32B salt
  │  2. navigator.credentials.get(challenge) -> authData + clientDataJSON + DER (r, s)
  │     (Private key never leaves hardware Secure Enclave / TPM)
  ▼
@thumbseal/sdk (packages/sdk)
  │  - Extracts uncompressed P-256 (x, y) from SPKI or COSE CBOR fallback
  │  - Parses ASN.1 DER signatures and normalizes canonical low-S
  │  - Packs RFC 4648 base64url sextets + authenticatorData flag bits (UP/UV/BE/BS)
  │  - Detects Chromium's 20% GREASE clientDataJSON injection automatically
  ▼
PasskeyAuth.compact + ThumbSealVault.compact (packages/contracts)
  │  - Enforces bijective 32B <-> 43-char base64url challenge encoding in-circuit
  │  - Reconstructs canonical W3C clientDataJSON & hashes with persistentHash (SHA-256)
  │  - Verifies rpIdHash (from public ledger), UP/UV flags, and native secp256r1EcdsaVerify
  │  - Proves anonymous membership via HistoricMerkleTree<16>.checkRoot (no keyCommit leak)
  │  - Burns domain- and scope-separated nullifier (replay reverts; cross-scope unlinkable)
  ▼
@thumbseal/relayer (packages/relayer)
  │  - Mode A (Zero-Trust): POST /api/relay/sponsor-tx accepts client-proved UnboundTx,
  │    balances DUST fees, and submits to Midnight Preview without seeing private witnesses.
  │  - Mode B (Hosted Demo): POST /api/relay/{register,authorize} runs proof-server:9.0.2
  │    so browser visitors without local Docker can test live Halo2 ZKIR-v3 proving.
  ▼
Midnight Preview Network (Ledger 9)
```

---

## Monorepo Layout

| Package | Path | Role |
|---|---|---|
| `@thumbseal/contracts` | [`packages/contracts`](packages/contracts) | Reusable `PasskeyAuth.compact` module, flagship `ThumbSealVault.compact`, 15-line `WalletlessCounter.compact` migration example, and 12-vector adversarial Vitest suite. |
| `@thumbseal/sdk` | [`packages/sdk`](packages/sdk) | Zero-Node-dependency browser/Node TypeScript SDK: WebAuthn client, SPKI/COSE & DER low-S crypto, `VirtualPasskeyAuthenticator`, and Midnight witness factories. |
| `@thumbseal/relayer` | [`packages/relayer`](packages/relayer) | Ledger 9 Preview deployer (`deploy-preview.ts`) and Express DUST fee sponsor relayer (`server.ts`). |
| `@thumbseal/bench` | [`packages/bench`](packages/bench) | Reproducible AKINDO Wave 1–3 ecosystem survey and `midnightntwrk/proof-server:9.0.2` Halo2 ZKIR-v3 benchmark harness. |
| `@thumbseal/web` | [`packages/web`](packages/web) | Interactive walletless playground, live Private Witness vs. Public Ledger boundary inspector, and Adversarial Tamper Lab. |

---

## 15-Line Developer Migration

Import `PasskeyAuth.compact` to turn any Midnight contract (such as Midnight's starter `Counter`) into a walletless passkey-gated contract ([`packages/contracts/src/examples/WalletlessCounter.compact`](packages/contracts/src/examples/WalletlessCounter.compact)):

```compact
import CompactStandardLibrary;
import "../PasskeyAuth" prefix PA_;

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
  assert(PA_commitPasskey(pk, salt) == ownerCommit, "Passkey does not match counter owner");
  const challenge = PA_deriveChallenge("thumbseal:cnt:v1", rpIdHash, scopeId, pad(32, "increment"));
  PA_verifyWebAuthnAssertion<27>(pk, rpIdHash, origin, challenge, false, localWebAuthnAssertion());
  const nf = disclose(PA_deriveScopedNullifier(ownerCommit, rpIdHash, scopeId));
  assert(!usedNonces.member(nf), "Increment scope already used");
  usedNonces.insert(nf);
  round.increment(1);
}
```

---

## Circuit Optimization: `k=18 → k=17` (50% Smaller Prover Key)

Chromium randomly appends a 111-byte GREASE property (131-byte combined `crossOrigin` + GREASE suffix) (`"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"`) to ~20% of `webauthn.get` assertions (`content/browser/webauth/client_data_json.cc`).

Because Compact evaluates both branches of conditional `persistentHash` calls inside a circuit, bundling standard W3C and GREASE `clientDataJSON` templates inside a single circuit pushed `authorizeAction` past the Halo2 `2^17` row boundary into **`k=18` (448.05 MB prover key)**.

Splitting Chromium's 20% GREASE path into a dedicated circuit (`authorizeActionGrease`) that shares the exact same `HistoricMerkleTree<16>` and `usedNullifiers` set — while `@thumbseal/sdk` inspects `clientDataJSON` and routes automatically — dropped the hot-path `authorizeAction` and `WalletlessCounter.increment` circuits back to **`k=17` (224.04 MB prover key, 50% smaller)**. In a paired benchmark against the bundled circuit (commit `87e2466`, three alternating runs on one proof server) proving got **1.9x faster: median 85.5 s → 44.2 s** ([`paired-bundled-vs-split.json`](packages/bench/results/paired-bundled-vs-split.json)).


| Contract | Circuit | k | ZKIR Ops | Prover Key | Verifier Key | Proof Size | Halo2 Prove (one run) |
|---|---|---:|---:|---:|---:|---:|---:|
| `ThumbSealVault` | `registerPasskey` | `k=15` | 65 | 56.01 MB | 2,745 B | 6,364 B | **11.93 s** |
| `ThumbSealVault` | `authorizeAction` | `k=17` | 1,451 | 224.04 MB | 2,745 B | 6,364 B | **27.76 s** |
| `ThumbSealVault` | `authorizeActionGrease` | `k=18` | 1,451 | 448.04 MB | 2,745 B | 6,364 B | **80.95 s** |
| `ThumbSealVault` | `enrollBackupPasskey` | `k=18` | 1,498 | 448.05 MB | 2,745 B | 6,364 B | k=18 (one-time) |
| `WalletlessCounter` | `increment` | `k=17` | 1,334 | 224.04 MB | 2,745 B | 6,364 B | **35.21 s** |

See [`packages/bench/results/zkir-benchmark.md`](packages/bench/results/zkir-benchmark.md) and [`packages/bench/results/ecosystem-survey.md`](packages/bench/results/ecosystem-survey.md) for raw measured data and reproduction scripts. Absolute prove times move with host load (same 8-vCPU shared box); compare circuits within one run.

---

## Adversarial QA & Zero-Leak Privacy Suite

Run `npm test` to execute all 12 Vitest suites covering compiled Compact `0.28.0` / `ZKIR v3` circuits and `@thumbseal/sdk`:

- Multi-user enrollment and anonymous authorization across standard W3C and Chromium 20% GREASE assertions
- Cross-circuit replay protection (nullifier spent via `authorizeActionGrease` reverts on `authorizeAction`)
- Concurrent registration resilience via `HistoricMerkleTree<16>` historic root verification
- Anonymous multi-device backup enrollment (`enrollBackupPasskey`) enforcing mandatory biometric `UV=1`
- Tampered `actionTag`, phished browser `origin`, wrong `rpIdHash`, stripped `UP` flag, missing `UV` flag when `requireBiometric=true`, forbidden `AT`/`ED` flags (`0x45`), 1-bit flipped ECDSA signature, identity `Secp256r1Point`, duplicate commitment, unregistered Merkle leaf, and non-canonical RFC 4648 base64url trailing bits
- Full serialized ledger scan confirming **0 bytes** of `pk.x`, `pk.y`, `salt`, `signature.r`, `signature.s`, or `keyCommit` leak into `usedNullifiers` or `receipts`

---

## Trust Model & Security Boundaries

See [`SECURITY.md`](SECURITY.md) for the complete threat model. Summary:

1. **Private key custody:** The P-256 signing key stays inside the user's hardware Secure Enclave / TPM / FIDO2 token in all modes.
2. **Zero-Trust Relayer (`POST /api/relay/sponsor-tx`):** Client runs a local Midnight proof server (`midnightntwrk/proof-server:9.0.2`), generates the Halo2 proof locally, and sends only an already-proved `UnboundTransaction` to the relayer for DUST fee balancing. Private witnesses never leave the user's machine.
3. **Hosted Demo Prover (`POST /api/relay/{register,authorize}`):** Provided strictly for zero-install browser testing by users without local Docker. Ephemeral public keys and WebAuthn signatures touch the hosted prover in memory only (never persisted or logged), while the Midnight ledger remains zero-leak.
4. **Origin scope:** `PasskeyAuth.compact` supports standard desktop/mobile Chrome, Edge, Brave (including Chromium's 20% GREASE), Firefox, and Safari `15.4+`. Browser extensions or Android APKs injecting arbitrary custom `clientDataJSON` keys fail cleanly with an explicit SDK diagnostic rather than weakening challenge binding.

---

## Quickstart & Reproduction

Prerequisites: Node.js `>=22`, `compactc 0.36.1` (`language 0.28.0`, `compact-runtime 0.21.0`), Docker (`midnightntwrk/proof-server:9.0.2`).

```bash
# Install workspace dependencies
npm install

# Compile Compact 0.36.1 contracts (full ZKIR v3 keygen)
npm run compile:contracts

# Build TypeScript packages & web app
npm run build

# Run all 12 contract + SDK adversarial tests
npm test

# Start Midnight Ledger 9 proof server
docker run -d --name midnight-proof-server -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:9.0.2

# Reproduce empirical AKINDO ecosystem survey & Halo2 ZKIR-v3 benchmarks
npm --workspace @thumbseal/bench run bench:ecosystem
npm --workspace @thumbseal/bench run bench:zkir
```

---

## Third-Party Credits & License

Licensed under the **Apache License, Version 2.0** ([`LICENSE`](LICENSE)).

- Midnight Compact Runtime, Ledger v9, Midnight.js, and Wallet SDK (`@midnight-ntwrk/*`) — Midnight Foundation, Apache-2.0
- Noble Cryptography (`@noble/curves`, `@noble/hashes`) — Paul Miller, MIT
- Express, React, Vite, Vitest, Lucide Icons — MIT / ISC
