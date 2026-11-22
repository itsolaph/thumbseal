# ThumbSeal Security & Privacy Model

## Cryptographic Guarantees (Enforced In-Circuit)

1. **Domain & Origin Pinning:** `rpIdHash` and `origin` are immutable public ledger fields set in the `ThumbSealVault` constructor and mixed directly into `persistentHash` inside `PasskeyAuth.compact`. An assertion signed on a phishing origin or different Relying Party ID fails `secp256r1EcdsaVerify`.
2. **Challenge Binding Without Trusted Witnesses:** Unlike designs that accept `clientDataHash` as an unconstrained private witness, `PasskeyAuth.compact` computes `expectedChallenge = SHA-256(domainTag || rpIdHash || scopeId || actionTag)` in-circuit, enforces a bijective 24-bit triplet mapping to its canonical 43-character RFC 4648 base64url encoding (with zero trailing padding bits), reconstructs W3C `clientDataJSON`, and computes `SHA-256(rpIdHash || flags || signCount || SHA-256(clientDataJSON))` entirely inside the circuit.
3. **Authenticator Flag Enforcement:** Bit 0 (`UP`, User Presence) is mandatory on every assertion. Bit 2 (`UV`, User Verification) is enforced whenever `defaultRequireUv || requireBiometric` is true, and unconditionally enforced on `enrollBackupPasskey`. Synced passkey bits `BE` (`0x08`) and `BS` (`0x10`) are permitted; `RFU2`, `AT`, and `ED` bits are rejected to guarantee exact 37-byte `authenticatorData` framing.
4. **Static Zero-Leak Disclosure:** Compact's witness-disclosure analyzer enforces at compile time that `localPasskeyPub`, `localKeySalt`, `localKeyPath`, and `localWebAuthnAssertion` never enter public ledger state. Only the historic Merkle root check and the domain-separated scoped nullifier cross the proof boundary.
5. **ECDSA Malleability Resistance:** `@thumbseal/sdk` normalizes all ASN.1 DER signatures to canonical low-S (`s <= n/2`). Even if an adversary submits a high-S malleable signature directly to a prover, replay protection keys on `deriveScopedNullifier(keyCommit, rpIdHash, scopeId)` rather than signature bytes, so malleation cannot bypass nullifier uniqueness.
6. **Non-Identity Curve Point Check:** `commitPasskey` and `verifyWebAuthnAssertion` explicitly assert `pk != default<Secp256r1Point>`.

## Relayer Trust Boundary

| Mode | Endpoint | Sees Hardware Private Key? | Sees Public Key & Salt? | Sees On-Chain Identity? |
|---|---|---|---|---|
| Zero-Trust DUST Sponsor | `POST /api/relay/sponsor-tx` | Never | Never (client proves locally) | Never (0 B leaked) |
| Hosted Demo Prover | `POST /api/relay/authorize` | Never (Secure Enclave) | Ephemeral RAM only during proving | Never (0 B leaked) |

## Operational Hardening

- Per-IP sliding-window rate limiting on all relayer POST endpoints.
- Strict CORS origin allowlist bound to the deployed relying-party origin.
- Relayer wallet seed loaded strictly from environment / `chmod 600` secret file, never logged or committed.

- **Contract-scoped DUST sponsorship (`assertSponsorPolicy`):** `POST /api/relay/sponsor-tx` deserializes Ledger 9 `UnboundTransaction` payloads before balancing DUST fees and rejects any transaction containing contract deployments, shielded/unshielded value offers, non-`ContractCall` actions, non-allowlisted contract addresses, or non-allowlisted circuit entry points.
- **Proving & budget quotas:** Per-IP concurrency cap (1 active Halo2 job per IP), sliding-window per-IP rate limits (10 proofs / 15 min; 5 sponsored txs / hour), global daily sponsored tx budget (`MAX_DAILY_SPONSORED_TX`), upfront NIST P-256 curve validation before proving, and optional `RELAYER_API_KEY` header authentication for production deployments (public sandbox runs with open demo access bounded strictly by these caps).
- **Canonical SDK base64url decoding:** `fromBase64Url` enforces RFC 4648 valid lengths and zero trailing bits on the client side, matching the in-circuit bijectivity constraints in `PasskeyAuth.compact`.
