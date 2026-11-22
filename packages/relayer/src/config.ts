import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const VAULT_ASSETS_DIR = path.resolve(
  REPO_ROOT,
  'packages/contracts/src/managed/thumbseal-vault'
);
export const COUNTER_ASSETS_DIR = path.resolve(
  REPO_ROOT,
  'packages/contracts/src/managed/walletless-counter'
);
export const DEPLOYMENT_FILE = path.resolve(REPO_ROOT, 'deployments/preview.json');

export const PREVIEW_ENDPOINTS = {
  networkId: 'preview' as const,
  indexerHttpUrl:
    process.env.MIDNIGHT_INDEXER_HTTP_URL ||
    'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWsUrl:
    process.env.MIDNIGHT_INDEXER_WS_URL ||
    'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  nodeHttpUrl:
    process.env.MIDNIGHT_NODE_URL || 'https://rpc.preview.midnight.network',
  nodeWsUrl:
    process.env.MIDNIGHT_NODE_WS_URL || 'wss://rpc.preview.midnight.network',
  provingServerUrl:
    process.env.MIDNIGHT_PROOF_SERVER_URL || 'http://127.0.0.1:6300',
};

export const THUMBSEAL_RP_ID = process.env.THUMBSEAL_RP_ID || 'thumbseal.pages.dev';
export const THUMBSEAL_ORIGIN = process.env.THUMBSEAL_ORIGIN || 'https://thumbseal.pages.dev';

export interface RelayerSecrets {
  masterSeed: Uint8Array;
  privateStatePassword: string;
}

export function loadRelayerSecrets(): RelayerSecrets {
  let seedHex = process.env.THUMBSEAL_PREVIEW_SEED;
  let pw = process.env.THUMBSEAL_PRIVATE_STATE_PASSWORD;

  const secretPath =
    process.env.THUMBSEAL_SECRET_FILE || path.join(os.homedir(), '.thumbseal', 'preview.env');
  if ((!seedHex || !pw) && fs.existsSync(secretPath)) {
    const raw = fs.readFileSync(secretPath, 'utf8');
    const mSeed = raw.match(/^THUMBSEAL_PREVIEW_SEED=([0-9a-fA-F]+)$/m);
    const mPw = raw.match(/^THUMBSEAL_PRIVATE_STATE_PASSWORD=(.+)$/m);
    if (!seedHex && mSeed) seedHex = mSeed[1].trim();
    if (!pw && mPw) pw = mPw[1].trim();
  }

  if (!seedHex) {
    throw new Error(
      'Missing THUMBSEAL_PREVIEW_SEED (set env var or THUMBSEAL_SECRET_FILE)'
    );
  }
  return {
    masterSeed: Uint8Array.from(Buffer.from(seedHex, 'hex')),
    privateStatePassword: pw || 'ThumbSeal-Local-Ephemeral-State-Pw-9!',
  };
}

export interface PreviewDeploymentRecord {
  network: 'preview';
  deployedAt: string;
  rpId: string;
  origin: string;
  vaultAddress: string;
  vaultDeployTxId: string;
  counterAddress?: string;
  counterDeployTxId?: string;
  relayerUnshieldedAddress: string;
  sampleRegisterTxId?: string;
  sampleKeyCommitHex?: string;
  sampleAuthorizeTxId?: string;
  sampleNullifierHex?: string;
}

export function loadPreviewDeployment(): PreviewDeploymentRecord | null {
  if (!fs.existsSync(DEPLOYMENT_FILE)) return null;
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8')) as PreviewDeploymentRecord;
}

export function savePreviewDeployment(rec: PreviewDeploymentRecord): void {
  fs.mkdirSync(path.dirname(DEPLOYMENT_FILE), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}
