/* ============================================================================
   Sentry · Engine tests (run: npm test)
   ============================================================================ */
import test from 'node:test';
import assert from 'node:assert';
import { runComplianceCheck, tcsRulesFor } from '../src/modules/compliance/compliance';
import { computeRiskScore } from '../src/modules/dashboard/risk';
import { forecastCategory } from '../src/modules/forecast/forecast';
import { buildLoanSchedule, emiAmount } from '../src/modules/loans/loans';
import { adviseTransferTiming } from '../src/modules/transfer-timing/advisor';

// ── START: Compliance ──────────────────────────────────────────────────────
test('TCS rule sets are versioned by financial year', () => {
  assert.strictEqual(tcsRulesFor('FY 2024-25').threshold, 700000);
  assert.strictEqual(tcsRulesFor('FY 2025-26').rates.educationSelf.above, 0.05);
  assert.strictEqual(tcsRulesFor('FY 2026-27').rates.educationSelf.above, 0.02);
  assert.strictEqual(tcsRulesFor('FY 2026-27').rates.educationLoan.above, 0);
  assert.ok(tcsRulesFor('FY 2030-31').carriedForward);
});

test('TCS applies only above the ₹10L threshold', () => {
  const remittances = [
    { id: 'a', date: '2026-05-01', amountInr: 800000, purpose: 'education', loanFunded: false },
    { id: 'b', date: '2026-08-01', amountInr: 600000, purpose: 'education', loanFunded: false }
  ];
  const check = runComplianceCheck(remittances, 'FY 2026-27', {});
  assert.strictEqual(check.items[0].tcs, 0);
  assert.strictEqual(check.items[1].tcs, 8000);
  assert.strictEqual(check.crossedOn, '2026-08-01');
});

test('Loan-funded education is 0% only with the sanction letter', () => {
  const remittances = [{ id: 'a', date: '2026-05-01', amountInr: 1500000, purpose: 'education', loanFunded: true }];
  assert.strictEqual(runComplianceCheck(remittances, 'FY 2026-27', { loanLetter: false }).totalTcs, 10000);
  assert.strictEqual(runComplianceCheck(remittances, 'FY 2026-27', { loanLetter: true }).totalTcs, 0);
  assert.strictEqual(runComplianceCheck(remittances, 'FY 2026-27', { loanLetter: false }).avoidableTcs, 10000);
});
// ── END: Compliance ────────────────────────────────────────────────────────


// ── START: Loans ───────────────────────────────────────────────────────────
test('EMI formula and moratorium schedule', () => {
  assert.ok(Math.abs(emiAmount(1000000, 10, 120) - 13215.07) < 0.5);
  const schedule = buildLoanSchedule({ principal: 1200000, rate: 12, tenure: 60, disbursed: '2026-01-10', moratoriumEnd: '2026-07-10', mode: 'simple' });
  const moratoriumRows = schedule.rows.filter((row) => row.phase === 'moratorium');
  assert.strictEqual(moratoriumRows.length, 5);
  assert.ok(Math.abs(moratoriumRows[0].pay - 12000) < 0.01);
  assert.ok(schedule.rows[schedule.rows.length - 1].balance < 1);
});

test('Adding interest to the loan during moratorium raises the EMI', () => {
  const base = { principal: 1000000, rate: 12, tenure: 12, disbursed: '2026-01-01', moratoriumEnd: '2026-04-01' };
  assert.ok(buildLoanSchedule(Object.assign({ mode: 'accrue' }, base)).emi > buildLoanSchedule(Object.assign({ mode: 'simple' }, base)).emi);
});
// ── END: Loans ─────────────────────────────────────────────────────────────


// ── START: Forecast, risk and timing ───────────────────────────────────────
test('Forecast flags a category that is running hot', () => {
  const daily = new Array(30).fill(0).map((_, day) => (day < 18 ? 22 : 0));
  const hot = forecastCategory({ dayOfMonth: 18, daysInMonth: 30, dailySpend: daily, budget: 500, history: [480, 500, 520] });
  assert.ok(hot.projected > 500 && hot.breachProbability > 0.5 && hot.breachDay > 18);
  const calm = forecastCategory({ dayOfMonth: 18, daysInMonth: 30, dailySpend: daily.map((amount) => amount / 3), budget: 500, history: [200, 210, 220] });
  assert.ok(calm.breachProbability < 0.1 && !calm.breachDay);
});

test('Risk score stays within 1–99 and compounds', () => {
  const risk = computeRiskScore({ totalBudget: 1000, projectedTotal: 1300, weightedOverspendRisk: 800, compliancePoints: 15, nextEmiInr: 60000, budgetInr: 100000, emiStepUpSoon: true, fxVolatility: 0.1 });
  assert.ok(risk.score >= 1 && risk.score <= 99 && risk.multiplier > 1);
});

test('Timing advisor prefers the cheapest upfront cost', () => {
  const rateHistory = Array.from({ length: 31 }, (_, day) => 110 + day * 0.2);
  const check = runComplianceCheck([], 'FY 2026-27', {});
  const advice = adviseTransferTiming({ rateHistory, amountLocal: 1000, fee: 10, today: new Date(2026, 8, 24), check, currencyCode: 'GBP', purpose: 'education', loanFunded: false, hasLoanLetter: false });
  assert.strictEqual(advice.windows.length, 3);
  assert.strictEqual(advice.recommended.id, 'now');
});
// ── END: Forecast, risk and timing ─────────────────────────────────────────
