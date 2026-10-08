# Sentry

**AI-Powered Financial Assistant for Students Studying Abroad** — Team 16, CU522T Mini Project,
Dept. of Computer Science and Business Systems, Rajagiri School of Engineering & Technology.

Sentry helps an Indian student abroad keep track of three things at once:

- **Spending abroad**, in the local currency and in rupees, with a per-category forecast of month-end overspend.
- **Money sent from India** under the Liberalised Remittance Scheme (LRS): the US$250,000 yearly limit, TCS above ₹10 lakh, and the paperwork (Form A2, Form 26AS, ITR).
- **Education loans**: EMI schedules, including the moratorium and the step-up when it ends.

These roll up into one **Compounding Risk Score** on the home screen.

### The home screen

| Section | What it shows | Tap |
|---|---|---|
| Balance card | Available to spend across your connected accounts abroad (or your Indian balance, or budget left when no bank is linked), a 30-day balance trend, **safe to spend per day**, **how long the balance lasts** at your current pace, and pending card payments | ↻ syncs every bank · *Connect bank* opens the connect flow |
| Accounts | One card per connected account with its current balance | opens Account · *Add account* connects another bank |
| Quick actions | Add expense · Timing (transfer timing advisor) · Sync · Review (badge = payments waiting for a category) | |
| This month | Spent vs budget with a marker for where you *should* be today, left, projected month-end, daily average | opens Budget |
| Risk score | Score, label, biggest driver, and a breakdown of all five parts with the compounding multiplier | *What’s driving it* expands the breakdown |
| Needs attention | Overspend alerts, compliance flags, transfer window | opens Forecast / Comply / Timing advisor |
| Coming up | Next EMIs, a scheduled transfer, and next month’s rent | opens EMI / Timing / Budget |
| Recent activity | Last five payments with category icons and a *Review* badge | opens the categorise sheet |
| Closest to budget | The three categories nearest their limit | opens that category’s forecast |

*Safe to spend* = the smaller of (budget left) and (available balance), minus monthly bills that have not left yet, spread over the days remaining.

## Run it

You need **Node 18+**. Install once, then:

```bash
npm install
npm start          # builds the app, then serves it at http://localhost:3000
npm run dev        # same, with live reload while you edit
npm test           # engine, banking and API tests
npm run typecheck  # TypeScript check
```

`npm run build` bundles the React app into **one file, `dist/index.html`**. It also works without the server: open it from disk, host it statically, or publish it as a claude.ai artifact. In that case accounts and data live on the device (see *Storage modes*). `dist/` is a build output and is not in the repo.

## Tech stack

**React 19 + TypeScript**, bundled by **Vite**. The backend is a small Node HTTP server written in TypeScript (run with `tsx`) that shares the same engine code as the app. There is no UI framework or CSS library: styles are inline, from the design.

## How the code is organised

Each feature lives in its own folder under `src/modules/`, and each folder has an owner. Inside a module, a lowercase file (`budget.ts`) is the **engine** (pure logic, no UI, also used by the server and tests), and a capitalised file (`BudgetScreen.tsx`) is a **screen or sheet**: the function that prepares its data and the React view that draws it.

```
src/
  main.tsx                    Entry point: mounts <SentryApp /> into the page
  app/                        App shell (Shaheen)
    App.tsx                     Root component: state, loading data, gathering every screen's data
    AppFrame.tsx                Phone frame: screen area, sheets, toast, tab bar
    ui-state.ts                 Starting state, navigation, two-tap delete
    forms.ts                    Shared plumbing for the loan / remittance / transfer sheets
    styles.ts                   Colours, tones and style helpers
    base.css, fonts.css
  shared/                     Helpers every module uses: dates.ts, maths.ts, types.ts
  data/                       Data layer: store.ts (accounts + saving), profile.ts, money.ts,
                              summary.ts (runs every engine once), user-data.ts, demo.ts
  modules/
    dashboard/        (Shaheen)   risk.ts · HomeScreen.tsx · NotificationsScreen.tsx
    budget/           (Adeeth)    budget.ts · category-rows.ts · BudgetScreen.tsx ·
                                  AddExpenseSheet.tsx · MonthlyBudgetSheet.tsx · CategoriseSheet.tsx
    loans/            (Adeeth)    loans.ts · LoansScreen.tsx · LoanSheet.tsx
    forecast/         (Sidharth)  forecast.ts · ForecastScreen.tsx
    compliance/       (Alen)      compliance.ts · ComplianceScreen.tsx · RemittanceSheet.tsx
    transfer-timing/  (Alen)      currency.ts · advisor.ts · TransferTimingScreen.tsx · TransferSheet.tsx
    banking/          (Alen)      mock-bank.ts · importer.ts · bank-sync.ts · ConnectBankSheet.tsx
    account/          (Alen & Shaheen)  SignInScreen.tsx · AccountScreen.tsx · SettingsScreen.tsx
server/server.ts              Backend: accounts, documents, live FX, mock banks
tests/                        engines.test.ts · banking.test.ts · server.test.ts
```

**How data flows:** `Store` loads the user's saved documents → `buildSummary()` runs every engine once → each screen's data function turns the summary into values and handlers → its React view draws them.

**Reading the code:** every file starts with a short header saying what it does and who owns it. Inside, the code is grouped into sections that begin with `// ── START: …` and end with `// ── END: …`. There are no line-by-line comments; the function and variable names explain themselves (`runComplianceCheck`, `buildLoanSchedule`, `importBankStatement`, `formatRupees`…).

## Modules and owners

| Module | Owner | Folder |
|---|---|---|
| Budget tracker + EMI scheduler | Adeeth Shajeev | `src/modules/budget/`, `src/modules/loans/` |
| LRS/TCS compliance, FX + remittance timing advisor, connected banking | Alen Thomas | `src/modules/compliance/`, `src/modules/transfer-timing/`, `src/modules/banking/` |
| AI overspend predictor | Sidharth Sunilkumar | `src/modules/forecast/` |
| Risk score, dashboard, integration | Shaheen Ahmed V | `src/modules/dashboard/`, `src/app/`, `src/data/` |
| Accounts, settings, backend | Alen Thomas & Shaheen Ahmed V | `src/modules/account/`, `server/` |

All modules share one category list (`CATEGORIES` in `src/modules/budget/budget.ts`: 9 categories), so the tracker, forecast, risk score and UI all use the same ids.

### Forecasting

In production, Prophet runs offline and its output becomes the month's prior. Nothing runs Python at request time.

In the app, the prior comes from an OLS trend over each category's last six months (the same fallback as `stub_forecast.py`). It is blended with this month's pace to give a projection, a confidence band, a breach probability and a breach day.

### Compliance rules

The rules are versioned per financial year, so an old year is always checked against the law that applied then:

| Financial year | Threshold | Self-funded education | Loan-funded education |
|---|---|---|---|
| FY 2024-25 | ₹7L | 5% | 0.5% |
| FY 2025-26 | ₹10L | 5% | 0% |
| FY 2026-27 | ₹10L | **2%** (Budget 2026, from 1 Apr 2026) | 0% |

In every year, medical remittances attract 2% and other purposes 20%. Loan-funded education only counts at the loan rate once the sanction letter is on file.

## Connected banking (mock)

Sentry can link two kinds of bank account. Both are **simulated**: no credentials are collected, and the feeds are generated deterministically, so re-syncing never duplicates anything.

| Account | Real-world rail it models | What Sentry reads |
|---|---|---|
| Spending account abroad (Monzo, Barclays, Chase, N26…) | UK Open Banking AIS · EU PSD2 · US aggregator · AU CDR | card payments with merchant name and merchant category code (MCC), plus top-ups arriving from India |
| Remitting account in India (HDFC, SBI, ICICI, Axis) | RBI Account Aggregator (consent via an AA app) | statement lines: outward LRS remittances, TCS u/s 206C(1G) debits, EMI auto-debits |

The flow is: **Account → Connect a bank → choose bank → review the read-only consent → approve**. The app then shows each step of the import as it happens.

### What gets marked automatically (`importBankStatement` in `src/modules/banking/importer.ts`)

| Bank line | What Sentry does |
|---|---|
| Card payment | Files it as an expense. The category is chosen in this order: your own rule, then a known merchant name, then the merchant category code. If Sentry is under 60% sure, the payment is flagged **Review**. |
| Same amount as an expense you typed, within 2 days | Links the two instead of counting the expense twice. |
| Top-up from India (e.g. `WISE *…`) | Recognised as a transfer, not spending. |
| `LRS OUTWARD` / `SWIFT OUT` | Logged as a remittance, with the purpose (S0305/S0304), whether it was loan-funded, and Form A2 marked as done. |
| `TCS U/S 206C(1G) REF …` | Matched to its remittance and shown as "bank-confirmed". |
| `NACH DR/… EMI` | Marks that month's instalment as paid on the right loan. |
| Past months fully covered by the feed | Rebuilds the forecast history from real spending. |
| Balance (every sync) | Stores current, available and pending balance plus a 30-day daily trend on the connection (`fetchBankBalance` in `src/modules/banking/mock-bank.ts`). The balance is rebuilt from the same statement lines, so it always agrees with the transactions. |

Correcting a category with **"Always use this for [merchant]"** saves a rule. It also refiles that merchant's other payments this month and in future syncs.

Only your first study-country account carries rent, bills and top-ups. Any extra card you connect carries about a quarter of day-to-day spending.

## Storage modes (`src/data/store.ts`)

| Opened from | Accounts | Data |
|---|---|---|
| `npm start` (server) | scrypt-hashed passwords, 30-day bearer tokens | `server/data/db.json` (git-ignored), one document set per user |
| claude.ai artifact | on the device (PBKDF2 hash) | artifact database, private to each viewer |
| file / static host | on the device (PBKDF2 hash) | browser `localStorage` |

Live FX (ECB rates via frankfurter.app, cached for an hour) is only available through the server. Without it, the app uses a reference snapshot.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | |
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/demo` · `/api/auth/logout` | |
| GET | `/api/me` | returns the user and all their documents |
| PUT / DELETE | `/api/docs/:id` | `id` is one of `profile`, `remits`, `loans`, `history`, `ledger-YYYY-MM` |
| DELETE | `/api/account` | |
| GET | `/api/fx?code=GBP` | also `USD`, `CAD`, `AUD`, `EUR` |
| GET | `/api/bank/institutions?code=GBP` | mock aggregator: banks available abroad and in India |
| POST | `/api/bank/connections` | grant consent and create a connection |
| POST | `/api/bank/connections/:id/statement` | card feed or Account Aggregator statement (at most 12 months), plus the account `balance` as of `to` |
| DELETE | `/api/bank/connections/:id` | revoke consent |

## Not in scope yet

- **Password reset by email.** No mail service is configured.
- **Real bank connections.** The aggregator is a mock. Going live means registering as (or partnering with) an open-banking AISP abroad and an FIU with an RBI-licensed Account Aggregator in India.
- **Wise Sandbox transfers (Feature #7).** Still deferred.

Sentry is a tracking tool, not a tax adviser. Confirm rates with your bank before remitting.
