/* ============================================================================
   Sentry · Add expense sheet (the purple + button)            (owner: Adeeth)
   ============================================================================ */

import { monthKey, startOfToday, toIsoDate } from '../../shared/dates';
import { css, STYLE, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';
import { Store } from '../../data/store';

// ── START: Add expense ─────────────────────────────────────────────────────
export var QUICK_AMOUNTS = [5, 10, 25, 50];

export function addExpenseSheet(app) {
  var summary = app.summary;
  var money = app.money;
  var sheet = app.ui.addExpense;
  var isOpen = !!sheet;
  var state = sheet || { categoryIndex: 1, amountChoice: 1, customAmount: '', note: '' };
  var usingCustom = state.amountChoice === 4;
  var customNumber = Math.max(0, Number(state.customAmount) || 0);
  var amount = usingCustom ? customNumber : QUICK_AMOUNTS[state.amountChoice];
  var hasAmount = amount > 0;
  var category = summary.categories[state.categoryIndex];
  var percentAfter = category.budget ? Math.round((category.spent + amount) / category.budget * 100) : 0;

  function change(changes) {
    app.update(function (current) { return { addExpense: Object.assign({}, current.addExpense, changes) }; });
  }

  function saveExpense() {
    if (!hasAmount) return;
    var documentId = 'ledger-' + monthKey(startOfToday());
    var ledger = Store.read(documentId) || { txns: [] };
    var expense = {
      id: Store.newId(), date: toIsoDate(startOfToday()), cat: category.id, amount: Math.round(amount * 100) / 100,
      cur: money.code, rate: money.rate, note: String(state.note || '').trim()
    };
    Store.save(documentId, { txns: ledger.txns.concat([expense]) });
    app.reloadData();
    app.update({ addExpense: null, screen: 'budget' });
    app.toast('Added ' + money.exact(amount) + ' to ' + category.name);
  }

  var bindings = {
    addExpenseOpen: isOpen,
    openSheet: function () { app.update(Object.assign({}, CLOSED_OVERLAYS, { addExpense: { categoryIndex: 1, amountChoice: 1, customAmount: '', note: '' } })); },
    closeSheet: function () { app.update({ addExpense: null }); },
    addCategoryChips: summary.categories.map(function (item) {
      return { name: item.name, chipStyle: item.index === state.categoryIndex ? STYLE.chipSelected : STYLE.chip, select: function () { change({ categoryIndex: item.index }); } };
    }),
    pickCustomAmount: function () { change({ amountChoice: 4 }); },
    customAmountChipStyle: usingCustom ? STYLE.chipSelected : STYLE.chip,
    isCustom: usingCustom,
    customAmount: state.customAmount,
    setCustomAmount: function (event) { change({ customAmount: event.target.value, amountChoice: 4 }); },
    increaseAmount: function () { change({ customAmount: String(Math.round((customNumber + 5) * 100) / 100), amountChoice: 4 }); },
    decreaseAmount: function () { change({ customAmount: String(Math.max(0, Math.round((customNumber - 5) * 100) / 100)), amountChoice: 4 }); },
    addAmountInRupees: hasAmount ? money.inRupees(amount) : '—',
    addCategoryName: category.name,
    categoryAfterAdding: hasAmount ? money.exact(category.spent + amount) + ' of ' + money.whole(category.budget) + ' (' + percentAfter + '%)' : '—',
    categoryAfterAddingStyle: 'font-size:13px;font-weight:800;color:' + (hasAmount && percentAfter >= 90 ? '#C4342C' : '#0B0620'),
    addButtonText: hasAmount ? 'Add ' + money.exact(amount) + ' to ' + category.name : 'Enter an amount',
    addButtonStyle: hasAmount ? STYLE.buttonEnabled : STYLE.buttonDisabled,
    saveExpense: saveExpense,
    expenseNote: state.note,
    setExpenseNote: function (event) { change({ note: event.target.value }); }
  };

  QUICK_AMOUNTS.forEach(function (value, index) {
    bindings['amountLabel' + index] = money.symbol + value;
    bindings['amountChipStyle' + index] = state.amountChoice === index ? STYLE.chipSelected : STYLE.chip;
    bindings['pickAmount' + index] = function () { change({ amountChoice: index }); };
  });
  return bindings;
}
// ── END: Add expense ───────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function AddExpenseSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeSheet} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Add expense</span>
          <span onClick={v.closeSheet} style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M6 6l8 8M14 6l-8 8" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Category
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.addCategoryChips || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.name}</span>
            ))}
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Amount
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            <span onClick={v.pickAmount0} style={css(v.amountChipStyle0)}>{v.amountLabel0}</span>
            <span onClick={v.pickAmount1} style={css(v.amountChipStyle1)}>{v.amountLabel1}</span>
            <span onClick={v.pickAmount2} style={css(v.amountChipStyle2)}>{v.amountLabel2}</span>
            <span onClick={v.pickAmount3} style={css(v.amountChipStyle3)}>{v.amountLabel3}</span>
            <span onClick={v.pickCustomAmount} style={css(v.customAmountChipStyle)}>Custom</span>
          </div>
          {v.isCustom ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', padding: '6px 8px 6px 18px', borderRadius: '999px', border: '1.5px solid #E6E1F1', background: '#FFFFFF' }}>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620' }}>{v.curSym}</span>
              <input type="number" min="0" step="0.5" inputMode="decimal" placeholder="0.00" value={v.customAmount} onChange={v.setCustomAmount} style={{ flex: '1', minWidth: '0', border: '0', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '20px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.02em', padding: '10px 0' }} />
              <span onClick={v.decreaseAmount} style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0' }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M5 10h10" stroke="#4A4266" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
              <span onClick={v.increaseAmount} style={{ width: '38px', height: '38px', borderRadius: '19px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0' }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M10 5v10M5 10h10" stroke="#4A4266" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          ) : null}
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Note (optional)
          </div>
          <input type="text" placeholder="Tesco, rent, train pass…" value={v.expenseNote} onChange={v.setExpenseNote} style={{ width: '100%', boxSizing: 'border-box', marginTop: '10px', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>Home currency</span>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0B0620' }}>{v.addAmountInRupees}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>{v.addCategoryName} after this</span>
              <span style={css(v.categoryAfterAddingStyle)}>{v.categoryAfterAdding}</span>
            </div>
          </div>
        </div>
        <div onClick={v.saveExpense} style={css(v.addButtonStyle)}>{v.addButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
