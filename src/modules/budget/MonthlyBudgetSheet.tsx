/* ============================================================================
   Sentry · Monthly spend sheet                                (owner: Adeeth)
   Changing the monthly total rescales every category in proportion.
   ============================================================================ */

import { MONTH_NAMES_LONG } from '../../shared/dates';
import { choiceChips, css, STYLE, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';
import { defaultMonthlyBudget, findCategory, rescaleBudgets, splitBudget } from './budget';

// ── START: Monthly spend ───────────────────────────────────────────────────
export function monthlyBudgetSheet(app) {
  var summary = app.summary;
  var money = app.money;
  var profile = app.profile;
  var sheet = app.ui.monthlyBudget;
  var typed = sheet ? sheet.input : '';
  var amount = Math.max(0, Number(typed) || 0);
  var isValid = amount > 0;
  var defaultAmount = defaultMonthlyBudget(money.code);
  var groceryShare = summary.totalBudget ? (profile.budgets.grocery || 0) / summary.totalBudget : findCategory('grocery').share;
  var presets = [0.8, 1, 1.2, 1.4].map(function (factor) { return Math.round(defaultAmount * factor / 25) * 25; });

  function setInput(value) {
    app.update({ monthlyBudget: { input: value } });
  }

  return {
    budgetSheetOpen: !!sheet,
    openBudgetSheet: function () { app.update(Object.assign({}, CLOSED_OVERLAYS, { monthlyBudget: { input: String(Math.round(summary.totalBudget)) } })); },
    closeBudgetSheet: function () { app.update({ monthlyBudget: null }); },
    budgetMonthLabel: 'Total for ' + MONTH_NAMES_LONG[summary.today.getMonth()],
    budgetInput: typed,
    budgetPlaceholder: String(defaultAmount),
    setBudgetInput: function (event) { setInput(event.target.value); },
    budgetUp: function () { setInput(String(Math.round(amount + 50))); },
    budgetDown: function () { setInput(String(Math.max(0, Math.round(amount - 50)))); },
    budgetPresets: choiceChips(presets.map(function (value) { return { value: value, label: money.symbol + value.toLocaleString('en-GB') }; }), Math.round(amount), function (value) { setInput(String(value)); }),
    budgetPreviewInr: isValid ? money.inRupees(amount) : '—',
    budgetPreviewUsed: isValid ? Math.round(summary.totalSpent / amount * 100) + '% of it used' : '—',
    budgetPreviewStyle: 'font-size:13px;font-weight:800;color:' + (isValid && summary.totalSpent / amount > 0.9 ? '#C4342C' : '#0B0620'),
    budgetPreviewCatName: findCategory('grocery').name,
    budgetPreviewCat: isValid ? money.whole(amount * groceryShare) : '—',
    budgetDefault: money.whole(defaultAmount),
    budgetButtonText: isValid ? 'Save ' + money.whole(amount) + ' monthly' : 'Enter a monthly amount',
    budgetButtonStyle: isValid ? STYLE.buttonEnabled : STYLE.buttonDisabled,
    saveBudget: function () {
      if (!isValid) return;
      app.saveProfile({ budgets: rescaleBudgets(profile.budgets, Math.round(amount)), budgetCurrency: money.code });
      app.update({ monthlyBudget: null });
      app.toast('Monthly spend set to ' + money.whole(amount) + ' · categories rescaled');
    },
    resetBudget: function () {
      app.saveProfile({ budgets: splitBudget(defaultAmount), budgetCurrency: money.code });
      app.update({ monthlyBudget: null });
      app.toast('Monthly spend reset to the default plan');
    }
  };
}
// ── END: Monthly spend ─────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function MonthlyBudgetSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeBudgetSheet} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Monthly spend</span>
          <span onClick={v.closeBudgetSheet} style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M6 6l8 8M14 6l-8 8" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '12px', textWrap: 'pretty' }}>
            Set what you plan to spend each month. Every category budget scales in proportion, so your split stays intact.
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            {v.budgetMonthLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '6px 8px 6px 18px', borderRadius: '999px', border: '1.5px solid #E6E1F1', background: '#FFFFFF' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620' }}>{v.curSym}</span>
            <input type="number" min="0" step="25" inputMode="decimal" placeholder={v.budgetPlaceholder} value={v.budgetInput} onChange={v.setBudgetInput} style={{ flex: '1', minWidth: '0', border: '0', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '20px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.02em', padding: '10px 0' }} />
            <span onClick={v.budgetDown} style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0' }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M5 10h10" stroke="#4A4266" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span onClick={v.budgetUp} style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0' }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M10 5v10M5 10h10" stroke="#4A4266" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Quick set
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.budgetPresets || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
            ))}
          </div>
          <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>In home currency</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0B0620' }}>{v.budgetPreviewInr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>Spent so far this month</span>
              <span style={css(v.budgetPreviewStyle)}>{v.budgetPreviewUsed}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>{v.budgetPreviewCatName} budget</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0B0620' }}>{v.budgetPreviewCat}</span>
            </div>
          </div>
          <div onClick={v.resetBudget} style={{ marginTop: '14px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#8552FF', cursor: 'pointer' }}>
            Reset to {v.budgetDefault} default
          </div>
        </div>
        <div onClick={v.saveBudget} style={css(v.budgetButtonStyle)}>{v.budgetButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
