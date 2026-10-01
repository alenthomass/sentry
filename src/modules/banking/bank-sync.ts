/* ============================================================================
   Sentry · Bank sync (runs in the browser)                      (owner: Alen)
   Connects to the mock aggregator — through the Node server when it is
   running, otherwise directly in the browser — then imports the statement
   and saves only the documents that changed.
   ============================================================================ */

import { addDays, parseIsoDate, startOfToday, toIsoDate } from '../../shared/dates';
import { Store } from '../../data/store';
import { importBankStatement } from './importer';
import { createBankConnection, fetchBankBalance, fetchBankStatement } from './mock-bank';
import { buildLoanSchedule } from '../loans/loans';
import { findCountry, rupeesPerUnit } from '../transfer-timing/currency';
import type { StudentFeed } from '../../shared/types';

export var BankSync = (function () {
  'use strict';

  // ── START: Talking to the aggregator ─────────────────────────────────────
  function throughServer() {
    return Store.mode() === 'server';
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  }

  async function connect(bankId, currencyCode) {
    if (throughServer()) {
      return (await Store.callServer('POST', '/api/bank/connections', { bankId: bankId, currencyCode: currencyCode })).connection;
    }
    await wait(500);
    return createBankConnection(bankId, currencyCode, Store.newId());
  }

  async function disconnect(connection) {
    if (!throughServer()) return;
    try { await Store.callServer('DELETE', '/api/bank/connections/' + encodeURIComponent(connection.id)); } catch (error) { return; }
  }

  async function fetchStatement(connection, fromIso, toIso, student) {
    if (throughServer()) {
      var body = { from: fromIso, to: toIso, student: student };
      var reply = await Store.callServer('POST', '/api/bank/connections/' + encodeURIComponent(connection.id) + '/statement', body);
      return { lines: reply.lines, balance: reply.balance || null };
    }
    await wait(700);
    var balance = null;
    try { balance = fetchBankBalance(connection, toIso, student); } catch (error) { balance = null; }
    return { lines: fetchBankStatement(connection, fromIso, toIso, student), balance: balance };
  }
  // ── END: Talking to the aggregator ───────────────────────────────────────


  // ── START: What the mock bank needs to know about the student ────────────
  function paymentsTypedByHand(ledgers, currencyCode) {
    var payments = [];
    Object.keys(ledgers || {}).forEach(function (month) {
      ledgers[month].forEach(function (expense) {
        var typedByHand = !expense.bankLineId || String(expense.bankLineId).indexOf(':card:' + expense.id) >= 0;
        if (typedByHand && expense.cur === currencyCode) payments.push({ id: expense.id, date: expense.date, amount: expense.amount, note: expense.note || '' });
      });
    });
    return payments;
  }

  function remittancesTypedByHand(remittances) {
    return (remittances || []).filter(function (remittance) {
      return !remittance.fromBank && (!remittance.bankLineId || String(remittance.bankLineId).indexOf(':lrs:' + remittance.id) >= 0);
    }).map(function (remittance) {
      return { id: remittance.id, date: remittance.date, amountInr: remittance.amountInr, purpose: remittance.purpose, loanFunded: !!remittance.loanFunded };
    });
  }

  function describeStudent(profile, loans, ledgers?, remittances?): StudentFeed {
    var country = findCountry(profile.country);
    return {
      currencyCode: country.code,
      name: profile.name,
      rupeeRate: rupeesPerUnit(country.code, profile.rateOverrides),
      usualTransfer: profile.transferAmount || country.usualTransfer,
      budgets: profile.budgets,
      funding: profile.funding,
      university: profile.uni,
      manualPayments: paymentsTypedByHand(ledgers, country.code),
      manualRemittances: remittancesTypedByHand(remittances),
      loans: (loans || []).map(function (loan) {
        return {
          id: loan.id,
          name: loan.name,
          payments: buildLoanSchedule(loan).rows.map(function (row) { return { date: toIsoDate(row.date), amount: row.pay }; })
        };
      })
    };
  }

  function dateRangeToFetch(connection, today) {
    if (connection.lastSync) {
      return { from: toIsoDate(addDays(parseIsoDate(connection.lastSync.slice(0, 10)), -3)), to: toIsoDate(today), historyFrom: null };
    }
    var from = connection.region === 'abroad'
      ? toIsoDate(new Date(today.getFullYear(), today.getMonth() - 2, 1))
      : toIsoDate(new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1));
    return { from: from, to: toIsoDate(today), historyFrom: from };
  }
  // ── END: What the mock bank needs to know about the student ──────────────


  // ── START: Sync one connection ───────────────────────────────────────────
  function currentData() {
    var ledgers = {};
    Store.listIds('ledger-').forEach(function (id) { ledgers[id.slice(7)] = (Store.read(id) || {}).txns || []; });
    return {
      ledgers: ledgers,
      remittances: (Store.read('remits') || {}).items || [],
      loans: (Store.read('loans') || {}).items || [],
      history: Store.read('history') || { months: [] }
    };
  }

  async function sync(connectionId) {
    var profile = Store.read('profile');
    var connection = (profile.banks || []).filter(function (bank) { return bank.id === connectionId; })[0];
    if (!connection) throw new Error('Bank not connected');

    var before = currentData();
    var range = dateRangeToFetch(connection, startOfToday());
    var student = describeStudent(profile, before.loans, before.ledgers, before.remittances);
    var abroadBanks = (profile.banks || []).filter(function (bank) { return bank.region === 'abroad'; });
    var isExtraCard = connection.region === 'abroad' && abroadBanks.length && abroadBanks[0].id !== connection.id;
    if (isExtraCard) student.share = 0.25;

    var statement = await fetchStatement(connection, range.from, range.to, student);
    var lines = statement.lines;
    var country = findCountry(profile.country);
    var result = importBankStatement(before, connection, lines, {
      rules: profile.categoryRules || {},
      rupeeRate: rupeesPerUnit(country.code, profile.rateOverrides),
      currencyCode: country.code,
      historyFrom: range.historyFrom,
      dismissedLines: profile.dismissedBankLines || []
    });

    var saves = [];
    Object.keys(result.data.ledgers).forEach(function (month) {
      var changed = JSON.stringify(result.data.ledgers[month]) !== JSON.stringify(before.ledgers[month] || []);
      if (changed) saves.push(Store.save('ledger-' + month, { txns: result.data.ledgers[month] }));
    });
    if (result.stats.remittances || result.stats.remittancesLinked || result.stats.tcsMatched) saves.push(Store.save('remits', { items: result.data.remittances }));
    if (result.stats.emisMatched) saves.push(Store.save('loans', { items: result.data.loans }));
    if (result.stats.monthsRebuilt.length) saves.push(Store.save('history', result.data.history));

    var latestProfile = Store.read('profile');
    var banks = (latestProfile.banks || []).map(function (bank) {
      return bank.id === connectionId ? Object.assign({}, bank, { lastSync: new Date().toISOString(), lastStats: result.stats, balance: statement.balance || bank.balance || null }) : bank;
    });
    saves.push(Store.save('profile', Object.assign({}, latestProfile, { banks: banks })));
    await Promise.all(saves);
    return result.stats;
  }
  // ── END: Sync one connection ─────────────────────────────────────────────


  return { connect: connect, disconnect: disconnect, sync: sync, describeStudent: describeStudent };
})();
