/* ============================================================================
   Sentry · Maths helpers
   Plain statistics used by the forecast, the risk score and the FX advisor.
   ============================================================================ */

// ── START: Basic statistics ────────────────────────────────────────────────
export function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export function sumOf(values) {
  var total = 0;
  for (var i = 0; i < values.length; i++) total += values[i];
  return total;
}

export function averageOf(values) {
  return values.length ? sumOf(values) / values.length : 0;
}

export function standardDeviation(values) {
  if (values.length < 2) return 0;
  var average = averageOf(values);
  var squares = 0;
  for (var i = 0; i < values.length; i++) squares += (values[i] - average) * (values[i] - average);
  return Math.sqrt(squares / (values.length - 1));
}
// ── END: Basic statistics ──────────────────────────────────────────────────


// ── START: Trend line (least squares) ──────────────────────────────────────
export function fitStraightLine(values) {
  var count = values.length;
  if (count < 2) return { intercept: values[0] || 0, slope: 0 };
  var middleX = (count - 1) / 2;
  var averageY = averageOf(values);
  var sumXY = 0;
  var sumXX = 0;
  for (var x = 0; x < count; x++) {
    sumXY += (x - middleX) * (values[x] - averageY);
    sumXX += (x - middleX) * (x - middleX);
  }
  var slope = sumXX ? sumXY / sumXX : 0;
  return { intercept: averageY - slope * middleX, slope: slope };
}
// ── END: Trend line (least squares) ────────────────────────────────────────


// ── START: Probability ─────────────────────────────────────────────────────
export function normalCdf(z) {
  var t = 1 / (1 + 0.2316419 * Math.abs(z));
  var density = 0.3989423 * Math.exp(-z * z / 2);
  var tail = density * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - tail : tail;
}
// ── END: Probability ───────────────────────────────────────────────────────


// ── START: Repeatable random numbers ───────────────────────────────────────
export function seededRandom(seedText) {
  var hash = 2166136261;
  seedText = String(seedText);
  for (var i = 0; i < seedText.length; i++) hash = Math.imul(hash ^ seedText.charCodeAt(i), 16777619);
  var state = hash >>> 0;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0;
    var mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
// ── END: Repeatable random numbers ─────────────────────────────────────────
