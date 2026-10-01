/* ============================================================================
   Sentry · Turning bank lines into Sentry data                  (owner: Alen)
   Reads the lines a bank sends and files them automatically:
     card payment        → expense, placed in a category (or flagged "Review")
     same as a typed one → linked to it, never counted twice
     top-up from India   → recognised as a transfer, not spending
     LRS remittance      → logged on the compliance screen
     TCS deduction       → matched to its remittance ("bank-confirmed")
     EMI debit           → that month's instalment marked paid
   These functions never save anything; they return the new data.
   ============================================================================ */

import { daysBetween, monthKey, parseIsoDate, startOfToday } from '../../shared/dates';
import { CATEGORIES } from '../budget/budget';
import { RUPEES_PER_USD } from '../transfer-timing/currency';

// ── START: How payments are categorised ────────────────────────────────────
export var REVIEW_BELOW_CONFIDENCE = 0.6;

export var KNOWN_SHOPS: Array<[RegExp, string]> = [
  [/UNITE STUDENTS|HOUSING RENT|RESIDENCE RENT|\bRENT\b/, 'rent'],
  [/TESCO|SAINSBURY|LIDL|ALDI|CO-OP|WAITROSE|TRADER JOE|WHOLEFDS|KROGER|WOOLWORTHS|REWE|LOBLAWS/, 'grocery'],
  [/PRET|DELIVEROO|NANDO|GREGGS|UBER \*EATS|DOORDASH|CHIPOTLE|STARBUCKS|SHAKE SHACK|MCDONALD|\bCAFE\b/, 'eatout'],
  [/TFL|UBER \*TRIP|TRAINLINE|LIME\*|MTA\*|LYFT|TRANSPORT/, 'transport'],
  [/PRIMARK|SUPERDRUG|H&M|ARGOS|UNIQLO/, 'shopping'],
  [/WATERSTONES|BARNES|BOOKSTORE|BOOKSHOP|PRINT|CHEGG/, 'course'],
  [/STUDENTS? UNION|STUDENT ACTIVITIES|FIXR|EVENTBRITE/, 'society'],
  [/BOOTS|CVS|PHARMACY|GYM|PLANET FITNESS|SPECSAVERS/, 'health'],
  [/GIFFGAFF|VIRGIN MEDIA|T-MOBILE|VERIZON|MOBILE PLAN|VODAFONE/, 'mobile']
];

export var MERCHANT_CODES = {
  6513: 'rent', 5411: 'grocery', 5812: 'eatout', 5814: 'eatout', 4111: 'transport', 4112: 'transport', 4121: 'transport',
  5651: 'shopping', 5977: 'shopping', 5311: 'shopping', 5942: 'course', 8220: 'course', 8641: 'society', 7922: 'society',
  5912: 'health', 8043: 'health', 7997: 'health', 4814: 'mobile', 4899: 'mobile'
};

export var BROAD_MERCHANT_CODES = { 5999: 'shopping', 5310: 'shopping', 5499: 'grocery', 5734: 'course', 5813: 'eatout' };

export function merchantKey(description) {
  return String(description || '').toUpperCase()
    .replace(/^(SQ|SUMUP|PAYPAL|AMAZON|UBER|LIME|FIXR|MTA|DOORDASH)\s*\*?\s*/, function (prefix) { return prefix.replace(/\s|\*/g, '') + ' '; })
    .replace(/[#*]/g, ' ')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function readableShopName(description) {
  return String(description || '')
    .replace(/^(SQ|SUMUP|PAYPAL|LIME)\s*\*\s*/i, '')
    .replace(/\s*[#*]\s*/g, ' ')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-z])/g, function (match, before, letter) { return before + letter.toUpperCase(); })
    .replace(/\b(Tfl|Ucl|Mta|Nyct|Cvs|Td|Rbc|Anz|Sbi|Gb|Ltd|Uk|Usa)\b/g, function (word) { return word.toUpperCase(); });
}

export function categorisePayment(description: string, merchantCode: number | null, savedRules?: Record<string, string>) {
  var upper = String(description || '').toUpperCase();
  var key = merchantKey(description);
  if (savedRules && savedRules[key]) return { categoryId: savedRules[key], confidence: 1, reason: 'Your rule' };
  for (var i = 0; i < KNOWN_SHOPS.length; i++) {
    if (KNOWN_SHOPS[i][0].test(upper)) return { categoryId: KNOWN_SHOPS[i][1], confidence: 0.92, reason: 'Known merchant' };
  }
  if (MERCHANT_CODES[merchantCode]) return { categoryId: MERCHANT_CODES[merchantCode], confidence: 0.8, reason: 'Merchant code ' + merchantCode };
  if (BROAD_MERCHANT_CODES[merchantCode]) return { categoryId: BROAD_MERCHANT_CODES[merchantCode], confidence: 0.45, reason: 'Merchant code ' + merchantCode + ' is broad' };
  return { categoryId: 'shopping', confidence: 0.3, reason: 'Unrecognised merchant' };
}
// ── END: How payments are categorised ──────────────────────────────────────


// ── START: Importing a statement ───────────────────────────────────────────
export function importBankStatement(current, connection, lines, options) {
  var ledgers = {};
  Object.keys(current.ledgers || {}).forEach(function (month) { ledgers[month] = current.ledgers[month].slice(); });
  var remittances = (current.remittances || []).slice();
  var loans = (current.loans || []).map(function (loan) { return Object.assign({}, loan, { payments: Object.assign({}, loan.payments || {}) }); });
  var stats = { lines: lines.length, expenses: 0, autoFiled: 0, needReview: 0, linkedToTyped: 0, topUps: 0, remittances: 0, remittancesLinked: 0, tcsMatched: 0, emisMatched: 0, alreadyHad: 0, monthsRebuilt: [] };

  var alreadyImported = {};
  (options.dismissedLines || []).forEach(function (lineId) { alreadyImported[lineId] = true; });
  Object.keys(ledgers).forEach(function (month) { ledgers[month].forEach(function (expense) { if (expense.bankLineId) alreadyImported[expense.bankLineId] = true; }); });
  remittances.forEach(function (remittance) {
    if (remittance.bankLineId) alreadyImported[remittance.bankLineId] = true;
    if (remittance.tcsLineId) alreadyImported[remittance.tcsLineId] = true;
  });
  loans.forEach(function (loan) { Object.keys(loan.payments).forEach(function (month) { alreadyImported[loan.payments[month].bankLineId] = true; }); });

  function findTypedExpense(line) {
    var found = null;
    Object.keys(ledgers).some(function (month) {
      var index = ledgers[month].findIndex(function (expense) {
        return !expense.bankLineId && expense.cur === line.currency && Math.abs(expense.amount - line.amount) < 0.01 &&
          Math.abs(daysBetween(parseIsoDate(expense.date), parseIsoDate(line.date))) <= 2;
      });
      if (index >= 0) found = { month: month, index: index };
      return !!found;
    });
    return found;
  }

  function importCardLine(line) {
    if (line.direction === 'credit') { stats.topUps++; return; }
    var typed = findTypedExpense(line);
    if (typed) {
      var existing = ledgers[typed.month][typed.index];
      ledgers[typed.month][typed.index] = Object.assign({}, existing, {
        bankLineId: line.id, bankId: connection.id, bankName: connection.name, merchant: merchantKey(line.description), merchantCode: line.merchantCode, linked: true
      });
      stats.linkedToTyped++;
      return;
    }
    var result = categorisePayment(line.description, line.merchantCode, options.rules);
    var month = line.date.slice(0, 7);
    (ledgers[month] = ledgers[month] || []).push({
      id: 'b' + line.id.replace(/[^a-z0-9]/gi, ''),
      bankLineId: line.id, bankId: connection.id, bankName: connection.name,
      date: line.date, cat: result.categoryId, amount: line.amount, cur: line.currency, rate: options.rupeeRate,
      note: readableShopName(line.description), merchant: merchantKey(line.description), merchantCode: line.merchantCode,
      confidence: result.confidence, reason: result.reason, needsReview: result.confidence < REVIEW_BELOW_CONFIDENCE
    });
    stats.expenses++;
    if (result.confidence < REVIEW_BELOW_CONFIDENCE) stats.needReview++;
    else stats.autoFiled++;
  }

  function matchTcsLine(line) {
    var reference = String(line.narration).toUpperCase().split('REF ')[1];
    remittances.forEach(function (remittance, index) {
      if (remittance.bankLineId && remittance.bankLineId.toUpperCase() === reference && remittance.tcsFromBank == null) {
        remittances[index] = Object.assign({}, remittance, { tcsFromBank: line.amount, tcsLineId: line.id });
        stats.tcsMatched++;
      }
    });
  }

  function importIndianLine(line) {
    var text = String(line.narration || '').toUpperCase();
    if (line.direction === 'credit') return;
    if (/TCS U\/S 206C/.test(text)) return;
    if (/LRS|SWIFT OUT|OUTWARD/.test(text)) {
      var typedIndex = remittances.findIndex(function (remittance) {
        return !remittance.bankLineId && !remittance.fromBank && Math.abs(remittance.amountInr - line.amount) < 1 &&
          Math.abs(daysBetween(parseIsoDate(remittance.date), parseIsoDate(line.date))) <= 2;
      });
      if (typedIndex >= 0) {
        var typed = remittances[typedIndex];
        remittances[typedIndex] = Object.assign({}, typed, { bankLineId: line.id, bankId: connection.id, bank: typed.bank || connection.name, linked: true });
        stats.remittancesLinked++;
        return;
      }
      remittances.push({
        id: 'b' + line.id.replace(/[^a-z0-9]/gi, ''), bankLineId: line.id, bankId: connection.id, fromBank: true,
        date: line.date, amountInr: line.amount, purpose: /MEDICAL|S0304/.test(text) ? 'medical' : 'education',
        loanFunded: /EDU LOAN/.test(text), usdRate: RUPEES_PER_USD, a2: true, in26as: false, bank: connection.name,
        note: /TUITION/.test(text) ? 'Tuition fees' : /LIVING/.test(text) ? 'Living costs top-up' : 'Outward remittance'
      });
      stats.remittances++;
      return;
    }
    if (/EMI/.test(text)) {
      var loan = loans.filter(function (item) { return text.indexOf('/' + item.id) >= 0 || text.indexOf(item.name.toUpperCase()) >= 0; })[0];
      if (loan) {
        loan.payments[line.date.slice(0, 7)] = { amount: line.amount, date: line.date, bankLineId: line.id, bankName: connection.name };
        stats.emisMatched++;
      }
    }
  }

  lines.forEach(function (line) {
    if (alreadyImported[line.id]) { stats.alreadyHad++; return; }
    alreadyImported[line.id] = true;
    if (connection.region === 'abroad') importCardLine(line);
    else importIndianLine(line);
  });
  if (connection.region === 'india') {
    lines.filter(function (line) { return /TCS U\/S 206C/.test(String(line.narration).toUpperCase()); }).forEach(matchTcsLine);
  }

  var history = { months: ((current.history || {}).months || []).slice() };
  if (connection.region === 'abroad' && options.historyFrom) {
    var thisMonth = monthKey(startOfToday());
    Object.keys(ledgers).forEach(function (month) {
      if (month >= thisMonth || options.historyFrom > month + '-01') return;
      var totals = {};
      CATEGORIES.forEach(function (category) { totals[category.id] = 0; });
      ledgers[month].forEach(function (expense) { if (expense.cur === options.currencyCode) totals[expense.cat] += expense.amount; });
      Object.keys(totals).forEach(function (categoryId) { totals[categoryId] = Math.round(totals[categoryId]); });
      history.months = history.months.filter(function (entry) { return entry.month !== month; })
        .concat([{ month: month, totals: totals, fromBank: true }])
        .sort(function (a, b) { return a.month < b.month ? -1 : 1; })
        .slice(-12);
      stats.monthsRebuilt.push(month);
    });
  }

  return { data: { ledgers: ledgers, remittances: remittances, loans: loans, history: history }, stats: stats };
}
// ── END: Importing a statement ─────────────────────────────────────────────


// ── START: Correcting a category ───────────────────────────────────────────
export function changeExpenseCategory(ledgers, expenseId, categoryId, merchant, applyToMerchant) {
  var updated = {};
  Object.keys(ledgers).forEach(function (month) {
    updated[month] = ledgers[month].map(function (expense) {
      var isTarget = expense.id === expenseId || (applyToMerchant && merchant && expense.merchant === merchant);
      if (!isTarget) return expense;
      return Object.assign({}, expense, { cat: categoryId, confidence: 1, reason: applyToMerchant ? 'Your rule' : 'Set by you', needsReview: false });
    });
  });
  return updated;
}
// ── END: Correcting a category ─────────────────────────────────────────────
