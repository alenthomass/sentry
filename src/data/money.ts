/* ============================================================================
   Sentry · Money formatting in the student's currency
   Every screen shows amounts in the study currency and in rupees. This
   builds the formatter once per render for the current profile.
   ============================================================================ */

import { formatRupees } from '../shared/dates';
import { findCountry, rupeesPerUnit } from '../modules/transfer-timing/currency';

// ── START: Money formatter ─────────────────────────────────────────────────
export function createMoneyFormatter(profile, liveRate) {
  var country = findCountry(profile.country);
  var hasLiveRate = liveRate && liveRate.code === country.code && liveRate.rate > 0;
  var rate = hasLiveRate ? liveRate.rate : rupeesPerUnit(country.code, profile.rateOverrides);
  var rupeesFirst = profile.primaryCurrency === 'INR';

  function sign(amount) {
    return amount < 0 ? '−' : '';
  }

  function whole(amount) {
    return sign(amount) + country.symbol + Math.round(Math.abs(amount)).toLocaleString('en-GB');
  }

  function exact(amount) {
    var value = Math.round(Math.abs(amount) * 100) / 100;
    var text = Number.isInteger(value)
      ? value.toLocaleString('en-GB')
      : value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign(amount) + country.symbol + text;
  }

  function inRupees(localAmount) {
    return formatRupees(localAmount * rate);
  }

  function fromRupees(rupeeAmount) {
    return whole(rupeeAmount / rate);
  }

  return {
    country: country,
    code: country.code,
    symbol: country.symbol,
    rate: rate,
    rupeesFirst: rupeesFirst,
    whole: whole,
    exact: exact,
    inRupees: inRupees,
    fromRupees: fromRupees
  };
}
// ── END: Money formatter ───────────────────────────────────────────────────
