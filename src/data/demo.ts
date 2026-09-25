/* ============================================================================
   Sentry · Demo account
   Builds "Aarav Sharma" at UCL with data dated around today, so the demo
   always looks current. His spending, remittances and EMI payments come
   from the mock banks exactly as a real sync would bring them in.
   ============================================================================ */

import { addDays, addMonths, daysBetween, monthKey, parseIsoDate, startOfToday, toIsoDate } from '../shared/dates';
import { seededRandom } from '../shared/maths';
import { createProfile } from './profile';
import { importBankStatement } from '../modules/banking/importer';
import { banksFor, createBankConnection, fetchBankBalance, fetchBankStatement } from '../modules/banking/mock-bank';
import { CATEGORIES, defaultMonthlyBudget, splitBudget } from '../modules/budget/budget';
import { buildLoanSchedule } from '../modules/loans/loans';
import { findCountry } from '../modules/transfer-timing/currency';

// ── START: Demo account ────────────────────────────────────────────────────
export function buildDemoAccount(countryId) {
  var country = findCountry(countryId || 'UK');
  var today = startOfToday();
  var budgets = splitBudget(defaultMonthlyBudget(country.code));
  var documents: Record<string, any> = {};

  documents.profile = Object.assign(createProfile({
    name: 'Aarav Sharma', phone: '+91 98200 12345', pan: 'ABCPS1234K', uni: 'University College London',
    courseEnds: 'Sep 2027', funding: 'Education loan', country: country.id
  }, 'aarav.sharma@ucl.ac.uk'), {
    dob: '14 Mar 2003', passport: 'Z4891907', panLinked: true, demo: true, budgets: budgets
  });

  documents.history = { months: demoPastMonths(budgets, today) };

  documents.loans = { items: [
    { id: 'l1', name: 'HDFC Credila', principal: 1400000, rate: 10.25, tenure: 84, mode: 'simple',
      disbursed: toIsoDate(addDays(addMonths(today, -12), 5)), moratoriumEnd: toIsoDate(addMonths(today, 5)) },
    { id: 'l2', name: 'SBI Global Ed-Vantage', principal: 600000, rate: 9.65, tenure: 60, mode: 'simple',
      disbursed: toIsoDate(addDays(addMonths(today, -14), -10)), moratoriumEnd: null }
  ] };

  importDemoBanks(documents, country, budgets, today);
  return documents;
}

export function demoPastMonths(budgets, today) {
  var random = seededRandom('demo-history');
  var months = [];
  for (var monthsAgo = 6; monthsAgo >= 1; monthsAgo--) {
    var month = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -monthsAgo);
    var totals = {};
    CATEGORIES.forEach(function (category) {
      var risingCategory = category.id === 'grocery' || category.id === 'shopping';
      var drift = risingCategory ? 0.9 + (6 - monthsAgo) * 0.045 : 0.88;
      totals[category.id] = Math.round(budgets[category.id] * drift * (0.95 + random() * 0.1));
    });
    months.push({ month: monthKey(month), totals: totals });
  }
  return months;
}
// ── END: Demo account ──────────────────────────────────────────────────────


// ── START: Demo bank data (last synced 3 days ago) ─────────────────────────
export function importDemoBanks(documents, country, budgets, today) {
  var lastSyncDate = addDays(today, -3);
  var lastSyncIso = toIsoDate(lastSyncDate);
  var cardBank = createBankConnection(banksFor(country.code).abroad[0].id, country.code, 'demo01');
  var indianBank = createBankConnection('hdfc', country.code, 'demo02');
  var student = {
    currencyCode: country.code, name: documents.profile.name, rupeeRate: country.rupeeRate, usualTransfer: country.usualTransfer,
    budgets: budgets, funding: documents.profile.funding, university: documents.profile.uni,
    loans: documents.loans.items.map(function (loan) {
      return { id: loan.id, name: loan.name, payments: buildLoanSchedule(loan).rows.map(function (row) { return { date: toIsoDate(row.date), amount: row.pay }; }) };
    })
  };

  var cardFrom = toIsoDate(new Date(today.getFullYear(), today.getMonth() - 2, 1));
  var yearFrom = toIsoDate(new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1));
  var start = { ledgers: {}, remittances: [], loans: documents.loans.items, history: documents.history };

  var afterCard = importBankStatement(start, cardBank, fetchBankStatement(cardBank, cardFrom, lastSyncIso, student),
    { rules: {}, rupeeRate: country.rupeeRate, currencyCode: country.code, historyFrom: cardFrom });
  var afterIndia = importBankStatement(afterCard.data, indianBank, fetchBankStatement(indianBank, yearFrom, lastSyncIso, student), { rules: {} });

  Object.keys(afterIndia.data.ledgers).forEach(function (month) {
    documents['ledger-' + month] = { txns: afterIndia.data.ledgers[month] };
  });
  documents.remits = { items: afterIndia.data.remittances.map(function (remittance) {
    return Object.assign({}, remittance, { in26as: daysBetween(parseIsoDate(remittance.date), today) > 30 });
  }) };
  documents.loans = { items: afterIndia.data.loans };
  documents.history = afterIndia.data.history;

  var syncedAt = new Date(lastSyncDate.getFullYear(), lastSyncDate.getMonth(), lastSyncDate.getDate(), 8, 30).toISOString();
  documents.profile.banks = [
    Object.assign(cardBank, { lastSync: syncedAt, lastStats: afterCard.stats, balance: fetchBankBalance(cardBank, lastSyncIso, student) }),
    Object.assign(indianBank, { lastSync: syncedAt, lastStats: afterIndia.stats, balance: fetchBankBalance(indianBank, lastSyncIso, student) })
  ];
  documents.profile.localBank = cardBank.name + ' ' + cardBank.account.replace(/^\w+ /, '');
  documents.profile.homeBank = indianBank.name + ' ' + indianBank.account.replace(/^\w+ /, '');
}
// ── END: Demo bank data (last synced 3 days ago) ───────────────────────────
