/* ============================================================================
   Sentry · Profile
   What a brand-new profile looks like, and how profiles saved by an older
   version of the app are brought up to date.
   ============================================================================ */

import { startOfToday, toIsoDate } from '../shared/dates';
import { defaultMonthlyBudget, splitBudget } from '../modules/budget/budget';
import { findCountry } from '../modules/transfer-timing/currency';

// ── START: New profile ─────────────────────────────────────────────────────
export var PROFILE_VERSION = 3;

export function createProfile(details, email) {
  var country = findCountry(details.country || 'UK');
  var monthly = Number(details.budget) > 0 ? Number(details.budget) : defaultMonthlyBudget(country.code);
  return {
    version: PROFILE_VERSION,
    name: String(details.name || '').trim(),
    email: email,
    phone: String(details.phone || '').trim(),
    dob: '',
    pan: String(details.pan || '').trim().toUpperCase(),
    passport: '',
    uni: String(details.uni || '').trim(),
    courseEnds: String(details.courseEnds || '').trim(),
    funding: details.funding || 'Education loan',
    country: country.id,
    budgets: splitBudget(Math.round(monthly)),
    budgetCurrency: country.code,
    alerts: { overspend: true, emi: true, fx: true, deadlines: true },
    alertThreshold: 85,
    primaryCurrency: 'LOCAL',
    panLinked: false,
    loanLetter: null,
    rateOverrides: {},
    readNotifications: {},
    scheduledTransfer: null,
    transferAmount: country.usualTransfer,
    localBank: '',
    homeBank: '',
    banks: [],
    categoryRules: {},
    createdAt: toIsoDate(startOfToday())
  };
}
// ── END: New profile ───────────────────────────────────────────────────────


// ── START: Upgrading older saved profiles ──────────────────────────────────
export var RENAMED_PROFILE_FIELDS = {
  settings: 'alerts',
  threshold: 'alertThreshold',
  primary: 'primaryCurrency',
  fxOverride: 'rateOverrides',
  read: 'readNotifications',
  scheduled: 'scheduledTransfer',
  transfer: 'transferAmount',
  budgetCur: 'budgetCurrency',
  rules: 'categoryRules'
};

export function upgradeProfile(profile) {
  if (!profile || profile.version === PROFILE_VERSION) return profile;
  var upgraded = Object.assign({}, profile, { version: PROFILE_VERSION });
  Object.keys(RENAMED_PROFILE_FIELDS).forEach(function (oldName) {
    var newName = RENAMED_PROFILE_FIELDS[oldName];
    if (upgraded[newName] === undefined && upgraded[oldName] !== undefined) upgraded[newName] = upgraded[oldName];
    delete upgraded[oldName];
  });
  upgraded.banks = upgraded.banks || [];
  upgraded.categoryRules = upgraded.categoryRules || {};
  return upgraded;
}
// ── END: Upgrading older saved profiles ────────────────────────────────────
