/* ============================================================================
   Sentry · Reading the signed-in user's documents into one data object
   ============================================================================ */

import { upgradeProfile } from './profile';
import { Store } from './store';

// ── START: Reading the user's documents ────────────────────────────────────
export function loadUserData(liveRate) {
  var ledgers = {};
  Store.listIds('ledger-').forEach(function (id) { ledgers[id.slice(7)] = (Store.read(id) || {}).txns || []; });
  return {
    profile: upgradeProfile(Store.read('profile')) || null,
    remittances: (Store.read('remits') || {}).items || [],
    loans: (Store.read('loans') || {}).items || [],
    history: Store.read('history') || { months: [] },
    ledgers: ledgers,
    liveRate: liveRate || null
  };
}
// ── END: Reading the user's documents ──────────────────────────────────────
