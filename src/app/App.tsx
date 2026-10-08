/* ============================================================================
   Sentry · App (the React root component)                    (owner: Shaheen)
   Holds what is on screen right now, loads the signed-in user's data and
   asks every screen for its bindings; AppFrame draws the page.
   ============================================================================ */

import React from 'react';
import { AppFrame } from './AppFrame';
import { formSheets } from './forms';
import { CLOSED_OVERLAYS, sharedBindings, STARTING_STATE } from './ui-state';
import { buildDemoAccount } from '../data/demo';
import { createProfile, PROFILE_VERSION, upgradeProfile } from '../data/profile';
import { Store } from '../data/store';
import { buildSummary } from '../data/summary';
import { loadUserData } from '../data/user-data';
import { accountScreen } from '../modules/account/AccountScreen';
import { settingsScreen } from '../modules/account/SettingsScreen';
import { registerScreen, signInScreen } from '../modules/account/SignInScreen';
import { bankingBindings, connectBankSheet } from '../modules/banking/ConnectBankSheet';
import { addExpenseSheet } from '../modules/budget/AddExpenseSheet';
import { budgetScreen, expenseListBindings } from '../modules/budget/BudgetScreen';
import { categoriseSheet } from '../modules/budget/CategoriseSheet';
import { monthlyBudgetSheet } from '../modules/budget/MonthlyBudgetSheet';
import { complianceScreen } from '../modules/compliance/ComplianceScreen';
import { homeScreen } from '../modules/dashboard/HomeScreen';
import { notificationsScreen } from '../modules/dashboard/NotificationsScreen';
import { forecastScreen } from '../modules/forecast/ForecastScreen';
import { loansScreen } from '../modules/loans/LoansScreen';
import { transferTimingScreen } from '../modules/transfer-timing/TransferTimingScreen';
import { findCountry } from '../modules/transfer-timing/currency';

// ── START: The component ───────────────────────────────────────────────────
export function SentryApp() {
  var dataState = React.useState(null);
  var data = dataState[0];
  var setData = dataState[1];
  var rateState = React.useState(null);
  var liveRate = rateState[0];
  var setLiveRate = rateState[1];
  var uiState = React.useState(STARTING_STATE);
  var ui = uiState[0];
  var setUi = uiState[1];
  var toastTimer = React.useRef(null);

  function update(change) {
    setUi(function (current) {
      return Object.assign({}, current, typeof change === 'function' ? change(current) : change);
    });
  }

  function toast(message) {
    update({ toast: message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(function () { update({ toast: '' }); }, 3200);
  }

  function reloadData() {
    setData(loadUserData(liveRate));
  }

  function saveProfile(changes) {
    var profile = Object.assign({}, upgradeProfile(Store.read('profile')), changes);
    Store.save('profile', profile);
    reloadData();
    return profile;
  }

  function goTo(screen) {
    return function () {
      update(Object.assign({ screen: screen, armedDelete: null, confirmAccountDeletion: false }, CLOSED_OVERLAYS));
    };
  }

  async function prepareSignedInUser(openingDemo) {
    var saved = Store.read('profile');
    var isDemo = openingDemo || (Store.user() && Store.user().email === 'demo@sentry.app');
    var demoIsOutdated = isDemo && saved && saved.version !== PROFILE_VERSION;
    if (!saved || demoIsOutdated) {
      if (isDemo) {
        await Store.removeAll();
        var demo = buildDemoAccount('UK');
        await Promise.all(Object.keys(demo).map(function (id) { return Store.save(id, demo[id]); }));
      } else {
        await Store.save('profile', createProfile({ name: (Store.user().email || '').split('@')[0] }, Store.user().email));
      }
    } else if (saved.version !== PROFILE_VERSION) {
      await Store.save('profile', upgradeProfile(saved));
    }
    setData(loadUserData(liveRate));
  }

  React.useEffect(function () {
    Store.onError(function (error) { toast(error && error.message ? error.message : 'Could not save that change — check your connection.'); });
    Store.start().then(function () {
      var signedIn = !!Store.user();
      setData(loadUserData(null));
      update({ screen: signedIn ? 'home' : 'login' });
      if (signedIn) prepareSignedInUser(false);
    });
    return function () { clearTimeout(toastTimer.current); };
  }, []);

  React.useEffect(function () {
    var scroller = document.querySelector('[data-scroll-host]');
    if (scroller) scroller.scrollTop = 0;
  }, [ui.screen]);

  var studyCurrency = data && data.profile ? findCountry(data.profile.country).code : null;
  React.useEffect(function () {
    if (!studyCurrency || Store.mode() !== 'server') return;
    Store.liveRate(studyCurrency).then(function (rate) {
      if (!rate || !rate.rate) return;
      setLiveRate(rate);
      setData(loadUserData(rate));
    });
  }, [studyCurrency]);

  var summary = React.useMemo(function () {
    return data && data.profile ? buildSummary(data) : null;
  }, [data]);

  var app = {
    ui: ui,
    update: update,
    toast: toast,
    goTo: goTo,
    data: data,
    summary: summary,
    profile: summary ? summary.profile : null,
    money: summary ? summary.money : null,
    reloadData: reloadData,
    saveProfile: saveProfile,
    prepareSignedInUser: prepareSignedInUser,
    liveRate: liveRate,
    setData: setData
  };

  var bindings = Object.assign({}, sharedBindings(app), signInScreen(app), registerScreen(app));
  if (summary && Store.user()) {
    Object.assign(bindings,
      homeScreen(app), budgetScreen(app), expenseListBindings(app), forecastScreen(app), complianceScreen(app), transferTimingScreen(app),
      loansScreen(app), notificationsScreen(app), accountScreen(app), settingsScreen(app),
      addExpenseSheet(app), monthlyBudgetSheet(app), formSheets(app), categoriseSheet(app), connectBankSheet(app), bankingBindings(app));
  }
  return <AppFrame v={bindings} />;
}
// ── END: The component ─────────────────────────────────────────────────────
