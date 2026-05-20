const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const HAND_NAMES = [
  'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', 'Royal Flush',
];

function getCombinations(arr, k) {
  const result = [];
  function pick(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i <= arr.length - (k - combo.length); i++) {
      combo.push(arr[i]);
      pick(i + 1, combo);
      combo.pop();
    }
  }
  pick(0, []);
  return result;
}

function evaluate5(cards) {
  const vals = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (normal + wheel A-2-3-4-5)
  let isStraight = false;
  let straightHigh = vals[0];
  const uniq = [...new Set(vals)].sort((a, b) => b - a);
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) { isStraight = true; }
    // Wheel: A-2-3-4-5
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) {
      isStraight = true; straightHigh = 5;
    }
  }

  // Count occurrences
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const entries = Object.entries(counts)
    .map(([v, c]) => ({ v: +v, c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);

  const groups = entries.map(e => e.c);
  let tier, tb;

  if (isFlush && isStraight) {
    tier = straightHigh === 14 ? 9 : 8;
    tb = [straightHigh];
  } else if (groups[0] === 4) {
    tier = 7; tb = [entries[0].v, entries[1].v];
  } else if (groups[0] === 3 && groups[1] === 2) {
    tier = 6; tb = [entries[0].v, entries[1].v];
  } else if (isFlush) {
    tier = 5; tb = vals;
  } else if (isStraight) {
    tier = 4; tb = [straightHigh];
  } else if (groups[0] === 3) {
    tier = 3; tb = [entries[0].v, ...entries.slice(1).map(e => e.v)];
  } else if (groups[0] === 2 && groups[1] === 2) {
    tier = 2;
    const pairs = entries.filter(e => e.c === 2).map(e => e.v).sort((a, b) => b - a);
    const kick = entries.find(e => e.c === 1).v;
    tb = [...pairs, kick];
  } else if (groups[0] === 2) {
    tier = 1;
    tb = [entries[0].v, ...entries.slice(1).map(e => e.v).sort((a, b) => b - a)];
  } else {
    tier = 0; tb = vals;
  }

  // Encode score: tier dominates, tiebreakers use base-15 for 5 slots
  let score = tier * 1e10;
  for (let i = 0; i < Math.min(tb.length, 5); i++) {
    score += tb[i] * Math.pow(15, 4 - i);
  }

  return { tier, score, description: HAND_NAMES[tier], bestFive: cards };
}

function evaluateBestHand(cards) {
  if (!cards || cards.length < 5) return null;
  const combos = getCombinations(cards, 5);
  let best = null;
  for (const combo of combos) {
    const r = evaluate5(combo);
    if (!best || r.score > best.score) best = r;
  }
  return best;
}

module.exports = { evaluateBestHand, RANK_VALUES, HAND_NAMES };
