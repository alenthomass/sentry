/* ============================================================================
   Sentry · Sign in and create account screens         (owner: Alen & Shaheen)
   ============================================================================ */

import { startOfToday } from '../../shared/dates';
import { choiceChips, css, type ViewProps } from '../../app/styles';
import { EMPTY_REGISTRATION } from '../../app/ui-state';
import { createProfile } from '../../data/profile';
import { Store } from '../../data/store';
import { loadUserData } from '../../data/user-data';
import { defaultMonthlyBudget } from '../budget/budget';
import { financialYearOf, tcsRulesFor } from '../compliance/compliance';
import { findCountry, STUDY_COUNTRIES } from '../transfer-timing/currency';

export var PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── START: Sign in ─────────────────────────────────────────────────────────
export function signInScreen(app) {
  var form = app.ui.signIn;

  function change(field, value) {
    app.update(function (current) {
      var next = Object.assign({}, current.signIn, { error: '' });
      next[field] = value;
      return { signIn: next };
    });
  }

  function showError(message) {
    app.update(function (current) { return { busy: false, signIn: Object.assign({}, current.signIn, { error: message }) }; });
  }

  async function signIn() {
    if (app.ui.busy) return;
    if (!form.email.trim() || !form.password) return showError('Enter your email and password to continue.');
    app.update({ busy: true });
    try {
      await Store.signIn(form.email, form.password, form.keepSignedIn);
      await app.prepareSignedInUser(false);
      app.update({ busy: false, screen: 'home', signIn: Object.assign({}, form, { password: '', error: '' }) });
    } catch (error) {
      showError(error.message || 'Could not sign in.');
    }
  }

  async function openDemo() {
    if (app.ui.busy) return;
    app.update({ busy: true });
    try {
      await Store.signInToDemo();
      await app.prepareSignedInUser(true);
      app.update({ busy: false, screen: 'home' });
      app.toast('Demo account loaded');
    } catch (error) {
      showError(error.message || 'Could not open the demo.');
    }
  }

  return {
    loginEmail: form.email,
    loginPassword: form.password,
    loginError: !!form.error,
    loginErrorText: form.error,
    setLoginEmail: function (event) { change('email', event.target.value); },
    setLoginPassword: function (event) { change('password', event.target.value); },
    rememberBox: 'width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background-color .2s ease,border-color .2s ease;' +
      'background:' + (form.keepSignedIn ? '#8552FF' : '#FFFFFF') + ';border:1.5px solid ' + (form.keepSignedIn ? '#8552FF' : '#D9D3E8'),
    toggleRemember: function () { change('keepSignedIn', !form.keepSignedIn); },
    signIn: signIn,
    signInOnEnter: function (event) { if (event.key === 'Enter') signIn(); },
    signInButtonText: app.ui.busy ? 'Signing in…' : 'Sign in',
    openDemo: openDemo,
    demoButtonText: app.ui.busy ? 'Opening demo…' : 'Continue with demo account',
    forgotPassword: function () {
      app.toast(Store.mode() === 'server'
        ? 'Password reset by email isn’t set up on this server yet — ask the admin to reset it.'
        : 'Accounts here live on this device, so there’s no reset email. Create a new account or use the demo.');
    }
  };
}
// ── END: Sign in ───────────────────────────────────────────────────────────


// ── START: Create account ──────────────────────────────────────────────────
export function registerScreen(app) {
  var details = app.ui.registration;
  var country = findCountry(details.country);
  var fundedByLoan = details.funding === 'Education loan';
  var selfFundedRate = tcsRulesFor(financialYearOf(startOfToday())).rates.educationSelf.above;

  function change(field, value) {
    app.update(function (current) {
      var next = Object.assign({}, current.registration);
      next[field] = value;
      return { registration: next, registrationError: '' };
    });
  }

  function fieldSetter(field) {
    return function (event) { change(field, event.target.value); };
  }

  function findProblem() {
    var pan = details.pan.trim().toUpperCase();
    if (!details.name.trim() || !details.email.trim() || !pan) return 'Add your name, email and PAN to finish setting up.';
    if (!EMAIL_PATTERN.test(details.email.trim())) return 'That email address doesn’t look right.';
    if (details.password.length < 8) return 'Choose a password of at least 8 characters.';
    if (!PAN_PATTERN.test(pan)) return 'PAN should look like ABCPS1234K (5 letters, 4 digits, 1 letter).';
    if (details.budget && !(Number(details.budget) > 0)) return 'Monthly budget should be a positive number.';
    return '';
  }

  async function createAccount() {
    if (app.ui.busy) return;
    var problem = findProblem();
    if (problem) return app.update({ registrationError: problem });
    app.update({ busy: true });
    try {
      var user = await Store.register(details.email, details.password, true);
      await Store.save('profile', createProfile(details, user.email));
      await Store.save('history', { months: [] });
      app.setData(loadUserData(app.liveRate));
      app.update({ busy: false, screen: 'home', registration: Object.assign({}, EMPTY_REGISTRATION), registrationError: '' });
      app.toast('Welcome, ' + details.name.trim().split(/\s+/)[0] + ' — add your first expense with +');
    } catch (error) {
      app.update({ busy: false, registrationError: error.message || 'Could not create the account.' });
    }
  }

  return {
    regName: details.name,
    regEmail: details.email,
    regPhone: details.phone,
    regPassword: details.password,
    regUni: details.uni,
    regCourseEnds: details.courseEnds,
    regBudget: details.budget,
    regPan: details.pan,
    setRegName: fieldSetter('name'),
    setRegEmail: fieldSetter('email'),
    setRegPhone: fieldSetter('phone'),
    setRegPassword: fieldSetter('password'),
    setRegUni: fieldSetter('uni'),
    setRegCourseEnds: fieldSetter('courseEnds'),
    setRegBudget: fieldSetter('budget'),
    setRegPan: fieldSetter('pan'),
    regError: !!app.ui.registrationError,
    regErrorText: app.ui.registrationError,
    curName: country.code,
    curCode: country.code,
    budgetPlaceholder: String(defaultMonthlyBudget(country.code)),
    countryOptions: choiceChips(STUDY_COUNTRIES.map(function (item) { return { value: item.id, label: item.label }; }), details.country, function (id) { change('country', id); }),
    fundingOptions: choiceChips(['Education loan', 'Self-funded', 'Scholarship'].map(function (item) { return { value: item, label: item }; }), details.funding, function (value) { change('funding', value); }),
    regPurposeCode: 'S0305',
    regPurposeNote: fundedByLoan ? 'Education, funded by a sanctioned loan' : details.funding === 'Scholarship' ? 'Education, scholarship funded' : 'Education, self funded',
    regTcsRate: fundedByLoan ? '0% TCS' : Math.round(selfFundedRate * 100) + '% TCS',
    regTcsChip: 'padding:6px 12px;border-radius:999px;white-space:nowrap;font-size:11px;font-weight:800;' + (fundedByLoan ? 'background:#EAF7E6;color:#4E8A41' : 'background:#FDE7E5;color:#C4342C'),
    createAccount: createAccount,
    createAccountButtonText: app.ui.busy ? 'Creating account…' : 'Create account'
  };
}
// ── END: Create account ────────────────────────────────────────────────────


// ── START: Views ─────────────────────────────────────────────────────────────────
export function SignInView({ v }: ViewProps) {
  return (
    <div data-screen-label="Sign in" style={{ position: 'relative', minHeight: '100%', boxSizing: 'border-box', padding: '44px 26px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '26px', animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }}>
      <div style={{ position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 460 900" preserveAspectRatio="none" fill="none">
          <circle cx="368" cy="118" r="150" stroke="rgba(27,18,51,0.10)" strokeWidth="1.5" />
          <circle cx="368" cy="118" r="228" stroke="rgba(27,18,51,0.07)" strokeWidth="1.5" />
          <path d="M-40 300 C 120 236, 300 300, 500 232" stroke="rgba(133,82,255,0.22)" strokeWidth="1.5" />
        </svg>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0B0620', letterSpacing: '-0.03em' }}>Welcome back</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#4A4266', marginTop: '6px', textWrap: 'pretty' }}>
            Sign in to track your budget, EMIs and LRS/TCS position in one place.
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', background: '#FFFFFF', border: '1.5px solid #E6E1F1', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px rgba(5,0,17,0.08)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
            Email
          </div>
          <input type="email" placeholder="you@university.ac.uk" value={v.loginEmail} onChange={v.setLoginEmail} onKeyDown={v.signInOnEnter} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
            Password
          </div>
          <input type="password" placeholder="••••••••" value={v.loginPassword} onChange={v.setLoginPassword} onKeyDown={v.signInOnEnter} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div onClick={v.toggleRemember} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
            <span style={css(v.rememberBox)}>
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>Keep me signed in</span>
          </div>
          <span onClick={v.forgotPassword} style={{ fontSize: '13px', fontWeight: '700', color: '#8552FF', cursor: 'pointer' }}>Forgot?</span>
        </div>
        {v.loginError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 14px', borderRadius: '16px', background: '#FDE7E5', border: '1.5px solid #F6C9C5' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M10 4.5v7" stroke="#C4342C" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="10" cy="15" r="1.2" fill="#C4342C" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#C4342C' }}>{v.loginErrorText}</span>
            <span style={{ display: 'none' }} />
          </div>
        ) : null}
        <div onClick={v.signIn} style={{ textAlign: 'center', padding: '16px', borderRadius: '999px', background: '#8552FF', border: '1.5px solid #6B36F0', fontSize: '15px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
          {v.signInButtonText}
        </div>
        <div onClick={v.openDemo} style={{ textAlign: 'center', padding: '15px', borderRadius: '999px', background: '#FFFFFF', border: '1.5px solid #E6E1F1', fontSize: '14px', fontWeight: '700', color: '#4A4266', cursor: 'pointer' }}>
          {v.demoButtonText}
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '14px', border: '1.5px solid #DED8EE', borderRadius: '999px', background: 'rgba(255,255,255,0.6)' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266' }}>New to Sentry?</span>
        <span onClick={v.goRegister} style={{ fontSize: '13px', fontWeight: '800', color: '#8552FF', cursor: 'pointer' }}>Create an account</span>
      </div>
    </div>
  );
}

export function RegisterView({ v }: ViewProps) {
  return (
    <div style={{ animation: 'scIn .34s cubic-bezier(.22,.85,.3,1) both' }} data-screen-label="Register">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 18px 14px' }}>
        <div onClick={v.goLogin} style={{ width: '40px', height: '40px', borderRadius: '20px', background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(5,0,17,0.08)', cursor: 'pointer' }}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12 5l-5 5 5 5" stroke="#0B0620" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#0B0620', letterSpacing: '-0.01em' }}>Create account</span>
        <div style={{ width: '40px' }} />
      </div>
      <div style={{ padding: '10px 18px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#4A4266', padding: '0 4px', textWrap: 'pretty' }}>
          These details set your LRS/TCS profile and the currency pair used across the app.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Your account</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>Step 1 of 3</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Full name (as on passport)
            </div>
            <input placeholder="Aarav Sharma" value={v.regName} onChange={v.setRegName} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Email
            </div>
            <input type="email" placeholder="you@university.ac.uk" value={v.regEmail} onChange={v.setRegEmail} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Mobile (Indian number)
            </div>
            <input placeholder="+91 98200 12345" value={v.regPhone} onChange={v.setRegPhone} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Password
            </div>
            <input type="password" placeholder="At least 8 characters" value={v.regPassword} onChange={v.setRegPassword} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Where you study</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>Step 2 of 3</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '10px' }}>
              Country of study
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(v.countryOptions || []).map((item: any, i: number) => (
                <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
              ))}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '10px' }}>
              Local amounts will be shown in {v.curName} beside ₹ INR.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              University
            </div>
            <input placeholder="University College London" value={v.regUni} onChange={v.setRegUni} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Course ends
            </div>
            <input placeholder="Sep 2027" value={v.regCourseEnds} onChange={v.setRegCourseEnds} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              Monthly budget ({v.curCode})
            </div>
            <input type="number" min="0" inputMode="decimal" placeholder={v.budgetPlaceholder} value={v.regBudget} onChange={v.setRegBudget} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '600', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', marginBottom: '-9px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: '#0B0620' }}>Compliance profile</span>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#7C7893' }}>Step 3 of 3</span>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: '22px', padding: '18px', boxShadow: '0 6px 22px rgba(5,0,17,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '8px' }}>
              PAN
            </div>
            <input placeholder="ABCPS1234K" value={v.regPan} onChange={v.setRegPan} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E6E1F1', borderRadius: '16px', padding: '14px 16px', fontFamily: 'inherit', fontSize: '15px', fontWeight: '700', letterSpacing: '0.06em', color: '#0B0620', background: '#FFFFFF', outline: 'none' }} />
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '8px' }}>
              Required to track TCS credits against Form 26AS.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7C7893', marginBottom: '10px' }}>
              How fees are funded
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(v.fundingOptions || []).map((item: any, i: number) => (
                <span key={i} onClick={item.select} style={css(item.chipStyle)}>{item.label}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 16px', borderRadius: '18px', background: '#F7F5FD' }}>
            <div style={{ minWidth: '0' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0B0620' }}>Purpose code {v.regPurposeCode}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', marginTop: '2px' }}>{v.regPurposeNote}</div>
            </div>
            <span style={css(v.regTcsChip)}>{v.regTcsRate}</span>
          </div>
        </div>
        {v.regError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '14px 16px', borderRadius: '18px', background: '#FDE7E5' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M10 4.5v7" stroke="#C4342C" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="10" cy="15" r="1.2" fill="#C4342C" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#C4342C' }}>{v.regErrorText}</span>
          </div>
        ) : null}
        <div onClick={v.createAccount} style={{ textAlign: 'center', padding: '16px', borderRadius: '999px', background: '#8552FF', fontSize: '15px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer' }}>
          {v.createAccountButtonText}
        </div>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#7C7893', textAlign: 'center', padding: '0 10px', textWrap: 'pretty' }}>
          Sentry is a tracking tool, not a tax adviser. Confirm rates with your bank before remitting.
        </div>
      </div>
    </div>
  );
}
// ── END: Views ───────────────────────────────────────────────────────────────────
