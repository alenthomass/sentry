/* ============================================================================
   Sentry · Transfer timing                                     (owner: Alen)
   The recommendation, the 30-day rate chart, how close the student is to
   the TCS threshold, and the three transfer windows compared.
   ============================================================================ */

import { formatDayMonth, formatFullDate, formatPercent, formatRupees, formatRupeesShort, parseIsoDate, startOfToday, toIsoDate } from '../../shared/dates';
import { chipStyle, css, rowStyle, TONES, type ViewProps } from '../../app/styles';
import { Store } from '../../data/store';
import { RUPEES_PER_USD } from './currency';

// ── START: Rate chart ──────────────────────────────────────────────────────
export function rateChart(history, average) {
  var lowest = Math.min.apply(null, history);
  var highest = Math.max.apply(null, history);
  var range = Math.max(highest - lowest, 1e-6);
  function yFor(rate) { return (80 - (rate - lowest) / range * 66).toFixed(1); }
  var path = history.map(function (rate, index) {
    return (index ? 'L' : 'M') + (4 + index / (history.length - 1) * 310).toFixed(1) + ' ' + yFor(rate);
  }).join(' ');
  return { path: path, lastY: yFor(history[history.length - 1]), averageLine: 'M0 ' + yFor(average) + 'h320' };
}
// ── END: Rate chart ────────────────────────────────────────────────────────


// ── START: Transfer timing screen ──────────────────────────────────────────
export function transferTimingScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var profile = app.profile;
  var timing = summary.timing;
  var check = summary.compliance;
  var threshold = check.rules.threshold;
  var selfFundedRate = check.rules.rates.educationSelf.above;
  var scheduled = profile.scheduledTransfer;
  var rupeeIsWeaker = timing.percentVsAverage > 0;
  var chart = rateChart(timing.rateHistory, timing.averageRate);

  var proximityNote;
  if (!check.crossedThreshold) {
    proximityNote = formatRupeesShort(check.leftBeforeThreshold) + ' left before TCS starts on education remittances this FY.';
  } else if (summary.fundedByLoan && summary.hasLoanLetter) {
    proximityNote = formatRupeesShort(check.nonTourInr) + ' remitted this FY against a ' + formatRupeesShort(threshold) + ' threshold. With the sanction letter on file, further loan-funded education remittances attract 0%.';
  } else {
    proximityNote = formatRupeesShort(check.nonTourInr) + ' remitted this FY against a ' + formatRupeesShort(threshold) + ' threshold. Every further education remittance attracts ' +
      formatPercent(selfFundedRate * 100) + ' TCS' + (summary.fundedByLoan ? ' until the loan sanction letter is on file.' : '.');
  }

  function logSentTransfer() {
    var items = (Store.read('remits') || {}).items || [];
    items = items.concat([{
      id: Store.newId(), date: toIsoDate(startOfToday()), amountInr: Math.round(summary.transferAmount * money.rate), purpose: 'education',
      loanFunded: summary.fundedByLoan, usdRate: RUPEES_PER_USD, a2: true, in26as: false, bank: profile.homeBank || '',
      note: 'Transfer · ' + money.whole(summary.transferAmount)
    }]);
    Store.save('remits', { items: items });
    app.saveProfile({ scheduledTransfer: null });
    app.toast('Remittance logged · compliance re-checked');
  }

  return {
    adviceHeadline: timing.headline,
    adviceText: timing.explanation,
    scheduled: !!scheduled,
    notScheduled: !scheduled,
    scheduleLabel: 'Schedule for ' + formatDayMonth(timing.recommended.date),
    scheduledLabel: scheduled ? 'Scheduled ' + formatDayMonth(parseIsoDate(scheduled.date)) + ' · undo' : '',
    schedule: function () {
      app.saveProfile({ scheduledTransfer: { date: toIsoDate(timing.recommended.date), amount: summary.transferAmount } });
      app.toast('Transfer scheduled for ' + formatDayMonth(timing.recommended.date));
    },
    unschedule: function () {
      app.saveProfile({ scheduledTransfer: null });
      app.toast('Scheduled transfer cancelled');
    },
    markSent: logSentTransfer,

    todaysRate: timing.todaysRate.toFixed(2),
    rateChipStyle: chipStyle(rupeeIsWeaker ? TONES.red : TONES.green, '6px 12px'),
    rateChipText: (rupeeIsWeaker ? '+' : '−') + Math.abs(timing.percentVsAverage).toFixed(1) + '% vs 30d avg',
    ratePath: chart.path,
    rateLastY: chart.lastY,
    rateAverageLine: chart.averageLine,
    rateChartNote: 'You buy ' + money.code + ' with rupees, so a lower number is better. Volatility ' + (timing.yearlyVolatility * 100).toFixed(1) + '% a year. ' +
      (summary.liveRates ? 'Live ECB rates, ' + formatFullDate(parseIsoDate(summary.ratesAsOf)) + '.' : 'Reference series — run the server for live rates.'),

    proximityChip: chipStyle(check.crossedThreshold ? TONES.red : TONES.green),
    proximityChipText: check.crossedThreshold ? 'Above threshold' : 'Below threshold',
    tcsProximityNote: proximityNote,
    thresholdShort: formatRupeesShort(threshold),
    yearTotalShort: formatRupeesShort(check.nonTourInr),

    transferAmount: money.whole(summary.transferAmount),
    feeLabel: money.symbol + money.country.transferFee,
    windows: timing.windows.map(function (option, index) {
      var isBest = option === timing.recommended;
      var color = isBest ? '#4E8A41' : option.extraCost > 0 ? '#C4342C' : '#7C7893';
      var rateText = option.isForecast ? 'Forecast ' + option.rate.toFixed(2) + ' · ±' + formatRupees(option.uncertainty) : 'Rate ' + option.rate.toFixed(2) + ' · today';
      return {
        title: option.label + ' · ' + option.dates,
        note: rateText + (option.tcs ? ' · TCS ' + formatRupees(option.tcs) : ''),
        noteStyle: 'font-size:11px;font-weight:600;color:' + color,
        totalCost: formatRupees(option.upfront),
        difference: isBest ? 'Best' : (option.extraCost >= 0 ? '+' : '−') + formatRupees(Math.abs(option.extraCost)),
        differenceStyle: 'font-size:11px;font-weight:700;color:' + color,
        rowStyle: rowStyle(index, timing.windows.length, 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 0')
      };
    })
  };
}
// ── END: Transfer timing screen ────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function TransferTimingView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Remittance Timing">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Transfer Timing</span>
        <div style={{ width: '40px' }} />
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: '#1B1233', borderRadius: '22px', padding: '18px', boxShadow: '0 10px 28px rgba(27,18,51,0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '9px', background: 'rgba(171,227,158,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M4 13.5l4.5-4.5 3 3L16 6.5" stroke="#ABE39E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ABE39E' }}>
              Recommended
            </span>
          </div>
          <div style={{ fontSize: '19px', fontWeight: '700', color: '#FFFFFF', lineHeight: '1.35', marginTop: '12px', letterSpacing: '-0.01em', textWrap: 'pretty' }}>
            {v.adviceHeadline}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#B7B0CE', lineHeight: '1.5', marginTop: '8px', textWrap: 'pretty' }}>
            {v.adviceText}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {v.notScheduled ? (
              <span onClick={v.schedule} style={{ flex: '1', textAlign: 'center', padding: '13px', borderRadius: '999px', background: '#8552FF', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
                {v.scheduleLabel}
              </span>
            ) : null}
            {v.scheduled ? (
              <>
                <span onClick={v.unschedule} style={{ flex: '1', textAlign: 'center', padding: '13px', borderRadius: '999px', background: '#ABE39E', fontSize: '14px', fontWeight: '700', color: '#22401B', cursor: 'pointer' }}>
                  {v.scheduledLabel}
                </span>
                <span onClick={v.markSent} style={{ textAlign: 'center', padding: '13px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.10)', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Mark as sent
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
                {v.curPair}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.03em' }}>{v.todaysRate}</div>
            </div>
            <span style={css(v.rateChipStyle)}>{v.rateChipText}</span>
          </div>
          <svg viewBox="0 0 320 90" width="100%" height="90" fill="none" preserveAspectRatio="none" style={{ marginTop: '10px' }}>
            <path d={v.rateAverageLine} stroke="#F2EFF8" strokeWidth="1" />
            <path d={v.ratePath} stroke="#8552FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="314" cy={v.rateLastY} r="5" fill="#FFFFFF" stroke="#8552FF" strokeWidth="3" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '600', color: '#9A95AE', marginTop: '4px' }}>
            <span>30 days ago</span>
            <span>Today</span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '10px', textWrap: 'pretty' }}>{v.rateChartNote}</div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>TCS proximity</span>
            <span style={css(v.proximityChip)}>{v.proximityChipText}</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '8px', textWrap: 'pretty' }}>{v.tcsProximityNote}</div>
          <div style={{ height: '10px', borderRadius: '5px', background: '#EFEBF8', marginTop: '14px', overflow: 'hidden' }}>
            <div style={css(v.thresholdBar)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '6px' }}>
            <span>₹0</span>
            <span>{v.thresholdShort} threshold</span>
            <span>{v.yearTotalShort}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Windows compared</span>
          <span onClick={v.openTransferSheet} style={{ fontSize: '12px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>
            On {v.transferAmount} · edit
          </span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.windows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <div style={{ minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.title}</div>
                <div style={css(item.noteStyle)}>{item.note}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{item.totalCost}</div>
                <div style={css(item.differenceStyle)}>{item.difference}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9A95AE', padding: '0 4px', marginTop: '-8px', textWrap: 'pretty' }}>
          Total cost in rupees to send {v.transferAmount} plus the {v.feeLabel} provider fee, including TCS collected upfront. A lower {v.curCode}/INR rate is better for you.
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
