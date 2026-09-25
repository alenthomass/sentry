/* ============================================================================
   Sentry · Form plumbing shared by the loan, remittance and transfer sheets
   All three share one "form" in the UI state: { kind, values, error }.
   ============================================================================ */

import { startOfToday, toIsoDate } from '../shared/dates';
import { STYLE } from './styles';
import { CLOSED_OVERLAYS } from './ui-state';
import { remittanceForm } from '../modules/compliance/RemittanceSheet';
import { loanForm } from '../modules/loans/LoanSheet';
import { transferForm } from '../modules/transfer-timing/TransferSheet';

// ── START: Shared form plumbing ────────────────────────────────────────────
export var FORM_FIELDS = ['name', 'principal', 'rate', 'tenure', 'disbursed', 'moratoriumEnd', 'amountInr', 'date', 'bank', 'note', 'amount'];

export function openForm(app, kind, values) {
  app.update(Object.assign({}, CLOSED_OVERLAYS, { form: { kind: kind, values: values, error: '' } }));
}

export function formSetters(app) {
  var setters = {};
  FORM_FIELDS.forEach(function (field) {
    setters[field] = function (event) { setFormValue(app, field, event.target.value); };
  });
  return setters;
}

export function setFormValue(app, field, value) {
  app.update(function (current) {
    var values = Object.assign({}, current.form.values);
    values[field] = value;
    return { form: Object.assign({}, current.form, { values: values, error: '' }) };
  });
}

export function showFormError(app, message) {
  app.update(function (current) { return { form: Object.assign({}, current.form, { error: message }) }; });
}
// ── END: Shared form plumbing ──────────────────────────────────────────────

// ── START: Form sheets bindings ────────────────────────────────────────────
export function formSheets(app) {
  var summary = app.summary;
  var profile = app.profile;
  var form = app.ui.form;
  var kind = form ? form.kind : null;
  var values = form ? form.values : {};
  var builders = { loan: loanForm, remittance: remittanceForm, transfer: transferForm };
  var active = kind ? builders[kind](app, values) : null;

  return Object.assign({
    loanSheetOpen: kind === 'loan',
    remitSheetOpen: kind === 'remittance',
    transferSheetOpen: kind === 'transfer',
    form: values,
    formSet: formSetters(app),
    formError: form ? form.error : '',
    formButtonText: active ? active.buttonText : '',
    formButtonStyle: active && active.isValid ? STYLE.buttonEnabled : STYLE.buttonDisabled,
    closeForm: function () { app.update({ form: null }); },
    saveLoan: active && kind === 'loan' ? active.save : function () {},
    saveRemit: active && kind === 'remittance' ? active.save : function () {},
    saveTransfer: active && kind === 'transfer' ? active.save : function () {},
    openLoanSheet: function () { openForm(app, 'loan', { mode: 'simple', disbursed: toIsoDate(startOfToday()) }); },
    openRemitSheet: function () { openForm(app, 'remittance', { date: toIsoDate(startOfToday()), purpose: 'education', loanFunded: summary.fundedByLoan, bank: profile.homeBank || '' }); },
    openTransferSheet: function () { openForm(app, 'transfer', { amount: String(summary.transferAmount) }); },
    loanPreview: [], loanModeOptions: [], remitPreview: [], remitIsEducation: true, purposeOptions: [], loanFundedOptions: [], transferPresets: [], transferPreview: []
  }, active ? active.bindings : {});
}
// ── END: Form sheets bindings ──────────────────────────────────────────────
