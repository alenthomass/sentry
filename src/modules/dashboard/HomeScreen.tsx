/* ============================================================================
   Sentry · Home (dashboard)                                 (owner: Shaheen)
   Live balances from connected banks, safe-to-spend and runway, quick
   actions, this month at a glance, the risk score with what drives it,
   alerts, what is coming up, recent bank activity and the categories
   closest to their budget.
   ============================================================================ */

import { addDays, daysBetween, formatDayMonth, formatRupees, formatRupeesShort, MONTH_NAMES_LONG, parseIsoDate, pluralize, WEEKDAY_NAMES } from '../../shared/dates';
import { sumOf } from '../../shared/maths';
import { bankLogoStyle, barStyle, CATEGORY_ICONS, categoryIcon, css, rowStyle, TONES, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS } from '../../app/ui-state';
import { accountNumber, openConnectBank, syncBanks, timeAgo } from '../banking/ConnectBankSheet';
import { shortBankName } from '../banking/mock-bank';
import { amountInCurrency, findCategory } from '../budget/budget';
import { categoryRows, daysUntilBreach } from '../budget/category-rows';
import { rupeesPerUnit } from '../transfer-timing/currency';

// ── START: Balances from connected banks ───────────────────────────────────
export function balanceInLocalCurrency(balance, amount, money) {
  if (balance.currency === money.code) return amount;
  if (balance.currency === 'INR') return amount / money.rate;
  return amount * rupeesPerUnit(balance.currency) / money.rate;
}

export function formatBankAmount(balance, amount, money) {
  return balance.currency === 'INR' ? formatRupees(amount) : money.exact(balanceInLocalCurrency(balance, amount, money));
}

export function sparkline(points: Array<{ amount: number }> | null, width?: number, height?: number) {
  if (!points || points.length < 2) return { line: '', area: '', endX: 0, endY: 0 };
  var values = points.map(function (point) { return point.amount; });
  var low = Math.min.apply(null, values);
  var high = Math.max.apply(null, values);
  var span = high - low || 1;
  var coordinates = values.map(function (value, index) {
    return [
      Math.round(index / (values.length - 1) * width * 10) / 10,
      Math.round((4 + (1 - (value - low) / span) * (height - 8)) * 10) / 10
    ];
  });
  var line = coordinates.map(function (point, index) { return (index ? 'L' : 'M') + point[0] + ' ' + point[1]; }).join(' ');
  var last = coordinates[coordinates.length - 1];
  return { line: line, area: line + ' L' + width + ' ' + height + ' L0 ' + height + ' Z', endX: last[0], endY: last[1] };
}

export function balanceOverview(app) {
  var summary = app.summary;
  var money = app.money;
  var banks = summary.banks;
  var withBalance = banks.filter(function (bank) { return bank.balance; });
  var spendingAccounts = withBalance.filter(function (bank) { return bank.region === 'abroad'; });
  var indianAccounts = withBalance.filter(function (bank) { return bank.region === 'india'; });

  var spendable = sumOf(spendingAccounts.map(function (bank) { return balanceInLocalCurrency(bank.balance, bank.balance.available, money); }));
  var pending = sumOf(spendingAccounts.map(function (bank) { return balanceInLocalCurrency(bank.balance, bank.balance.pending || 0, money); }));
  var inIndia = sumOf(indianAccounts.map(function (bank) { return bank.balance.current; }));
  var totalLocal = sumOf(withBalance.map(function (bank) { return balanceInLocalCurrency(bank.balance, bank.balance.current, money); }));
  var oldestAsOf = withBalance.map(function (bank) { return bank.balance.asOf; }).sort()[0];
  var newestSync = banks.map(function (bank) { return bank.lastSync; }).filter(Boolean).sort().slice(-1)[0];

  return {
    banks: banks,
    withBalance: withBalance,
    spendingAccounts: spendingAccounts,
    indianAccounts: indianAccounts,
    spendable: spendable,
    pending: pending,
    inIndia: inIndia,
    totalLocal: totalLocal,
    asOf: oldestAsOf ? parseIsoDate(oldestAsOf) : null,
    lastSync: newestSync || null
  };
}
// ── END: Balances from connected banks ─────────────────────────────────────

// ── START: Home screen ─────────────────────────────────────────────────────
export var GREETINGS = [[5, 'Good night'], [12, 'Good morning'], [17, 'Good afternoon'], [22, 'Good evening'], [24, 'Good night']];

export function greetingFor(hour) {
  return GREETINGS.filter(function (entry) { return hour < entry[0]; })[0][1];
}

export function whenText(today, date) {
  var days = daysBetween(today, date);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) return 'In ' + days + ' days';
  return formatDayMonth(date);
}

export function homeScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var profile = app.profile;
  var ui = app.ui;
  var risk = summary.risk;
  var riskTone = TONES[risk.tone];
  var alerts = summary.overspendAlerts;
  var flags = summary.complianceFlags;
  var timing = summary.timing;
  var scheduled = profile.scheduledTransfer;
  var overBudget = summary.totalSpent > summary.totalBudget;
  var usedBarPercent = Math.min(100, summary.usedPercent);
  var balances = balanceOverview(app);
  var hasBalance = balances.withBalance.length > 0;
  var hasSpendingBalance = balances.spendingAccounts.length > 0;
  var daysRemaining = summary.daysInThisMonth - summary.dayOfMonth + 1;

  var topAlertText = '';
  if (alerts.length) {
    var worst = alerts[0];
    if (worst.forecast.alreadyOver) topAlertText = money.exact(worst.spent - worst.budget) + ' over already';
    else if (worst.forecast.breachDay) topAlertText = pluralize(daysUntilBreach(summary, worst), 'day') + ' out';
    else topAlertText = worst.breachChance + '% breach risk';
  }

  var firstName = (profile.name || '').trim().split(/\s+/)[0] || 'there';
  var initials = (profile.name || '').trim().split(/\s+/).map(function (word) { return word[0]; }).slice(0, 2).join('').toUpperCase() || 'S';

  var unpaidBills = sumOf(summary.categories.filter(function (category) {
    return category.paidOnceAMonth && category.spent === 0;
  }).map(function (category) { return category.budget; }));
  var budgetRoom = Math.max(0, summary.totalBudget - summary.totalSpent - unpaidBills);
  var cashRoom = hasSpendingBalance ? Math.max(0, balances.spendable - unpaidBills) : budgetRoom;
  var safePerDay = Math.min(budgetRoom, cashRoom) / daysRemaining;
  var dailyPace = summary.dayOfMonth ? summary.totalSpent / summary.dayOfMonth : 0;
  var runwayDays = hasSpendingBalance && dailyPace > 0 ? Math.floor(balances.spendable / dailyPace) : null;

  var hero;
  if (hasSpendingBalance) {
    var primary = balances.spendingAccounts[0];
    var trend = sparkline(primary.balance.trend, 300, 58);
    var firstPoint = primary.balance.trend[0];
    var change = firstPoint ? primary.balance.current - firstPoint.amount : 0;
    hero = {
      label: 'Available to spend',
      amount: money.exact(balances.spendable),
      sub: '≈ ' + money.inRupees(balances.spendable) + ' · ' + (balances.spendingAccounts.length > 1 ? balances.spendingAccounts.length + ' accounts' : primary.name + ' ' + accountNumber(primary)),
      hasTrend: !!trend.line,
      trend: trend,
      trendNote: (change >= 0 ? '▲ ' : '▼ ') + money.whole(Math.abs(balanceInLocalCurrency(primary.balance, change, money))) + ' over 30 days',
      trendNoteStyle: 'font-size:11px;font-weight:700;color:' + (change >= 0 ? '#ABE39E' : '#FFB4AE'),
      stats: [
        { label: 'Safe to spend', value: money.whole(safePerDay) + '/day' },
        { label: 'Lasts until', value: runwayDays == null ? '—' : runwayDays >= 60 ? '60+ days' : formatDayMonth(addDays(summary.today, runwayDays)) },
        { label: 'Pending', value: money.exact(balances.pending) }
      ]
    };
  } else if (hasBalance) {
    var indian = balances.indianAccounts[0];
    var indianTrend = sparkline(indian.balance.trend, 300, 58);
    hero = {
      label: 'Balance in India',
      amount: formatRupees(balances.inIndia),
      sub: '≈ ' + money.whole(balances.inIndia / money.rate) + ' · ' + indian.name + ' ' + accountNumber(indian),
      hasTrend: !!indianTrend.line,
      trend: indianTrend,
      trendNote: 'Last 30 days',
      trendNoteStyle: 'font-size:11px;font-weight:700;color:#C9B4FF',
      stats: [
        { label: 'Safe to spend', value: money.whole(safePerDay) + '/day' },
        { label: 'Budget left', value: money.whole(summary.budgetLeft) },
        { label: 'Days left', value: String(daysRemaining) }
      ]
    };
  } else {
    hero = {
      label: 'Budget left this month',
      amount: money.exact(summary.budgetLeft),
      sub: '≈ ' + money.inRupees(summary.budgetLeft) + ' · of ' + money.whole(summary.totalBudget),
      hasTrend: false,
      trend: sparkline(null),
      trendNote: '',
      trendNoteStyle: '',
      stats: [
        { label: 'Safe to spend', value: money.whole(safePerDay) + '/day' },
        { label: 'Days left', value: String(daysRemaining) },
        { label: 'Projected', value: money.whole(summary.totalProjected) }
      ]
    };
  }

  var syncing = ui.syncing;
  var heroStatus = !balances.banks.length ? 'Connect a bank to see your live balance'
    : syncing ? 'Syncing with your bank…'
    : !hasBalance ? 'Sync to fetch your live balance'
    : 'Balance as of ' + formatDayMonth(balances.asOf) + ' · synced ' + timeAgo(balances.lastSync);

  var accountCards = balances.banks.map(function (bank) {
    return {
      logo: bank.logo,
      logoStyle: bankLogoStyle(bank.color, 30),
      name: shortBankName(bank),
      number: accountNumber(bank),
      balance: bank.balance ? formatBankAmount(bank.balance, bank.balance.current, money) : 'Sync to see',
      balanceStyle: 'font-size:' + (bank.balance ? '17' : '13') + 'px;font-weight:800;color:' + (bank.balance ? '#0B0620' : '#8552FF') + ';margin-top:12px;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      caption: bank.region === 'india' ? 'Remitting · INR' : 'Spending · ' + bank.currency,
      open: app.goTo('account')
    };
  });

  var pacePercent = Math.round(summary.dayOfMonth / summary.daysInThisMonth * 100);
  var projectedOver = summary.totalProjected > summary.totalBudget;
  var aheadOfPace = summary.usedPercent > pacePercent + 3;

  var comingUp = [];
  summary.upcomingPayments.slice(0, 2).forEach(function (payment) {
    comingUp.push({
      date: payment.date, icon: 'emi', title: payment.loan.name + ' EMI', sub: payment.phase === 'moratorium' ? 'Interest only · auto-debit' : 'Principal + interest · auto-debit',
      amount: formatRupees(payment.pay), amountSub: money.fromRupees(payment.pay), open: app.goTo('emi')
    });
  });
  if (scheduled) {
    var transferDate = parseIsoDate(scheduled.date);
    comingUp.push({
      date: transferDate, icon: 'transfer', title: 'Transfer from India', sub: 'Scheduled with the timing advisor',
      amount: money.whole(scheduled.amount), amountSub: money.inRupees(scheduled.amount), open: app.goTo('remit')
    });
  }
  var rentBudget = (profile.budgets || {}).rent || 0;
  if (rentBudget) {
    comingUp.push({
      date: new Date(summary.today.getFullYear(), summary.today.getMonth() + 1, 1), icon: 'rent', title: 'Rent & bills', sub: 'Usually leaves on the 1st',
      amount: money.whole(rentBudget), amountSub: money.inRupees(rentBudget), open: app.goTo('budget')
    });
  }
  comingUp.sort(function (a, b) { return a.date - b.date; });
  var upcomingIcons = {
    emi: { path: 'M4 6.5h12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8zM4 6.5l1.2-2h9.6l1.2 2M8 10h4', tint: '#F3EDFF', ink: '#6B36F0' },
    transfer: { path: 'M4 7h11l-3-3M16 13H5l3 3', tint: '#EAF7E6', ink: '#4E8A41' },
    rent: CATEGORY_ICONS.rent
  };
  var homeUpcomingRows = comingUp.slice(0, 4).map(function (item, index, list) {
    var icon = upcomingIcons[item.icon];
    var days = daysBetween(summary.today, item.date);
    return {
      title: item.title, sub: item.sub, amount: item.amount, amountSub: item.amountSub, open: item.open,
      when: whenText(summary.today, item.date),
      whenStyle: 'font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;' + (days <= 3 ? 'background:#FDE7E5;color:#C4342C' : 'background:#F3F1FA;color:#4A4266'),
      iconPath: icon.path, iconInk: icon.ink,
      iconBoxStyle: 'width:40px;height:40px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + icon.tint,
      rowStyle: rowStyle(index, list.length, 'display:flex;align-items:center;gap:12px;padding:13px 0;cursor:pointer')
    };
  });

  var recent = summary.expenses.slice(0, 5).map(function (expense, index, list) {
    var category = findCategory(expense.cat);
    var amount = amountInCurrency(expense, money.code, profile.rateOverrides);
    return Object.assign(categoryIcon(expense.cat), {
      title: expense.note || category.name,
      sub: category.short + ' · ' + formatDayMonth(parseIsoDate(expense.date)) + ' · ' + (expense.bankName || 'Added by you'),
      amount: '−' + money.exact(amount),
      amountSub: money.inRupees(amount),
      needsReview: !!expense.needsReview,
      rowStyle: rowStyle(index, list.length, 'display:flex;align-items:center;gap:12px;padding:12px 0;cursor:pointer'),
      open: function () { app.update({ categorise: { expenseId: expense.id, categoryId: expense.cat, applyToMerchant: !!expense.merchant } }); }
    });
  });

  var riskParts = risk.parts.slice().sort(function (a, b) { return b.points / b.max - a.points / a.max; }).map(function (part) {
    var share = part.max ? part.points / part.max * 100 : 0;
    var tone = share >= 50 ? TONES.red : share >= 25 ? TONES.purple : TONES.green;
    return {
      label: part.label,
      points: Math.round(part.points) + ' / ' + part.max,
      barStyle: barStyle(share, tone.bar, 3)
    };
  });
  var topDriver = riskParts[0];

  var reviewCount = summary.needsReviewCount;

  return {
    initials: initials,
    greeting: greetingFor(new Date().getHours()) + ', ' + firstName,
    todayLabel: WEEKDAY_NAMES[summary.today.getDay()] + ', ' + formatDayMonth(summary.today),
    hasUnread: summary.unreadCount > 0,
    unreadCount: summary.unreadCount,

    heroLabel: hero.label,
    heroAmount: hero.amount,
    heroSub: hero.sub,
    heroHasTrend: hero.hasTrend,
    heroTrendLine: hero.trend.line,
    heroTrendArea: hero.trend.area,
    heroTrendEndX: hero.trend.endX,
    heroTrendEndY: hero.trend.endY,
    heroTrendNote: hero.trendNote,
    heroTrendNoteStyle: hero.trendNoteStyle,
    heroStats: hero.stats,
    heroStatus: heroStatus,
    heroNeedsBank: !balances.banks.length,
    heroSyncIconStyle: 'display:block;' + (syncing ? 'animation:spin 0.9s linear infinite' : ''),
    heroSync: balances.banks.length ? function () { syncBanks(app, balances.banks); } : function () { openConnectBank(app, 'abroad'); },
    heroConnect: function () { openConnectBank(app, 'abroad'); },
    totalAcrossAccounts: balances.withBalance.length > 1 ? 'Total across accounts ≈ ' + money.whole(balances.totalLocal) + ' · ' + formatRupeesShort(balances.totalLocal * money.rate) : '',

    hasAccounts: accountCards.length > 0,
    accountCards: accountCards,
    accountCount: pluralize(accountCards.length, 'account'),
    addAccount: function () { openConnectBank(app, balances.spendingAccounts.length || balances.banks.some(function (bank) { return bank.region === 'abroad'; }) ? 'india' : 'abroad'); },

    quickSyncLabel: balances.banks.length ? (syncing ? 'Syncing' : 'Sync') : 'Connect',
    quickSyncIconStyle: 'display:block;' + (syncing ? 'animation:spin 0.9s linear infinite' : ''),
    quickReviewLabel: reviewCount ? 'Review' : 'Activity',
    hasReviews: reviewCount > 0,
    reviewCount: reviewCount,
    quickReview: function () {
      app.update(Object.assign({ screen: 'budget', expenseFilter: reviewCount ? 'review' : 'all', categoryGroup: 'all', showAllExpenses: !!reviewCount }, CLOSED_OVERLAYS));
    },

    monthTitle: MONTH_NAMES_LONG[summary.today.getMonth()] + ' spending',
    monthDay: 'Day ' + summary.dayOfMonth + ' of ' + summary.daysInThisMonth,
    monthSpent: money.exact(summary.totalSpent),
    monthOf: 'of ' + money.whole(summary.totalBudget),
    monthBar: barStyle(usedBarPercent, overBudget ? '#F2544B' : aheadOfPace ? '#B18BFF' : '#8552FF', 5),
    monthPaceStyle: 'position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;background:#1B1233;left:calc(' + pacePercent + '% - 1px)',
    monthPaceNote: overBudget ? 'Over budget by ' + money.exact(summary.totalSpent - summary.totalBudget)
      : aheadOfPace ? Math.round(summary.usedPercent - pacePercent) + '% ahead of pace — ease off a little'
      : 'On pace · ' + Math.round(summary.usedPercent) + '% used, ' + pacePercent + '% of month gone',
    monthPaceNoteStyle: 'font-size:12px;font-weight:700;margin-top:9px;color:' + (overBudget ? '#C4342C' : aheadOfPace ? '#9A5B00' : '#4E8A41'),
    monthLeft: money.whole(summary.budgetLeft),
    monthProjected: money.whole(summary.totalProjected),
    monthProjectedStyle: 'font-size:15px;font-weight:800;margin-top:3px;color:' + (projectedOver ? '#C4342C' : '#0B0620'),
    monthDailyAverage: money.whole(dailyPace),

    score: risk.score,
    scoreDash: Math.round(157 * risk.score / 100) + ' 400',
    scoreLabel: risk.label,
    scoreChip: 'align-self:flex-start;padding:4px 10px;border-radius:999px;background:' + riskTone.background + ';font-size:11px;font-weight:800;color:' + riskTone.text,
    scoreStroke: riskTone.bar === '#ABE39E' ? '#6CC25A' : riskTone.bar,
    scoreCaption: Math.round(summary.usedPercent) + '% of budget used · ' + pluralize(alerts.length, 'overspend alert') + ' · ' + pluralize(flags.length, 'compliance flag'),
    scoreDriver: topDriver && parseFloat(topDriver.points) > 0 ? 'Biggest driver: ' + topDriver.label.toLowerCase() : 'Nothing is driving risk up',
    scoreMultiplier: risk.multiplier > 1 ? '×' + risk.multiplier.toFixed(2) + ' compounding — several risks are hot at once' : 'No compounding — risks are independent right now',
    riskParts: riskParts,
    showRiskParts: !!ui.showRiskParts,
    riskToggleLabel: ui.showRiskParts ? 'Hide breakdown' : 'What’s driving it',
    riskChevronStyle: 'display:block;transition:transform .25s ease;transform:rotate(' + (ui.showRiskParts ? '180' : '0') + 'deg)',
    toggleRiskParts: function () { app.update({ showRiskParts: !ui.showRiskParts }); },

    monthlyBudget: money.whole(summary.totalBudget),
    budgetLeft: money.exact(summary.budgetLeft),
    usedBarLg: barStyle(usedBarPercent, overBudget ? '#F2544B' : '#8552FF', 5),
    usedText: Math.round(summary.usedPercent) + '% used · day ' + summary.dayOfMonth + ' of ' + summary.daysInThisMonth,

    alertCount: alerts.length + ' active',
    alertSummary: alerts.length ? alerts[0].name + ' · ' + topAlertText : 'All categories tracking under budget',
    flagCount: flags.length + ' open',
    flagSummary: flags.length ? flags.slice(0, 2).map(function (flag) { return flag.text; }).join(' · ') : 'Nothing open this FY',
    transferSummary: scheduled
      ? 'Transfer scheduled for ' + formatDayMonth(parseIsoDate(scheduled.date))
      : money.code + '/INR ' + timing.todaysRate.toFixed(2) + ' · ' + (timing.percentVsAverage > 0 ? 'above' : 'below') + ' 30-day avg',
    transferAction: scheduled ? 'Scheduled' : timing.recommended.id === 'now' ? 'Send now' : 'Wait',

    homeHasUpcoming: homeUpcomingRows.length > 0,
    homeUpcomingRows: homeUpcomingRows,

    hasRecent: recent.length > 0,
    noRecent: recent.length === 0,
    recentRows: recent,
    recentEmptyText: balances.banks.some(function (bank) { return bank.region === 'abroad'; })
      ? 'No payments yet this month. Sync to pull in the latest.'
      : 'Nothing logged this month. Tap + to add an expense or connect your card.',

    categoryCount: summary.categories.length,
    topCategories: categoryRows(app).sort(function (a, b) { return b.percent - a.percent; }).slice(0, 3)
  };
}
// ── END: Home screen ───────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function HomeView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '44px 20px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: '0' }}>
          <div onClick={v.goAccount} role="button" aria-label="Account" style={{ width: '42px', height: '42px', borderRadius: '21px', background: '#1B1233', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.14)', cursor: 'pointer', flexShrink: '0' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#ABE39E', letterSpacing: '0.02em' }}>{v.initials}</span>
          </div>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#4A4266' }}>{v.todayLabel}</div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.01em', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v.greeting}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0' }}>
          <div onClick={v.goSettings} role="button" aria-label="Settings" style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.10)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2.6" stroke="#0B0620" strokeWidth="1.6" />
              <path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3L4.9 4.9" stroke="#0B0620" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={v.goNotifs} role="button" aria-label="Notifications" style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.10)', position: 'relative', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 8.5a4.5 4.5 0 019 0v3l1.5 2.5H4l1.5-2.5v-3z" stroke="#0B0620" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M8.5 16.5h3" stroke="#0B0620" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {v.hasUnread ? (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '19px', height: '19px', boxSizing: 'border-box', padding: '0 5px', borderRadius: '10px', background: '#F2544B', border: '2px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#FFFFFF', animation: 'blip 2.6s ease-in-out infinite' }}>
                {v.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ padding: '22px 20px 132px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '26px', padding: '24px 22px 18px', background: 'radial-gradient(130% 100% at 100% 0%,#5B2FD6 0%,rgba(91,47,214,0) 58%),radial-gradient(90% 80% at 0% 100%,rgba(171,227,158,0.16) 0%,rgba(171,227,158,0) 60%),#1B1233', boxShadow: '0 14px 34px rgba(27,18,51,0.32)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#C9B4FF' }}>
                {v.heroLabel}
              </div>
              <div style={{ fontSize: '38px', lineHeight: '1.05', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.03em', marginTop: '10px', whiteSpace: 'nowrap' }}>
                {v.heroAmount}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.66)', marginTop: '7px' }}>{v.heroSub}</div>
            </div>
            <div onClick={v.heroSync} role="button" aria-label="Sync balances" style={{ width: '38px', height: '38px', borderRadius: '19px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: '0' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" style={css(v.heroSyncIconStyle)}>
                <path d="M15.8 8.2A6 6 0 005 6.2M4.2 11.8A6 6 0 0015 13.8" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M5 3v3.2h3.2M15 17v-3.2h-3.2" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          {v.heroHasTrend ? (
            <div style={{ position: 'relative', margin: '22px -4px 0' }}>
              <svg width="100%" height="58" viewBox="0 0 300 58" preserveAspectRatio="none" fill="none" style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="heroTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ABE39E" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#ABE39E" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={v.heroTrendArea} fill="url(#heroTrendFill)" />
                <path d={v.heroTrendLine} stroke="#ABE39E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', padding: '0 4px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>30 days</span>
                <span style={css(v.heroTrendNoteStyle)}>{v.heroTrendNote}</span>
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '12px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            {(v.heroStats || []).map((stat: any, i: number) => (
              <div key={i} style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.56)', whiteSpace: 'nowrap' }}>{stat.label}</div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', marginTop: '3px', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '16px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '3px', background: '#ABE39E', flexShrink: '0' }} />
            <span style={{ flex: '1', minWidth: '0', fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>{v.heroStatus}</span>
            {v.heroNeedsBank ? (
              <span onClick={v.heroConnect} style={{ flexShrink: '0', padding: '8px 14px', borderRadius: '999px', background: '#ABE39E', fontSize: '12px', fontWeight: '800', color: '#1B1233', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Connect bank
              </span>
            ) : null}
          </div>
        </div>
        {v.hasAccounts ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Accounts</span>
              <span onClick={v.goAccount} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>Manage</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', margin: '0 -20px', padding: '0 20px 6px', scrollPadding: '0 20px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
              {(v.accountCards || []).map((acct: any, i: number) => (
                <div key={i} onClick={acct.open} style={{ flex: '0 0 148px', width: '148px', minWidth: '0', scrollSnapAlign: 'start', background: '#FFFFFF', borderRadius: '20px', padding: '14px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={css(acct.logoStyle)}>{acct.logo}</span>
                    <div style={{ flex: '1', minWidth: '0' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {acct.name}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{acct.number}</div>
                    </div>
                  </div>
                  <div style={css(acct.balanceStyle)}>{acct.balance}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px', whiteSpace: 'nowrap' }}>{acct.caption}</div>
                </div>
              ))}
              <div onClick={v.addAccount} style={{ flex: '0 0 118px', width: '118px', scrollSnapAlign: 'start', borderRadius: '20px', border: '1.5px dashed #C9B4FF', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxSizing: 'border-box', padding: '14px' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M10 5v10M5 10h10" stroke="#6B36F0" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#6B36F0', textAlign: 'center' }}>Add account</span>
              </div>
              <div style={{ flex: '0 0 8px' }} />
            </div>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
          <div onClick={v.openSheet} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
            <span style={{ width: '54px', height: '54px', borderRadius: '18px', background: '#FFFFFF', boxShadow: '0 6px 18px rgba(5,0,17,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M10 4.5v11M4.5 10h11" stroke="#8552FF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>Add</span>
          </div>
          <div onClick={v.goRemit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
            <span style={{ width: '54px', height: '54px', borderRadius: '18px', background: '#FFFFFF', boxShadow: '0 6px 18px rgba(5,0,17,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M16.5 3.5L8.8 11.2M16.5 3.5l-4.8 13-2.9-5.3-5.3-2.9 13-4.8z" stroke="#8552FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>Send</span>
          </div>
          <div onClick={v.heroSync} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
            <span style={{ width: '54px', height: '54px', borderRadius: '18px', background: '#FFFFFF', boxShadow: '0 6px 18px rgba(5,0,17,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={css(v.quickSyncIconStyle)}>
                <path d="M15.8 8.2A6 6 0 005 6.2M4.2 11.8A6 6 0 0015 13.8" stroke="#8552FF" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M5 3v3.2h3.2M15 17v-3.2h-3.2" stroke="#8552FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>{v.quickSyncLabel}</span>
          </div>
          <div onClick={v.quickReview} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', cursor: 'pointer' }}>
            <span style={{ position: 'relative', width: '54px', height: '54px', borderRadius: '18px', background: '#FFFFFF', boxShadow: '0 6px 18px rgba(5,0,17,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <rect x="3.5" y="3.5" width="13" height="13" rx="3" stroke="#8552FF" strokeWidth="1.7" />
                <path d="M7 10.2l2 2 4-4.4" stroke="#8552FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {v.hasReviews ? (
                <span style={{ position: 'absolute', top: '-5px', right: '-5px', minWidth: '20px', height: '20px', boxSizing: 'border-box', padding: '0 5px', borderRadius: '10px', background: '#F2544B', border: '2px solid #F5F4F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: '#FFFFFF' }}>
                  {v.reviewCount}
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>{v.quickReviewLabel}</span>
          </div>
        </div>
        <div onClick={v.goBudget} style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{v.monthTitle}</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#7C7893', padding: '4px 9px', borderRadius: '999px', background: '#F3F1FA' }}>
              {v.monthDay}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginTop: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.03em' }}>{v.monthSpent}</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#7C7893' }}>{v.monthOf}</span>
          </div>
          <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: '#EFEBF8', marginTop: '12px' }}>
            <div style={{ position: 'absolute', inset: '0', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={css(v.monthBar)} />
            </div>
            <div style={css(v.monthPaceStyle)} />
          </div>
          <div style={css(v.monthPaceNoteStyle)}>{v.monthPaceNote}</div>
          <div style={{ display: 'flex', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F0EDF7' }}>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Left</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.monthLeft}</div>
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Projected</div>
              <div style={css(v.monthProjectedStyle)}>{v.monthProjected}</div>
            </div>
            <div style={{ flex: '1' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Daily average</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620', marginTop: '3px' }}>{v.monthDailyAverage}</div>
            </div>
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '16px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ position: 'relative', width: '118px', height: '70px', flexShrink: '0' }}>
              <svg width="118" height="70" viewBox="0 0 118 70" fill="none">
                <path d="M9 62a50 50 0 01100 0" stroke="#EFEBF8" strokeWidth="11" strokeLinecap="round" />
                <path d="M9 62a50 50 0 01100 0" stroke={v.scoreStroke} strokeWidth="11" strokeLinecap="round" strokeDasharray={v.scoreDash} style={{ transition: 'stroke-dasharray .7s cubic-bezier(.32,1,.35,1)', animation: 'sweep .9s cubic-bezier(.32,1,.35,1) both' }} />
              </svg>
              <div style={{ position: 'absolute', left: '0', right: '0', bottom: '0', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1px' }}>
                <span style={{ fontSize: '28px', lineHeight: '0.95', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.03em' }}>{v.score}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#7C7893', paddingBottom: '3px' }}>/100</span>
              </div>
            </div>
            <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#4A4266' }}>Compounding Risk Score</div>
              <div style={css(v.scoreChip)}>{v.scoreLabel}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', textWrap: 'pretty' }}>{v.scoreDriver}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '10px', textWrap: 'pretty' }}>{v.scoreCaption}</div>
          {v.showRiskParts ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F0EDF7', animation: 'fadeUp .25s ease both' }}>
              {(v.riskParts || []).map((part: any, i: number) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#0B0620' }}>
                    <span>{part.label}</span>
                    <span style={{ color: '#7C7893' }}>{part.points}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: '#EFEBF8', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={css(part.barStyle)} />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B36F0' }}>{v.scoreMultiplier}</div>
            </div>
          ) : null}
          <div onClick={v.toggleRiskParts} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px', padding: '10px', borderRadius: '14px', background: '#F7F5FC', fontSize: '12px', fontWeight: '700', color: '#6B36F0', cursor: 'pointer' }}>
            <span>{v.riskToggleLabel}</span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={css(v.riskChevronStyle)}>
              <path d="M5 8l5 5 5-5" stroke="#6B36F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px 0', marginBottom: '-8px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Needs attention</span>
          <span onClick={v.goNotifs} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>Inbox</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div onClick={v.goForecast} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', borderBottom: '1px solid #F0EDF7', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
              <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#FDE7E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3.5l7 12.5H3l7-12.5z" stroke="#C4342C" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M10 8.5v3.2" stroke="#C4342C" strokeWidth="1.7" strokeLinecap="round" />
                  <circle cx="10" cy="13.8" r="0.9" fill="#C4342C" />
                </svg>
              </span>
              <div style={{ minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Overspend alerts</div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893' }}>{v.alertSummary}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: '0' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#C4342C' }}>{v.alertCount}</span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div onClick={v.goComply} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', borderBottom: '1px solid #F0EDF7', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
              <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#F3EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3l6 2.5v5c0 3.6-2.5 5.7-6 6.5-3.5-.8-6-2.9-6-6.5v-5L10 3z" stroke="#6B36F0" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </span>
              <div style={{ minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Compliance flags</div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893' }}>{v.flagSummary}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: '0' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#6B36F0' }}>{v.flagCount}</span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div onClick={v.goRemit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '15px 0', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '0' }}>
              <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#EAF7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M4 13.5l4.5-4.5 3 3L16 6.5" stroke="#4E8A41" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div style={{ minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Transfer window</div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893' }}>{v.transferSummary}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: '0' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#4E8A41' }}>{v.transferAction}</span>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        {v.homeHasUpcoming ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-8px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Coming up</span>
              <span onClick={v.goEmi} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>Schedule</span>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '4px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
              {(v.homeUpcomingRows || []).map((due: any, i: number) => (
                <div key={i} onClick={due.open} style={css(due.rowStyle)}>
                  <span style={css(due.iconBoxStyle)}>
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                      <path d={due.iconPath} stroke={due.iconInk} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div style={{ flex: '1', minWidth: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {due.title}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {due.sub}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: '0' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{due.amount}</span>
                    <span style={css(due.whenStyle)}>{due.when}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-8px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Recent activity</span>
          <span onClick={v.goBudget} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>See all</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '4px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {v.hasRecent ? (
            <>
              {(v.recentRows || []).map((txn: any, i: number) => (
                <div key={i} onClick={txn.open} style={css(txn.rowStyle)}>
                  <span style={css(txn.iconBoxStyle)}>
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
                      <path d={txn.iconPath} stroke={txn.iconInk} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div style={{ flex: '1', minWidth: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: '0' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {txn.title}
                      </span>
                      {txn.needsReview ? (
                        <span style={{ flexShrink: '0', padding: '2px 7px', borderRadius: '999px', background: '#FFF1E0', fontSize: '10px', fontWeight: '800', color: '#9A5B00' }}>
                          Review
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#7C7893', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txn.sub}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: '0' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0B0620' }}>{txn.amount}</span>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{txn.amountSub}</span>
                  </div>
                </div>
              ))}
            </>
          ) : null}
          {v.noRecent ? (
            <div style={{ padding: '22px 0', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#7C7893' }}>{v.recentEmptyText}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Closest to budget</span>
          <span onClick={v.goBudget} style={{ fontSize: '13px', fontWeight: '600', color: '#8552FF', cursor: 'pointer' }}>All {v.categoryCount}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(v.topCategories || []).map((item: any, i: number) => (
            <div key={i} onClick={item.open} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.name}</span>
                <span style={css(item.nameStyle)}>{item.spentText}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: '#EFEBF8', marginTop: '8px', overflow: 'hidden' }}>
                <div style={css(item.barStyle)} />
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '5px' }}>{item.spentInRupees}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
