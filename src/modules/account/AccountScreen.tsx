/* ============================================================================
   Sentry · Account                                    (owner: Alen & Shaheen)
   Profile card, country of study, personal details (with editing) and the
   study and funding details.
   ============================================================================ */

import { formatPercent } from '../../shared/dates';
import { choiceChips, css, rowStyle, type ViewProps } from '../../app/styles';
import { EMAIL_PATTERN, PAN_PATTERN } from './SignInScreen';
import { CATEGORIES } from '../budget/budget';
import { findCountry, rupeesPerUnit, STUDY_COUNTRIES } from '../transfer-timing/currency';

// ── START: Editable fields ─────────────────────────────────────────────────
export var EDITABLE_DETAILS = [
  { key: 'name', label: 'Full name', placeholder: 'Aarav Sharma' },
  { key: 'email', label: 'Email', placeholder: 'you@university.ac.uk' },
  { key: 'phone', label: 'Mobile', placeholder: '+91 98200 12345' },
  { key: 'dob', label: 'Date of birth', placeholder: '14 Mar 2003' },
  { key: 'pan', label: 'PAN', placeholder: 'ABCPS1234K' },
  { key: 'passport', label: 'Passport', placeholder: 'Z4891907' },
  { key: 'uni', label: 'University', placeholder: 'University College London' },
  { key: 'courseEnds', label: 'Course ends', placeholder: 'Sep 2027' },
  { key: 'localBank', label: 'Spending account abroad', placeholder: 'Monzo ••4417' },
  { key: 'homeBank', label: 'Remitting bank in India', placeholder: 'HDFC Bank ••8802' }
];

export function hidePassport(number) {
  return number && number.length > 5 ? number.slice(0, 3) + '••' + number.slice(-3) : number;
}

export function detailRows(rows) {
  return rows.map(function (row, index) {
    return { label: row.label, value: row.value || '—', rowStyle: rowStyle(index, rows.length, 'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 0') };
  });
}
// ── END: Editable fields ───────────────────────────────────────────────────


// ── START: Account screen ──────────────────────────────────────────────────
export function accountScreen(app) {
  var summary = app.summary;
  var money = app.money;
  var profile = app.profile;
  var ui = app.ui;
  var selfFundedRate = summary.compliance.rules.rates.educationSelf.above;

  function changeCountry(countryId) {
    if (countryId === profile.country) return;
    var newCountry = findCountry(countryId);
    var newRate = rupeesPerUnit(newCountry.code, profile.rateOverrides);
    var converted = {};
    CATEGORIES.forEach(function (category) { converted[category.id] = Math.round((profile.budgets[category.id] || 0) * money.rate / newRate); });
    app.saveProfile({ country: newCountry.id, budgets: converted, budgetCurrency: newCountry.code, transferAmount: newCountry.usualTransfer, scheduledTransfer: null });
    app.toast('Now showing local amounts in ' + newCountry.code + ' · ₹ figures unchanged');
  }

  function saveDetails() {
    var draft = ui.detailsDraft;
    var cleaned: Record<string, any> = {};
    EDITABLE_DETAILS.forEach(function (field) { cleaned[field.key] = String(draft[field.key] == null ? '' : draft[field.key]).trim(); });
    cleaned.pan = cleaned.pan.toUpperCase();
    if (!cleaned.name) return app.toast('Name can’t be empty');
    if (cleaned.pan && !PAN_PATTERN.test(cleaned.pan)) return app.toast('PAN should look like ABCPS1234K');
    if (cleaned.email && !EMAIL_PATTERN.test(cleaned.email)) return app.toast('That email address doesn’t look right');
    app.saveProfile(cleaned);
    app.update({ editingDetails: false, detailsDraft: {} });
    app.toast('Personal details updated');
  }

  return {
    profileName: profile.name,
    profileEmail: profile.email,
    kycText: PAN_PATTERN.test(profile.pan || '') ? 'PAN on file' : 'PAN missing',
    countryOptions: choiceChips(STUDY_COUNTRIES.map(function (country) { return { value: country.id, label: country.label }; }), profile.country, changeCountry),

    personalRows: detailRows([
      { label: 'Full name', value: profile.name },
      { label: 'Email', value: profile.email },
      { label: 'Mobile', value: profile.phone },
      { label: 'Date of birth', value: profile.dob },
      { label: 'PAN', value: profile.pan },
      { label: 'Passport', value: hidePassport(profile.passport) }
    ]),
    studyRows: detailRows([
      { label: 'University', value: profile.uni },
      { label: 'Course ends', value: profile.courseEnds },
      { label: 'Visa status', value: money.country.visa },
      { label: 'Funding source', value: profile.funding },
      { label: 'Purpose code', value: 'S0305 · education' },
      { label: 'Tax residency', value: 'Resident of India' }
    ]),
    tcsBadgeText: summary.fundedByLoan ? (summary.hasLoanLetter ? '0% TCS applies' : '0% TCS eligible') : formatPercent(selfFundedRate * 100) + ' TCS applies',
    tcsBadge: 'font-size:12px;font-weight:700;color:' + (summary.fundedByLoan ? '#4E8A41' : '#C4342C'),

    editing: ui.editingDetails,
    notEditing: !ui.editingDetails,
    editToggleLabel: ui.editingDetails ? 'Cancel' : 'Edit',
    toggleEdit: function () { app.update({ editingDetails: !ui.editingDetails, detailsDraft: ui.editingDetails ? {} : Object.assign({}, profile) }); },
    cancelEdit: function () { app.update({ editingDetails: false, detailsDraft: {} }); },
    editFields: EDITABLE_DETAILS.map(function (field) {
      return {
        label: field.label,
        placeholder: field.placeholder,
        value: ui.detailsDraft[field.key] == null ? '' : ui.detailsDraft[field.key],
        onChange: function (event) {
          var value = event.target.value;
          app.update(function (current) {
            var draft = Object.assign({}, current.detailsDraft);
            draft[field.key] = value;
            return { detailsDraft: draft };
          });
        }
      };
    }),
    saveEdit: saveDetails
  };
}
// ── END: Account screen ────────────────────────────────────────────────────


// ── START: View ──────────────────────────────────────────────────────────────────
export function AccountView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Account">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 18px 14px' }}>
        <div onClick={v.goHome} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Account</span>
        <div onClick={v.goSettings} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="2.6" stroke="#0B0620" strokeWidth="1.6" />
            <path d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1" stroke="#0B0620" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{ padding: '10px 18px 132px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          <div style={{ width: '58px', height: '58px', borderRadius: '29px', background: '#1B1233', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#ABE39E', letterSpacing: '0.02em' }}>{v.initials}</span>
          </div>
          <div style={{ flex: '1', minWidth: '0' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.02em' }}>{v.profileName}</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.profileEmail}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '9px', padding: '5px 10px', borderRadius: '999px', background: '#EAF7E6', fontSize: '11px', fontWeight: '800', color: '#4E8A41' }}>
              {v.kycText}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Countries & currency</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>{v.curPair}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893' }}>
                Home country
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0B0620', marginTop: '4px' }}>India</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>LRS limit and TCS rules apply</div>
            </div>
            <span style={{ padding: '6px 12px', borderRadius: '999px', background: '#F3EDFF', fontSize: '11px', fontWeight: '800', color: '#6B36F0', whiteSpace: 'nowrap' }}>
              Fixed
            </span>
          </div>
          <div style={{ paddingTop: '16px', borderTop: '1px solid #F0EDF7' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '10px' }}>
              Country of study
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(v.countryOptions || []).map((item: any, i: number) => (
                <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
              ))}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '10px', textWrap: 'pretty' }}>
              Budgets, EMIs and transfer windows re-price in {v.curName} at {v.rateLine}. Home-currency figures stay in ₹.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Personal details</span>
          <span onClick={v.toggleEdit} style={{ fontSize: '12px', fontWeight: '700', color: '#8552FF', cursor: 'pointer' }}>{v.editToggleLabel}</span>
        </div>
        {v.notEditing ? (
          <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
            {(v.personalRows || []).map((item: any, i: number) => (
              <div key={i} style={css(item.rowStyle)}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#7C7893' }}>{item.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620', textAlign: 'right', minWidth: '0' }}>{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        {v.editing ? (
          <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(v.editFields || []).map((item: any, i: number) => (
              <div key={i}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
                  {item.label}
                </div>
                <input value={item.value} onChange={item.onChange} placeholder={item.placeholder} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px' }}>
              <span onClick={v.saveEdit} style={{ flex: '1', textAlign: 'center', padding: '15px', borderRadius: '999px', background: '#8552FF', fontSize: '14px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
                Save details
              </span>
              <span onClick={v.cancelEdit} style={{ textAlign: 'center', padding: '15px 20px', borderRadius: '999px', background: '#F3F1FA', fontSize: '14px', fontWeight: '700', color: '#4A4266', cursor: 'pointer' }}>
                Cancel
              </span>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Study & funding</span>
          <span style={css(v.tcsBadge)}>{v.tcsBadgeText}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.studyRows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#7C7893' }}>{item.label}</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620', textAlign: 'right', minWidth: '0' }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Linked accounts</span>
          <span onClick={v.syncAll} style={css(v.syncAllStyle)}>{v.syncAllLabel}</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '8px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)' }}>
          {(v.bankRows || []).map((item: any, i: number) => (
            <div key={i} style={css(item.rowStyle)}>
              <span style={css(item.logoStyle)}>{item.logo}</span>
              <div style={{ flex: '1', minWidth: '0' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>{item.details}</div>
              </div>
              <span onClick={item.chipAction} style={css(item.chipStyle)}>{item.chipText}</span>
              {item.canRemove ? (
                <div onClick={item.remove} aria-label="Disconnect bank" style={css(item.deleteStyle)}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              ) : null}
            </div>
          ))}
          <div onClick={v.openConnect} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 0', borderTop: '1px solid #F0EDF7', cursor: 'pointer' }}>
            <span style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#8552FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 5v10M5 10h10" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </span>
            <div style={{ flex: '1', minWidth: '0' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Connect a bank</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893' }}>Read-only · import spending, remittances and EMIs</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div onClick={v.goSettings} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#FFFFFF', borderRadius: '20px', padding: '16px 18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', cursor: 'pointer' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0B0620' }}>Settings & notifications</span>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 5l5 5-5 5" stroke="#B9B4CC" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div onClick={v.signOut} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', border: '1.5px solid #FBDDDA', background: '#FFFFFF', borderRadius: '999px', padding: '15px', cursor: 'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
              <path d="M8 16.5H5a1 1 0 01-1-1v-11a1 1 0 011-1h3" stroke="#C4342C" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 6.5l3.5 3.5L12 13.5M15.5 10H8" stroke="#C4342C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#C4342C' }}>Log out</span>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── END: View ────────────────────────────────────────────────────────────────────
