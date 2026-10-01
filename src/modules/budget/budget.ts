/* ============================================================================
   Sentry · Budget categories                                  (owner: Adeeth)
   The nine spending categories every module shares, and how a monthly
   budget is split across them.
   ============================================================================ */

import { sumOf } from '../../shared/maths';
import { rupeesPerUnit } from '../transfer-timing/currency';

// ── START: Categories ──────────────────────────────────────────────────────
export var CATEGORIES = [
  { id: 'rent', name: 'Rent & Bills', short: 'Rent', group: 'essentials', share: 0.273, paidOnceAMonth: true },
  { id: 'grocery', name: 'Groceries & Food', short: 'Groceries', group: 'essentials', share: 0.337 },
  { id: 'eatout', name: 'Eating out', short: 'Eating out', group: 'lifestyle', share: 0.096 },
  { id: 'transport', name: 'Transport', short: 'Transport', group: 'essentials', share: 0.076 },
  { id: 'shopping', name: 'Shopping & personal', short: 'Shopping', group: 'lifestyle', share: 0.056 },
  { id: 'course', name: 'Course materials', short: 'Course', group: 'study', share: 0.048 },
  { id: 'society', name: 'Societies & events', short: 'Societies', group: 'study', share: 0.044 },
  { id: 'health', name: 'Health & insurance', short: 'Health', group: 'essentials', share: 0.036, paidOnceAMonth: true },
  { id: 'mobile', name: 'Mobile & internet', short: 'Mobile', group: 'essentials', share: 0.034, paidOnceAMonth: true }
];

export var CATEGORY_GROUPS = { all: 'All categories', essentials: 'Essentials', lifestyle: 'Lifestyle', study: 'Study' };

export function findCategory(categoryId) {
  return CATEGORIES.filter(function (category) { return category.id === categoryId; })[0] || CATEGORIES[0];
}
// ── END: Categories ────────────────────────────────────────────────────────


// ── START: Monthly budget ──────────────────────────────────────────────────
export var DEFAULT_MONTHLY_BUDGET_GBP = 1245;

export function defaultMonthlyBudget(currencyCode) {
  var converted = DEFAULT_MONTHLY_BUDGET_GBP * rupeesPerUnit('GBP') / rupeesPerUnit(currencyCode);
  return Math.round(converted / 25) * 25;
}

export function splitBudget(monthlyTotal) {
  var budgets = {};
  var allocated = 0;
  CATEGORIES.forEach(function (category, index) {
    var isLast = index === CATEGORIES.length - 1;
    var amount = isLast ? Math.max(0, monthlyTotal - allocated) : Math.round(monthlyTotal * category.share);
    budgets[category.id] = amount;
    allocated += amount;
  });
  return budgets;
}

export function rescaleBudgets(budgets, newMonthlyTotal) {
  var oldTotal = sumOf(CATEGORIES.map(function (category) { return budgets[category.id] || 0; }));
  if (!oldTotal) return splitBudget(newMonthlyTotal);
  var rescaled = {};
  CATEGORIES.forEach(function (category) {
    rescaled[category.id] = Math.round((budgets[category.id] || 0) * newMonthlyTotal / oldTotal);
  });
  return rescaled;
}
// ── END: Monthly budget ────────────────────────────────────────────────────


// ── START: Expenses in another currency ────────────────────────────────────
export function amountInCurrency(expense, currencyCode, rateOverrides) {
  if (expense.cur === currencyCode) return expense.amount;
  var rupees = expense.amount * (expense.rate || rupeesPerUnit(expense.cur, rateOverrides));
  return rupees / rupeesPerUnit(currencyCode, rateOverrides);
}
// ── END: Expenses in another currency ──────────────────────────────────────
