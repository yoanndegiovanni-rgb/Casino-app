/**
 * Calculate side pots from player total bets.
 * Returns array of { amount, eligible: [playerId] } from smallest to largest.
 */
function calculateSidePots(players) {
  const contributors = players
    .filter(p => p.totalBet > 0)
    .map(p => ({ id: p.id, totalBet: p.totalBet, status: p.status }));

  if (contributors.length === 0) return [];

  // Work on a copy so we can decrement
  const remaining = contributors.map(p => ({ ...p, left: p.totalBet }));
  const pots = [];

  while (remaining.some(p => p.left > 0)) {
    const minLeft = Math.min(...remaining.filter(p => p.left > 0).map(p => p.left));
    const inPot = remaining.filter(p => p.left > 0);
    const potAmount = minLeft * inPot.length;

    // Eligible = non-folded contributors at this level
    const eligible = inPot
      .filter(p => p.status !== 'folded')
      .map(p => p.id);

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligible });
    }

    for (const p of remaining) {
      p.left = Math.max(0, p.left - minLeft);
    }
  }

  return pots;
}

module.exports = { calculateSidePots };
