/* ============================================================================
   Sentry · App frame                                         (owner: Shaheen)
   The phone-sized frame every screen sits in: the scrolling screen area,
   the pop-up sheets, the toast and the tab bar with the + button.
   ============================================================================ */

import { css, type ViewProps } from './styles';
import { AccountView } from '../modules/account/AccountScreen';
import { SettingsView } from '../modules/account/SettingsScreen';
import { RegisterView, SignInView } from '../modules/account/SignInScreen';
import { ConnectBankSheetView } from '../modules/banking/ConnectBankSheet';
import { AddExpenseSheetView } from '../modules/budget/AddExpenseSheet';
import { BudgetView } from '../modules/budget/BudgetScreen';
import { CategoriseSheetView } from '../modules/budget/CategoriseSheet';
import { MonthlyBudgetSheetView } from '../modules/budget/MonthlyBudgetSheet';
import { ComplianceView } from '../modules/compliance/ComplianceScreen';
import { RemittanceSheetView } from '../modules/compliance/RemittanceSheet';
import { HomeView } from '../modules/dashboard/HomeScreen';
import { NotificationsView } from '../modules/dashboard/NotificationsScreen';
import { ForecastView } from '../modules/forecast/ForecastScreen';
import { LoanSheetView } from '../modules/loans/LoanSheet';
import { LoansView } from '../modules/loans/LoansScreen';
import { TransferSheetView } from '../modules/transfer-timing/TransferSheet';
import { TransferTimingView } from '../modules/transfer-timing/TransferTimingScreen';

// ── START: Frame ───────────────────────────────────────────────────────────
export function AppFrame({ v }: ViewProps) {
  return (
    <div style={{ position: 'fixed', top: '0', right: '0', bottom: 'calc(0px - env(safe-area-inset-top))', left: '0', display: 'flex', justifyContent: 'center', background: '#EFE9FA', overflow: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: '460px', height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#EEE9F8 0%,#C9B3FC 9%,#DAC7FF 17%,#EFE8FF 28%,#F5F4F9 42%,#F5F4F9 100%)' }}>
        <div data-scroll-host="1" style={{ flex: '1', minHeight: '0', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingTop: 'max(env(safe-area-inset-top), 20px)', boxSizing: 'border-box' }}>
          {v.onLogin ? <SignInView v={v} /> : null}
          {v.onRegister ? <RegisterView v={v} /> : null}
          {v.onHome ? <HomeView v={v} /> : null}
          {v.onBudget ? <BudgetView v={v} /> : null}
          {v.onForecast ? <ForecastView v={v} /> : null}
          {v.onEmi ? <LoansView v={v} /> : null}
          {v.onComply ? <ComplianceView v={v} /> : null}
          {v.onRemit ? <TransferTimingView v={v} /> : null}
          {v.onNotifs ? <NotificationsView v={v} /> : null}
          {v.onAccount ? <AccountView v={v} /> : null}
          {v.onSettings ? <SettingsView v={v} /> : null}
        </div>

        <div style={{ position: 'absolute', top: '0', left: '0', right: '0', height: 'env(safe-area-inset-top)', background: 'linear-gradient(180deg,#EEE9F8 0%,#C9B3FC 9%,#DAC7FF 17%,#EFE8FF 28%,#F5F4F9 42%,#F5F4F9 100%)', backgroundSize: '100% 100vh', backgroundRepeat: 'no-repeat', zIndex: '40', pointerEvents: 'none' }} />
        {v.addExpenseOpen ? <AddExpenseSheetView v={v} /> : null}
        {v.budgetSheetOpen ? <MonthlyBudgetSheetView v={v} /> : null}
        {v.loanSheetOpen ? <LoanSheetView v={v} /> : null}
        {v.remitSheetOpen ? <RemittanceSheetView v={v} /> : null}
        {v.transferSheetOpen ? <TransferSheetView v={v} /> : null}
        {v.connectOpen ? <ConnectBankSheetView v={v} /> : null}
        {v.categoriseOpen ? <CategoriseSheetView v={v} /> : null}

        {v.toastOpen ? <ToastView v={v} /> : null}
        {v.authed ? <TabBarView v={v} /> : null}
      </div>
    </div>
  );
}
// ── END: Frame ─────────────────────────────────────────────────────────────


// ── START: Toast and tab bar ───────────────────────────────────────────────
function ToastView({ v }: ViewProps) {
  return (
    <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: 'calc(66px + max(env(safe-area-inset-bottom), 14px))', display: 'flex', alignItems: 'center', gap: '10px', background: '#1B1233', borderRadius: '18px', padding: '14px 16px', boxShadow: '0 12px 30px rgba(5,0,17,0.3)', zIndex: '45', animation: 'toastIn .28s cubic-bezier(.22,.9,.3,1) both' }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'rgba(171,227,158,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#ABE39E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ flex: '1', minWidth: '0', fontSize: '12px', fontWeight: '700', color: '#FFFFFF' }}>{v.toast}</span>
      <span onClick={v.clearToast} style={{ fontSize: '12px', fontWeight: '700', color: '#C9B4FF', cursor: 'pointer', flexShrink: '0' }}>Dismiss</span>
    </div>
  );
}

function TabBarView({ v }: ViewProps) {
  return (
    <>
      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: 'calc(52px + max(env(safe-area-inset-bottom), 14px))', boxSizing: 'border-box', background: '#FFFFFF', borderRadius: '26px 26px 0 0', boxShadow: '0 -6px 26px rgba(5,0,17,0.10)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 24px 0', zIndex: '30' }}>
        <div onClick={v.goHome} style={css(v.tabHome)}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path d="M3.2 8.6L10 3l6.8 5.6V16a1 1 0 01-1 1h-3.4v-4.4H7.6V17H4.2a1 1 0 01-1-1V8.6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 'inherit', color: 'currentColor' }}>Home</span>
        </div>
        <div onClick={v.goBudget} style={css(v.tabBudget)}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="5.5" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M13 10.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 'inherit', color: 'currentColor' }}>Budget</span>
        </div>
        <div style={{ width: '56px' }} />
        <div onClick={v.goForecast} style={css(v.tabForecast)}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path d="M3.5 14l4-4.5 3 2.5 5.5-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 'inherit', color: 'currentColor' }}>Forecast</span>
        </div>
        <div onClick={v.goComply} style={css(v.tabComply)}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <path d="M10 3l6 2.5v5c0 3.6-2.5 5.7-6 6.5-3.5-.8-6-2.9-6-6.5v-5L10 3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 'inherit', color: 'currentColor' }}>Comply</span>
        </div>
      </div>
      <div onClick={v.openSheet} style={{ position: 'absolute', bottom: 'calc(4px + max(env(safe-area-inset-bottom), 14px))', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '60px', borderRadius: '30px', background: '#1B1233', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(27,18,51,0.4)', cursor: 'pointer', zIndex: '35' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 6.5v11M6.5 12h11" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </>
  );
}
// ── END: Toast and tab bar ─────────────────────────────────────────────────
