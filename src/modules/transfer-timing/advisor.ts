/* ============================================================================
   Sentry · Remittance timing advisor                            (owner: Alen)
   Compares sending money this week, next week and in two weeks. Rupees buy
   the foreign currency, so a LOWER rupee rate is better for the student.
   ============================================================================ */

import { addDays, daysBetween, formatDayMonth, formatRupees } from '../../shared/dates';
import { averageOf, fitStraightLine, standardDeviation } from '../../shared/maths';
import { financialYearOf, previewTcs, tcsOnRemittance, tcsRateKey, tcsRulesFor } from '../compliance/compliance';
import type { TransferWindow } from '../../shared/types';

// ── START: Timing advice ───────────────────────────────────────────────────
export function adviseTransferTiming(input) {
  var rates = input.rateHistory;
  var todaysRate = rates[rates.length - 1];
  var averageRate = averageOf(rates);
  var dailyMoves = [];
  for (var i = 1; i < rates.length; i++) dailyMoves.push(Math.log(rates[i] / rates[i - 1]));
  var dailyVolatility = standardDeviation(dailyMoves);
  var trendPerDay = fitStraightLine(rates.slice(-14)).slope;

  function forecastRate(daysAhead) {
    return todaysRate + trendPerDay * daysAhead * 0.6 + (averageRate - todaysRate) * 0.25 * Math.min(1, daysAhead / 14);
  }

  var today = input.today;
  var amount = input.amountLocal;
  var fee = input.fee;
  var windows: TransferWindow[] = [
    { id: 'now', label: 'This week', dates: formatDayMonth(today) + '–' + formatDayMonth(addDays(today, 6)), date: today, rate: todaysRate, isForecast: false },
    { id: 'next', label: 'Next week', dates: formatDayMonth(addDays(today, 7)) + '–' + formatDayMonth(addDays(today, 13)), date: addDays(today, 7), rate: forecastRate(7), isForecast: true },
    { id: 'later', label: 'In two weeks', dates: formatDayMonth(addDays(today, 14)) + '–' + formatDayMonth(addDays(today, 20)), date: addDays(today, 14), rate: forecastRate(14), isForecast: true }
  ];

  windows.forEach(function (option) {
    var sameYear = financialYearOf(option.date) === input.check.rules.financialYear;
    option.rupees = (amount + fee) * option.rate;
    option.tcs = sameYear
      ? previewTcs(input.check, amount * option.rate, input.purpose, input.loanFunded, input.hasLoanLetter).tcs
      : tcsOnRemittance(tcsRulesFor(financialYearOf(option.date)), tcsRateKey({ purpose: input.purpose, loanFunded: input.loanFunded }, input.hasLoanLetter), 0, amount * option.rate, 0).tcs;
    option.upfront = option.rupees + option.tcs;
    option.uncertainty = option.isForecast ? 1.28 * dailyVolatility * Math.sqrt(daysBetween(today, option.date)) * todaysRate * (amount + fee) : 0;
  });

  var cheapest = windows.slice().sort(function (a, b) { return a.upfront - b.upfront; })[0];
  windows.forEach(function (option) { option.extraCost = option.upfront - windows[0].upfront; });
  var saving = windows[0].upfront - cheapest.upfront;
  var savingIsNoise = cheapest !== windows[0] && saving < cheapest.uncertainty * 0.6;
  var recommended = cheapest === windows[0] || savingIsNoise ? windows[0] : cheapest;
  var percentVsAverage = (todaysRate - averageRate) / averageRate * 100;

  var reasons = [];
  reasons.push(percentVsAverage <= 0
    ? 'The rupee is ' + Math.abs(percentVsAverage).toFixed(1) + '% stronger than its 30-day average against ' + input.currencyCode + ', so each ' + input.currencyCode + ' costs less today.'
    : 'The rupee is ' + percentVsAverage.toFixed(1) + '% weaker than its 30-day average against ' + input.currencyCode + ', so each ' + input.currencyCode + ' costs more today.');
  if (trendPerDay > 0) reasons.push('The 14-day trend is still moving against you (≈' + formatRupees(trendPerDay * 7 * (amount + fee)) + ' per week on this transfer).');
  if (trendPerDay < 0) reasons.push('The 14-day trend is easing (≈' + formatRupees(-trendPerDay * 7 * (amount + fee)) + ' cheaper per week on this transfer).');
  if (savingIsNoise) reasons.push('Waiting might save ' + formatRupees(saving) + ', but that is inside the forecast error of ±' + formatRupees(cheapest.uncertainty) + ', so it is not worth the risk.');
  if (windows[0].tcs > 0) reasons.push('This transfer attracts ' + formatRupees(windows[0].tcs) + ' TCS upfront (claimable in your ITR).');
  if (input.purpose === 'education' && input.loanFunded && !input.hasLoanLetter) reasons.push('Upload your loan sanction letter first — loan-funded education remittances are 0% TCS.');

  return {
    todaysRate: todaysRate,
    averageRate: averageRate,
    percentVsAverage: percentVsAverage,
    yearlyVolatility: dailyVolatility * Math.sqrt(252),
    windows: windows,
    recommended: recommended,
    headline: recommended.id === 'now' ? 'Send this week.' : 'Wait until ' + recommended.label.toLowerCase() + '.',
    explanation: reasons.join(' '),
    rateHistory: rates
  };
}
// ── END: Timing advice ─────────────────────────────────────────────────────
