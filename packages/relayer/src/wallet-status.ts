import { firstValueFrom, filter, timeout } from 'rxjs';
import * as ledgerV9 from '@midnight-ntwrk/ledger-v9';
import { createRelayerWallet } from './wallet.js';

async function main() {
  console.log('Checking ThumbSeal burner wallet on Midnight Preview...');
  const wallet = await createRelayerWallet();
  try {
    console.log('Unshielded address:', wallet.unshieldedAddress);
    const nativeToken = ledgerV9.nativeToken().raw;

    // Wait for unshielded wallet sync first (~10-15s) so faucet deposits show immediately
    const uState = await firstValueFrom(
      wallet.facade.state().pipe(
        filter((s) => Boolean(s.unshielded?.progress?.isStrictlyComplete?.())),
        timeout(60_000)
      )
    );
    const unshieldedNight =
      (uState.unshielded.balances as Record<string, bigint>)[nativeToken] ?? 0n;
    console.log('Unshielded synced: true');
    console.log('Unshielded tNIGHT:', unshieldedNight.toString());
    console.log('Full isSynced    :', uState.isSynced);
    console.log(
      'Shielded progress:',
      `${uState.shielded?.progress?.appliedIndex ?? 0n}/${uState.shielded?.progress?.highestRelevantWalletIndex ?? 0n}`
    );
    console.log(
      'DUST progress    :',
      `${uState.dust?.progress?.appliedIndex ?? 0n}/${uState.dust?.progress?.highestRelevantWalletIndex ?? 0n}`
    );
    console.log('Current tDUST    :', uState.dust.balance(new Date()).toString());
  } finally {
    await wallet.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
