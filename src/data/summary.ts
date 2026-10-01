/* ============================================================================
   Sentry · Summary of everything (runs all the engines once)
   Every time data changes, buildSummary() runs each module's engine and
   returns one object the screens read from. Screens never call engines.
   ============================================================================ */

import { addDays, daysBetween, daysInMonth, formatDayMonth, formatFullDate, formatMonthYear, formatRupees, monthKey, parseIsoDate, startOfToday, toIsoDate } from '../shared/dates';
import { standardDeviation, sumOf } from '../shared/maths';
import { createMoneyFormatter } from './money';
import { amountInCurrency, CATEGORIES } from '../modules/budget/budget';
import { financialYearOf, runComplianceCheck } from '../modules/compliance/compliance';
import { computeRiskScore } from '../modules/dashboard/risk';
import { forecastCategory } from '../modules/forecast/forecast';
import { loanStatus } from '../modules/loans/loans';
import { adviseTransferTiming } from '../modules/transfer-timing/advisor';
import { buildRateHistory, RATES_AS_OF, rupeesPerUnit } from '../modules/transfer-timing/currency';

// ── START: Build the summary ───────────────────────────────────────────────
export function buildSummary(data) {
  var profile = data.profile;
  var today = startOfToday();
  var money = createMoneyFormatter(profile, data.liveRate);
  var currencyCode = money.code;
  var rates = Object.assign({}, profile.rateOverrides || {});
  rates[currencyCode] = money.rate;
  var dayOfMonth = today.getDate();
  var monthLength = daysInMonth(today.getFullYear(), today.getMonth());
  var thisMonth = monthKey(today);

  var spending = summariseSpending(data, profile, money, rates, dayOfMonth, monthLength, thisMonth);
  var compliance = summariseCompliance(data, profile, today);
  var loans = summariseLoans(data, today);
  var timing = summariseTiming(data, profile, money, compliance, today);

  var risk = computeRiskScore({
    totalBudget: spending.totalBudget,
    projectedTotal: spending.totalProjected,
    weightedOverspendRisk: sumOf(spending.categories.map(function (category) { return category.budget * category.forecast.breachProbability; })),
    compliancePoints: sumOf(compliance.complianceFlags.map(function (flag) { return flag.points; })),
    nextEmiInr: loans.dueWithin30Days,
    budgetInr: spending.totalBudget * money.rate,
    emiStepUpSoon: loans.stepUpSoon,
    fxVolatility: timing.volatility
  });

  var summary = Object.assign({
    data: data,
    profile: profile,
    money: money,
    today: today,
    dayOfMonth: dayOfMonth,
    daysInThisMonth: monthLength,
    daysLeft: monthLength - dayOfMonth,
    risk: risk,
    banks: profile.banks || []
  }, spending, compliance, loans, timing);

  summary.notifications = buildNotifications(summary);
  summary.unreadCount = summary.notifications.filter(function (item) { return !(profile.readNotifications || {})[item.id]; }).length;
  return summary;
}
// ── END: Build the summary ─────────────────────────────────────────────────


// ── START: Spending and forecast (Adeeth + Sidharth) ───────────────────────
export function paymentsToReview(ledgers) {
  var waiting = [];
  Object.keys(ledgers || {}).forEach(function (month) {
    ledgers[month].forEach(function (expense) { if (expense.needsReview) waiting.push(expense); });
  });
  return waiting.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
}

export function summariseSpending(data, profile, money, rates, dayOfMonth, monthLength, thisMonth) {
  var expenses = (data.ledgers[thisMonth] || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

  var dailySpend = {};
  CATEGORIES.forEach(function (category) { dailySpend[category.id] = new Array(monthLength).fill(0); });
  expenses.forEach(function (expense) {
    if (dailySpend[expense.cat]) dailySpend[expense.cat][parseIsoDate(expense.date).getDate() - 1] += amountInCurrency(expense, money.code, rates);
  });

  var pastMonths = {};
  CATEGORIES.forEach(function (category) { pastMonths[category.id] = []; });
  var historyScale = rupeesPerUnit(profile.budgetCurrency || money.code, rates) / money.rate;
  var storedMonths = (data.history.months || []).map(function (entry) { return entry.month || entry.ym; });
  (data.history.months || []).forEach(function (entry) {
    CATEGORIES.forEach(function (category) { pastMonths[category.id].push((entry.totals[category.id] || 0) * historyScale); });
  });
  Object.keys(data.ledgers).sort().forEach(function (month) {
    if (month >= thisMonth || storedMonths.indexOf(month) >= 0) return;
    var totals = {};
    data.ledgers[month].forEach(function (expense) { totals[expense.cat] = (totals[expense.cat] || 0) + amountInCurrency(expense, money.code, rates); });
    CATEGORIES.forEach(function (category) { pastMonths[category.id].push(totals[category.id] || 0); });
  });

  var threshold = (profile.alertThreshold || 85) / 100;
  var categories = CATEGORIES.map(function (category, index) {
    var budget = (profile.budgets || {})[category.id] || 0;
    var forecast = forecastCategory({
      dayOfMonth: dayOfMonth, daysInMonth: monthLength, dailySpend: dailySpend[category.id],
      budget: budget, history: pastMonths[category.id].slice(-6), paidOnceAMonth: category.paidOnceAMonth
    });
    return Object.assign({}, category, {
      index: index,
      budget: budget,
      forecast: forecast,
      spent: forecast.spent,
      usedPercent: budget ? forecast.spent / budget * 100 : 0,
      breachChance: Math.round(forecast.breachProbability * 100),
      onAlert: budget > 0 && forecast.projected >= budget * threshold && forecast.breachProbability >= 0.35
    });
  });

  var totalBudget = sumOf(categories.map(function (category) { return category.budget; }));
  var totalSpent = sumOf(categories.map(function (category) { return category.spent; }));
  return {
    expenses: expenses,
    toReview: paymentsToReview(data.ledgers),
    needsReviewCount: paymentsToReview(data.ledgers).length,
    categories: categories,
    totalBudget: totalBudget,
    totalSpent: totalSpent,
    totalProjected: sumOf(categories.map(function (category) { return category.forecast.projected; })),
    budgetLeft: Math.max(0, totalBudget - totalSpent),
    usedPercent: totalBudget ? totalSpent / totalBudget * 100 : 0,
    overspendAlerts: categories.filter(function (category) { return category.onAlert; })
      .sort(function (a, b) { return b.forecast.breachProbability - a.forecast.breachProbability; })
  };
}
// ── END: Spending and forecast (Adeeth + Sidharth) ─────────────────────────


// ── START: LRS / TCS compliance (Alen) ─────────────────────────────────────
export function summariseCompliance(data, profile, today) {
  var financialYear = financialYearOf(today);
  var hasLoanLetter = !!profile.loanLetter;
  var fundedByLoan = profile.funding === 'Education loan';
  var check = runComplianceCheck(data.remittances, financialYear, { loanLetter: hasLoanLetter });

  var flags = [];
  if (fundedByLoan && !hasLoanLetter) flags.push({ id: 'letter', points: check.avoidableTcs > 0 ? 8 : 4, text: 'Loan letter missing' });
  if (check.seenIn26asCount < check.tcsCount) flags.push({ id: '26as', points: 3, text: 'Form 26AS pending' });
  if (check.totalTcs > 0) flags.push({ id: 'itr', points: 2, text: 'TCS to claim in ITR' });
  if (check.lrsUsedPercent >= 80) flags.push({ id: 'lrs', points: check.lrsUsedPercent >= 100 ? 12 : 8, text: 'LRS limit ' + Math.round(check.lrsUsedPercent) + '% used' });
  if (!profile.panLinked) flags.push({ id: 'pan', points: 5, text: 'PAN–Aadhaar link unconfirmed' });

  return { financialYear: financialYear, compliance: check, complianceFlags: flags, hasLoanLetter: hasLoanLetter, fundedByLoan: fundedByLoan };
}
// ── END: LRS / TCS compliance (Alen) ───────────────────────────────────────


// ── START: Education loans (Adeeth) ────────────────────────────────────────
export function summariseLoans(data, today) {
  var loans = data.loans.map(function (loan) { return Object.assign({}, loan, { status: loanStatus(loan, today) }); });
  var upcoming = [];
  loans.forEach(function (loan) {
    loan.status.upcoming.slice(0, 3).forEach(function (row) { upcoming.push(Object.assign({ loan: loan }, row)); });
  });
  upcoming.sort(function (a, b) { return a.date - b.date; });
  var in30Days = addDays(today, 30);
  return {
    loans: loans,
    upcomingPayments: upcoming,
    nextPayment: upcoming[0] || null,
    dueWithin30Days: sumOf(upcoming.filter(function (row) { return row.date <= in30Days; }).map(function (row) { return row.pay; })),
    stepUpSoon: loans.some(function (loan) {
      return loan.status.inMoratorium && loan.status.schedule.moratoriumEnd && daysBetween(today, loan.status.schedule.moratoriumEnd) <= 183;
    })
  };
}
// ── END: Education loans (Adeeth) ──────────────────────────────────────────


// ── START: Exchange rate and transfer timing (Alen) ────────────────────────
export function summariseTiming(data, profile, money, compliance, today) {
  var live = data.liveRate;
  var hasLiveHistory = !!(live && live.code === money.code && live.series && live.series.length >= 10);
  var rateHistory = hasLiveHistory ? live.series.slice(-31) : buildRateHistory(money.code, money.rate);
  var dailyMoves = [];
  for (var i = 1; i < rateHistory.length; i++) dailyMoves.push(Math.log(rateHistory[i] / rateHistory[i - 1]));
  var transferAmount = profile.transferAmount || money.country.usualTransfer;
  var timing = adviseTransferTiming({
    rateHistory: rateHistory, amountLocal: transferAmount, fee: money.country.transferFee, today: today,
    check: compliance.compliance, currencyCode: money.code, purpose: 'education',
    loanFunded: compliance.fundedByLoan, hasLoanLetter: compliance.hasLoanLetter
  });
  return {
    rateHistory: rateHistory,
    liveRates: hasLiveHistory,
    ratesAsOf: hasLiveHistory ? live.asOf : RATES_AS_OF,
    volatility: standardDeviation(dailyMoves) * Math.sqrt(252),
    transferAmount: transferAmount,
    timing: timing
  };
}
// ── END: Exchange rate and transfer timing (Alen) ──────────────────────────


// ── START: Notifications ───────────────────────────────────────────────────
export function buildNotifications(summary) {
  var profile = summary.profile;
  var money = summary.money;
  var alerts = profile.alerts || {};
  var check = summary.compliance;
  var list = [];

  if (summary.needsReviewCount) {
    list.push({
      id: 'review-' + monthKey(summary.today) + '-' + summary.needsReviewCount, tone: 'purple', screen: 'budget', action: 'Review now',
      title: summary.needsReviewCount + (summary.needsReviewCount === 1 ? ' bank payment needs' : ' bank payments need') + ' a category',
      body: 'Sentry wasn’t sure how to file these. Pick a category once and it remembers the merchant.'
    });
  }

  summary.banks.forEach(function (bank) {
    var daysOld = bank.lastSync ? daysBetween(parseIsoDate(bank.lastSync.slice(0, 10)), summary.today) : 99;
    if (daysOld < 2) return;
    list.push({
      id: 'stale-' + bank.id + '-' + toIsoDate(summary.today), tone: 'purple', screen: 'account', action: 'Sync now',
      title: bank.name + ' last synced ' + (daysOld >= 99 ? 'never' : daysOld + ' days ago'),
      body: 'New ' + (bank.region === 'india' ? 'remittances, TCS and EMI debits' : 'card payments') + ' may be waiting.'
    });
  });

  if (alerts.overspend) {
    summary.overspendAlerts.slice(0, 3).forEach(function (category) {
      var forecast = category.forecast;
      list.push({
        id: 'over-' + category.id + '-' + monthKey(summary.today), tone: 'red', screen: 'forecast', categoryIndex: category.index, action: 'Open forecast',
        title: category.name + ' heading over budget',
        body: forecast.alreadyOver
          ? money.exact(forecast.spent - category.budget) + ' past a ' + money.whole(category.budget) + ' budget with ' + summary.daysLeft + ' days left.'
          : 'Forecast ' + money.exact(forecast.projected) + ' against ' + money.whole(category.budget) + ' — ' + category.breachChance + '% chance of a breach' + (forecast.breachDay ? ' around day ' + forecast.breachDay : '') + '.'
      });
    });
  }

  var next = summary.nextPayment;
  if (alerts.emi && next && daysBetween(summary.today, next.date) <= 7) {
    list.push({
      id: 'emi-' + toIsoDate(next.date), tone: 'purple', screen: 'emi', action: 'Open EMI schedule',
      title: next.loan.name + ' EMI due ' + formatDayMonth(next.date),
      body: formatRupees(next.pay) + ' (' + money.fromRupees(next.pay) + ')' + (next.phase === 'moratorium' ? ' · interest only during the moratorium.' : '.')
    });
  }

  if (alerts.emi && summary.stepUpSoon) {
    summary.loans.filter(function (loan) { return loan.status.inMoratorium; }).forEach(function (loan) {
      list.push({
        id: 'step-' + loan.id, tone: 'purple', screen: 'emi', action: 'Open EMI schedule',
        title: 'Moratorium on ' + loan.name + ' ends ' + formatMonthYear(loan.status.schedule.moratoriumEnd),
        body: 'Full EMI of ' + formatRupees(loan.status.schedule.emi) + ' starts ' + formatFullDate(loan.status.schedule.repaymentStart) + '.'
      });
    });
  }

  if (summary.fundedByLoan && !summary.hasLoanLetter) {
    list.push({
      id: 'letter', tone: 'red', screen: 'comply', action: 'Open compliance', title: 'Loan sanction letter missing',
      body: check.avoidableTcs > 0
        ? 'Without it, ' + formatRupees(check.avoidableTcs) + ' of TCS was collected this FY that a loan-funded remittance avoids.'
        : 'Upload it so loan-funded education remittances go at 0% TCS.'
    });
  }

  var missingIn26as = check.tcsCount - check.seenIn26asCount;
  if (alerts.deadlines && missingIn26as > 0) {
    list.push({
      id: '26as-' + check.seenIn26asCount, tone: 'purple', screen: 'comply', action: 'Open compliance',
      title: missingIn26as + ' TCS ' + (missingIn26as === 1 ? 'entry' : 'entries') + ' missing in Form 26AS',
      body: check.seenIn26asCount + ' of ' + check.tcsCount + ' deductions have appeared. Chase the bank before filing.'
    });
  }

  if (alerts.deadlines && check.totalTcs > 0) {
    list.push({
      id: 'itr-' + summary.financialYear, tone: 'purple', screen: 'comply', action: 'Open compliance',
      title: 'Claim ' + formatRupees(check.totalTcs) + ' TCS in your ITR',
      body: check.assessmentYear + ' return · due ' + check.itrDueDate + '. TCS is a credit against tax, not an extra cost.'
    });
  }

  if (alerts.fx && !profile.scheduledTransfer && summary.timing.percentVsAverage <= -0.3) {
    list.push({
      id: 'fx-' + toIsoDate(summary.today), tone: 'green', screen: 'remit', action: 'Open timing advisor',
      title: 'Rupee stronger than its 30-day average',
      body: 'Sending ' + money.whole(summary.transferAmount) + ' now costs ' + formatRupees(summary.timing.windows[0].rupees) + '.'
    });
  }

  return list;
}
// ── END: Notifications ─────────────────────────────────────────────────────
