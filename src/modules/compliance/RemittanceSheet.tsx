/* ============================================================================
   Sentry · Log-a-remittance sheet                              (owner: Alen)
   ============================================================================ */

import { formatPercent, formatRupees, parseIsoDate, startOfToday, toIsoDate } from '../../shared/dates';
import { setFormValue, showFormError } from '../../app/forms';
import { choiceChips, css, STYLE, type ViewProps } from '../../app/styles';
import { Store } from '../../data/store';
import { financialYearOf, previewTcs, REMITTANCE_PURPOSES, runComplianceCheck } from './compliance';
import { RUPEES_PER_USD } from '../transfer-timing/currency';

// ── START: Log a remittance ────────────────────────────────────────────────
export function remittanceForm(app, values) {
  var summary = app.summary;
  var amount = Number(values.amountInr) || 0;
  var purpose = values.purpose || 'education';
  var isEducation = purpose === 'education';
  var paidByLoan = isEducation && values.loanFunded !== false;
  var isValid = amount > 0 && !!values.date;

  var preview = [{ label: 'TCS collected on this', value: '—', style: STYLE.valueText }];
  if (amount > 0) {
    var yearOfTransfer = financialYearOf(parseIsoDate(values.date || toIsoDate(summary.today)));
    var yearCheck = runComplianceCheck(summary.data.remittances, yearOfTransfer, { loanLetter: summary.hasLoanLetter });
    var tcs = previewTcs(yearCheck, amount, purpose, paidByLoan, summary.hasLoanLetter);
    preview = [
      { label: 'TCS collected on this', value: tcs.tcs ? formatRupees(tcs.tcs) + ' · ' + formatPercent(tcs.rate * 100) : 'None', style: tcs.tcs ? STYLE.valueTextRed : STYLE.valueTextGreen },
      { label: yearOfTransfer + ' total after', value: formatRupees(yearCheck.totalInr + amount), style: STYLE.valueText },
      { label: 'LRS limit used after', value: formatPercent((yearCheck.totalUsd + amount / RUPEES_PER_USD) / yearCheck.rules.lrsLimitUsd * 100), style: STYLE.valueText }
    ];
  }

  return {
    isValid: isValid,
    buttonText: isValid ? 'Log ' + formatRupees(amount) : 'Enter the amount and date',
    bindings: {
      remitPreview: preview,
      remitIsEducation: isEducation,
      purposeOptions: choiceChips(REMITTANCE_PURPOSES.map(function (item) { return { value: item.id, label: item.label }; }), purpose, function (id) { setFormValue(app, 'purpose', id); }),
      loanFundedOptions: choiceChips([{ value: true, label: 'Yes, loan' }, { value: false, label: 'No, own funds' }], values.loanFunded !== false, function (value) { setFormValue(app, 'loanFunded', value); })
    },
    save: function () {
      if (!isValid) return showFormError(app, 'Enter the rupee amount and the date it left India.');
      if (parseIsoDate(values.date) > startOfToday()) return showFormError(app, 'Log remittances once they’ve been sent (date can’t be in the future).');
      var items = (Store.read('remits') || {}).items || [];
      items = items.concat([{
        id: Store.newId(), date: values.date, amountInr: Math.round(amount), purpose: purpose, loanFunded: paidByLoan,
        usdRate: RUPEES_PER_USD, a2: true, in26as: false, bank: String(values.bank || '').trim(), note: String(values.note || '').trim()
      }]);
      Store.save('remits', { items: items });
      app.reloadData();
      app.update({ form: null, screen: 'comply' });
      app.toast('Remittance logged · compliance re-checked');
    }
  };
}
// ── END: Log a remittance ──────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function RemittanceSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeForm} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Log remittance</span>
          <span onClick={v.closeForm} aria-label="Close" style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Amount sent from India (₹)
          </div>
          <input type="number" inputMode="decimal" placeholder="600000" value={v.form.amountInr} onChange={v.formSet.amountInr} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Date
          </div>
          <input type="date" placeholder="" value={v.form.date} onChange={v.formSet.date} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Purpose
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.purposeOptions || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
            ))}
          </div>
          {v.remitIsEducation ? (
            <>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
                Paid from an education loan?
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {(v.loanFundedOptions || []).map((item: any, i: number) => (
                  <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
                ))}
              </div>
            </>
          ) : null}
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Bank
          </div>
          <input type="text" placeholder="HDFC Bank" value={v.form.bank} onChange={v.formSet.bank} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Note (optional)
          </div>
          <input type="text" placeholder="Tuition — Year 2" value={v.form.note} onChange={v.formSet.note} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(v.remitPreview || []).map((row: any, i: number) => (
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
        <div onClick={v.saveRemit} style={css(v.formButtonStyle)}>{v.formButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
