/* ============================================================================
   Sentry · Dates and money formatting
   Small helpers used everywhere. Dates are stored as "YYYY-MM-DD" strings
   and turned into local Date objects only when we need to calculate.
   ============================================================================ */

// ── START: Names ───────────────────────────────────────────────────────────
export var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export var MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export var WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// ── END: Names ─────────────────────────────────────────────────────────────


// ── START: Converting between Date objects and stored strings ─────────────
export function twoDigits(number) {
  return (number < 10 ? '0' : '') + number;
}

export function toIsoDate(date) {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

export function parseIsoDate(text) {
  var parts = String(text).split('-');
  return new Date(+parts[0], (+parts[1] || 1) - 1, +parts[2] || 1);
}

export function monthKey(date) {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1);
}

export function startOfToday() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}
// ── END: Converting between Date objects and stored strings ───────────────


// ── START: Date arithmetic ─────────────────────────────────────────────────
export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date, months) {
  var year = date.getFullYear();
  var monthIndex = date.getMonth() + months;
  var targetYear = year + Math.floor(monthIndex / 12);
  var targetMonth = ((monthIndex % 12) + 12) % 12;
  var day = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));
  return new Date(year, monthIndex, day);
}

export function daysBetween(fromDate, toDate) {
  return Math.round((toDate - fromDate) / 86400000);
}
// ── END: Date arithmetic ───────────────────────────────────────────────────


// ── START: Showing dates to people ─────────────────────────────────────────
export function formatDayMonth(date) {
  return date.getDate() + ' ' + MONTH_NAMES[date.getMonth()];
}

export function formatFullDate(date) {
  return date.getDate() + ' ' + MONTH_NAMES[date.getMonth()] + ' ' + date.getFullYear();
}

export function formatMonthYear(date) {
  return MONTH_NAMES[date.getMonth()] + ' ' + date.getFullYear();
}
// ── END: Showing dates to people ───────────────────────────────────────────


// ── START: Showing rupee amounts ───────────────────────────────────────────
export function formatRupees(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function formatRupeesShort(amount) {
  var size = Math.abs(amount);
  if (size >= 1e7) return '₹' + (amount / 1e7).toFixed(2) + 'Cr';
  if (size >= 1e5) return '₹' + (amount / 1e5).toFixed(size >= 1e6 ? 1 : 2).replace(/\.0+$/, '') + 'L';
  return formatRupees(amount);
}

export function formatPercent(value) {
  var rounded = Math.round(value * 10) / 10;
  var showDecimal = value < 10 && rounded % 1 !== 0;
  return (showDecimal ? rounded.toFixed(1) : Math.round(value)) + '%';
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count + ' ' + (count === 1 ? singular : (plural || singular + 's'));
}
// ── END: Showing rupee amounts ─────────────────────────────────────────────
