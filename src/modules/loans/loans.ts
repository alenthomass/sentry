/* ============================================================================
   Sentry · Education loan EMI scheduler                       (owner: Adeeth)
   Builds the month-by-month schedule, including the moratorium, and says
   where a loan stands today.
   ============================================================================ */

import { addMonths, parseIsoDate } from '../../shared/dates';
import { clamp, sumOf } from '../../shared/maths';

// ── START: EMI formula ─────────────────────────────────────────────────────
export function emiAmount(principal, annualRatePercent, months) {
  var monthlyRate = annualRatePercent / 1200;
  if (!monthlyRate) return principal / months;
  var growth = Math.pow(1 + monthlyRate, months);
  return principal * monthlyRate * growth / (growth - 1);
}
// ── END: EMI formula ───────────────────────────────────────────────────────


// ── START: Full repayment schedule ─────────────────────────────────────────
export function buildLoanSchedule(loan) {
  var monthlyRate = loan.rate / 1200;
  var balance = +loan.principal;
  var rows = [];
  var firstDue = addMonths(parseIsoDate(loan.disbursed), 1);
  var moratoriumEnd = loan.moratoriumEnd ? parseIsoDate(loan.moratoriumEnd) : null;
  var dueDate = firstDue;

  while (moratoriumEnd && dueDate < moratoriumEnd && rows.length < 120) {
    var interest = balance * monthlyRate;
    if (loan.mode === 'accrue') {
      balance += interest;
      rows.push({ date: dueDate, pay: 0, principal: 0, interest: interest, balance: balance, phase: 'accrue' });
    } else {
      rows.push({ date: dueDate, pay: interest, principal: 0, interest: interest, balance: balance, phase: 'moratorium' });
    }
    dueDate = addMonths(firstDue, rows.length);
  }

  var repaymentStart = dueDate;
  var emi = emiAmount(balance, loan.rate, +loan.tenure);
  for (var month = 0; month < +loan.tenure; month++) {
    var monthInterest = balance * monthlyRate;
    var principalPart = Math.min(balance, emi - monthInterest);
    balance = Math.max(0, balance - principalPart);
    rows.push({ date: addMonths(firstDue, rows.length), pay: principalPart + monthInterest, principal: principalPart, interest: monthInterest, balance: balance, phase: 'repay' });
  }

  return {
    rows: rows,
    emi: emi,
    repaymentStart: repaymentStart,
    moratoriumEnd: moratoriumEnd,
    totalInterest: sumOf(rows.map(function (row) { return row.interest; }))
  };
}
// ── END: Full repayment schedule ───────────────────────────────────────────


// ── START: Where a loan stands today ───────────────────────────────────────
export function loanStatus(loan, today) {
  var schedule = buildLoanSchedule(loan);
  var pastRows = schedule.rows.filter(function (row) { return row.date < today; });
  var upcomingRows = schedule.rows.filter(function (row) { return row.date >= today; });
  var outstanding = pastRows.length ? pastRows[pastRows.length - 1].balance : +loan.principal;
  return {
    schedule: schedule,
    upcoming: upcomingRows,
    next: upcomingRows[0] || null,
    outstanding: outstanding,
    principalRepaid: Math.max(0, loan.principal - outstanding),
    inMoratorium: !!(schedule.moratoriumEnd && today < schedule.moratoriumEnd),
    progress: clamp((loan.principal - outstanding) / loan.principal, 0, 1)
  };
}
// ── END: Where a loan stands today ─────────────────────────────────────────
