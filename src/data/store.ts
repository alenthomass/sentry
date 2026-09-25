/* ============================================================================
   Sentry · Store (accounts and saved data)
   The rest of the app calls Store.* and never cares where data lives:
     server  → opened through `npm start`: real accounts on the Node server
     cloud   → published on claude.ai: private storage for each viewer
     local   → opened as a file: this browser's localStorage
   Each signed-in user owns a few JSON documents:
     profile, remits, loans, history, ledger-YYYY-MM (one per month)
   ============================================================================ */

export var Store = (function () {
  'use strict';

  // ── START: State ─────────────────────────────────────────────────────────
  var LOCAL_STORAGE_KEY = 'sentry.v2';
  var mode = 'memory';
  var deviceData: Record<string, any> = {};
  var userDocuments = {};
  var currentUser = null;
  var sessionToken = null;
  var cloudDatabase = null;
  var cloudFolder = '';
  var pendingWrites = {};
  var reportError = function (error?: unknown) {};
  // ── END: State ───────────────────────────────────────────────────────────


  // ── START: Small helpers ─────────────────────────────────────────────────
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cleanEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function readRemembered(key) {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch (error) { return null; }
  }

  function remember(key: string, value: string | null, keepAfterClosing?: boolean) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      if (value) (keepAfterClosing ? localStorage : sessionStorage).setItem(key, value);
    } catch (error) { return; }
  }

  function failure(code, message) {
    var error: Error & { code?: string } = new Error(message);
    error.code = code;
    return error;
  }

  async function callServer(method: string, path: string, body?: unknown) {
    var headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) headers.Authorization = 'Bearer ' + sessionToken;
    var response = await fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
    var data = null;
    try { data = await response.json(); } catch (error) { data = null; }
    if (!response.ok) throw failure((data && data.code) || 'http_' + response.status, (data && data.error) || 'Request failed (' + response.status + ')');
    return data;
  }

  async function hashPassword(password, salt) {
    try {
      var encoder = new TextEncoder();
      var key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
      return Array.from(new Uint8Array(bits)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    } catch (error) {
      var hash = 2166136261;
      var text = salt + ':' + password;
      for (var round = 0; round < 20000; round++) {
        for (var i = 0; i < text.length; i++) hash = Math.imul(hash ^ (text.charCodeAt(i) + round), 16777619) >>> 0;
      }
      return 'fnv' + hash.toString(16);
    }
  }
  // ── END: Small helpers ───────────────────────────────────────────────────


  // ── START: Device storage (cloud and local modes) ────────────────────────
  function cloudPath(key) {
    return cloudFolder + '/' + encodeURIComponent(key).replace(/%/g, '~');
  }

  function saveLocalCopy() {
    if (mode !== 'local') return;
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(deviceData)); } catch (error) { reportError(error); }
  }

  function writeDevice(key, value) {
    deviceData[key] = value;
    if (mode === 'cloud') {
      pendingWrites[key] = (pendingWrites[key] || Promise.resolve())
        .then(function () { return cloudDatabase.doc(cloudPath(key)).set({ v: JSON.stringify(value) }); })
        .catch(reportError);
      return pendingWrites[key];
    }
    saveLocalCopy();
    return Promise.resolve();
  }

  function deleteDevice(key) {
    delete deviceData[key];
    if (mode === 'cloud') {
      pendingWrites[key] = (pendingWrites[key] || Promise.resolve())
        .then(function () { return cloudDatabase.doc(cloudPath(key)).delete(); })
        .catch(reportError);
      return pendingWrites[key];
    }
    saveLocalCopy();
    return Promise.resolve();
  }

  function deviceAccounts() {
    return deviceData.accounts || {};
  }

  function loadDeviceDocuments(userId) {
    userDocuments = {};
    var prefix = 'u.' + userId + '.';
    Object.keys(deviceData).forEach(function (key) {
      if (key.indexOf(prefix) === 0) userDocuments[key.slice(prefix.length)] = deviceData[key];
    });
  }

  function restoreDeviceSession() {
    var savedUserId = readRemembered('sentry.session');
    var accounts = deviceAccounts();
    var account = Object.keys(accounts).map(function (email) { return accounts[email]; }).filter(function (item) { return item.id === savedUserId; })[0];
    if (!account) return;
    currentUser = { id: account.id, email: account.email };
    loadDeviceDocuments(account.id);
  }
  // ── END: Device storage (cloud and local modes) ──────────────────────────


  // ── START: Choosing a mode when the app opens ────────────────────────────
  async function tryServer() {
    var onWebsite = /^https?:$/.test(location.protocol);
    var insideClaude = !!(window.claude && window.claude.use);
    if (!onWebsite || insideClaude) return false;
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 1500);
      var response = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok || (await response.json()).app !== 'sentry') return false;
    } catch (error) { return false; }
    mode = 'server';
    sessionToken = readRemembered('sentry.token');
    if (sessionToken) {
      try {
        var me = await callServer('GET', '/api/me');
        currentUser = me.user;
        userDocuments = me.docs || {};
      } catch (error) {
        sessionToken = null;
        remember('sentry.token', null);
      }
    }
    return true;
  }

  async function tryClaudeStorage() {
    if (!(window.claude && window.claude.use)) return false;
    try {
      var capabilities = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      var viewerId = capabilities[0] && capabilities[1] ? await capabilities[1].id() : null;
      if (!viewerId) return false;
      cloudDatabase = capabilities[0];
      cloudFolder = 'data/users/' + viewerId;
      mode = 'cloud';
      var snapshot = await cloudDatabase.collection(cloudFolder).get();
      snapshot.docs.forEach(function (row) {
        try { deviceData[decodeURIComponent(row.id.replace(/~/g, '%'))] = JSON.parse(row.data().v); } catch (error) { return; }
      });
      restoreDeviceSession();
      return true;
    } catch (error) {
      cloudDatabase = null;
      deviceData = {};
      return false;
    }
  }

  async function start() {
    if (await tryServer()) return mode;
    if (await tryClaudeStorage()) return mode;
    try {
      deviceData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}') || {};
      mode = 'local';
    } catch (error) {
      deviceData = {};
      mode = 'memory';
    }
    restoreDeviceSession();
    return mode;
  }
  // ── END: Choosing a mode when the app opens ──────────────────────────────


  // ── START: Accounts ──────────────────────────────────────────────────────
  async function register(email, password, keepSignedIn) {
    email = cleanEmail(email);
    if (mode === 'server') {
      var result = await callServer('POST', '/api/auth/register', { email: email, password: password });
      sessionToken = result.token;
      currentUser = result.user;
      userDocuments = {};
      remember('sentry.token', sessionToken, keepSignedIn);
      return currentUser;
    }
    if (deviceAccounts()[email]) throw failure('exists', 'An account with this email already exists. Sign in instead.');
    var salt = newId();
    var account = { id: newId(), email: email, salt: salt, hash: await hashPassword(password, salt), createdAt: new Date().toISOString() };
    var accounts = Object.assign({}, deviceAccounts());
    accounts[email] = account;
    await writeDevice('accounts', accounts);
    currentUser = { id: account.id, email: email };
    userDocuments = {};
    remember('sentry.session', account.id, keepSignedIn);
    return currentUser;
  }

  async function signIn(email, password, keepSignedIn) {
    email = cleanEmail(email);
    if (mode === 'server') {
      var result = await callServer('POST', '/api/auth/login', { email: email, password: password });
      sessionToken = result.token;
      currentUser = result.user;
      remember('sentry.token', sessionToken, keepSignedIn);
      userDocuments = (await callServer('GET', '/api/me')).docs || {};
      return currentUser;
    }
    var account = deviceAccounts()[email];
    var passwordMatches = account && (await hashPassword(password, account.salt)) === account.hash;
    if (!passwordMatches) throw failure('bad_login', 'That email and password don’t match an account on this device.');
    currentUser = { id: account.id, email: email };
    loadDeviceDocuments(account.id);
    remember('sentry.session', account.id, keepSignedIn);
    return currentUser;
  }

  async function signInToDemo() {
    if (mode === 'server') {
      var result = await callServer('POST', '/api/auth/demo');
      sessionToken = result.token;
      currentUser = result.user;
      remember('sentry.token', sessionToken, true);
      userDocuments = (await callServer('GET', '/api/me')).docs || {};
      return currentUser;
    }
    var email = 'demo@sentry.app';
    if (!deviceAccounts()[email]) {
      var accounts = Object.assign({}, deviceAccounts());
      accounts[email] = { id: 'demo', email: email, salt: 'demo', hash: '', demo: true, createdAt: new Date().toISOString() };
      await writeDevice('accounts', accounts);
    }
    currentUser = { id: 'demo', email: email };
    loadDeviceDocuments('demo');
    remember('sentry.session', 'demo', true);
    return currentUser;
  }

  function forgetSession() {
    sessionToken = null;
    currentUser = null;
    userDocuments = {};
    remember('sentry.token', null);
    remember('sentry.session', null);
  }

  async function signOut() {
    if (mode === 'server' && sessionToken) {
      try { await callServer('POST', '/api/auth/logout'); } catch (error) { forgetSession(); }
    }
    forgetSession();
  }

  async function deleteAccount() {
    if (mode === 'server') {
      await callServer('DELETE', '/api/account');
    } else if (currentUser) {
      var prefix = 'u.' + currentUser.id + '.';
      await Promise.all(Object.keys(deviceData).filter(function (key) { return key.indexOf(prefix) === 0; }).map(deleteDevice));
      var accounts = Object.assign({}, deviceAccounts());
      Object.keys(accounts).forEach(function (email) { if (accounts[email].id === currentUser.id) delete accounts[email]; });
      await writeDevice('accounts', accounts);
    }
    forgetSession();
  }
  // ── END: Accounts ────────────────────────────────────────────────────────


  // ── START: Documents of the signed-in user ───────────────────────────────
  function read(documentId) {
    return userDocuments[documentId];
  }

  function listIds(prefix) {
    return Object.keys(userDocuments).filter(function (id) { return id.indexOf(prefix) === 0; });
  }

  function save(documentId, data) {
    if (!currentUser) return Promise.reject(failure('signed_out', 'Not signed in'));
    userDocuments[documentId] = data;
    if (mode === 'server') {
      pendingWrites[documentId] = (pendingWrites[documentId] || Promise.resolve())
        .then(function () { return callServer('PUT', '/api/docs/' + encodeURIComponent(documentId), data); })
        .catch(reportError);
      return pendingWrites[documentId];
    }
    return writeDevice('u.' + currentUser.id + '.' + documentId, data);
  }

  function remove(documentId) {
    if (!currentUser) return Promise.resolve();
    delete userDocuments[documentId];
    if (mode === 'server') {
      pendingWrites[documentId] = (pendingWrites[documentId] || Promise.resolve())
        .then(function () { return callServer('DELETE', '/api/docs/' + encodeURIComponent(documentId)); })
        .catch(reportError);
      return pendingWrites[documentId];
    }
    return deleteDevice('u.' + currentUser.id + '.' + documentId);
  }

  function removeAll() {
    return Promise.all(Object.keys(userDocuments).map(remove));
  }
  // ── END: Documents of the signed-in user ─────────────────────────────────


  // ── START: Live exchange rate (server mode only) ─────────────────────────
  async function liveRate(currencyCode) {
    if (mode !== 'server') return null;
    try { return await callServer('GET', '/api/fx?code=' + encodeURIComponent(currencyCode)); } catch (error) { return null; }
  }
  // ── END: Live exchange rate (server mode only) ───────────────────────────


  return {
    start: start,
    register: register,
    signIn: signIn,
    signInToDemo: signInToDemo,
    signOut: signOut,
    deleteAccount: deleteAccount,
    read: read,
    listIds: listIds,
    save: save,
    remove: remove,
    removeAll: removeAll,
    liveRate: liveRate,
    callServer: callServer,
    newId: newId,
    mode: function () { return mode; },
    user: function () { return currentUser; },
    onError: function (handler) { reportError = handler; }
  };
})();
