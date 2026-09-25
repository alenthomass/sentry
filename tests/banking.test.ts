/* ============================================================================
   Sentry · Mock banking tests (run: npm test)
   ============================================================================ */
import test from 'node:test';
import assert from 'node:assert';
import { categorisePayment, changeExpenseCategory, importBankStatement, merchantKey, REVIEW_BELOW_CONFIDENCE } from '../src/modules/banking/importer';
import { createBankConnection, fetchBankBalance, fetchBankStatement } from '../src/modules/banking/mock-bank';
import { splitBudget } from '../src/modules/budget/budget';
import { buildLoanSchedule } from '../src/modules/loans/loans';
import { addMonths, startOfToday, toIsoDate } from '../src/shared/dates';

const emptyData = () => ({ ledgers: {}, remittances: [], loans: [], history: { months: [] } });
const today = startOfToday();
const twoMonthsAgo = toIsoDate(new Date(today.getFullYear(), today.getMonth() - 2, 1));
const todayIso = toIsoDate(today);

// ── START: Categorising ────────────────────────────────────────────────────
test('categoriser: your rule, then known shop, then merchant code, then review', () => {
  assert.strictEqual(categorisePayment('TESCO STORES 3291', 5411).categoryId, 'grocery');
  assert.strictEqual(categorisePayment('SOME DINER', 5812).categoryId, 'eatout');
  assert.ok(categorisePayment('AMAZON* MKTPLACE', 5999).confidence < REVIEW_BELOW_CONFIDENCE);
  const rules = { [merchantKey('AMAZON* MKTPLACE')]: 'course' };
  assert.strictEqual(categorisePayment('AMAZON* MKTPLACE', 5999, rules).categoryId, 'course');
});
// ── END: Categorising ──────────────────────────────────────────────────────


// ── START: Importing statements ────────────────────────────────────────────
test('card statement imports, skips top-ups and never duplicates', () => {
  const bank = createBankConnection('monzo', 'GBP', 't1');
  const lines = fetchBankStatement(bank, twoMonthsAgo, todayIso, { currencyCode: 'GBP', budgets: splitBudget(1250), usualTransfer: 1200, name: 'A' });
  const options = { rules: {}, rupeeRate: 118.4, currencyCode: 'GBP', historyFrom: twoMonthsAgo };
  const first = importBankStatement(emptyData(), bank, lines, options);
  assert.ok(first.stats.expenses > 50 && first.stats.topUps >= 2);
  assert.strictEqual(first.stats.monthsRebuilt.length, 2);
  assert.strictEqual(importBankStatement(first.data, bank, lines, options).stats.expenses, 0);
});

test('a typed-in expense is linked, not counted twice', () => {
  const bank = createBankConnection('monzo', 'GBP', 't2');
  const payments = fetchBankStatement(bank, todayIso, todayIso, { currencyCode: 'GBP', budgets: splitBudget(5000) }).filter((line) => line.direction === 'debit');
  if (!payments.length) return;
  const data = emptyData();
  data.ledgers[todayIso.slice(0, 7)] = [{ id: 'typed', date: todayIso, cat: 'grocery', amount: payments[0].amount, cur: 'GBP' }];
  const result = importBankStatement(data, bank, payments.slice(0, 1), { rules: {}, rupeeRate: 118, currencyCode: 'GBP' });
  assert.strictEqual(result.stats.linkedToTyped, 1);
  assert.strictEqual(result.data.ledgers[todayIso.slice(0, 7)].length, 1);
});

test('Indian statement: remittances logged, TCS matched, EMIs marked paid', () => {
  const loan = { id: 'l1', name: 'HDFC Credila', principal: 1400000, rate: 10.25, tenure: 84, disbursed: toIsoDate(addMonths(today, -12)), moratoriumEnd: toIsoDate(addMonths(today, 5)), mode: 'simple' };
  const bank = createBankConnection('hdfc', 'GBP', 't3');
  const yearStart = toIsoDate(new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1));
  const student = {
    currencyCode: 'GBP', rupeeRate: 118.4, usualTransfer: 1200, funding: 'Education loan', university: 'UCL',
    loans: [{ id: 'l1', name: 'HDFC Credila', payments: buildLoanSchedule(loan).rows.map((row) => ({ date: toIsoDate(row.date), amount: row.pay })) }]
  };
  const lines = fetchBankStatement(bank, yearStart, todayIso, student);
  const data = emptyData();
  data.loans = [loan];
  const result = importBankStatement(data, bank, lines, { rules: {} });
  assert.ok(result.stats.remittances >= 1 && result.stats.emisMatched >= 1);
  assert.ok(result.data.remittances.every((item) => item.a2 && item.fromBank));
  assert.strictEqual(result.stats.tcsMatched, lines.filter((line) => /TCS/.test(line.narration)).length);
});

test('balance: matches the statement, stays deterministic, returns a 30-day trend', () => {
  const student = { currencyCode: 'GBP', budgets: splitBudget(1250), usualTransfer: 1200, name: 'A', rupeeRate: 118.4, funding: 'Education loan', loans: [] };
  const card = createBankConnection('monzo', 'GBP', 'bal1');
  const balance = fetchBankBalance(card, todayIso, student);
  assert.deepStrictEqual(fetchBankBalance(card, todayIso, student), balance);
  assert.strictEqual(balance.currency, 'GBP');
  assert.ok(balance.trend.length > 0 && balance.trend.length <= 30);
  assert.strictEqual(balance.trend[balance.trend.length - 1].amount, balance.current);
  assert.ok(Math.abs(balance.current - balance.pending - balance.available) < 0.01);
  const india = fetchBankBalance(createBankConnection('hdfc', 'GBP', 'bal2'), todayIso, student);
  assert.strictEqual(india.currency, 'INR');
  assert.ok(india.trend.every((point) => point.amount > 0));
});

test('"always use this" refiles every payment from that shop', () => {
  const ledgers = { '2026-09': [{ id: 'a', merchant: 'X', cat: 'shopping', needsReview: true }, { id: 'b', merchant: 'X', cat: 'shopping', needsReview: true }, { id: 'c', merchant: 'Y', cat: 'shopping' }] };
  const updated = changeExpenseCategory(ledgers, 'a', 'course', 'X', true)['2026-09'];
  assert.deepStrictEqual(updated.map((expense) => expense.cat), ['course', 'course', 'shopping']);
  assert.ok(!updated[1].needsReview);
});
// ── END: Importing statements ──────────────────────────────────────────────
