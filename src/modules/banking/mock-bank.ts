/* ============================================================================
   Sentry · Mock bank aggregator                                 (owner: Alen)
   Pretends to be the two real systems a student would link:
     • a bank abroad, through open banking (UK Open Banking, EU PSD2, US/AU/CA
       equivalents) — card payments with the shop name and merchant code;
     • a bank in India, through RBI's Account Aggregator — statement lines for
       remittances, TCS deductions and loan EMIs.
   Nothing here contacts a real bank. The same day always produces the same
   lines, so syncing twice never creates duplicates.
   ============================================================================ */

import { addDays, addMonths, daysInMonth, parseIsoDate, toIsoDate } from '../../shared/dates';
import { seededRandom, sumOf } from '../../shared/maths';
import { BROAD_MERCHANT_CODES } from './importer';
import { financialYearOf, runComplianceCheck } from '../compliance/compliance';
import type { Bank, BankBalance, BankConnection, BankLine, StudentFeed } from '../../shared/types';

// ── START: Banks you can connect ───────────────────────────────────────────
export var BANK_PROTOCOLS = {
  UK: 'UK Open Banking · FCA-regulated AIS',
  US: 'Aggregator API · read-only',
  CA: 'Open banking · read-only',
  AU: 'Consumer Data Right',
  DE: 'PSD2 account information',
  IN: 'RBI Account Aggregator'
};

export var BANKS: Bank[] = [
  { id: 'monzo', name: 'Monzo', logo: 'M', color: '#FF4F40', country: 'UK' },
  { id: 'barclays', name: 'Barclays', logo: 'B', color: '#00AEEF', country: 'UK' },
  { id: 'hsbc-uk', name: 'HSBC UK', logo: 'H', color: '#DB0011', country: 'UK' },
  { id: 'revolut', name: 'Revolut', logo: 'R', color: '#191C1F', country: 'UK' },
  { id: 'chase', name: 'Chase', logo: 'C', color: '#117ACA', country: 'US' },
  { id: 'bofa', name: 'Bank of America', short: 'BofA', logo: 'BA', color: '#E31837', country: 'US' },
  { id: 'wells', name: 'Wells Fargo', logo: 'W', color: '#D71E28', country: 'US' },
  { id: 'rbc', name: 'RBC Royal Bank', short: 'RBC', logo: 'R', color: '#005DAA', country: 'CA' },
  { id: 'td', name: 'TD Canada Trust', short: 'TD Bank', logo: 'TD', color: '#34A853', country: 'CA' },
  { id: 'commbank', name: 'CommBank', logo: 'C', color: '#1A1A1A', country: 'AU' },
  { id: 'anz', name: 'ANZ', logo: 'A', color: '#007DBA', country: 'AU' },
  { id: 'n26', name: 'N26', logo: 'N', color: '#36A18B', country: 'DE' },
  { id: 'sparkasse', name: 'Sparkasse', logo: 'S', color: '#E30613', country: 'DE' },
  { id: 'hdfc', name: 'HDFC Bank', short: 'HDFC', logo: 'H', color: '#004C8F', country: 'IN' },
  { id: 'sbi', name: 'State Bank of India', short: 'SBI', logo: 'SBI', color: '#22409A', country: 'IN' },
  { id: 'icici', name: 'ICICI Bank', short: 'ICICI', logo: 'I', color: '#B02A30', country: 'IN' },
  { id: 'axis', name: 'Axis Bank', short: 'Axis', logo: 'A', color: '#97144D', country: 'IN' }
];

export function findBank(bankId: string): Bank | undefined {
  return BANKS.filter(function (bank) { return bank.id === bankId; })[0];
}

export function shortBankName(connection: BankConnection): string {
  var bank: Partial<Bank> = findBank(connection.bankId) || {};
  return bank.short || connection.name;
}

export function banksFor(currencyCode) {
  var countryOfStudy = { GBP: 'UK', USD: 'US', CAD: 'CA', AUD: 'AU', EUR: 'DE' }[currencyCode] || 'UK';
  function describe(bank) {
    return Object.assign({}, bank, { region: bank.country === 'IN' ? 'india' : 'abroad', protocol: BANK_PROTOCOLS[bank.country] });
  }
  return {
    abroad: BANKS.filter(function (bank) { return bank.country === countryOfStudy; }).map(describe),
    india: BANKS.filter(function (bank) { return bank.country === 'IN'; }).map(describe)
  };
}
// ── END: Banks you can connect ─────────────────────────────────────────────


// ── START: Granting consent (creates a connection) ─────────────────────────
export function createBankConnection(bankId: string, currencyCode: string, uniqueSuffix?: string): BankConnection {
  var bank = findBank(bankId);
  if (!bank) throw new Error('Unknown bank');
  var isIndian = bank.country === 'IN';
  var connectionId = bank.id + '-' + String(uniqueSuffix || Date.now().toString(36)).slice(-6);
  var accountDigits = String(1000 + Math.floor(seededRandom('account' + connectionId)() * 9000));
  return {
    id: connectionId,
    bankId: bank.id,
    name: bank.name,
    logo: bank.logo,
    color: bank.color,
    region: isIndian ? 'india' : 'abroad',
    protocol: BANK_PROTOCOLS[bank.country],
    account: (isIndian ? 'Savings' : 'Current') + ' ••' + accountDigits,
    currency: isIndian ? 'INR' : currencyCode,
    consentId: 'cns_' + seededRandom(connectionId + 'consent')().toString(36).slice(2, 12),
    connectedAt: new Date().toISOString(),
    consentExpires: toIsoDate(addMonths(new Date(), 12)),
    lastSync: null
  };
}
// ── END: Granting consent (creates a connection) ───────────────────────────


// ── START: Shops that appear on card statements ────────────────────────────
export var SHOPS_UK = {
  rent: [['UNITE STUDENTS LTD', 6513]],
  grocery: [['TESCO STORES 3291', 5411], ['SAINSBURYS S/MKTS', 5411], ['LIDL GB LONDON', 5411], ['ALDI 84 LONDON', 5411], ['CO-OP GROUP FOOD', 5411], ['SQ *CAMPUS KIOSK', 5499]],
  eatout: [['PRET A MANGER', 5814], ['DELIVEROO', 5812], ['NANDOS EUSTON', 5812], ['GREGGS', 5814], ['UBER *EATS', 5812], ['SUMUP *THE CROWN', 5813]],
  transport: [['TFL TRAVEL CH', 4111], ['UBER *TRIP', 4121], ['TRAINLINE.COM', 4112], ['LIME*RIDE', 4121]],
  shopping: [['PRIMARK LONDON', 5651], ['SUPERDRUG', 5977], ['H&M', 5651], ['AMAZON* MKTPLACE', 5999], ['ARGOS LTD', 5311], ['PAYPAL *EBAY', 5999]],
  course: [['WATERSTONES', 5942], ['UCL PRINT SERVICES', 8220], ['OVERLEAF.COM', 5734]],
  society: [['STUDENTS UNION UCL', 8641], ['FIXR *EVENT', 7922], ['EVENTBRITE', 7922]],
  health: [['BOOTS PHARMACY', 5912], ['PUREGYM LTD', 7997], ['SPECSAVERS', 8043]],
  mobile: [['GIFFGAFF', 4814], ['VIRGIN MEDIA', 4899]]
};

export var SHOPS_US = {
  rent: [['CAMPUS HOUSING RENT', 6513]],
  grocery: [['TRADER JOE S #552', 5411], ['WHOLEFDS MKT', 5411], ['KROGER #7781', 5411], ['WALMART SUPERCENTER', 5310], ['SQ *CAMPUS MARKET', 5499]],
  eatout: [['CHIPOTLE 1123', 5814], ['STARBUCKS STORE', 5814], ['DOORDASH*ORDER', 5812], ['SHAKE SHACK', 5812], ['SQ *FOOD TRUCK', 5812]],
  transport: [['MTA*NYCT PAYGO', 4111], ['UBER *TRIP', 4121], ['LYFT *RIDE', 4121]],
  shopping: [['TARGET 00023', 5310], ['AMAZON.COM*MKTPLC', 5999], ['UNIQLO USA', 5651], ['PAYPAL *ETSY', 5999]],
  course: [['BARNES & NOBLE', 5942], ['CAMPUS BOOKSTORE', 5942], ['CHEGG INC', 5734]],
  society: [['STUDENT ACTIVITIES FEE', 8641], ['EVENTBRITE', 7922]],
  health: [['CVS/PHARMACY', 5912], ['PLANET FITNESS', 7997]],
  mobile: [['T-MOBILE', 4814], ['VERIZON WIRELESS', 4814]]
};

export var SHOPS_ELSEWHERE = {
  rent: [['STUDENT RESIDENCE RENT', 6513]],
  grocery: [['ALDI', 5411], ['LIDL', 5411], ['WOOLWORTHS', 5411], ['REWE MARKT', 5411], ['SQ *CAMPUS STORE', 5499]],
  eatout: [['STARBUCKS', 5814], ['UBER *EATS', 5812], ['MCDONALDS', 5814], ['SUMUP *CAFE', 5814]],
  transport: [['PUBLIC TRANSPORT CARD', 4111], ['UBER *TRIP', 4121]],
  shopping: [['H&M', 5651], ['AMAZON MKTPLACE', 5999], ['PAYPAL *SHOP', 5999]],
  course: [['UNIVERSITY BOOKSHOP', 5942], ['UNI PRINTING', 8220]],
  society: [['STUDENT UNION', 8641], ['EVENTBRITE', 7922]],
  health: [['PHARMACY', 5912], ['CITY GYM', 7997]],
  mobile: [['MOBILE PLAN', 4814]]
};

export function shopsFor(currencyCode) {
  if (currencyCode === 'GBP') return SHOPS_UK;
  if (currencyCode === 'USD') return SHOPS_US;
  return SHOPS_ELSEWHERE;
}
// ── END: Shops that appear on card statements ──────────────────────────────


// ── START: Card statement for a bank abroad ────────────────────────────────
export var SPENDING_PATTERN = {
  grocery: { pace: 1.1, paymentsPerMonth: 14 },
  eatout: { pace: 1.0, paymentsPerMonth: 8 },
  transport: { pace: 0.85, paymentsPerMonth: 6 },
  shopping: { pace: 1.04, paymentsPerMonth: 5 },
  course: { pace: 0.7, paymentsPerMonth: 2 },
  society: { pace: 0.9, paymentsPerMonth: 3 }
};

export function everyDayBetween(fromIso, toIso) {
  var days = [];
  var day = parseIsoDate(fromIso);
  var last = parseIsoDate(toIso);
  while (day <= last) {
    days.push(new Date(day));
    day = addDays(day, 1);
  }
  return days;
}

export function cardStatement(connection: BankConnection, fromIso: string, toIso: string, student: StudentFeed): BankLine[] {
  var shops = shopsFor(student.currencyCode);
  var share = student.share == null ? 1 : student.share;
  var isMainCard = share >= 1;
  var budgets: Record<string, number> = {};
  Object.keys(student.budgets || {}).forEach(function (categoryId) { budgets[categoryId] = student.budgets[categoryId] * share; });
  var lines = [];

  everyDayBetween(fromIso, toIso).forEach(function (date) {
    var isoDate = toIsoDate(date);
    var dayOfMonth = date.getDate();
    var monthLength = daysInMonth(date.getFullYear(), date.getMonth());

    function addPayment(categoryId, amount, lineKey, shopPick) {
      var choices = shops[categoryId];
      var shop = choices[Math.floor(shopPick * choices.length) % choices.length];
      var isVagueShop = BROAD_MERCHANT_CODES[shop[1]];
      if (isVagueShop && seededRandom(lineKey + isoDate + 'vague')() > 0.4) {
        shop = choices.filter(function (choice) { return !BROAD_MERCHANT_CODES[choice[1]]; })[0];
      }
      lines.push({
        id: connection.id + ':' + isoDate + ':' + lineKey, date: isoDate, direction: 'debit',
        amount: Math.round(amount * 100) / 100, currency: student.currencyCode, description: shop[0], merchantCode: shop[1]
      });
    }

    var random = seededRandom(connection.id + isoDate);
    if (isMainCard && dayOfMonth === 1 && budgets.rent) addPayment('rent', budgets.rent * 0.95, 'rent', 0);
    if (isMainCard && dayOfMonth === 5 && budgets.health) addPayment('health', budgets.health * 0.4, 'health', random());
    if (isMainCard && dayOfMonth === 18 && budgets.health) addPayment('health', budgets.health * 0.25, 'health2', random());
    if (isMainCard && dayOfMonth === 9 && budgets.mobile) addPayment('mobile', budgets.mobile * 0.55, 'mobile', random());

    Object.keys(SPENDING_PATTERN).forEach(function (categoryId) {
      if (!budgets[categoryId]) return;
      var pattern = SPENDING_PATTERN[categoryId];
      var count = isMainCard ? pattern.paymentsPerMonth : Math.max(1, Math.round(pattern.paymentsPerMonth * share * 2));
      var offset = seededRandom(connection.id + isoDate.slice(0, 7) + categoryId)();
      for (var n = 0; n < count; n++) {
        if (Math.floor((n + offset) * monthLength / count) + 1 !== dayOfMonth) continue;
        var paymentRandom = seededRandom(connection.id + isoDate + categoryId + n);
        addPayment(categoryId, budgets[categoryId] * pattern.pace / count * (0.75 + paymentRandom() * 0.5), categoryId + n, paymentRandom());
      }
    });

    if (isMainCard && dayOfMonth === 3 && student.usualTransfer) {
      lines.push({
        id: connection.id + ':' + isoDate + ':topup', date: isoDate, direction: 'credit', amount: student.usualTransfer,
        currency: student.currencyCode, description: 'WISE *' + String(student.name || 'SELF').toUpperCase(), merchantCode: null
      });
    }
  });
  return lines;
}
// ── END: Card statement for a bank abroad ──────────────────────────────────


// ── START: Account Aggregator statement for a bank in India ────────────────
export function indianStatement(connection: BankConnection, fromIso: string, toIso: string, student: StudentFeed): BankLine[] {
  var lines = [];
  var fundedByLoan = student.funding === 'Education loan';
  var university = String(student.university || 'UNIVERSITY').toUpperCase();

  everyDayBetween(fromIso, toIso).forEach(function (date) {
    var isoDate = toIsoDate(date);
    var dayOfMonth = date.getDate();
    var month = date.getMonth();
    if (dayOfMonth === 1) {
      lines.push({ id: connection.id + ':' + isoDate + ':in', date: isoDate, direction: 'credit', currency: 'INR', amount: 250000, narration: 'NEFT CR/PARENT TRANSFER' });
    }
    if (dayOfMonth === 2 && student.usualTransfer) {
      lines.push({ id: connection.id + ':' + isoDate + ':wise', date: isoDate, direction: 'debit', currency: 'INR',
        amount: Math.round(student.usualTransfer * student.rupeeRate), narration: 'LRS OUTWARD/WISE/S0305 LIVING COSTS/SELF ' + student.currencyCode });
    }
    if (dayOfMonth === 10 && (month === 8 || month === 0)) {
      lines.push({ id: connection.id + ':' + isoDate + ':feesin', date: isoDate, direction: 'credit', currency: 'INR',
        amount: student.tuition || 640000, narration: fundedByLoan ? 'NEFT CR/EDU LOAN DISBURSAL' : 'NEFT CR/PARENT TRANSFER FEES' });
      lines.push({ id: connection.id + ':' + isoDate + ':fees', date: isoDate, direction: 'debit', currency: 'INR',
        amount: student.tuition || 640000, narration: 'SWIFT OUT/LRS S0305/TUITION FEES/' + university + (fundedByLoan ? '/EDU LOAN DISB' : '') });
    }
  });

  var remittancesByYear = {};
  lines.filter(function (line) { return line.direction === 'debit'; }).forEach(function (line) {
    var year = financialYearOf(parseIsoDate(line.date));
    (remittancesByYear[year] = remittancesByYear[year] || []).push({
      id: line.id, date: line.date, amountInr: line.amount, purpose: 'education', loanFunded: /EDU LOAN/.test(line.narration)
    });
  });
  Object.keys(remittancesByYear).forEach(function (year) {
    runComplianceCheck(remittancesByYear[year], year, { loanLetter: false }).items.forEach(function (item) {
      if (item.tcs > 0) {
        lines.push({ id: item.id + ':tcs', date: item.date, direction: 'debit', currency: 'INR', amount: item.tcs, narration: 'TCS U/S 206C(1G) REF ' + item.id });
      }
    });
  });

  (student.loans || []).forEach(function (loan) {
    (loan.payments || []).forEach(function (payment) {
      if (payment.date >= fromIso && payment.date <= toIso && payment.amount > 0) {
        lines.push({ id: connection.id + ':' + payment.date + ':emi:' + loan.id, date: payment.date, direction: 'debit', currency: 'INR',
          amount: Math.round(payment.amount), narration: 'NACH DR/' + loan.name.toUpperCase() + ' EMI/' + loan.id });
      }
    });
  });

  return lines.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}
// ── END: Account Aggregator statement for a bank in India ──────────────────


// ── START: One entry point for both kinds of bank ──────────────────────────
export function fetchBankStatement(connection: BankConnection, fromIso: string, toIso: string, student: StudentFeed): BankLine[] {
  if (connection.region === 'india') return indianStatement(connection, fromIso, toIso, student);
  return cardStatement(connection, fromIso, toIso, student);
}
// ── END: One entry point for both kinds of bank ────────────────────────────


// ── START: Account balance (AIS /balances, AA "Summary" block) ────────────
export var BALANCE_TREND_DAYS = 30;

export function openingBalance(connection, anchorIso, student) {
  var random = seededRandom(connection.id + anchorIso + 'opening')();
  if (connection.region === 'india') return Math.round(150000 + random * 90000);
  var usualTransfer = student.usualTransfer || 1000;
  var isExtraCard = student.share != null && student.share < 1;
  return Math.round((isExtraCard ? 0.12 + random * 0.1 : 0.45 + random * 0.2) * usualTransfer * 100) / 100;
}

export function fetchBankBalance(connection: BankConnection, asOfIso: string, student: StudentFeed): BankBalance {
  var asOf = parseIsoDate(asOfIso);
  var anchorIso = toIsoDate(new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1));
  var lines = fetchBankStatement(connection, anchorIso, asOfIso, student);
  var movementByDay = {};
  lines.forEach(function (line) {
    movementByDay[line.date] = (movementByDay[line.date] || 0) + (line.direction === 'credit' ? line.amount : -line.amount);
  });

  var running = openingBalance(connection, anchorIso, student);
  var trend = [];
  everyDayBetween(anchorIso, asOfIso).forEach(function (date) {
    var isoDate = toIsoDate(date);
    running += movementByDay[isoDate] || 0;
    trend.push({ date: isoDate, amount: Math.round(running * 100) / 100 });
  });

  var current = trend.length ? trend[trend.length - 1].amount : running;
  var monthStart = asOfIso.slice(0, 8) + '01';
  var thisMonth = lines.filter(function (line) { return line.date >= monthStart; });
  var pending = connection.region === 'abroad' ? Math.round(seededRandom(connection.id + asOfIso + 'pending')() * 18 * 100) / 100 : 0;
  return {
    current: current,
    available: Math.round((current - pending) * 100) / 100,
    pending: pending,
    currency: connection.currency,
    asOf: asOfIso,
    moneyInThisMonth: sumOf(thisMonth.filter(function (line) { return line.direction === 'credit'; }).map(function (line) { return line.amount; })),
    moneyOutThisMonth: sumOf(thisMonth.filter(function (line) { return line.direction === 'debit'; }).map(function (line) { return line.amount; })),
    trend: trend.slice(-BALANCE_TREND_DAYS)
  };
}
// ── END: Account balance (AIS /balances, AA "Summary" block) ──────────────
