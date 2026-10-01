/* ============================================================================
   Sentry · Overspend forecast                              (owner: Sidharth)
   AI insight card, category pills, the forecast chart and every category
   ranked by its chance of going over budget.
   ============================================================================ */

import { pluralize } from '../../shared/dates';
import { chipStyle, css, rowStyle, STYLE, toneForPercent, type ViewProps } from '../../app/styles';
import { categoryRows, daysUntilBreach } from '../budget/category-rows';
import { buildForecastChart } from './forecast';

// ── START: Insight text ────────────────────────────────────────────────────
export function forecastInsight(summary, money, category) {
  var forecast = category.forecast;
  var daysLeft = summary.daysLeft;
  if (forecast.alreadyOver) {
    return {
      title: category.name + ' is ' + money.exact(forecast.spent - category.budget) + ' over budget with ' + pluralize(daysLeft, 'day') + ' left.',
      body: 'You have spent ' + money.exact(forecast.spent) + ' of a ' + money.whole(category.budget) + ' budget and are on track for ' + money.exact(forecast.projected) +
        ' — ' + money.exact(forecast.projected - category.budget) + ' over (' + money.inRupees(forecast.projected - category.budget) + ') by day ' + summary.daysInThisMonth + '.'
    };
  }
  if (forecast.willOverspend && forecast.breachDay) {
    return {
      title: category.name + ' is projected to exceed budget in ' + pluralize(daysUntilBreach(summary, category), 'day') + '.',
      body: 'At the current pace you land at ' + money.exact(forecast.projected) + ' against a ' + money.whole(category.budget) + ' budget — ' +
        money.exact(forecast.projected - category.budget) + ' over (' + money.inRupees(forecast.projected - category.budget) + '). Cutting about ' +
        money.exact((forecast.projected - category.budget) / Math.max(1, daysLeft)) + ' a day keeps you inside it.'
    };
  }
  if (category.budget <= 0) {
    return { title: category.name + ' has no budget yet.', body: 'Set a monthly spend so Sentry can split it across categories and start forecasting.' };
  }
  return {
    title: category.name + ' is tracking under budget.',
    body: 'Projected ' + money.exact(forecast.projected) + ' against a ' + money.whole(category.budget) + ' budget — ' +
      money.exact(category.budget - forecast.projected) + ' (' + money.inRupees(category.budget - forecast.projected) + ') to spare this cycle.'
  };
}
// ── END: Insight text ──────────────────────────────────────────────────────


// ── START: Forecast screen ─────────────────────────────────────────────────
export function forecastScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var ui = app.ui;
  var rows = categoryRows(app);
  var category = rows[Math.min(ui.forecastCategory, rows.length - 1)];
  var chart = buildForecastChart(category.forecast, category.budget, summary.dayOfMonth, summary.daysInThisMonth);
  var insight = forecastInsight(summary, money, category);

  var ranked = rows.slice()
    .sort(function (a, b) { return b.forecast.breachProbability - a.forecast.breachProbability; })
    .map(function (row, index) {
      return Object.assign({}, row, {
        rank: index + 1,
        rowStyle: rowStyle(index, rows.length, 'animation:fadeUp .32s ease ' + (index * 0.04).toFixed(2) + 's both;display:flex;align-items:center;gap:12px;padding:15px 0;cursor:pointer')
      });
    });

  return {
    showInsight: ui.showInsight,
    snooze: function () {
      app.update({ showInsight: false });
      app.toast('Insight snoozed for this visit');
    },
    showBand: ui.showBand,
    toggleBand: function () {
      app.update({ showBand: !ui.showBand });
      app.toast(ui.showBand ? 'Confidence band hidden' : 'Confidence band shown');
    },
    insightTitle: insight.title,
    insightBody: insight.body,

    categoryPills: rows.map(function (row) {
      return {
        shortName: row.short,
        pillStyle: row.index === category.index ? STYLE.pillSelected : STYLE.pill,
        select: function () { app.update({ forecastCategory: row.index, showInsight: true }); }
      };
    }),
    rankedCategories: ranked,

    categoryName: category.name,
    categoryBudget: money.whole(category.budget),
    categorySpent: money.exact(category.spent),
    categoryProjected: money.exact(category.forecast.projected),
    categoryConfidence: category.forecast.confidence + '%',
    categoryWillCross: !!chart.crossPoint,
    projStyle: 'font-size:17px;font-weight:800;margin-top:3px;color:' + (category.forecast.willOverspend ? '#C4342C' : '#0B0620'),
    riskText: category.breachChance + '% risk',
    riskChip: chipStyle(toneForPercent(category.breachChance), '6px 12px'),
    cycleLabel: summary.daysInThisMonth + '-day cycle · day ' + summary.dayOfMonth,
    daysLeftLabel: 'Next ' + pluralize(summary.daysLeft, 'day'),

    actualPath: chart.actual,
    projPath: chart.projected,
    bandPath: chart.band,
    budgetLine: chart.budgetLine,
    todayX: chart.todayPoint.x.toFixed(1),
    todayY: chart.todayPoint.y.toFixed(1),
    crossX: chart.crossPoint ? chart.crossPoint.x.toFixed(1) : 0,
    crossY: chart.crossPoint ? chart.crossPoint.y.toFixed(1) : 0,
    tickLabels: chart.tickDays.map(function (day) { return { label: day === summary.dayOfMonth ? 'Today' : 'Day ' + day }; })
  };
}
// ── END: Forecast screen ───────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function ForecastView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Overspend Predictor">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '64px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Overspend Forecast</span>
        <div onClick={v.toggleBand} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="5" r="1.4" fill="#0B0620" />
            <circle cx="10" cy="10" r="1.4" fill="#0B0620" />
            <circle cx="10" cy="15" r="1.4" fill="#0B0620" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {v.showInsight ? (
          <div style={{ background: '#1B1233', borderRadius: '22px', padding: '18px', boxShadow: '0 10px 28px rgba(27,18,51,0.28)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '9px', background: 'rgba(133,82,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2.5l1.9 4.6 4.6 1.9-4.6 1.9L10 15.5 8.1 10.9 3.5 9l4.6-1.9L10 2.5z" fill="#C9B4FF" />
                </svg>
              </span>
              <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9B4FF' }}>
                AI insight
              </span>
            </div>
            <div style={{ fontSize: '19px', fontWeight: '700', color: '#FFFFFF', lineHeight: '1.35', marginTop: '12px', letterSpacing: '-0.01em', textWrap: 'pretty' }}>
              {v.insightTitle}
            </div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#B7B0CE', lineHeight: '1.5', marginTop: '8px', textWrap: 'pretty' }}>
              {v.insightBody}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <span onClick={v.goBudget} style={{ flex: '1', textAlign: 'center', padding: '13px', borderRadius: '999px', background: '#8552FF', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
                Adjust budget
              </span>
              <span onClick={v.snooze} style={{ textAlign: 'center', padding: '13px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.10)', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
                Snooze
              </span>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
          {(v.categoryPills || []).map((item: any, i: number) => (
            <span key={i} onClick={item.select} style={css(item.pillStyle)}>{item.shortName}</span>
          ))}
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0B0620' }}>{v.categoryName}</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.cycleLabel}</div>
            </div>
            <span style={css(v.riskChip)}>{v.riskText}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: '#8552FF' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4A4266' }}>Actual</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: '#F2544B' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4A4266' }}>Projected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '8px', borderRadius: '2px', background: '#FBDDDA' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4A4266' }}>Confidence</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '0', borderTop: '2px dashed #9A95AE' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#4A4266' }}>Budget {v.categoryBudget}</span>
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <svg viewBox="0 0 320 160" width="100%" height="160" fill="none" preserveAspectRatio="none">
              <path d="M0 20h320M0 60h320M0 100h320M0 140h320" stroke="#F2EFF8" strokeWidth="1" />
              {v.showBand ? (
                <path d={v.bandPath} fill="#F2544B" fillOpacity="0.13" />
              ) : null}
              <path d={v.budgetLine} stroke="#9A95AE" strokeWidth="1.6" strokeDasharray="5 5" />
              <path d={v.actualPath} stroke="#8552FF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: '520', animation: 'drawLine .85s cubic-bezier(.3,.9,.3,1) both' }} />
              <path d={v.projPath} stroke="#F2544B" strokeWidth="3.2" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'fadeUp .5s ease .5s both' }} />
              <circle cx={v.todayX} cy={v.todayY} r="5" fill="#FFFFFF" stroke="#8552FF" strokeWidth="3" style={{ animation: 'fadeUp .4s ease .55s both' }} />
              {v.categoryWillCross ? (
                <circle cx={v.crossX} cy={v.crossY} r="5.5" fill="#F2544B" stroke="#FFFFFF" strokeWidth="2.5" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'blip 2.4s ease-in-out .8s infinite' }} />
              ) : null}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '600', color: '#9A95AE', marginTop: '6px' }}>
              {(v.tickLabels || []).map((tick: any, i: number) => (
                <span key={i}>{tick.label}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F0EDF7' }}>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Spent so far</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.categorySpent}</div>
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Projected</div>
              <div style={css(v.projStyle)}>{v.categoryProjected}</div>
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Confidence</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.categoryConfidence}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Risk by category</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.daysLeftLabel}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.rankedCategories || []).map((item: any, i: number) => (
            <div key={i} onClick={item.open} style={css(item.rowStyle)}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#9A95AE', width: '14px' }}>{item.rank}</span>
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.name}</div>
                <div style={{ height: '6px', borderRadius: '3px', background: '#EFEBF8', marginTop: '7px', overflow: 'hidden' }}>
                  <div style={css(item.riskBarStyle)} />
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '5px' }}>{item.riskDetails}</div>
              </div>
              <span style={css(item.riskChipStyle)}>{item.riskPercent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
