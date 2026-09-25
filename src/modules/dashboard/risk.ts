/* ============================================================================
   Sentry · Compounding Risk Score                            (owner: Shaheen)
   Five parts, each worth a set number of points. When two or more parts
   are "hot" at the same time the total is multiplied: that is the compounding.
   ============================================================================ */

import { clamp, sumOf } from '../../shared/maths';

// ── START: Risk score ──────────────────────────────────────────────────────
export function computeRiskScore(input) {
  var projectedShare = input.totalBudget ? input.projectedTotal / input.totalBudget : 0;
  var overspendShare = input.totalBudget ? input.weightedOverspendRisk / input.totalBudget : 0;
  var emiShare = input.budgetInr ? input.nextEmiInr / input.budgetInr : 0;

  var parts = [
    { id: 'pace', label: 'Budget pace', max: 25, points: clamp((projectedShare - 0.85) / 0.35, 0, 1) * 25 },
    { id: 'overspend', label: 'Overspend exposure', max: 25, points: clamp(overspendShare, 0, 1) * 25 },
    { id: 'compliance', label: 'Compliance', max: 20, points: clamp(input.compliancePoints, 0, 20) },
    { id: 'emi', label: 'EMI load', max: 20, points: clamp(emiShare / 0.6, 0, 1) * 15 + (input.emiStepUpSoon ? 5 : 0) },
    { id: 'fx', label: 'FX volatility', max: 10, points: clamp(input.fxVolatility / 0.12, 0, 1) * 10 }
  ];

  var basePoints = sumOf(parts.map(function (part) { return part.points; }));
  var hotParts = parts.filter(function (part) { return part.points >= part.max * 0.5; }).length;
  var multiplier = 1 + 0.12 * Math.max(0, hotParts - 1);
  var score = clamp(Math.round(basePoints * multiplier), 1, 99);

  return {
    score: score,
    parts: parts,
    multiplier: multiplier,
    label: score >= 70 ? 'High risk' : score >= 45 ? 'Elevated risk' : score >= 25 ? 'Moderate risk' : 'Low risk',
    tone: score >= 45 ? 'red' : score >= 25 ? 'purple' : 'green'
  };
}
// ── END: Risk score ────────────────────────────────────────────────────────
