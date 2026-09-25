/* ============================================================================
   Sentry · Connected banking: linked accounts, sync and the connect flow
   (owner: Alen)
   The connect sheet walks through four steps:
     pick a bank → review the read-only consent → working → done (summary)
   ============================================================================ */

import { addMonths, formatFullDate, pluralize, startOfToday } from '../../shared/dates';
import { bankLogoStyle, choiceChips, css, rowStyle, STYLE, type ViewProps } from '../../app/styles';
import { CLOSED_OVERLAYS, twoTapDelete } from '../../app/ui-state';
import { Store } from '../../data/store';
import { BankSync } from './bank-sync';
import { banksFor, findBank } from './mock-bank';
import { formatBankAmount } from '../dashboard/HomeScreen';

// ── START: Sync helpers ────────────────────────────────────────────────────
export function timeAgo(isoTimestamp) {
  if (!isoTimestamp) return 'never';
  var minutes = Math.max(0, Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.round(minutes / 60) + 'h ago';
  return pluralize(Math.round(minutes / 1440), 'day') + ' ago';
}

export function accountNumber(connection) {
  return connection.account.replace(/^\w+ /, '');
}

export async function syncBanks(app, banks) {
  if (app.ui.syncing || !banks.length) return;
  app.update({ syncing: true });
  var totals = { expenses: 0, needReview: 0, remittances: 0, emisMatched: 0 };
  try {
    for (var i = 0; i < banks.length; i++) {
      var stats = await BankSync.sync(banks[i].id);
      Object.keys(totals).forEach(function (key) { totals[key] += stats[key] || 0; });
    }
    app.reloadData();
    var parts = [];
    if (totals.expenses) parts.push(pluralize(totals.expenses, 'payment'));
    if (totals.remittances) parts.push(pluralize(totals.remittances, 'remittance'));
    if (totals.emisMatched) parts.push(pluralize(totals.emisMatched, 'EMI') + ' matched');
    app.toast(parts.length ? 'Imported ' + parts.join(' · ') + (totals.needReview ? ' · ' + totals.needReview + ' to review' : '') : 'Up to date · nothing new');
  } catch (error) {
    app.toast(error.message || 'Sync failed');
  }
  app.update({ syncing: false });
}

export function openConnectBank(app, region) {
  app.update(Object.assign({}, CLOSED_OVERLAYS, { connectBank: { step: 'pick', region: region } }));
}
// ── END: Sync helpers ──────────────────────────────────────────────────────


// ── START: Linked accounts card and Budget banner ──────────────────────────
export function bankingBindings(app) {
  var profile = app.profile;
  var money = app.money;
  var ui = app.ui;
  var banks = profile.banks || [];
  var cardBanks = banks.filter(function (bank) { return bank.region === 'abroad'; });
  var indianBanks = banks.filter(function (bank) { return bank.region === 'india'; });
  var reviewCount = app.summary.needsReviewCount;
  var greenChip = 'padding:5px 10px;border-radius:999px;background:#EAF7E6;font-size:11px;font-weight:800;color:#4E8A41;white-space:nowrap;cursor:pointer';
  var purpleChip = 'padding:5px 10px;border-radius:999px;background:#F3EDFF;font-size:11px;font-weight:800;color:#6B36F0;white-space:nowrap;cursor:pointer';
  var defaultRegion = cardBanks.length && !indianBanks.length ? 'india' : 'abroad';

  var rows = banks.map(function (bank) {
    var disconnect = twoTapDelete(app, 'bank:' + bank.id, 'Tap × again to disconnect ' + bank.name + ' (imported data stays)', async function () {
      await BankSync.disconnect(bank);
      app.saveProfile({ banks: (Store.read('profile').banks || []).filter(function (item) { return item.id !== bank.id; }) });
      app.toast(bank.name + ' disconnected · consent revoked');
    });
    return {
      logo: bank.logo,
      logoStyle: bankLogoStyle(bank.color),
      title: bank.name + ' ' + accountNumber(bank),
      details: bank.region === 'india' ? 'Remittances · INR · Account Aggregator' : 'Spending · ' + bank.currency + ' · Open banking',
      chipText: ui.syncing ? 'Syncing…' : 'Synced ' + timeAgo(bank.lastSync),
      chipStyle: greenChip,
      chipAction: function () { syncBanks(app, [bank]); },
      canRemove: true,
      deleteStyle: disconnect.style,
      remove: disconnect.press
    };
  });
  if (!cardBanks.length) {
    rows.push({ logo: money.code, logoStyle: bankLogoStyle('#C9B4FF'), title: profile.localBank || 'Spending account', details: 'Spending · ' + money.code + ' · entered by hand',
      chipText: 'Connect', chipStyle: purpleChip, chipAction: function () { openConnectBank(app, 'abroad'); }, canRemove: false });
  }
  if (!indianBanks.length) {
    rows.push({ logo: '₹', logoStyle: bankLogoStyle('#C9B4FF'), title: profile.homeBank || 'Remitting bank in India', details: 'Remittances · INR · entered by hand',
      chipText: 'Connect', chipStyle: purpleChip, chipAction: function () { openConnectBank(app, 'india'); }, canRemove: false });
  }
  rows.forEach(function (row, index) { row.rowStyle = rowStyle(index, rows.length, 'display:flex;align-items:center;gap:12px;padding:15px 0'); });

  var mainCard = cardBanks[0];
  return {
    bankRows: rows,
    openConnect: function () { openConnectBank(app, defaultRegion); },
    syncAll: function () { syncBanks(app, banks); },
    syncAllLabel: banks.length ? (ui.syncing ? 'Syncing…' : 'Sync now') : 'Not connected',
    syncAllStyle: 'font-size:12px;font-weight:' + (banks.length ? '700;color:#8552FF;cursor:pointer' : '600;color:#7C7893'),
    bankBannerTitle: mainCard ? mainCard.name + ' connected' : 'Connect your bank',
    bankBannerSub: mainCard
      ? (ui.syncing ? 'Syncing…' : 'Synced ' + timeAgo(mainCard.lastSync) + (reviewCount ? ' · ' + reviewCount + ' to review' : ' · all categorised'))
      : 'Import card spending and categorise it automatically',
    bankBannerLabel: mainCard ? (ui.syncing ? '…' : 'Sync') : 'Connect',
    bankBannerAction: mainCard ? function () { syncBanks(app, banks); } : function () { openConnectBank(app, 'abroad'); },
    bankBannerBtn: 'flex-shrink:0;padding:9px 15px;border-radius:999px;background:#8552FF;font-size:12px;font-weight:700;color:#FFFFFF;cursor:pointer;white-space:nowrap'
  };
}
// ── END: Linked accounts card and Budget banner ────────────────────────────


// ── START: Connect-a-bank sheet ────────────────────────────────────────────
export function connectResultRows(region, stats, balanceText) {
  if (!stats) return [];
  var balanceRow = balanceText ? [{ label: 'Current balance', value: balanceText, style: STYLE.valueTextLarge }] : [];
  if (region === 'india') {
    return balanceRow.concat([
      { label: 'Statement lines read', value: String(stats.lines), style: STYLE.valueText },
      { label: 'Remittances logged', value: String(stats.remittances), style: STYLE.valueTextLarge },
      { label: 'TCS debits matched', value: String(stats.tcsMatched), style: STYLE.valueText },
      { label: 'EMI payments marked paid', value: String(stats.emisMatched), style: stats.emisMatched ? STYLE.valueTextGreen : STYLE.valueText }
    ]);
  }
  return balanceRow.concat([
    { label: 'Card payments imported', value: String(stats.expenses), style: STYLE.valueTextLarge },
    { label: 'Auto-categorised', value: String(stats.autoFiled), style: STYLE.valueTextGreen },
    { label: 'Need a quick review', value: String(stats.needReview), style: stats.needReview ? STYLE.valueTextAmber : STYLE.valueText },
    { label: 'Top-ups from India (not spending)', value: String(stats.topUps), style: STYLE.valueText },
    { label: 'Matched to entries you typed', value: String(stats.linkedToTyped), style: STYLE.valueText },
    { label: 'Forecast history rebuilt', value: stats.monthsRebuilt.length ? pluralize(stats.monthsRebuilt.length, 'month') : '—', style: STYLE.valueText }
  ]);
}

export function connectBankSheet(app) {
  var money = app.money;
  var profile = app.profile;
  var flow = app.ui.connectBank;
  var region = flow ? flow.region : 'abroad';
  var step = flow ? flow.step : null;
  var available = banksFor(money.code);
  var chosenBank = flow && flow.bankId ? findBank(flow.bankId) : null;
  var today = startOfToday();
  var yearStart = new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1);
  var connectedIds = (profile.banks || []).map(function (bank) { return bank.bankId; });
  var protocol = region === 'india' ? 'RBI Account Aggregator · consent via AA' : (available.abroad[0] ? available.abroad[0].protocol : 'Open banking');
  var stats = flow && flow.stats;

  function setFlow(next) {
    app.update({ connectBank: next });
  }

  function advance(progress) {
    app.update(function (current) { return { connectBank: Object.assign({}, current.connectBank, { progress: progress }) }; });
  }

  function pause(milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  }

  async function approve() {
    var bankId = flow.bankId;
    setFlow({ step: 'working', region: region, bankId: bankId, progress: 0 });
    try {
      await pause(500);
      var connection = await BankSync.connect(bankId, money.code);
      await pause(450);
      advance(1);
      var latest = Store.read('profile');
      var accountLabel = connection.name + ' ' + accountNumber(connection);
      await Store.save('profile', Object.assign({}, latest, {
        banks: (latest.banks || []).concat([connection]),
        localBank: region === 'abroad' ? accountLabel : latest.localBank,
        homeBank: region === 'india' ? accountLabel : latest.homeBank
      }));
      await pause(450);
      advance(2);
      var result = await BankSync.sync(connection.id);
      advance(3);
      await pause(450);
      app.reloadData();
      var synced = (Store.read('profile').banks || []).filter(function (bank) { return bank.id === connection.id; })[0];
      var balance = synced && synced.balance;
      setFlow({ step: 'done', region: region, bankId: bankId, stats: result, balanceText: balance ? formatBankAmount(balance, balance.current, money) : '' });
    } catch (error) {
      setFlow({ step: 'consent', region: region, bankId: bankId });
      app.toast(error.message || 'Could not connect');
    }
  }

  function finish() {
    var goReview = region === 'abroad' && stats && stats.needReview;
    if (goReview) app.update({ connectBank: null, screen: 'budget', categoryGroup: 'all', expenseFilter: 'review', showAllExpenses: true });
    else app.update({ connectBank: null, screen: region === 'india' ? 'comply' : 'budget' });
  }

  var stepLabels = region === 'india'
    ? ['Consent approved', 'Fetching accounts and balances', 'Reading statement (FI data)', 'Matching remittances, TCS and EMIs']
    : ['Consent approved', 'Fetching accounts and balances', 'Importing card transactions', 'Auto-categorising payments'];
  var progress = flow ? flow.progress || 0 : 0;

  var button = { text: '', action: null };
  if (step === 'consent') button = { text: 'Approve & connect', action: approve };
  if (step === 'done') button = { text: region === 'abroad' && stats && stats.needReview ? 'Review ' + pluralize(stats.needReview, 'payment') : 'Done', action: finish };

  var permissions = region === 'india'
    ? [['Account details', 'Account type, masked number and holder name'], ['Statement (FI data)', 'Debits and credits with narrations — outward remittances, TCS, loan EMIs'], ['Balance', 'Current balance, refreshed on each sync']]
    : [['Account details', 'Account name, masked number and currency'], ['Balances', 'Available and current balance'], ['Transactions', 'Card payments with merchant name and merchant category code']];
  var bankList = region === 'india' ? available.india : available.abroad;

  return {
    connectOpen: !!flow,
    closeConnect: function () { if (step !== 'working') app.update({ connectBank: null }); },
    connectTitle: { pick: 'Connect a bank', consent: 'Review access', working: 'Connecting…', done: 'Connected' }[step] || '',
    connectPick: step === 'pick',
    connectConsent: step === 'consent',
    connectWorking: step === 'working',
    connectDone: step === 'done',
    connectRegions: choiceChips([{ value: 'abroad', label: 'Bank in ' + money.country.label }, { value: 'india', label: 'Bank in India' }], region, function (value) { setFlow({ step: 'pick', region: value }); }),
    connectRegionNote: region === 'india'
      ? 'Uses India’s RBI Account Aggregator: you approve a consent in your AA app and your bank shares a read-only statement. Sentry logs LRS remittances, matches TCS debits and marks EMI auto-debits as paid.'
      : 'Uses ' + protocol + '. Card payments arrive with merchant names and codes, and Sentry files each one into your budget categories automatically.',
    institutions: bankList.map(function (bank, index) {
      var alreadyConnected = connectedIds.indexOf(bank.id) >= 0;
      return {
        name: bank.name,
        note: alreadyConnected ? 'Already connected' : bank.protocol,
        logo: bank.logo,
        logoStyle: bankLogoStyle(bank.color),
        rowStyle: rowStyle(index, bankList.length, 'display:flex;align-items:center;gap:12px;padding:13px 0;cursor:pointer' + (alreadyConnected ? ';opacity:0.45' : '')),
        select: function () { if (!alreadyConnected) setFlow({ step: 'consent', region: region, bankId: bank.id }); }
      };
    }),
    consentLogo: chosenBank ? chosenBank.logo : '',
    consentLogoStyle: chosenBank ? bankLogoStyle(chosenBank.color, 44) : '',
    consentBank: chosenBank ? chosenBank.name : '',
    consentProtocol: protocol,
    consentItems: permissions.map(function (item, index) {
      return { title: item[0], note: item[1], rowStyle: rowStyle(index, permissions.length, 'display:flex;align-items:flex-start;gap:12px;padding:12px 0') };
    }),
    consentTerms: [
      { label: 'History shared', value: region === 'india' ? 'From ' + formatFullDate(yearStart) : 'Last 2 full months' },
      { label: 'Consent valid until', value: formatFullDate(addMonths(today, 12)) },
      { label: 'Refresh', value: 'When you tap Sync' },
      { label: 'Revoke', value: 'Any time in Account' }
    ],
    workSteps: stepLabels.map(function (label, index) {
      var done = index <= progress;
      var active = index === progress + 1;
      return {
        label: label,
        done: done,
        rowStyle: 'display:flex;align-items:center;gap:12px;padding:12px 0',
        dotStyle: 'width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background-color .3s ease;background:' +
          (done ? '#ABE39E' : active ? '#DCCCFF' : '#F3F1FA') + (active ? ';animation:dim 0.9s ease-in-out infinite alternate' : ''),
        textStyle: 'font-size:14px;font-weight:' + (done || active ? '700' : '600') + ';color:' + (done || active ? '#0B0620' : '#9A95AE')
      };
    }),
    doneTitle: chosenBank ? chosenBank.name + ' is connected' : '',
    doneSub: region === 'india' ? 'Your compliance check and EMI schedule now use bank data.' : 'Your budget, forecast and risk score now use bank data.',
    doneRows: connectResultRows(region, stats, flow && flow.balanceText),
    connectHasCta: !!button.action,
    connectAction: button.action || function () {},
    connectButtonText: button.text,
    connectButtonStyle: STYLE.buttonEnabled,
    connectBack: function () { setFlow({ step: 'pick', region: region }); }
  };
}
// ── END: Connect-a-bank sheet ──────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function ConnectBankSheetView({ v }: ViewProps) {
  return (
    <>
      <div onClick={v.closeConnect} style={{ position: 'absolute', inset: '0', background: 'rgba(11,6,32,0.45)', zIndex: '40', animation: 'dim .22s ease both' }} />
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', boxSizing: 'border-box', maxHeight: '88%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '28px 28px 0 0', padding: '22px 20px 24px', boxShadow: '0 -12px 40px rgba(5,0,17,0.25)', zIndex: '50', animation: 'sheetUp .32s cubic-bezier(.22,.9,.3,1) both' }}>
        <div style={{ flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620' }}>{v.connectTitle}</span>
          <span onClick={v.closeConnect} aria-label="Close" style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#F3F1FA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="#4A4266" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <div style={{ flex: '1', minHeight: '0', overflowY: 'auto', scrollbarWidth: 'none' }}>
          {v.connectPick ? (
            <>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {(v.connectRegions || []).map((item: any, i: number) => (
                  <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
                ))}
              </div>
              <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '16px', background: '#F7F5FD', fontSize: '12px', fontWeight: '600', color: '#4A4266', lineHeight: '1.45', textWrap: 'pretty' }}>
                {v.connectRegionNote}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginTop: '18px' }}>
                Choose your bank
              </div>
              <div style={{ marginTop: '4px' }}>
                {(v.institutions || []).map((item: any, i: number) => (
                  <div key={i} onClick={item.select} style={css(item.rowStyle)}>
                    <span style={css(item.logoStyle)}>{item.logo}</span>
                    <div style={{ flex: '1', minWidth: '0' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{item.note}</div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {v.connectConsent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px' }}>
                <span style={css(v.consentLogoStyle)}>{v.consentLogo}</span>
                <div style={{ minWidth: '0' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0B0620' }}>{v.consentBank}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{v.consentProtocol}</div>
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', marginTop: '16px', textWrap: 'pretty' }}>
                Sentry is asking for read-only access. It can never move money.
              </div>
              <div style={{ marginTop: '6px' }}>
                {(v.consentItems || []).map((item: any, i: number) => (
                  <div key={i} style={css(item.rowStyle)}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '11px', background: '#ABE39E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0', marginTop: '1px' }}>
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                        <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#22401B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div style={{ minWidth: '0' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', textWrap: 'pretty' }}>{item.note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(v.consentTerms || []).map((row: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0B0620', textAlign: 'right' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 14px', borderRadius: '16px', background: '#FFF1D6' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#9A5B00' }}>Demo</span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B4A12', textWrap: 'pretty' }}>
                  Simulated connection for the prototype. No login or credentials are collected; the bank data is generated.
                </span>
              </div>
            </>
          ) : null}
          {v.connectWorking ? (
            <div style={{ marginTop: '18px' }}>
              {(v.workSteps || []).map((item: any, i: number) => (
                <div key={i} style={css(item.rowStyle)}>
                  <span style={css(item.dotStyle)}>
                    {item.done ? (
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                        <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#22401B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span style={css(item.textStyle)}>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          {v.connectDone ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '20px' }}>
                <span style={{ width: '52px', height: '52px', borderRadius: '26px', background: '#ABE39E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                    <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#22401B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#0B0620', marginTop: '12px' }}>{v.doneTitle}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '4px', textWrap: 'pretty' }}>{v.doneSub}</div>
              </div>
              <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {(v.doneRows || []).map((row: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>{row.label}</span>
                    <span style={css(row.style)}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
        {v.connectHasCta ? (
          <div onClick={v.connectAction} style={css(v.connectButtonStyle)}>{v.connectButtonText}</div>
        ) : null}
        {v.connectConsent ? (
          <div onClick={v.connectBack} style={{ flexShrink: '0', marginTop: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#7C7893', cursor: 'pointer' }}>
            Choose a different bank
          </div>
        ) : null}
      </div>
    </>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
