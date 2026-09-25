/* ============================================================================
   Sentry · Currency and exchange rates                         (owner: Alen)
   Where a student can study, the local currency there, and the rupee rate.
   Rates are a reference snapshot; the server swaps in live ECB rates.
   ============================================================================ */

import { seededRandom } from '../../shared/maths';

// ── START: Study countries ─────────────────────────────────────────────────
export var RATES_AS_OF = '2026-09-24';
export var RUPEES_PER_USD = 88.4;

export var STUDY_COUNTRIES = [
  { id: 'UK', label: 'United Kingdom', code: 'GBP', symbol: '£', rupeeRate: 118.4, visa: 'Student route', transferFee: 9, usualTransfer: 1200, bankName: 'Monzo' },
  { id: 'US', label: 'United States', code: 'USD', symbol: '$', rupeeRate: 88.4, visa: 'F-1 student', transferFee: 12, usualTransfer: 1500, bankName: 'Chase' },
  { id: 'CA', label: 'Canada', code: 'CAD', symbol: 'C$', rupeeRate: 63.8, visa: 'Study permit', transferFee: 14, usualTransfer: 2000, bankName: 'RBC' },
  { id: 'AU', label: 'Australia', code: 'AUD', symbol: 'A$', rupeeRate: 58.2, visa: 'Subclass 500', transferFee: 15, usualTransfer: 2200, bankName: 'CommBank' },
  { id: 'DE', label: 'Germany', code: 'EUR', symbol: '€', rupeeRate: 103.6, visa: 'National D visa', transferFee: 8, usualTransfer: 1300, bankName: 'N26' }
];

export function findCountry(countryId) {
  for (var i = 0; i < STUDY_COUNTRIES.length; i++) {
    if (STUDY_COUNTRIES[i].id === countryId) return STUDY_COUNTRIES[i];
  }
  return STUDY_COUNTRIES[0];
}
// ── END: Study countries ───────────────────────────────────────────────────


// ── START: Rupee rates ─────────────────────────────────────────────────────
export function rupeesPerUnit(currencyCode: string, overrides?: Record<string, number>) {
  if (currencyCode === 'INR') return 1;
  if (overrides && overrides[currencyCode] > 0) return +overrides[currencyCode];
  for (var i = 0; i < STUDY_COUNTRIES.length; i++) {
    if (STUDY_COUNTRIES[i].code === currencyCode) return STUDY_COUNTRIES[i].rupeeRate;
  }
  return currencyCode === 'USD' ? RUPEES_PER_USD : 1;
}

export function buildRateHistory(currencyCode, todaysRate) {
  var random = seededRandom('fx:' + currencyCode);
  var drift = currencyCode === 'GBP' || currencyCode === 'EUR' ? 0.0006 : 0.0002;
  var logMoves = [0];
  for (var day = 1; day < 31; day++) {
    var shock = (random() + random() + random() - 1.5) * 0.0042;
    logMoves.push(logMoves[day - 1] * 0.93 + shock + drift);
  }
  var lastMove = logMoves[30];
  return logMoves.map(function (move) {
    return +(todaysRate * Math.exp(move - lastMove)).toFixed(3);
  });
}
// ── END: Rupee rates ───────────────────────────────────────────────────────
