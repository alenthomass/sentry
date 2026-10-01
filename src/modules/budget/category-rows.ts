/* ============================================================================
   Sentry · Category rows                                     (owner: Adeeth)
   One row per budget category, shared by Home, Budget and Forecast.
   ============================================================================ */

import { barStyle, chipStyle, toneForPercent } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';

// ── START: Category rows (shared by Home, Budget and Forecast) ─────────────
export function categoryRows(app) {
  var money = app.money;
  return app.summary.categories.map(function (category) {
    var percent = Math.round(category.usedPercent);
    var usedTone = toneForPercent(percent);
    var riskTone = toneForPercent(category.breachChance);
    return Object.assign({}, category, {
      percent: percent,
      spentText: money.exact(category.spent) + ' of ' + money.whole(category.budget),
      spentInRupees: money.inRupees(category.spent) + ' of ' + money.inRupees(category.budget),
      percentText: percent + '%',
      percentChipStyle: chipStyle(usedTone, '4px 9px'),
      nameStyle: 'font-size:14px;font-weight:700;color:' + (percent >= 90 ? '#C4342C' : '#0B0620'),
      barStyle: barStyle(percent, usedTone.bar, 4),
      dotStyle: 'width:8px;height:8px;border-radius:4px;flex-shrink:0;background:' + usedTone.bar,
      riskPercent: category.breachChance + '%',
      riskDetails: money.exact(category.forecast.projected) + ' projected · ' + money.whole(category.budget) + ' budget',
      riskChipStyle: chipStyle(riskTone),
      riskBarStyle: barStyle(category.breachChance, riskTone.bar, 3),
      open: function () {
        app.update(Object.assign({ screen: 'forecast', forecastCategory: category.index, showInsight: true }, CLOSED_OVERLAYS));
      }
    });
  });
}

export function daysUntilBreach(summary, category) {
  return category.forecast.breachDay ? Math.max(1, category.forecast.breachDay - summary.dayOfMonth) : 0;
}
// ── END: Category rows (shared by Home, Budget and Forecast) ───────────────
