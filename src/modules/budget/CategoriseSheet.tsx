/* ============================================================================
   Sentry · Categorise sheet                                   (owner: Adeeth)
   Opens when an expense is tapped. "Always use this for …" saves a rule so
   that shop's other payments, and future syncs, are filed the same way.
   ============================================================================ */

import { formatFullDate, parseIsoDate, pluralize } from '../../shared/dates';
import { css, STYLE, switchKnobStyle, switchTrackStyle, type ViewProps } from '../../app/styles';
import { Store } from '../../data/store';
import { changeExpenseCategory } from '../banking/importer';
import { amountInCurrency, findCategory } from './budget';

// ── START: Categorise ──────────────────────────────────────────────────────
export function findExpense(ledgers, expenseId) {
  var found = null;
  Object.keys(ledgers).some(function (month) {
    found = ledgers[month].filter(function (expense) { return expense.id === expenseId; })[0] || null;
    return !!found;
  });
  return found;
}

export function categoriseSheet(app) {
  var summary = app.summary;
  var money = app.money;
  var sheet = app.ui.categorise;
  var expense = sheet ? findExpense(summary.data.ledgers, sheet.expenseId) : null;
  var chosen = sheet ? findCategory(sheet.categoryId) : null;
  var amount = expense ? amountInCurrency(expense, money.code, app.profile.rateOverrides) : 0;
  var sameShopCount = expense && expense.merchant ? summary.expenses.filter(function (item) { return item.merchant === expense.merchant; }).length : 0;
  var applyToShop = !!(sheet && sheet.applyToMerchant);

  function change(changes) {
    app.update(function (current) { return { categorise: Object.assign({}, current.categorise, changes) }; });
  }

  function save() {
    if (!expense || !chosen) return;
    var useRule = applyToShop && !!expense.merchant;
    var before = summary.data.ledgers;
    var after = changeExpenseCategory(before, expense.id, chosen.id, expense.merchant, useRule);
    var changedCount = 0;
    Object.keys(after).forEach(function (month) {
      var changedHere = after[month].filter(function (item, index) {
        return item.cat !== before[month][index].cat || item.needsReview !== before[month][index].needsReview;
      }).length;
      if (!changedHere) return;
      changedCount += changedHere;
      Store.save('ledger-' + month, { txns: after[month] });
    });
    if (useRule) {
      var rules = Object.assign({}, app.profile.categoryRules || {});
      rules[expense.merchant] = chosen.id;
      app.saveProfile({ categoryRules: rules });
    } else {
      app.reloadData();
    }
    app.update({ categorise: null });
    app.toast('Filed under ' + chosen.name + (changedCount > 1 ? ' · ' + changedCount + ' payments updated' : '') + (useRule ? ' · rule saved' : ''));
  }

  var reasonText = '';
  if (expense) {
    reasonText = expense.reason
      ? expense.reason + (expense.confidence != null && expense.confidence < 1 ? ' · ' + Math.round(expense.confidence * 100) + '% sure' : '')
      : 'Category chosen when you added it';
  }

  return {
    categoriseOpen: !!(sheet && expense),
    closeCategorise: function () { app.update({ categorise: null }); },
    categoriseTitle: expense ? expense.note || (chosen || {}).name : '',
    categoriseAmount: expense ? money.exact(amount) : '',
    categoriseDetails: expense ? formatFullDate(parseIsoDate(expense.date)) + ' · ' + (expense.bankName ? expense.bankName + ' card' : 'Added by you') + (expense.merchantCode ? ' · MCC ' + expense.merchantCode : '') : '',
    categoriseReason: reasonText,
    categoriseReasonStyle: 'font-size:11px;font-weight:700;margin-top:8px;color:' + (expense && expense.needsReview ? '#9A5B00' : '#6B36F0'),
    categoriseChips: summary.categories.map(function (category) {
      return { name: category.name, chipStyle: chosen && chosen.id === category.id ? STYLE.chipSelected : STYLE.chip, select: function () { change({ categoryId: category.id }); } };
    }),
    categoriseHasMerchant: !!(expense && expense.merchant),
    categoriseMerchant: expense ? expense.note : '',
    alwaysUseNote: sameShopCount > 1 ? 'Also refiles ' + pluralize(sameShopCount - 1, 'other payment') + ' this month and future syncs' : 'Future payments here are filed automatically',
    toggleAlwaysUse: function () { change({ applyToMerchant: !applyToShop }); },
    alwaysUseTrackStyle: switchTrackStyle(applyToShop),
    alwaysUseKnobStyle: switchKnobStyle(applyToShop),
    categoriseButtonText: chosen ? 'File under ' + chosen.name : 'Pick a category',
    categoriseButtonStyle: chosen ? STYLE.buttonEnabled : STYLE.buttonDisabled,
    saveCategory: save
  };
}
// ── END: Categorise ────────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function CategoriseSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeCategorise} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>Categorise</span>
          <span onClick={v.closeCategorise} aria-label="Close" style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.categoriseTitle}
              </span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', flexShrink: '0' }}>{v.categoriseAmount}</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '4px' }}>{v.categoriseDetails}</div>
            <div style={css(v.categoriseReasonStyle)}>{v.categoriseReason}</div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
            Category
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(v.categoriseChips || []).map((item: any, i: number) => (
              <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.name}</span>
            ))}
          </div>
          {v.categoriseHasMerchant ? (
            <div onClick={v.toggleAlwaysUse} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px', padding: '14px 16px', borderRadius: '18px', border: '1.5px solid #E6E1F1', cursor: 'pointer' }}>
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Always use this for {v.categoriseMerchant}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.alwaysUseNote}</div>
              </div>
              <span style={css(v.alwaysUseTrackStyle)}>
                <span style={css(v.alwaysUseKnobStyle)} />
              </span>
            </div>
          ) : null}
        </div>
        <div onClick={v.saveCategory} style={css(v.categoriseButtonStyle)}>{v.categoriseButtonText}</div>
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
