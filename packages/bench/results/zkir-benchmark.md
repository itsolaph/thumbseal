# ThumbSeal ZKIR v3 & Halo2 Proving Benchmarks (Compact 0.36.1 / Ledger 9)

- **Measured at:** 2026-11-22T14:27:52.408Z
- **Toolchain:** `compactc 0.36.1` (`language 0.28.0`, `compact-runtime 0.21.0`, `midnightntwrk/proof-server:9.0.2`)
- **Optimization win:** Splitting Chromium's 20% GREASE suffix into `authorizeActionGrease` cut the hot-path `authorizeAction` circuit from **k=18 (448.05 MB, 121.15 s)** to **k=17 (224.04 MB, 27.76 s)** â€” **50% smaller prover key & ~2x faster proving**.

| Contract | Circuit | k | ZKIR Ops | Prover Key | Verifier Key | Check | Halo2 Prove |
|---|---|---:|---:|---:|---:|---:|---:|
| ThumbSealVault | `registerPasskey` | k=15 | 65 | 56.01 MB | 2745 B | 561 ms | **11.93 s** |
| ThumbSealVault | `authorizeAction` | k=17 | 1451 | 224.04 MB | 2745 B | 2425 ms | **27.76 s** |
| ThumbSealVault | `authorizeActionGrease` | k=18 | 1451 | 448.04 MB | 2745 B | 3718 ms | **80.95 s** |
| ThumbSealVault | `enrollBackupPasskey` | k=18 | 1498 | 448.05 MB | 2745 B | 8 ms | k=18 (optional) |
| WalletlessCounter | `increment` | k=17 | 1334 | 224.04 MB | 2745 B | 5730 ms | **35.21 s** |

Reproduce: `npm --workspace @thumbseal/bench run bench:zkir`
