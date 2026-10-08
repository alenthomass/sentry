/* ============================================================================
   Sentry · EMI scheduler                                     (owner: Adeeth)
   Total outstanding, moratorium notices, upcoming payments and the full
   schedule of the selected loan.
   ============================================================================ */

import { formatDayMonth, formatFullDate, formatMonthYear, formatRupees, formatRupeesShort, MONTH_NAMES, parseIsoDate, pluralize } from '../../shared/dates';
import { sumOf } from '../../shared/maths';
import { barStyle, chipStyle, css, rowStyle, STYLE, TONES, type ViewProps } from '../../app/styles';
import { twoTapDelete } from '../../app/ui-state';
import { Store } from '../../data/store';

// ── START: Selected loan card ──────────────────────────────────────────────
export function selectedLoanCard(app, loan) {
  var ui = app.ui;
  var status = loan.status;
  var today = app.summary.today;
  var rows = ui.showFullSchedule ? status.upcoming : status.upcoming.slice(0, 3);
  var lastRow = status.schedule.rows[status.schedule.rows.length - 1];
  var paidMonths = Object.keys(loan.payments || {}).sort();
  var lastPayment = paidMonths.length ? loan.payments[paidMonths[paidMonths.length - 1]] : null;

  var state = { label: 'Repaying', tone: TONES.green };
  if (!status.upcoming.length) state = { label: 'Closed', tone: TONES.green };
  else if (status.inMoratorium) state = { label: 'Moratorium', tone: TONES.purple };

  var removeControl = twoTapDelete(app, 'loan:' + loan.id, null, function () {
    var saved = (Store.read('loans') || {}).items || [];
    Store.save('loans', { items: saved.filter(function (item) { return item.id !== loan.id; }) });
    app.update({ selectedLoan: 0 });
    app.reloadData();
    app.toast(loan.name + ' removed');
  });

  return {
    name: loan.name,
    terms: formatRupees(loan.principal) + ' · ' + loan.rate + '% · ' + loan.tenure + ' months',
    status: state.label,
    statusStyle: chipStyle(state.tone),
    barStyle: barStyle(Math.max(2, status.progress * 100), status.inMoratorium ? '#8552FF' : '#ABE39E', 4),
    repaid: formatRupees(status.principalRepaid) + ' repaid',
    outstanding: formatRupees(status.outstanding) + ' outstanding',
    hasPaid: !!lastPayment,
    lastPaid: lastPayment ? 'Last EMI ' + formatRupees(lastPayment.amount) + ' paid ' + formatDayMonth(parseIsoDate(lastPayment.date)) +
      ' · auto-matched from ' + lastPayment.bankName + ' (' + pluralize(paidMonths.length, 'payment') + ' matched)' : '',
    tableTitle: ui.showFullSchedule ? 'Full schedule · ' + pluralize(status.upcoming.length, 'instalment') : 'Amortization · next ' + rows.length + ' instalments',
    scheduleToggleText: ui.showFullSchedule ? 'Show less' : 'Full schedule',
    toggleSchedule: function () { app.update({ showFullSchedule: !ui.showFullSchedule }); },
    rows: rows.map(function (row, index) {
      var otherYear = row.date.getFullYear() !== today.getFullYear();
      return {
        due: formatDayMonth(row.date) + (otherYear ? ' ' + String(row.date.getFullYear()).slice(2) : ''),
        principal: formatRupees(row.principal),
        interest: formatRupees(row.interest),
        balance: formatRupeesShort(row.balance),
        principalStyle: 'font-size:12px;font-weight:600;text-align:right;color:' + (row.principal > 0 ? '#4E8A41' : '#7C7893'),
        rowStyle: rowStyle(index, rows.length, 'display:grid;grid-template-columns:1fr auto auto auto;gap:10px;padding:10px 0')
      };
    }),
    emi: formatRupees(status.schedule.emi),
    totalInterest: formatRupeesShort(status.schedule.totalInterest),
    ends: lastRow ? formatMonthYear(lastRow.date) : '—',
    removeLabel: removeControl.armed ? 'Tap again to remove this loan' : 'Remove loan',
    removeStyle: 'margin-top:14px;text-align:center;font-size:12px;font-weight:' + (removeControl.armed ? '800' : '700') + ';color:#C4342C;cursor:pointer',
    remove: removeControl.press
  };
}
// ── END: Selected loan card ────────────────────────────────────────────────


// ── START: Loans screen ────────────────────────────────────────────────────
export function loansScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var loans = summary.loans;
  var selectedIndex = Math.min(app.ui.selectedLoan, Math.max(0, loans.length - 1));
  var upcoming = summary.upcomingPayments.slice(0, 4);
  var next = summary.nextPayment;
  var outstanding = sumOf(loans.map(function (loan) { return loan.status.outstanding; }));

  function selectLoan(index) {
    app.update({ selectedLoan: index, showFullSchedule: false, armedDelete: null });
  }

  return {
    hasLoans: loans.length > 0,
    noLoans: loans.length === 0,
    emiOutstandingLabel: 'Outstanding across ' + pluralize(loans.length, 'loan'),
    emiOutstanding: formatRupees(outstanding),
    emiOutstandingLocal: money.fromRupees(outstanding),
    emiNextLabel: next ? 'next payment ' + formatDayMonth(next.date) : 'no payments due',
    emiRepaid: formatRupees(sumOf(loans.map(function (loan) { return loan.status.principalRepaid; }))),
    emiSanctioned: formatRupees(sumOf(loans.map(function (loan) { return +loan.principal; }))),

    moratoriumNotes: loans.filter(function (loan) { return loan.status.inMoratorium; }).map(function (loan) {
      var schedule = loan.status.schedule;
      return {
        title: 'Moratorium active until ' + formatMonthYear(schedule.moratoriumEnd),
        body: 'On ' + loan.name + (loan.mode === 'accrue' ? ' interest is being added to the loan.' : ' only simple interest is billed now.') +
          ' Full EMI of ' + formatRupees(schedule.emi) + ' starts ' + formatFullDate(schedule.repaymentStart) + '.'
      };
    }),

    upcomingLabel: 'Next ' + upcoming.length,
    upcomingRows: upcoming.map(function (payment, index) {
      var note = payment.phase === 'moratorium' ? 'Interest only · moratorium' : payment.phase === 'accrue' ? 'Interest added to loan' : 'Principal + interest';
      return {
        day: payment.date.getDate(),
        month: MONTH_NAMES[payment.date.getMonth()],
        loanName: payment.loan.name,
        note: note,
        noteStyle: 'font-size:11px;font-weight:600;color:' + (payment.phase === 'repay' ? '#7C7893' : '#6B36F0'),
        amount: formatRupees(payment.pay),
        amountInLocal: money.fromRupees(payment.pay),
        select: function () { selectLoan(loans.indexOf(payment.loan)); },
        rowStyle: rowStyle(index, upcoming.length, 'display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:12px 0;cursor:pointer')
      };
    }),

    loanPills: loans.map(function (loan, index) {
      return { name: loan.name, pillStyle: index === selectedIndex ? STYLE.pillSelected : STYLE.pill, select: function () { selectLoan(index); } };
    }),
    selectedLoan: loans.length ? [selectedLoanCard(app, loans[selectedIndex])] : []
  };
}
// ── END: Loans screen ──────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function LoansView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="EMI Scheduler">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>EMI Scheduler</span>
        <div onClick={v.openLoanSheet} aria-label="Add loan" style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M10 5v10M5 10h10" stroke="#0B0620" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {v.noLoans ? (
          <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '22px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', textAlign: 'center' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#F3EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5.5" width="14" height="10" rx="3" stroke="#6B36F0" strokeWidth="1.7" />
                <path d="M13 10.5h2" stroke="#6B36F0" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620', marginTop: '12px' }}>No education loans yet</div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#7C7893', marginTop: '4px', textWrap: 'pretty' }}>
              Add your loan to see every instalment, the moratorium step-up and what is left to repay.
            </div>
            <div onClick={v.openLoanSheet} style={{ marginTop: '16px', textAlign: 'center', padding: '14px', borderRadius: '999px', background: '#8552FF', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
              Add a loan
            </div>
          </div>
        ) : null}
        {v.hasLoans ? (
          <>
            <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
                {v.emiOutstandingLabel}
              </div>
              <div style={{ fontSize: '30px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.03em' }}>{v.emiOutstanding}</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>≈ {v.emiOutstandingLocal} · {v.emiNextLabel}</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <div style={{ flex: '1', background: '#F7F5FD', borderRadius: '16px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Repaid to date</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.emiRepaid}</div>
                </div>
                <div style={{ flex: '1', background: '#F7F5FD', borderRadius: '16px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Sanctioned</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.emiSanctioned}</div>
                </div>
              </div>
            </div>
            {(v.moratoriumNotes || []).map((item: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#F3EDFF', border: '1.5px solid #DCCCFF', borderRadius: '18px', padding: '14px 16px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '10px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="6.5" stroke="#6B36F0" strokeWidth="2" />
                    <path d="M10 6.8V10l2.4 1.8" stroke="#6B36F0" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div style={{ flex: '1', minWidth: '0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#2B1A55' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#5B4B85', marginTop: '2px', textWrap: 'pretty' }}>{item.body}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Upcoming payments</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.upcomingLabel}</span>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '16px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '12px', paddingBottom: '9px', borderBottom: '1px solid #F0EDF7' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE' }}>Date</span>
                <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE' }}>Loan</span>
                <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE', textAlign: 'right' }}>
                  Amount
                </span>
              </div>
              {(v.upcomingRows || []).map((item: any, i: number) => (
                <div key={i} onClick={item.select} style={css(item.rowStyle)}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620' }}>{item.day}</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{item.month}</div>
                  </div>
                  <div style={{ minWidth: '0' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620' }}>{item.loanName}</div>
                    <div style={css(item.noteStyle)}>{item.note}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{item.amount}</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{item.amountInLocal}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {(v.loanPills || []).map((item: any, i: number) => (
                <span key={i} onClick={item.select} style={css(item.pillStyle)}>{item.name}</span>
              ))}
            </div>
            {(v.selectedLoan || []).map((loan: any, i: number) => (
              <div key={i} style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0B0620' }}>{loan.name}</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{loan.terms}</div>
                  </div>
                  <span style={css(loan.statusStyle)}>{loan.status}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: '#EFEBF8', marginTop: '14px', overflow: 'hidden' }}>
                  <div style={css(loan.barStyle)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '6px' }}>
                  <span>{loan.repaid}</span>
                  <span>{loan.outstanding}</span>
                </div>
                {loan.hasPaid ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '10px 12px', borderRadius: '14px', background: '#EAF7E6' }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#4E8A41" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#2F5E24', textWrap: 'pretty' }}>{loan.lastPaid}</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A95AE' }}>
                    {loan.tableTitle}
                  </div>
                  <span onClick={loan.toggleSchedule} style={{ fontSize: '12px', fontWeight: '700', color: '#8552FF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {loan.scheduleToggleText}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '10px', marginTop: '10px', paddingBottom: '8px', borderBottom: '1px solid #F0EDF7' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#9A95AE' }}>Due</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#9A95AE', textAlign: 'right' }}>Principal</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#9A95AE', textAlign: 'right' }}>Interest</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#9A95AE', textAlign: 'right' }}>Balance</span>
                </div>
                {(loan.rows || []).map((row: any, i: number) => (
                  <div key={i} style={css(row.rowStyle)}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>{row.due}</span>
                    <span style={css(row.principalStyle)}>{row.principal}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#0B0620', textAlign: 'right' }}>{row.interest}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', textAlign: 'right' }}>{row.balance}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F0EDF7' }}>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Full EMI</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{loan.emi}</div>
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Total interest</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{loan.totalInterest}</div>
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Ends</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{loan.ends}</div>
                  </div>
                </div>
                <div onClick={loan.remove} style={css(loan.removeStyle)}>{loan.removeLabel}</div>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
