/* ============================================================================
   Sentry · Overspend forecast                               (owner: Sidharth)
   Predicts where each category will end the month. In production Prophet
   runs offline and supplies the "expected month"; here a straight-line
   trend over past months plays that role and is blended with this month's pace.
   ============================================================================ */

import { averageOf, clamp, fitStraightLine, normalCdf, standardDeviation } from '../../shared/maths';

// ── START: Forecast one category ───────────────────────────────────────────
export function forecastCategory(input) {
  var today = input.dayOfMonth;
  var monthLength = input.daysInMonth;
  var dailySpend = input.dailySpend;
  var budget = input.budget;
  var history = input.history || [];

  var runningTotals = [];
  var spentSoFar = 0;
  for (var day = 0; day < today; day++) {
    spentSoFar += dailySpend[day] || 0;
    runningTotals.push(spentSoFar);
  }
  var daysLeft = monthLength - today;

  var expectedMonth;
  if (history.length >= 3) {
    var trend = fitStraightLine(history);
    expectedMonth = Math.max(0, trend.intercept + trend.slope * history.length);
  } else {
    expectedMonth = history.length ? averageOf(history) : budget * 0.9;
  }
  if (!(expectedMonth > 0)) expectedMonth = budget;
  var historySpread = history.length >= 3 ? standardDeviation(history) : expectedMonth * 0.15;

  var projected, spread, dailyRate;
  if (input.paidOnceAMonth) {
    var alreadyPaid = spentSoFar >= expectedMonth * 0.85;
    projected = alreadyPaid ? spentSoFar : Math.max(spentSoFar, expectedMonth);
    dailyRate = daysLeft ? (projected - spentSoFar) / daysLeft : 0;
    spread = Math.max(projected * 0.03, alreadyPaid ? projected * 0.02 : historySpread * 0.5);
  } else {
    var trustInThisMonth = clamp(today / (monthLength * 0.6), 0, 1);
    dailyRate = trustInThisMonth * (spentSoFar / Math.max(today, 1)) + (1 - trustInThisMonth) * (expectedMonth / monthLength);
    projected = spentSoFar + dailyRate * daysLeft;
    var dailySpread = standardDeviation(dailySpend.slice(0, today));
    spread = Math.sqrt(Math.pow(dailySpread * Math.sqrt(daysLeft), 2) + Math.pow(historySpread * (daysLeft / monthLength) * (1 - trustInThisMonth * 0.5), 2));
    spread = Math.max(spread, projected * 0.04);
  }

  var breachProbability = 0;
  if (budget > 0) breachProbability = spentSoFar > budget ? 1 : 1 - normalCdf((budget - projected) / Math.max(spread, 1e-6));

  var breachDay = null;
  if (budget > 0 && spentSoFar > budget) {
    for (var d = 0; d < today; d++) {
      if (runningTotals[d] > budget) { breachDay = d + 1; break; }
    }
  } else if (budget > 0 && projected > budget && dailyRate > 0) {
    breachDay = Math.min(monthLength, today + Math.ceil((budget - spentSoFar) / dailyRate));
  }

  return {
    spent: spentSoFar,
    projected: projected,
    spread: spread,
    high: projected + 1.28 * spread,
    breachProbability: breachProbability,
    confidence: clamp(Math.round(100 - 128 * spread / Math.max(projected, 1)), 50, 99),
    dailyRate: dailyRate,
    runningTotals: runningTotals,
    breachDay: breachDay,
    alreadyOver: spentSoFar > budget,
    willOverspend: projected > budget
  };
}
// ── END: Forecast one category ─────────────────────────────────────────────


// ── START: Chart paths (320 × 160 SVG) ─────────────────────────────────────
export function buildForecastChart(forecast, budget, today, monthLength) {
  var top = Math.max(forecast.high, budget, forecast.spent, 1) * 1.12;
  function xFor(day) { return 8 + (day - 1) / Math.max(1, monthLength - 1) * 304; }
  function yFor(amount) { return 150 - amount / top * 130; }
  function toPath(points, startWithMove) {
    return points.map(function (point, index) {
      return (index || !startWithMove ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1);
    }).join(' ');
  }

  var actual = forecast.runningTotals.length
    ? toPath(forecast.runningTotals.map(function (total, index) { return [xFor(index + 1), yFor(total)]; }), true)
    : 'M' + xFor(1) + ' ' + yFor(0);

  var steps = 8;
  var daysLeft = monthLength - today;
  var projectedPoints = [];
  var upperPoints = [];
  var lowerPoints = [];
  for (var step = 0; step <= steps; step++) {
    var day = today + daysLeft * step / steps;
    var amount = forecast.spent + forecast.dailyRate * (day - today);
    var band = 1.28 * forecast.spread * Math.sqrt(daysLeft ? (day - today) / daysLeft : 0);
    projectedPoints.push([xFor(day), yFor(amount)]);
    upperPoints.push([xFor(day), yFor(amount + band)]);
    lowerPoints.push([xFor(day), yFor(Math.max(forecast.spent, amount - band))]);
  }

  return {
    actual: actual,
    projected: toPath(projectedPoints, true),
    band: toPath(upperPoints, true) + ' ' + toPath(lowerPoints.slice().reverse(), false) + ' Z',
    budgetLine: 'M0 ' + yFor(budget).toFixed(1) + 'h320',
    todayPoint: { x: xFor(today), y: yFor(forecast.spent) },
    crossPoint: forecast.breachDay ? { x: xFor(forecast.breachDay), y: yFor(budget) } : null,
    tickDays: [1, Math.round(monthLength / 3), Math.round(monthLength * 2 / 3), monthLength]
      .filter(function (day) { return Math.abs(day - today) > 3; })
      .concat([today])
      .sort(function (a, b) { return a - b; })
      .map(function (day) { return { day: day, percent: xFor(day) / 320 * 100 }; })
  };
}
// ── END: Chart paths (320 × 160 SVG) ───────────────────────────────────────
