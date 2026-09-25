/* ============================================================================
   Sentry · LRS limit and TCS rules                              (owner: Alen)
   Every financial year keeps its own rule set, so an old year is always
   checked against the law that applied then.
   ============================================================================ */

import { RUPEES_PER_USD } from '../transfer-timing/currency';
import type { TcsRuleSet } from '../../shared/types';

// ── START: Rule sets by financial year ─────────────────────────────────────
export var TCS_RULE_SETS: TcsRuleSet[] = [
  {
    financialYear: 'FY 2024-25', start: '2024-04-01', end: '2025-03-31', threshold: 700000, lrsLimitUsd: 250000,
    source: 'Finance Act 2023 · effective 1 Oct 2023',
    rates: { educationLoan: { above: 0.005 }, educationSelf: { above: 0.05 }, medical: { above: 0.05 }, tour: { upTo: 0.05, above: 0.20 }, other: { above: 0.20 } }
  },
  {
    financialYear: 'FY 2025-26', start: '2025-04-01', end: '2026-03-31', threshold: 1000000, lrsLimitUsd: 250000,
    source: 'Finance Act 2025 · effective 1 Apr 2025',
    rates: { educationLoan: { above: 0 }, educationSelf: { above: 0.05 }, medical: { above: 0.05 }, tour: { upTo: 0.05, above: 0.20 }, other: { above: 0.20 } }
  },
  {
    financialYear: 'FY 2026-27', start: '2026-04-01', end: '2027-03-31', threshold: 1000000, lrsLimitUsd: 250000,
    source: 'Finance Act 2026 · effective 1 Apr 2026',
    rates: { educationLoan: { above: 0 }, educationSelf: { above: 0.02 }, medical: { above: 0.02 }, tour: { flat: 0.02 }, other: { above: 0.20 } }
  }
];

export var REMITTANCE_PURPOSES = [
  { id: 'education', label: 'Education', code: 'S0305' },
  { id: 'medical', label: 'Medical treatment', code: 'S0304' },
  { id: 'tour', label: 'Tour package', code: '' },
  { id: 'other', label: 'Other', code: '' }
];

export function findPurpose(purposeId) {
  return REMITTANCE_PURPOSES.filter(function (purpose) { return purpose.id === purposeId; })[0] || REMITTANCE_PURPOSES[3];
}

export function financialYearOf(date) {
  var startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return 'FY ' + startYear + '-' + String(startYear + 1).slice(2);
}

export function tcsRulesFor(financialYear: string): TcsRuleSet {
  for (var i = 0; i < TCS_RULE_SETS.length; i++) {
    if (TCS_RULE_SETS[i].financialYear === financialYear) return TCS_RULE_SETS[i];
  }
  var latest = TCS_RULE_SETS[TCS_RULE_SETS.length - 1];
  var startYear = +financialYear.slice(3, 7);
  return Object.assign({}, latest, {
    financialYear: financialYear, start: startYear + '-04-01', end: (startYear + 1) + '-03-31',
    source: latest.source + ' · carried forward', carriedForward: true
  });
}
// ── END: Rule sets by financial year ───────────────────────────────────────


// ── START: TCS on a single remittance ──────────────────────────────────────
export function tcsRateKey(remittance, hasLoanLetter) {
  if (remittance.purpose === 'education') return remittance.loanFunded && hasLoanLetter ? 'educationLoan' : 'educationSelf';
  if (remittance.purpose === 'medical') return 'medical';
  if (remittance.purpose === 'tour') return 'tour';
  return 'other';
}

export function tcsOnRemittance(rules, rateKey, sentBefore, amount, tourSentBefore) {
  var rate = rules.rates[rateKey];
  if (rateKey === 'tour') {
    if (rate.flat != null) return { tcs: amount * rate.flat, taxable: amount, rate: rate.flat };
    var belowThreshold = Math.max(0, Math.min(amount, rules.threshold - tourSentBefore));
    var aboveThreshold = amount - belowThreshold;
    return { tcs: belowThreshold * rate.upTo + aboveThreshold * rate.above, taxable: amount, rate: aboveThreshold > 0 ? rate.above : rate.upTo };
  }
  var taxable = Math.max(0, sentBefore + amount - Math.max(sentBefore, rules.threshold));
  return { tcs: taxable * rate.above, taxable: taxable, rate: rate.above };
}
// ── END: TCS on a single remittance ────────────────────────────────────────


// ── START: Full compliance check for a financial year ──────────────────────
export function runComplianceCheck(remittances, financialYear, options) {
  var rules = tcsRulesFor(financialYear);
  var hasLoanLetter = !!(options && options.loanLetter);
  var thisYear = remittances
    .filter(function (item) { return item.date >= rules.start && item.date <= rules.end; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  var sentSoFar = 0;
  var tourSentSoFar = 0;
  var totalTcs = 0;
  var avoidableTcs = 0;
  var totalUsd = 0;
  var crossedOn = null;
  var items = [];

  thisYear.forEach(function (remittance) {
    var rateKey = tcsRateKey(remittance, hasLoanLetter);
    var result = tcsOnRemittance(rules, rateKey, sentSoFar, remittance.amountInr, tourSentSoFar);
    if (remittance.purpose === 'education' && remittance.loanFunded && !hasLoanLetter) {
      avoidableTcs += result.tcs - tcsOnRemittance(rules, 'educationLoan', sentSoFar, remittance.amountInr, tourSentSoFar).tcs;
    }
    if (!crossedOn && rateKey !== 'tour' && sentSoFar < rules.threshold && sentSoFar + remittance.amountInr >= rules.threshold) {
      crossedOn = remittance.date;
    }
    if (rateKey === 'tour') tourSentSoFar += remittance.amountInr;
    else sentSoFar += remittance.amountInr;
    totalTcs += result.tcs;
    totalUsd += remittance.amountInr / (remittance.usdRate || RUPEES_PER_USD);
    items.push(Object.assign({}, remittance, { rateKey: rateKey, tcs: Math.round(result.tcs), rate: result.rate, taxable: result.taxable }));
  });

  var itemsWithTcs = items.filter(function (item) { return item.tcs > 0; });
  var assessmentYear = +rules.financialYear.slice(3, 7) + 1;
  var headroomUsd = Math.max(0, rules.lrsLimitUsd - totalUsd);

  return {
    rules: rules,
    items: items,
    totalInr: sentSoFar + tourSentSoFar,
    nonTourInr: sentSoFar,
    totalUsd: totalUsd,
    lrsUsedPercent: totalUsd / rules.lrsLimitUsd * 100,
    headroomInr: headroomUsd * RUPEES_PER_USD,
    thresholdPercent: sentSoFar / rules.threshold * 100,
    crossedThreshold: sentSoFar >= rules.threshold,
    crossedOn: crossedOn,
    aboveThresholdBy: Math.max(0, sentSoFar - rules.threshold),
    leftBeforeThreshold: Math.max(0, rules.threshold - sentSoFar),
    totalTcs: Math.round(totalTcs),
    avoidableTcs: Math.round(avoidableTcs),
    tcsCount: itemsWithTcs.length,
    seenIn26asCount: itemsWithTcs.filter(function (item) { return item.in26as; }).length,
    formA2Count: items.filter(function (item) { return item.a2 !== false; }).length,
    assessmentYear: 'AY ' + assessmentYear + '-' + String(assessmentYear + 1).slice(2),
    itrDueDate: '31 Jul ' + assessmentYear
  };
}

export function previewTcs(check, amountInr, purposeId, loanFunded, hasLoanLetter) {
  var rateKey = tcsRateKey({ purpose: purposeId, loanFunded: loanFunded }, hasLoanLetter);
  var tourBefore = check.totalInr - check.nonTourInr;
  var result = tcsOnRemittance(check.rules, rateKey, check.nonTourInr, amountInr, tourBefore);
  return { tcs: Math.round(result.tcs), rate: result.rate, taxable: result.taxable, rateKey: rateKey };
}
// ── END: Full compliance check for a financial year ────────────────────────
