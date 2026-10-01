/* ============================================================================
   Sentry · LRS & TCS check                                     (owner: Alen)
   Money sent this financial year, the TCS threshold, rates by purpose, the
   paperwork checklist and every logged remittance.
   ============================================================================ */

import { formatFullDate, formatPercent, formatRupees, formatRupeesShort, parseIsoDate, pluralize, startOfToday, toIsoDate } from '../../shared/dates';
import { barStyle, chipStyle, css, rowStyle, TONES, type ViewProps } from '../../app/styles';
import { twoTapDelete } from '../../app/ui-state';
import { Store } from '../../data/store';
import { findPurpose } from './compliance';

// ── START: Threshold and limit cards ───────────────────────────────────────
export function complianceTotals(app) {
  var summary = app.summary;
  var check = summary.compliance;
  var rules = check.rules;
  var threshold = rules.threshold;
  var selfFundedRate = rules.rates.educationSelf.above;
  var limitTone = check.lrsUsedPercent >= 100 ? TONES.red : check.lrsUsedPercent >= 80 ? TONES.purple : TONES.green;
  var crossingPoint = check.crossedThreshold ? Math.max(4, Math.min(96, threshold / Math.max(check.nonTourInr, 1) * 100)) : 0;
  var thresholdBar = check.crossedThreshold
    ? 'width:100%;transition:width .55s cubic-bezier(.32,1,.35,1),background-color .3s ease;height:100%;border-radius:5px;background:linear-gradient(90deg,#ABE39E 0%,#ABE39E ' +
      crossingPoint.toFixed(1) + '%,#F2544B ' + crossingPoint.toFixed(1) + '%,#F2544B 100%)'
    : barStyle(check.thresholdPercent, '#ABE39E', 5);

  var avoidLabel = 'Avoidable';
  var avoidAmount = formatRupees(check.avoidableTcs);
  var avoidColor = '#C4342C';
  var avoidNote = '0% applies with loan sanction letter';
  if (!summary.fundedByLoan) {
    avoidLabel = 'Your TCS rate';
    avoidAmount = formatPercent(selfFundedRate * 100);
    avoidColor = '#0B0620';
    avoidNote = 'Self-funded education above ' + formatRupeesShort(threshold);
  } else if (summary.hasLoanLetter) {
    avoidLabel = 'Now reclaimable';
    avoidAmount = formatRupees(check.totalTcs);
    avoidColor = '#4E8A41';
    avoidNote = 'Letter on file · 0% on future remittances';
  }

  return {
    financialYear: rules.financialYear,
    yearTotal: formatRupees(check.totalInr),
    yearTotalUsd: 'US$' + Math.round(check.totalUsd).toLocaleString('en-US'),
    lrsChipStyle: chipStyle(limitTone, '6px 12px'),
    lrsChipText: check.lrsUsedPercent >= 100 ? 'Over limit' : check.lrsUsedPercent >= 80 ? 'Near limit' : 'Within limit',
    lrsUsed: formatPercent(check.lrsUsedPercent) + ' used',
    lrsBarStyle: barStyle(check.lrsUsedPercent, '#8552FF', 5),
    lrsHeadroom: formatRupees(check.headroomInr) + ' headroom · limit US$' + rules.lrsLimitUsd.toLocaleString('en-US'),
    thresholdText: formatRupees(threshold),
    thresholdState: check.crossedThreshold ? 'Crossed' : formatRupeesShort(check.leftBeforeThreshold) + ' to go',
    thresholdStateStyle: 'color:' + (check.crossedThreshold ? '#C4342C' : '#4E8A41'),
    thresholdBar: thresholdBar,
    thresholdMarker: check.crossedThreshold
      ? 'position:absolute;left:' + crossingPoint.toFixed(1) + '%;top:-4px;width:2px;height:18px;background:#1B1233;border-radius:1px'
      : 'display:none',
    thresholdLeft: check.crossedThreshold ? 'Crossed ' + formatFullDate(parseIsoDate(check.crossedOn)) : formatRupees(check.nonTourInr) + ' so far',
    thresholdRight: check.crossedThreshold ? formatRupees(check.aboveThresholdBy) + ' above' : formatRupees(check.leftBeforeThreshold) + ' left',
    tcsCollected: formatRupees(check.totalTcs),
    tcsCollectedNote: check.totalTcs ? 'On ' + pluralize(check.tcsCount, 'remittance') + ' · refundable via ITR' : 'Nothing collected this FY',
    avoidLabel: avoidLabel,
    avoidAmount: avoidAmount,
    avoidStyle: 'font-size:20px;font-weight:800;margin-top:6px;letter-spacing:-0.02em;color:' + avoidColor,
    avoidNote: avoidNote,
    rulesFrom: 'From ' + formatFullDate(parseIsoDate(rules.start))
  };
}
// ── END: Threshold and limit cards ─────────────────────────────────────────


// ── START: TCS by purpose table ────────────────────────────────────────────
export function purposeTable(app) {
  var summary = app.summary;
  var rules = summary.compliance.rules;
  var yourRate = summary.fundedByLoan && summary.hasLoanLetter ? 'educationLoan' : 'educationSelf';
  var loanNote = summary.fundedByLoan ? (summary.hasLoanLetter ? 'S0305 · your active code' : 'S0305 · needs sanction letter') : 'S0305 · with a sanctioned loan';
  var tourNote = rules.rates.tour.flat != null ? 'Flat, no threshold' : formatPercent(rules.rates.tour.upTo * 100) + ' up to ' + formatRupeesShort(rules.threshold);
  var purposes = [
    { key: 'educationLoan', name: 'Education · loan funded', note: loanNote },
    { key: 'educationSelf', name: 'Education · self funded', note: yourRate === 'educationSelf' ? 'S0305 · your current rate' : 'S0305 · no longer applies' },
    { key: 'medical', name: 'Medical treatment', note: 'S0304' },
    { key: 'tour', name: 'Tour package', note: tourNote },
    { key: 'other', name: 'Other purposes', note: 'Gifts, maintenance, investment' }
  ];

  return purposes.map(function (purpose, index) {
    var rate = rules.rates[purpose.key];
    var percent = rate.flat != null ? rate.flat : rate.above;
    var isYours = purpose.key === yourRate;
    var highlightNote = isYours || (purpose.key === 'educationLoan' && summary.fundedByLoan);
    var baseRow = 'display:grid;grid-template-columns:1fr 50px 48px;gap:10px;align-items:center;' +
      (isYours ? 'padding:11px 8px;margin:0 -8px;background:#FBF9FF;border-radius:10px' : 'padding:11px 0');
    return {
      name: purpose.name,
      note: purpose.note,
      noteStyle: 'font-size:11px;font-weight:600;color:' + (highlightNote ? '#6B36F0' : '#7C7893'),
      rate: formatPercent(percent * 100),
      rateStyle: 'font-size:14px;font-weight:800;text-align:right;color:' + (percent === 0 ? '#4E8A41' : isYours ? '#C4342C' : '#0B0620'),
      above: rate.flat != null ? 'All' : formatRupeesShort(rules.threshold),
      rowStyle: rowStyle(index, purposes.length, baseRow)
    };
  });
}
// ── END: TCS by purpose table ──────────────────────────────────────────────


// ── START: Paperwork checklist ─────────────────────────────────────────────
export function updateRemittance(app, remittanceId, changes) {
  var items = (Store.read('remits') || {}).items || [];
  Store.save('remits', { items: items.map(function (item) { return item.id === remittanceId ? Object.assign({}, item, changes) : item; }) });
  app.reloadData();
}

export function complianceChecklist(app) {
  var summary = app.summary;
  var profile = app.profile;
  var check = summary.compliance;
  var newestFirst = check.items.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var waitingFor26as = check.items.filter(function (item) { return item.tcs > 0 && !item.in26as; });
  var tasks = [];

  function stop(event) {
    if (event && event.stopPropagation) event.stopPropagation();
  }

  if (profile.panLinked) {
    tasks.push({ kind: 'done', title: 'PAN linked with Aadhaar', note: 'Confirmed by you · tap to undo', onTap: function () { app.saveProfile({ panLinked: false }); } });
  } else {
    tasks.push({
      kind: 'problem', title: 'PAN–Aadhaar link unconfirmed', note: 'Banks collect TCS at double the rate if it isn’t', noteColor: '#C4342C', actionText: 'Confirm',
      onAction: function (event) { stop(event); app.saveProfile({ panLinked: true }); app.toast('PAN–Aadhaar link confirmed'); }
    });
  }

  if (!check.items.length) {
    tasks.push({ kind: 'waiting', title: 'Form A2 · nothing to file yet', note: 'Your bank asks for one with each remittance' });
  } else {
    tasks.push({
      kind: check.formA2Count >= check.items.length ? 'done' : 'waiting',
      title: 'Form A2 on file · ' + check.formA2Count + ' of ' + check.items.length,
      note: 'Last: ' + formatRupees(newestFirst[0].amountInr) + ' on ' + formatFullDate(parseIsoDate(newestFirst[0].date))
    });
  }

  if (summary.fundedByLoan && summary.hasLoanLetter) {
    tasks.push({
      kind: 'done', title: 'Loan sanction letter on file', note: '0% TCS applies to future remittances', noteColor: '#4E8A41', actionText: 'Undo', quietAction: true,
      onAction: function (event) { stop(event); app.saveProfile({ loanLetter: null }); app.toast('Sanction letter removed · TCS re-checked'); }
    });
  } else if (summary.fundedByLoan) {
    tasks.push({
      kind: 'problem', title: 'Loan sanction letter missing', note: 'Upload to move loan-funded education to 0% TCS', noteColor: '#C4342C', actionText: 'Upload',
      onAction: function (event) { stop(event); app.saveProfile({ loanLetter: { addedAt: toIsoDate(startOfToday()) } }); app.toast('Sanction letter noted · TCS re-checked at 0%'); }
    });
  }

  if (check.tcsCount === 0) {
    tasks.push({ kind: 'done', title: 'Form 26AS · nothing to match', note: 'No TCS collected this FY' });
  } else {
    tasks.push({
      kind: waitingFor26as.length ? 'waiting' : 'done',
      title: 'TCS in Form 26AS · ' + check.seenIn26asCount + ' of ' + check.tcsCount,
      note: waitingFor26as.length ? 'Tap once the next entry appears on the portal' : 'Every deduction has appeared',
      actionText: waitingFor26as.length ? 'Seen' : '', quietAction: true,
      onAction: function (event) {
        stop(event);
        updateRemittance(app, waitingFor26as[waitingFor26as.length - 1].id, { in26as: true });
        app.toast('Marked as appearing in Form 26AS');
      }
    });
  }

  tasks.push({ kind: 'document', title: check.totalTcs ? 'Claim ' + formatRupees(check.totalTcs) + ' TCS credit in ITR' : 'Claim TCS credit in ITR', note: check.assessmentYear + ' · due ' + check.itrDueDate });

  var problems = tasks.filter(function (task) { return task.kind === 'problem'; }).length;
  var waiting = tasks.filter(function (task) { return task.kind === 'waiting'; }).length;

  return {
    checklist: tasks.map(function (task, index) {
      return {
        ok: task.kind === 'done', warn: task.kind === 'problem', clock: task.kind === 'waiting', doc: task.kind === 'document',
        title: task.title,
        note: task.note,
        noteStyle: 'font-size:11px;font-weight:600;color:' + (task.noteColor || '#7C7893'),
        actionText: task.actionText || '',
        onAction: task.onAction,
        actionStyle: 'padding:8px 13px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;' +
          (task.quietAction ? 'background:#F3F1FA;color:#4A4266' : 'background:#1B1233;color:#FFFFFF'),
        onTap: task.onTap,
        rowStyle: rowStyle(index, tasks.length, 'display:flex;align-items:center;gap:12px;padding:15px 0' + (task.onTap ? ';cursor:pointer' : ''))
      };
    }),
    checklistStatus: problems ? problems + ' need action' : waiting ? waiting + ' to track' : 'All clear',
    checklistChip: 'font-size:12px;font-weight:700;color:' + (problems ? '#C4342C' : '#4E8A41')
  };
}
// ── END: Paperwork checklist ───────────────────────────────────────────────


// ── START: Remittance list ─────────────────────────────────────────────────
export function remittanceList(app) {
  var items = app.summary.compliance.items.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  function deleteRemittance(remittance) {
    var saved = (Store.read('remits') || {}).items || [];
    Store.save('remits', { items: saved.filter(function (item) { return item.id !== remittance.id; }) });
    var bankLines = [remittance.bankLineId, remittance.tcsLineId].filter(Boolean);
    if (bankLines.length) app.saveProfile({ dismissedBankLines: (app.profile.dismissedBankLines || []).concat(bankLines) });
    else app.reloadData();
    app.toast(bankLines.length ? 'Remittance removed · it won’t come back on the next sync' : 'Remittance deleted · compliance re-checked');
  }

  return items.map(function (remittance, index) {
    var purpose = findPurpose(remittance.purpose);
    var fundingText = remittance.purpose === 'education' ? (remittance.loanFunded ? ' · loan' : ' · self') : '';
    var tcsText = remittance.tcsFromBank != null ? 'TCS ' + formatRupees(remittance.tcsFromBank) + ' · bank-confirmed'
      : remittance.tcs ? 'TCS ' + formatRupees(remittance.tcs) + ' · ' + formatPercent(remittance.rate * 100) : 'No TCS';
    var deleteControl = twoTapDelete(app, 'remittance:' + remittance.id, 'Tap × again to delete this remittance', function () { deleteRemittance(remittance); });
    return {
      title: remittance.note || purpose.label,
      details: formatFullDate(parseIsoDate(remittance.date)) + ' · ' + purpose.label + fundingText + (remittance.fromBank ? ' · auto from ' + remittance.bank : ''),
      amount: formatRupees(remittance.amountInr),
      tcsText: tcsText,
      tcsStyle: 'font-size:11px;font-weight:700;color:' + (remittance.tcs ? '#C4342C' : '#4E8A41'),
      rowStyle: rowStyle(index, items.length, 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 0'),
      deleteStyle: deleteControl.style,
      remove: deleteControl.press
    };
  });
}
// ── END: Remittance list ───────────────────────────────────────────────────


// ── START: Compliance screen ───────────────────────────────────────────────
export function complianceScreen(app) {
  var rows = remittanceList(app);
  return Object.assign(complianceTotals(app), complianceChecklist(app), {
    purposeRows: purposeTable(app),
    remittanceRows: rows,
    noRemittances: rows.length === 0
  });
}
// ── END: Compliance screen ─────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function ComplianceView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="LRS TCS Compliance">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '64px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>LRS & TCS Check</span>
        <div onClick={v.openRemitSheet} aria-label="Log remittance" style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M10 5v10M5 10h10" stroke="#0B0620" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
                Remitted this FY
              </div>
              <div style={{ fontSize: '30px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.03em' }}>{v.yearTotal}</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>≈ {v.yearTotalUsd} · {v.financialYear}</div>
            </div>
            <span style={css(v.lrsChipStyle)}>{v.lrsChipText}</span>
          </div>
          <div style={{ marginTop: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: '700', color: '#4A4266' }}>
              <span>LRS annual limit</span>
              <span>{v.lrsUsed}</span>
            </div>
            <div style={{ height: '10px', borderRadius: '5px', background: '#EFEBF8', marginTop: '7px', overflow: 'hidden' }}>
              <div style={css(v.lrsBarStyle)} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '6px' }}>{v.lrsHeadroom}</div>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F0EDF7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: '700', color: '#4A4266' }}>
              <span>TCS threshold {v.thresholdText}</span>
              <span style={css(v.thresholdStateStyle)}>{v.thresholdState}</span>
            </div>
            <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: '#EFEBF8', marginTop: '7px' }}>
              <div style={css(v.thresholdBar)} />
              <div style={css(v.thresholdMarker)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '6px' }}>
              <span>{v.thresholdLeft}</span>
              <span>{v.thresholdRight}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: '1', background: '#FFFFFF', borderRadius: '22px', padding: '14px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
              TCS collected
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.02em' }}>{v.tcsCollected}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '3px' }}>{v.tcsCollectedNote}</div>
          </div>
          <div style={{ flex: '1', background: '#FFFFFF', borderRadius: '22px', padding: '14px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
              {v.avoidLabel}
            </div>
            <div style={css(v.avoidStyle)}>{v.avoidAmount}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '3px' }}>{v.avoidNote}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>TCS by purpose code</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.rulesFrom}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '16px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 48px', gap: '10px', paddingBottom: '9px', borderBottom: '1px solid #F0EDF7' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE' }}>Purpose</span>
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE', textAlign: 'right' }}>
              Rate
            </span>
            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE', textAlign: 'right' }}>
              Above
            </span>
          </div>
          {(v.purposeRows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620' }}>{item.name}</div>
                <div style={css(item.noteStyle)}>{item.note}</div>
              </div>
              <span style={css(item.rateStyle)}>{item.rate}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', textAlign: 'right' }}>{item.above}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Compliance checklist</span>
          <span style={css(v.checklistChip)}>{v.checklistStatus}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.checklist || []).map((item: any, i: number) => (
            <div key={i} onClick={item.onTap} style={css(item.rowStyle)}>
              {item.ok ? (
                <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#ABE39E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#22401B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : null}
              {item.warn ? (
                <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#FDE7E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4.5v7" stroke="#C4342C" strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="10" cy="15" r="1.2" fill="#C4342C" />
                  </svg>
                </span>
              ) : null}
              {item.clock ? (
                <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#F3EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="6.5" stroke="#6B36F0" strokeWidth="2" />
                    <path d="M10 6.8V10l2.4 1.8" stroke="#6B36F0" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              ) : null}
              {item.doc ? (
                <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#F3EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <rect x="4" y="4.5" width="12" height="11" rx="2.5" stroke="#6B36F0" strokeWidth="1.9" />
                    <path d="M4 8h12" stroke="#6B36F0" strokeWidth="1.9" />
                  </svg>
                </span>
              ) : null}
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.title}</div>
                <div style={css(item.noteStyle)}>{item.note}</div>
              </div>
              {item.actionText ? (
                <span onClick={item.onAction} style={css(item.actionStyle)}>{item.actionText}</span>
              ) : null}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Remittances</span>
          <span onClick={v.openRemitSheet} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>+ Log one</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '6px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {v.noRemittances ? (
            <div style={{ padding: '18px 0', fontSize: '13px', fontWeight: '600', color: '#7C7893', textAlign: 'center', textWrap: 'pretty' }}>
              No remittances logged in {v.financialYear}. Log each transfer from India so Sentry can track your LRS limit and TCS.
            </div>
          ) : null}
          {(v.remittanceRows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <div style={{ minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893' }}>{item.details}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{item.amount}</div>
                  <div style={css(item.tcsStyle)}>{item.tcsText}</div>
                </div>
                <div onClick={item.remove} aria-label="Delete remittance" style={css(item.deleteStyle)}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div onClick={v.goRemit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#1B1233', borderRadius: '20px', padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFFFFF' }}>Plan the next transfer</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#B7B0CE', marginTop: '2px' }}>Timing advisor · FX + TCS aware</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M8 5l5 5-5 5" stroke="#C9B4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
