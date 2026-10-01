/* ============================================================================
   Sentry · Add-a-loan sheet                                  (owner: Adeeth)
   ============================================================================ */

import { formatFullDate, formatRupees } from '../../shared/dates';
import { setFormValue, showFormError } from '../../app/forms';
import { choiceChips, css, STYLE, type ViewProps } from '../../app/styles';
import { Store } from '../../data/store';
import { buildLoanSchedule } from './loans';

// ── START: Add a loan ──────────────────────────────────────────────────────
export function loanForm(app, values) {
  var loan = {
    principal: Number(values.principal) || 0,
    rate: Number(values.rate) || 0,
    tenure: Math.round(Number(values.tenure) || 0),
    disbursed: values.disbursed,
    moratoriumEnd: values.moratoriumEnd || null,
    mode: values.mode || 'simple'
  };
  var isValid = !!(values.name && values.name.trim()) && loan.principal > 0 && loan.rate >= 0 && loan.rate < 40 &&
    loan.tenure > 0 && loan.tenure <= 360 && !!loan.disbursed && (!loan.moratoriumEnd || loan.moratoriumEnd > loan.disbursed);

  var preview = [{ label: 'Full EMI', value: '—', style: STYLE.valueTextLarge }];
  if (loan.principal > 0 && loan.tenure > 0 && loan.disbursed) {
    var schedule = buildLoanSchedule(loan);
    preview = [
      { label: 'Full EMI', value: formatRupees(schedule.emi), style: STYLE.valueTextLarge },
      { label: 'Repayment starts', value: formatFullDate(schedule.repaymentStart), style: STYLE.valueText },
      { label: 'Total interest', value: formatRupees(schedule.totalInterest), style: STYLE.valueText }
    ];
  }

  return {
    isValid: isValid,
    buttonText: isValid ? 'Add ' + values.name.trim() : 'Fill in the loan details',
    bindings: {
      loanPreview: preview,
      loanModeOptions: choiceChips([{ value: 'simple', label: 'Paid monthly' }, { value: 'accrue', label: 'Added to loan' }], loan.mode, function (mode) { setFormValue(app, 'mode', mode); })
    },
    save: function () {
      if (!isValid) return showFormError(app, 'Check the amount, rate (0–40%), tenure (1–360 months) and dates.');
      var items = (Store.read('loans') || {}).items || [];
      var newLoan = Object.assign({ id: Store.newId(), name: values.name.trim() }, loan);
      Store.save('loans', { items: items.concat([newLoan]) });
      app.reloadData();
      app.update({ form: null, selectedLoan: items.length, screen: 'emi' });
      app.toast(newLoan.name + ' added · schedule built');
    }
  };
}
// ── END: Add a loan ────────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function LoanSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeForm} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Add education loan</span>
          <span onClick={v.closeForm} aria-label="Close" style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Lender
          </div>
          <input type="text" placeholder="HDFC Credila" value={v.form.name} onChange={v.formSet.name} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Sanctioned amount (₹)
          </div>
          <input type="number" inputMode="decimal" placeholder="1400000" value={v.form.principal} onChange={v.formSet.principal} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
                Interest % a year
              </div>
              <input type="number" inputMode="decimal" placeholder="10.25" value={v.form.rate} onChange={v.formSet.rate} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
                Tenure (months)
              </div>
              <input type="number" inputMode="numeric" placeholder="84" value={v.form.tenure} onChange={v.formSet.tenure} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            First disbursement
          </div>
          <input type="date" placeholder="" value={v.form.disbursed} onChange={v.formSet.disbursed} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Moratorium ends (optional)
          </div>
          <input type="date" placeholder="" value={v.form.moratoriumEnd} onChange={v.formSet.moratoriumEnd} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Interest during moratorium
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.loanModeOptions || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
            ))}
          </div>
          <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(v.loanPreview || []).map((row: any, i: number) => (
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
        <div onClick={v.saveLoan} style={css(v.formButtonStyle)}>{v.formButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
