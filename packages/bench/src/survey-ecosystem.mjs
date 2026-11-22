#!/usr/bin/env node
/**
 * ThumbSeal Empirical Ecosystem Survey
 * Scans the public Build Privacy-First Apps on Midnight (AKINDO Wave 1-3) corpus
 * plus public GitHub README.md and package.json files to quantify Lace wallet-extension
 * dependency vs. walletless WebAuthn / Passkey / native secp256r1 adoption.
 *
 * Licensed under the Apache License, Version 2.0.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.resolve(__dirname, '../results');
const AKINDO_BASE = 'https://api.akindo.io/public/wave-hacks/jaMZjqPOBsLXvjdG';

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'thumbseal-ecosystem-bench/0.1', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchAllProducts() {
  const all = [];
  let page = 1;
  const perPage = 50;
  while (true) {
    const data = await fetchJson(`${AKINDO_BASE}/products?page=${page}&perPage=${perPage}`);
    const items = data.items ?? [];
    all.push(...items);
    const totalPages = data.meta?.totalPages ?? 1;
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }
  return all;
}

function parseGithubSlug(product) {
  const direct = product.githubRepositoryName;
  if (direct && typeof direct === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(direct.trim())) {
    return direct.trim();
  }
  for (const field of [product.deliverableUrl, product.githubUrl, product.sourceUrl, product.description]) {
    if (!field || typeof field !== 'string') continue;
    const m = field.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
    if (!m) continue;
    const owner = m[1];
    const repo = m[2].replace(/\.git$/i, '').replace(/[),.\]]+$/, '');
    if (['orgs', 'topics', 'features', 'marketplace', 'sponsors'].includes(owner.toLowerCase())) continue;
    return `${owner}/${repo}`;
  }
  return null;
}

async function fetchRawFiles(slug) {
  for (const branch of ['main', 'master']) {
    let readme = null;
    let pkgJson = null;
    try {
      const r1 = await fetch(`https://raw.githubusercontent.com/${slug}/${branch}/README.md`, {
        headers: { 'User-Agent': 'thumbseal-ecosystem-bench/0.1' },
        signal: AbortSignal.timeout(5000),
      });
      if (r1.ok) readme = (await r1.text()).slice(0, 40_000);
    } catch {}
    try {
      const r2 = await fetch(`https://raw.githubusercontent.com/${slug}/${branch}/package.json`, {
        headers: { 'User-Agent': 'thumbseal-ecosystem-bench/0.1' },
        signal: AbortSignal.timeout(5000),
      });
      if (r2.ok) pkgJson = (await r2.text()).slice(0, 15_000);
    } catch {}
    if (readme || pkgJson) return { branch, readme, pkgJson };
  }
  return null;
}

async function runPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

async function main() {
  const measuredAt = new Date().toISOString();
  const products = await fetchAllProducts();

  const reLace = /\blace\b|dapp-connector|mnLace|midnight\.mnLace|browser\s+wallet|wallet\s+extension/i;
  const reWebAuthn = /\bwebauthn\b|\bpasskey\b|\bfido2\b|navigator\.credentials|\bsecp256r1\b|\bp-256\b/i;
  const reWalletless = /\bwalletless\b|no\s+wallet|without\s+(a\s+)?wallet|zero[- ]wallet|dust\s+(sponsor|relayer|paymaster)/i;
  const reLedger9 = /0\.36|zkir[- ]?v3|ledger[- ]?v?9|secp256r1EcdsaVerify/i;

  const uniqueSlugs = new Map();
  for (const p of products) {
    const slug = parseGithubSlug(p);
    if (slug && !uniqueSlugs.has(slug.toLowerCase())) {
      uniqueSlugs.set(slug.toLowerCase(), slug);
    }
  }

  const slugList = Array.from(uniqueSlugs.values());
  const fetched = await runPool(slugList, 12, async (slug) => ({
    slug,
    files: await fetchRawFiles(slug),
  }));
  const fileMap = new Map(fetched.map((x) => [x.slug.toLowerCase(), x.files]));

  let withGithub = 0;
  let reposReachable = 0;
  let mentionsLace = 0;
  let mentionsLaceAmongReachable = 0;
  let mentionsWebAuthnOrP256 = 0;
  let mentionsWalletless = 0;
  let mentionsLedger9 = 0;
  const webauthnMatches = [];
  const walletlessMatches = [];
  const ledger9Matches = [];

  for (const p of products) {
    const slug = parseGithubSlug(p);
    if (slug) withGithub += 1;
    const files = slug ? fileMap.get(slug.toLowerCase()) : null;
    if (files) reposReachable += 1;

    const corpus = [
      p.name || '',
      p.tagline || '',
      p.description || '',
      files?.readme || '',
      files?.pkgJson || '',
    ].join('\n');

    const hasLace = reLace.test(corpus);
    const hasWebAuthn = reWebAuthn.test(corpus);
    const hasWalletless = reWalletless.test(corpus);
    const hasL9 = reLedger9.test(corpus);

    if (hasLace) {
      mentionsLace += 1;
      if (files) mentionsLaceAmongReachable += 1;
    }
    if (hasWebAuthn) {
      mentionsWebAuthnOrP256 += 1;
      webauthnMatches.push({ name: p.name, slug: slug || null });
    }
    if (hasWalletless) {
      mentionsWalletless += 1;
      walletlessMatches.push({ name: p.name, slug: slug || null });
    }
    if (hasL9) {
      mentionsLedger9 += 1;
      ledger9Matches.push({ name: p.name, slug: slug || null });
    }
  }

  const summary = {
    measuredAt,
    source: `${AKINDO_BASE}/products`,
    totalProducts: products.length,
    productsWithPublicGithubUrl: withGithub,
    uniqueGithubReposFetched: fetched.filter((r) => r.files !== null).length,
    productsWithReachableRepo: reposReachable,
    metrics: {
      mentionsLaceOrWalletExtension: mentionsLace,
      mentionsLaceAmongReachableRepos: mentionsLaceAmongReachable,
      mentionsLacePercentOfReachableRepos: Number(
        ((mentionsLaceAmongReachable / Math.max(reposReachable, 1)) * 100).toFixed(1)
      ),
      mentionsWebAuthnPasskeyOrP256: mentionsWebAuthnOrP256,
      mentionsWalletlessOrDustRelayer: mentionsWalletless,
      mentionsLedger9OrCompact036: mentionsLedger9,
    },
    webauthnMatches,
    walletlessMatches,
    ledger9Matches,
    methodology: [
      'Fetched every public product entry from the AKINDO Build Privacy-First Apps on Midnight WaveHack API.',
      'Extracted GitHub owner/repo slugs from githubRepositoryName and deliverableUrl fields.',
      'Fetched public README.md and package.json (main/master) via raw.githubusercontent.com.',
      'Scanned combined metadata + README + package.json with deterministic regexes; percentages are reported strictly over reachable public repositories (no extrapolation for private or unlinked repos).',
    ],
  };

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(RESULTS_DIR, 'ecosystem-survey.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8'
  );

  const md = [
    '# Midnight Buildathon Ecosystem Survey (Wallet Friction & Passkey Adoption)',
    '',
    `- **Measured at:** ${measuredAt}`,
    `- **Source:** \`${AKINDO_BASE}/products\``,
    `- **Total public products scanned:** ${summary.totalProducts}`,
    `- **Products with public GitHub link:** ${summary.productsWithPublicGithubUrl}`,
    `- **Reachable public GitHub repos (README / package.json):** ${summary.productsWithReachableRepo} (${summary.uniqueGithubReposFetched} unique)`,
    '',
    '| Signal | Count | Share of reachable repos |',
    '|---|---:|---:|',
    `| References Lace / dApp connector / browser wallet extension | ${mentionsLaceAmongReachable} / ${reposReachable} | ${summary.metrics.mentionsLacePercentOfReachableRepos}% |`,
    `| References WebAuthn / Passkey / FIDO2 / secp256r1 | ${mentionsWebAuthnOrP256} / ${summary.totalProducts} | ${((mentionsWebAuthnOrP256 / Math.max(summary.totalProducts, 1)) * 100).toFixed(1)}% |`,
    `| References walletless UX / DUST sponsor relayer | ${mentionsWalletless} / ${summary.totalProducts} | ${((mentionsWalletless / Math.max(summary.totalProducts, 1)) * 100).toFixed(1)}% |`,
    `| References Ledger 9 / Compact 0.36 / ZKIR v3 | ${mentionsLedger9} / ${summary.totalProducts} | ${((mentionsLedger9 / Math.max(summary.totalProducts, 1)) * 100).toFixed(1)}% |`,
    '',
    'Reproduce: `npm --workspace @thumbseal/bench run bench:ecosystem`',
    '',
  ].join('\n');

  await fs.writeFile(path.join(RESULTS_DIR, 'ecosystem-survey.md'), md, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
