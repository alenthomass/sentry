/* ============================================================================
   Sentry · Budget tracker                                    (owner: Adeeth)
   Month total, category list with filters, and the list of expenses.
   ============================================================================ */

import { formatDayMonth, formatFullDate, MONTH_NAMES_LONG, parseIsoDate } from '../../shared/dates';
import { sumOf } from '../../shared/maths';
import { css, rowStyle, STYLE, type ViewProps } from '../../app/styles';
import { twoTapDelete } from '../../app/ui-state';
import { Store } from '../../data/store';
import { amountInCurrency, CATEGORY_GROUPS, findCategory } from './budget';
import { categoryRows } from './category-rows';

// ── START: Budget screen ───────────────────────────────────────────────────
export function budgetScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var ui = app.ui;
  var group = ui.categoryGroup;
  var rows = categoryRows(app);
  var shown = group === 'all' ? rows : rows.filter(function (row) { return row.group === group; });
  var groupSpent = sumOf(shown.map(function (row) { return row.spent; }));
  var groupBudget = sumOf(shown.map(function (row) { return row.budget; }));

  function groupButton(name) {
    return { select: function () { app.update({ categoryGroup: name }); }, style: group === name ? STYLE.pillSelected : STYLE.pill };
  }
  var all = groupButton('all');
  var essentials = groupButton('essentials');
  var lifestyle = groupButton('lifestyle');
  var study = groupButton('study');

  return {
    spentMonthLabel: 'Spent in ' + MONTH_NAMES_LONG[summary.today.getMonth()],
    curCode: money.code,
    curName: money.code,
    curSym: money.symbol,
    curPair: money.code + ' / INR',
    localCurrencyStyle: money.rupeesFirst ? STYLE.segment : STYLE.segmentSelected,
    rupeeCurrencyStyle: money.rupeesFirst ? STYLE.segmentSelected : STYLE.segment,
    showLocalFirst: function () { app.saveProfile({ primaryCurrency: 'LOCAL' }); },
    showRupeesFirst: function () { app.saveProfile({ primaryCurrency: 'INR' }); },
    totalPrimary: money.rupeesFirst ? money.inRupees(summary.totalSpent) : money.exact(summary.totalSpent),
    totalSecondary: (money.rupeesFirst ? money.exact(summary.totalSpent) : money.inRupees(summary.totalSpent)) + ' at ₹' + money.rate.toFixed(2),
    rateLine: '1 ' + money.code + ' = ₹' + money.rate.toFixed(2),
    rateNote: (summary.liveRates ? 'Live mid-market rate · ' : 'Reference rate · ') + formatFullDate(parseIsoDate(summary.ratesAsOf)) + ' · all home amounts use it',
    dayLabel: 'Day ' + summary.dayOfMonth + ' of ' + summary.daysInThisMonth,

    groupTitle: CATEGORY_GROUPS[group],
    groupAll: all.select, groupAllStyle: all.style,
    groupEssentials: essentials.select, groupEssentialsStyle: essentials.style,
    groupLifestyle: lifestyle.select, groupLifestyleStyle: lifestyle.style,
    groupStudy: study.select, groupStudyStyle: study.style,
    shownCategories: shown,
    groupSpent: money.exact(groupSpent),
    groupSpentInr: money.inRupees(groupSpent),
    groupBudget: money.whole(groupBudget),
    groupPct: (groupBudget ? Math.round(groupSpent / groupBudget * 100) : 0) + '%'
  };
}
// ── END: Budget screen ─────────────────────────────────────────────────────


// ── START: Expense list ────────────────────────────────────────────────────
export function expenseListBindings(app) {
  var summary = app.summary;
  var money = app.money;
  var ui = app.ui;
  var reviewing = ui.expenseFilter === 'review';
  var rows = categoryRows(app);

  var matching = summary.expenses.filter(function (expense) {
    var inGroup = ui.categoryGroup === 'all' || findCategory(expense.cat).group === ui.categoryGroup;
    return inGroup && (!reviewing || expense.needsReview);
  });
  var visible = ui.showAllExpenses ? matching : matching.slice(0, 6);

  function deleteExpense(expense) {
    var documentId = 'ledger-' + expense.date.slice(0, 7);
    var ledger = Store.read(documentId) || { txns: [] };
    Store.save(documentId, { txns: ledger.txns.filter(function (item) { return item.id !== expense.id; }) });
    app.reloadData();
    app.toast('Expense deleted · forecast updated');
  }

  var expenseRows = visible.map(function (expense, index) {
    var category = rows.filter(function (row) { return row.id === expense.cat; })[0] || rows[0];
    var amount = amountInCurrency(expense, money.code, app.profile.rateOverrides);
    var deleteControl = twoTapDelete(app, 'expense:' + expense.id, 'Tap × again to delete this expense', function () { deleteExpense(expense); });
    return {
      title: expense.note || category.name,
      details: category.name + ' · ' + formatDayMonth(parseIsoDate(expense.date)) + ' · ' + (expense.bankName || 'manual'),
      needsReview: !!expense.needsReview,
      amount: money.exact(amount),
      amountInRupees: money.inRupees(amount),
      dotStyle: category.dotStyle,
      rowStyle: rowStyle(index, visible.length, 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 0'),
      deleteStyle: deleteControl.style,
      remove: deleteControl.press,
      open: function () { app.update({ categorise: { expenseId: expense.id, categoryId: expense.cat, applyToMerchant: !!expense.merchant } }); }
    };
  });

  var reviewCount = summary.needsReviewCount;
  var headerText = '';
  if (reviewing) headerText = 'Show all';
  else if (reviewCount) headerText = 'Review ' + reviewCount;
  else if (matching.length > 6) headerText = ui.showAllExpenses ? 'Show less' : 'All ' + matching.length;

  var hasCardBank = summary.banks.some(function (bank) { return bank.region === 'abroad'; });
  var groupName = CATEGORY_GROUPS[ui.categoryGroup].toLowerCase();

  return {
    expenseRows: expenseRows,
    noExpenses: matching.length === 0,
    noExpensesText: reviewing ? 'All caught up — every payment has a category.'
      : hasCardBank ? 'Nothing in ' + groupName + ' this month yet.'
      : 'Nothing logged in ' + groupName + ' this month. Tap + or connect your bank.',
    expenseHeading: reviewing ? 'To review' : 'Recent expenses',
    expenseHeaderText: headerText,
    expenseHeaderAction: function () {
      if (reviewing) app.update({ expenseFilter: 'all' });
      else if (reviewCount) app.update({ expenseFilter: 'review', categoryGroup: 'all', showAllExpenses: true });
      else app.update({ showAllExpenses: !ui.showAllExpenses });
    }
  };
}
// ── END: Expense list ──────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function BudgetView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Budget Tracker">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '64px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Budget Tracker</span>
        <div onClick={v.openSheet} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M10 5v10M5 10h10" stroke="#0B0620" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
              {v.spentMonthLabel}
            </div>
            <div style={{ display: 'flex', padding: '3px', borderRadius: '999px', background: '#F3F1FA' }}>
              <span onClick={v.showLocalFirst} style={css(v.localCurrencyStyle)}>{v.curCode}</span>
              <span onClick={v.showRupeesFirst} style={css(v.rupeeCurrencyStyle)}>INR</span>
            </div>
          </div>
          <div style={{ fontSize: '34px', fontWeight: '800', color: '#0B0620', marginTop: '8px', letterSpacing: '-0.03em' }}>{v.totalPrimary}</div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.totalSecondary}</div>
          <div style={{ height: '10px', borderRadius: '5px', background: '#EFEBF8', marginTop: '14px', overflow: 'hidden' }}>
            <div style={css(v.usedBarLg)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '8px' }}>
            <span>{v.usedText}</span>
            <span>{v.budgetLeft} left of {v.monthlyBudget}</span>
          </div>
          <div onClick={v.openBudgetSheet} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '16px', padding: '13px 16px', border: '1.5px solid #E6E1F1', borderRadius: '999px', cursor: 'pointer', transition: 'background-color .2s ease,border-color .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: '0' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M13.2 4.3l2.5 2.5-8.2 8.2H5v-2.5l8.2-8.2z" stroke="#8552FF" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620' }}>Set monthly spend</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#8552FF', whiteSpace: 'nowrap' }}>{v.monthlyBudget}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1B1233', borderRadius: '18px', padding: '13px 16px' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '10px', background: 'rgba(171,227,158,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M4 13.5l4.5-4.5 3 3L16 6.5" stroke="#ABE39E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF' }}>{v.rateLine}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#B7B0CE' }}>{v.rateNote}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px', scrollbarWidth: 'none' }}>
          <span onClick={v.groupAll} style={css(v.groupAllStyle)}>All</span>
          <span onClick={v.groupEssentials} style={css(v.groupEssentialsStyle)}>Essentials</span>
          <span onClick={v.groupLifestyle} style={css(v.groupLifestyleStyle)}>Lifestyle</span>
          <span onClick={v.groupStudy} style={css(v.groupStudyStyle)}>Study</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>{v.groupTitle}</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.dayLabel}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {(v.shownCategories || []).map((item: any, i: number) => (
            <div key={i} onClick={item.open} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: '0' }}>
                  <span style={css(item.dotStyle)} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.name}</span>
                </div>
                <span style={css(item.percentChipStyle)}>{item.percentText}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: '#EFEBF8', marginTop: '8px', overflow: 'hidden' }}>
                <div style={css(item.barStyle)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '6px' }}>
                <span>{item.spentText}</span>
                <span>{item.spentInRupees}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
              {v.groupTitle} subtotal
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.02em' }}>{v.groupSpent}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.groupSpentInr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>Of budget</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0B0620', marginTop: '6px', letterSpacing: '-0.02em' }}>{v.groupBudget}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.groupPct} used</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#1B1233', borderRadius: '20px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
            <span style={{ width: '30px', height: '30px', borderRadius: '10px', background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M3 8l7-4 7 4M4.5 8.5v6M8.5 8.5v6M11.5 8.5v6M15.5 8.5v6M3 16.5h14" stroke="#C9B4FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF' }}>{v.bankBannerTitle}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#B7B0CE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.bankBannerSub}
              </div>
            </div>
          </div>
          <span onClick={v.bankBannerAction} style={css(v.bankBannerBtn)}>{v.bankBannerLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>{v.expenseHeading}</span>
          <span onClick={v.expenseHeaderAction} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>
            {v.expenseHeaderText}
          </span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '6px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {v.noExpenses ? (
            <div style={{ padding: '18px 0', fontSize: '13px', fontWeight: '600', color: '#7C7893', textAlign: 'center', textWrap: 'pretty' }}>
              {v.noExpensesText}
            </div>
          ) : null}
          {(v.expenseRows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <div onClick={item.open} style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0', cursor: 'pointer' }}>
                <span style={css(item.dotStyle)} />
                <div style={{ minWidth: '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </span>
                    {item.needsReview ? (
                      <span style={{ flexShrink: '0', padding: '3px 8px', borderRadius: '999px', background: '#FFF1D6', fontSize: '10px', fontWeight: '800', color: '#9A5B00' }}>
                        Review
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.details}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{item.amount}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{item.amountInRupees}</div>
                </div>
                <div onClick={item.remove} aria-label="Delete expense" style={css(item.deleteStyle)}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
