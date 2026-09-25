/* ============================================================================
   Sentry · Transfer amount sheet                               (owner: Alen)
   ============================================================================ */

import { formatRupees } from '../../shared/dates';
import { setFormValue } from '../../app/forms';
import { choiceChips, css, STYLE, type ViewProps } from '../../app/styles';
import { previewTcs } from '../compliance/compliance';

// ── START: Transfer amount ─────────────────────────────────────────────────
export function transferForm(app, values) {
  var summary = app.summary;
  var money = app.money;
  var amount = Number(values.amount) || 0;
  var isValid = amount > 0;
  var usual = money.country.usualTransfer;
  var presets = [0.5, 1, 1.5, 2].map(function (factor) { return Math.round(usual * factor / 50) * 50; });
  var tcs = previewTcs(summary.compliance, amount * money.rate, 'education', summary.fundedByLoan, summary.hasLoanLetter).tcs;

  return {
    isValid: isValid,
    buttonText: isValid ? 'Compare ' + money.whole(amount) : 'Enter an amount',
    bindings: {
      transferPresets: choiceChips(presets.map(function (value) { return { value: value, label: money.symbol + value.toLocaleString('en-GB') }; }), Math.round(amount), function (value) { setFormValue(app, 'amount', String(value)); }),
      transferPreview: isValid ? [
        { label: 'Costs today (with fee)', value: formatRupees((amount + money.country.transferFee) * money.rate), style: STYLE.valueTextLarge },
        { label: 'TCS upfront', value: formatRupees(tcs), style: STYLE.valueText }
      ] : [{ label: 'Costs today (with fee)', value: '—', style: STYLE.valueTextLarge }]
    },
    save: function () {
      if (!isValid) return;
      app.saveProfile({ transferAmount: Math.round(amount), scheduledTransfer: null });
      app.update({ form: null });
      app.toast('Advisor re-run for ' + money.whole(amount));
    }
  };
}
// ── END: Transfer amount ───────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function TransferSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeForm} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Transfer amount</span>
          <span onClick={v.closeForm} aria-label="Close" style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '12px', textWrap: 'pretty' }}>
            How much you want to land abroad. The advisor compares this amount across the next three weeks.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px', padding: '6px 8px 6px 18px', borderRadius: '999px', border: '1.5px solid #E6E1F1', background: '#FFFFFF' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620' }}>{v.curSym}</span>
            <input type="number" min="0" step="50" inputMode="decimal" placeholder="1200" value={v.form.amount} onChange={v.formSet.amount} style={{ flex: '1', minWidth: '0', border: '0', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '20px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.02em', padding: '10px 0' }} />
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Quick set
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.transferPresets || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
            ))}
          </div>
          <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(v.transferPreview || []).map((row: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>{row.label}</span>
                <span style={css(row.style)}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        {v.formError ? (
          <div style={{ flexShrink: '0', marginTop: '12px', fontSize: '12px', fontWeight: '700', color: '#C4342C', textAlign: 'center' }}>
            {v.formError}
          </div>
        ) : null}
        <div onClick={v.saveTransfer} style={css(v.formButtonStyle)}>{v.formButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
