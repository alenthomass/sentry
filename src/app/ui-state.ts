/* ============================================================================
   Sentry · UI state shared by every screen
   What the app starts with, which overlays can be open, the bindings every
   screen shares (navigation, tab bar, toast) and the two-tap delete button.
   ============================================================================ */

import { deleteButtonStyle, STYLE } from './styles';
import { Store } from '../data/store';

// ── START: Starting values ─────────────────────────────────────────────────
export var EMPTY_REGISTRATION = { name: '', email: '', phone: '', password: '', uni: '', courseEnds: '', budget: '', pan: '', funding: 'Education loan', country: 'UK' };

export var CLOSED_OVERLAYS = { addExpense: null, monthlyBudget: null, form: null, categorise: null, connectBank: null };

export var STARTING_STATE = Object.assign({
  screen: 'starting',
  busy: false,
  toast: '',
  signIn: { email: '', password: '', error: '', keepSignedIn: true },
  registration: Object.assign({}, EMPTY_REGISTRATION),
  registrationError: '',
  forecastCategory: 1,
  categoryGroup: 'all',
  showBand: true,
  showInsight: true,
  expenseFilter: 'all',
  showAllExpenses: false,
  selectedLoan: 0,
  showFullSchedule: false,
  armedDelete: null,
  editingDetails: false,
  detailsDraft: {},
  confirmAccountDeletion: false,
  showRiskParts: false,
  syncing: false
}, CLOSED_OVERLAYS);
// ── END: Starting values ───────────────────────────────────────────────────

// ── START: Bindings every screen shares ────────────────────────────────────
export function sharedBindings(app) {
  var ui = app.ui;
  var onScreen = function (name) { return ui.screen === name; };
  var homeGroup = ['home', 'emi', 'remit', 'notifs', 'account', 'settings'];
  return {
    authed: !!(app.summary && Store.user()),
    toastOpen: !!ui.toast,
    toast: ui.toast,
    clearToast: function () { app.update({ toast: '' }); },
    onLogin: onScreen('login'),
    onRegister: onScreen('register'),
    onHome: onScreen('home'),
    onBudget: onScreen('budget'),
    onForecast: onScreen('forecast'),
    onComply: onScreen('comply'),
    onEmi: onScreen('emi'),
    onRemit: onScreen('remit'),
    onNotifs: onScreen('notifs'),
    onAccount: onScreen('account'),
    onSettings: onScreen('settings'),
    goLogin: app.goTo('login'),
    goRegister: app.goTo('register'),
    goHome: app.goTo('home'),
    goBudget: app.goTo('budget'),
    goForecast: app.goTo('forecast'),
    goComply: app.goTo('comply'),
    goEmi: app.goTo('emi'),
    goRemit: app.goTo('remit'),
    goNotifs: app.goTo('notifs'),
    goAccount: app.goTo('account'),
    goSettings: app.goTo('settings'),
    tabHome: homeGroup.indexOf(ui.screen) >= 0 ? STYLE.tabActive : STYLE.tabInactive,
    tabBudget: onScreen('budget') ? STYLE.tabActive : STYLE.tabInactive,
    tabForecast: onScreen('forecast') ? STYLE.tabActive : STYLE.tabInactive,
    tabComply: onScreen('comply') ? STYLE.tabActive : STYLE.tabInactive
  };
}

export function twoTapDelete(app, key, warning, onConfirm) {
  var armed = app.ui.armedDelete === key;
  return {
    style: deleteButtonStyle(armed),
    armed: armed,
    press: function () {
      if (!armed) {
        app.update({ armedDelete: key });
        if (warning) app.toast(warning);
        return;
      }
      app.update({ armedDelete: null });
      onConfirm();
    }
  };
}
// ── END: Bindings every screen shares ──────────────────────────────────────
