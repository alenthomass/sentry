/* ============================================================================
   Sentry · Shared types
   The shapes that move between modules: banks and their feeds, the
   student profile the mock bank needs, TCS rule sets and transfer windows.
   ============================================================================ */

export interface Bank {
  id: string;
  name: string;
  short?: string;
  logo: string;
  color: string;
  country: string;
}

export interface BankConnection {
  id: string;
  bankId: string;
  name: string;
  logo: string;
  color: string;
  region: 'abroad' | 'india';
  protocol: string;
  account: string;
  currency: string;
  consentId: string;
  connectedAt: string;
  consentExpires: string;
  lastSync: string | null;
  lastStats?: Record<string, any>;
  balance?: BankBalance | null;
}

export interface BankBalance {
  current: number;
  available: number;
  pending: number;
  currency: string;
  asOf: string;
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  trend: Array<{ date: string; amount: number }>;
}

export interface BankLine {
  id: string;
  date: string;
  direction: 'debit' | 'credit';
  amount: number;
  currency: string;
  description?: string;
  merchantCode?: number | null;
  narration?: string;
}

export interface StudentFeed {
  currencyCode?: string;
  name?: string;
  rupeeRate?: number;
  usualTransfer?: number;
  budgets?: Record<string, number>;
  funding?: string;
  university?: string;
  tuition?: number;
  share?: number;
  manualPayments?: Array<{ id: string; date: string; amount: number; note?: string }>;
  manualRemittances?: Array<{ id: string; date: string; amountInr: number; purpose?: string; loanFunded?: boolean }>;
  loans?: Array<{ id: string; name: string; payments: Array<{ date: string; amount: number }> }>;
}

export interface TcsRuleSet {
  financialYear: string;
  start: string;
  end: string;
  threshold: number;
  lrsLimitUsd: number;
  source: string;
  carriedForward?: boolean;
  rates: Record<string, { above?: number; upTo?: number; flat?: number }>;
}

export interface TransferWindow {
  id: string;
  label: string;
  dates: string;
  date: Date;
  rate: number;
  isForecast: boolean;
  rupees?: number;
  tcs?: number;
  upfront?: number;
  uncertainty?: number;
  extraCost?: number;
}
