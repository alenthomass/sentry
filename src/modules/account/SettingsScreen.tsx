/* ============================================================================
   Sentry · Settings                                   (owner: Alen & Shaheen)
   Alert switches, overspend sensitivity, display options, the CSV export,
   deleting the account and signing out.
   ============================================================================ */

import { formatFullDate, parseIsoDate, startOfToday, toIsoDate } from '../../shared/dates';
import { choiceChips, css, rowStyle, switchKnobStyle, switchTrackStyle, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';
import { Store } from '../../data/store';
import { loadUserData } from '../../data/user-data';
import { amountInCurrency, findCategory } from '../budget/budget';
import { findPurpose } from '../compliance/compliance';

// ── START: Alert switches ──────────────────────────────────────────────────
export var ALERT_SWITCHES = [
  { key: 'overspend', label: 'Overspend alerts', note: 'When a category is forecast to breach budget' },
  { key: 'emi', label: 'EMI reminders', note: 'In the week before each instalment' },
  { key: 'fx', label: 'FX rate alerts', note: 'When the rupee beats its 30-day average' },
  { key: 'deadlines', label: 'Compliance deadlines', note: 'Form 26AS gaps and the ITR due date' }
];
// ── END: Alert switches ────────────────────────────────────────────────────


// ── START: CSV statement ───────────────────────────────────────────────────
export function csvCell(value) {
  var text = String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export async function downloadStatement(summary) {
  var money = summary.money;
  var rows = [['Type', 'Date', 'Category / purpose', 'Note', 'Amount', 'Currency', 'INR', 'TCS (INR)']];
  summary.expenses.forEach(function (expense) {
    var amount = amountInCurrency(expense, money.code, summary.profile.rateOverrides);
    rows.push(['Expense', expense.date, findCategory(expense.cat).name, expense.note || '', amount.toFixed(2), money.code, Math.round(amount * money.rate), '']);
  });
  summary.compliance.items.forEach(function (remittance) {
    rows.push(['Remittance', remittance.date, findPurpose(remittance.purpose).label, remittance.note || '', remittance.amountInr, 'INR', remittance.amountInr, remittance.tcs]);
  });
  var csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\n');
  var fileName = 'sentry-statement-' + toIsoDate(startOfToday()) + '.csv';

  var downloads = null;
  try { downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (error) { downloads = null; }
  if (downloads) return downloads.save({ filename: fileName, data: csv });

  var link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
// ── END: CSV statement ─────────────────────────────────────────────────────


// ── START: Settings screen ─────────────────────────────────────────────────
export function settingsScreen(app) {
  var summary = app.summary;
  var profile = app.profile;
  var alerts = profile.alerts || {};
  var threshold = profile.alertThreshold || 85;
  var confirming = app.ui.confirmAccountDeletion;

  function signedOutState() {
    return Object.assign({ screen: 'login', armedDelete: null, confirmAccountDeletion: false, editingDetails: false, expenseFilter: 'all', categoryGroup: 'all', showAllExpenses: false, selectedLoan: 0 }, CLOSED_OVERLAYS);
  }

  return {
    toggleRows: ALERT_SWITCHES.map(function (item, index) {
      var isOn = !!alerts[item.key];
      return {
        label: item.label,
        note: item.note,
        rowStyle: rowStyle(index, ALERT_SWITCHES.length, 'display:flex;align-items:center;gap:14px;padding:15px 0;cursor:pointer'),
        trackStyle: switchTrackStyle(isOn),
        knobStyle: switchKnobStyle(isOn),
        toggle: function () {
          var next = Object.assign({}, alerts);
          next[item.key] = !isOn;
          app.saveProfile({ alerts: next });
        }
      };
    }),
    thresholdOptions: choiceChips([75, 85, 95].map(function (value) { return { value: value, label: value + '%' }; }), threshold, function (value) { app.saveProfile({ alertThreshold: value }); }),
    thresholdLabel: threshold + '% of budget',
    thresholdNote: 'Sentry warns you once a category is forecast to pass ' + threshold + '% of its budget. Lower is earlier and noisier.',
    rateSourceNote: summary.liveRates ? 'Live ECB reference rate via Frankfurter' : 'Reference rate · ' + formatFullDate(parseIsoDate(summary.ratesAsOf)),
    exportStatement: function () { downloadStatement(summary); },

    deleteLabel: confirming ? 'Tap again to confirm deletion' : 'Delete account',
    deleteStyle: 'font-size:14px;font-weight:' + (confirming ? '800' : '700') + ';color:#C4342C',
    deleteAccount: async function () {
      if (!confirming) {
        app.update({ confirmAccountDeletion: true });
        return app.toast('This removes all your data. Tap again to confirm.');
      }
      await Store.deleteAccount();
      app.setData(loadUserData(null));
      app.update(signedOutState());
      app.toast('Account deleted · you have been signed out');
    },
    signOut: async function () {
      await Store.signOut();
      app.setData(loadUserData(null));
      app.update(Object.assign(signedOutState(), { signIn: { email: '', password: '', error: '', keepSignedIn: true } }));
    }
  };
}
// ── END: Settings screen ───────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function SettingsView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Settings">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 18px 14px' }}>
        <div onClick={v.goAccount} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Settings</span>
        <div style={{ width: '40px' }} />
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Alerts</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.alertsOnCount} on</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.toggleRows || []).map((item: any, i: number) => (
            <div key={i} onClick={item.toggle} style={css(item.rowStyle)}>
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.label}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{item.note}</div>
              </div>
              <span style={css(item.trackStyle)}>
                <span style={css(item.knobStyle)} />
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Overspend sensitivity</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#8552FF' }}>{v.thresholdLabel}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(v.thresholdOptions || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
            ))}
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '12px', textWrap: 'pretty' }}>{v.thresholdNote}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Display</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.curPair}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Primary currency</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>Shown first on every amount</div>
            </div>
            <div style={{ display: 'flex', padding: '3px', borderRadius: '999px', background: '#F3F1FA', flexShrink: '0' }}>
              <span onClick={v.showLocalFirst} style={css(v.localCurrencyStyle)}>{v.curCode}</span>
              <span onClick={v.showRupeesFirst} style={css(v.rupeeCurrencyStyle)}>INR</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '16px', borderTop: '1px solid #F0EDF7' }}>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>FX rate source</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.rateSourceNote}</div>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0B0620', whiteSpace: 'nowrap' }}>{v.rateLine}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Data & privacy</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div onClick={v.exportStatement} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', borderBottom: '1px solid #F0EDF7', cursor: 'pointer' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Export spend & TCS statement</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v9M6.5 9.5L10 13l3.5-3.5M4.5 16h11" stroke="#B9B4CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div onClick={v.goAccount} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', borderBottom: '1px solid #F0EDF7', cursor: 'pointer' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Bank connections</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div onClick={v.deleteAccount} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', cursor: 'pointer' }}>
            <span style={css(v.deleteStyle)}>{v.deleteLabel}</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 5l5 5-5 5" stroke="#F0BEBA" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div onClick={v.signOut} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: '1.5px solid #FBDDDA', background: '#FFFFFF', borderRadius: '999px', padding: '15px', cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <path d="M8 16.5H5a1 1 0 01-1-1v-11a1 1 0 011-1h3" stroke="#C4342C" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 6.5l3.5 3.5L12 13.5M15.5 10H8" stroke="#C4342C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: '800', color: '#C4342C' }}>Log out</span>
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9A95AE', textAlign: 'center' }}>Sentry 1.4.0 · {v.profileEmail}</div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
