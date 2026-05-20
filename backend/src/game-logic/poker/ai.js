const { evaluateBestHand, RANK_VALUES } = require('./evaluator');

const BIG_BLIND = 20;

// ─── Bot personalities ────────────────────────────────────────────────────────
//
//  vpip       how wide a range they voluntarily enter the pot with
//  pfr        how often they raise vs just call preflop (as fraction of vpip)
//  agg        postflop aggression multiplier (>1 = bets more, <1 = bets less)
//  callTight  multiplied against pot odds for call threshold (<1 = calls loosely, >1 = calls tightly)
//  bluffFreq  base probability of running a bluff / semi-bluff
//  slowPlay   probability of checking a monster hand (trap / check-raise)

const PERSONALITIES = {
  TAG:     { vpip: 0.52, pfr: 0.44, agg: 1.20, callTight: 0.90, bluffFreq: 0.08, slowPlay: 0.18 },
  LAG:     { vpip: 0.68, pfr: 0.52, agg: 1.50, callTight: 0.70, bluffFreq: 0.22, slowPlay: 0.10 },
  NIT:     { vpip: 0.36, pfr: 0.32, agg: 0.90, callTight: 1.10, bluffFreq: 0.03, slowPlay: 0.25 },
  CS:      { vpip: 0.76, pfr: 0.16, agg: 0.45, callTight: 0.35, bluffFreq: 0.04, slowPlay: 0.05 },
  BLUFFER: { vpip: 0.62, pfr: 0.58, agg: 1.70, callTight: 0.65, bluffFreq: 0.40, slowPlay: 0.08 },
};

// Each bot name is bound to a fixed personality so they always feel distinct.
const BOT_PERSONA = {
  'Dealer Dan':   PERSONALITIES.TAG,      // solid tight-aggressive regular
  'Lucky Larry':  PERSONALITIES.LAG,      // loose action player
  "Bluffin' Bob": PERSONALITIES.BLUFFER,  // wild bluffer
  'Ace Alice':    PERSONALITIES.NIT,      // only plays premiums
  'River Rick':   PERSONALITIES.CS,       // calls everything
};

// ─── Preflop hand strength (0 = trash, 1 = AA) ───────────────────────────────

function preflopStrength(c1, c2) {
  const v1 = RANK_VALUES[c1.rank];
  const v2 = RANK_VALUES[c2.rank];
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  const suited = c1.suit === c2.suit;
  const gap = hi - lo;

  // Pocket pairs: 22 → 0.48, AA → 1.00
  if (hi === lo) return 0.48 + (hi - 2) / 12 * 0.52;

  // Non-pairs: base from card ranks
  let s = 0.20
    + (hi - 2) / 12 * 0.32  // high card (2→0, A→0.32)
    + (lo - 2) / 12 * 0.15; // low card

  if (suited) s += 0.04;
  if (gap === 1) s += 0.05;       // connected  (KQs, JTs…)
  else if (gap === 2) s += 0.03;  // one-gapper (KJs, T8s…)
  else if (gap >= 7) s -= 0.06;   // trash combos (A2o…)
  if (gap >= 5 && lo <= 6) s -= 0.04; // low unconnected

  return Math.max(0.18, Math.min(0.84, s));
}

// ─── Postflop hand strength ───────────────────────────────────────────────────

// Non-linear mapping: high-card and weak pair feel very different at the table.
const TIER_STRENGTH = [0.15, 0.38, 0.58, 0.74, 0.81, 0.87, 0.93, 0.97, 0.99, 1.00];

function postflopStrength(holeCards, communityCards) {
  const result = evaluateBestHand([...holeCards, ...communityCards]);
  return result ? TIER_STRENGTH[result.tier] : 0.15;
}

// ─── Draw detection ───────────────────────────────────────────────────────────

function drawEquity(holeCards, communityCards, phase) {
  if (phase === 'pre_flop' || phase === 'river') return 0;

  const cards = [...holeCards, ...communityCards];
  const toRiver = phase === 'flop' ? 2 : 1;
  let eq = 0;

  // Flush draw: 4 cards of the same suit
  const suits = {};
  for (const c of cards) suits[c.suit] = (suits[c.suit] || 0) + 1;
  if (Object.values(suits).some(n => n === 4)) {
    eq += toRiver === 2 ? 0.35 : 0.20;
  }

  // Straight draw: slide a window and count unique values in range
  const vals = [...new Set(cards.map(c => RANK_VALUES[c.rank]))].sort((a, b) => a - b);
  if (vals.includes(14)) vals.unshift(1); // treat ace as low too

  let bestStr = 0;
  for (let i = 0; i < vals.length; i++) {
    const span3 = vals.filter(v => v >= vals[i] && v <= vals[i] + 3).length;
    if (span3 === 4) { bestStr = Math.max(bestStr, toRiver === 2 ? 0.32 : 0.17); break; } // OESD
    const span4 = vals.filter(v => v >= vals[i] && v <= vals[i] + 4).length;
    if (span4 >= 4) bestStr = Math.max(bestStr, toRiver === 2 ? 0.13 : 0.07);  // gutshot
  }
  eq += bestStr;

  return Math.min(eq, 0.55);
}

// ─── Raise sizing ─────────────────────────────────────────────────────────────

function calcRaiseAmount(strength, pot, toCall, chips, phase) {
  let raise;

  if (phase === 'pre_flop') {
    if (toCall <= BIG_BLIND) {
      // Open raise: 2.5x – 3.5x BB (bigger with stronger hands)
      const bbMult = 2.5 + strength * 1.0;
      raise = Math.round(BIG_BLIND * bbMult) - toCall;
    } else {
      // 3-bet: ~3x the facing raise
      raise = Math.round(toCall * 3.0);
    }
  } else {
    if (toCall === 0) {
      // Leading bet: 40% – 80% of pot based on strength
      const frac = 0.40 + strength * 0.40;
      raise = Math.round(pot * frac);
    } else {
      // Raise a bet: ~2.5x the bet size
      raise = Math.round(toCall * 2.5);
    }
  }

  return Math.min(Math.max(BIG_BLIND, raise), chips);
}

// ─── Main decision function ───────────────────────────────────────────────────

function getAiDecision(player, game) {
  const { holeCards, chips, currentBet: myBet, difficulty, name } = player;
  const { communityCards, currentBet, pot, phase } = game;

  const toCall   = currentBet - myBet;
  const canCheck = toCall === 0;

  // Personality (fall back to TAG for unknown bot names)
  const persona = BOT_PERSONA[name] || PERSONALITIES.TAG;

  // Difficulty widens/narrows noise around the "correct" decision
  const noise = difficulty === 'hard' ? 0.05 : difficulty === 'medium' ? 0.12 : 0.22;

  // ── 1. Base hand strength ──
  const rawStrength = phase === 'pre_flop'
    ? preflopStrength(holeCards[0], holeCards[1])
    : postflopStrength(holeCards, communityCards);

  const draws = drawEquity(holeCards, communityCards, phase);

  // Add randomness (worse bots deviate more from optimal play)
  let strength = rawStrength + (Math.random() - 0.5) * noise;
  strength = Math.max(0.05, Math.min(0.98, strength));

  // ── 2. Bluffing opportunity ──
  // Easier bots bluff much less than their personality suggests
  const bluffScale = difficulty === 'hard' ? 1.0 : difficulty === 'medium' ? 0.6 : 0.2;
  const isBluffing = Math.random() < persona.bluffFreq * bluffScale;
  if (isBluffing) strength = Math.max(strength, 0.68 + Math.random() * 0.22);

  // ── 3. Pot odds & effective equity ──
  const potOdds      = toCall > 0 && pot > 0 ? toCall / (pot + toCall) : 0;
  const effEquity    = Math.min(0.97, strength + draws * 0.35); // draws add implied-odds value

  // ── Short-stack shove threshold ──
  if (chips <= BIG_BLIND * 5 || (chips <= toCall + BIG_BLIND && toCall > 0)) {
    if (effEquity > 0.46) return { action: 'all-in' };
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }

  // ═══════════════ PREFLOP ═════════════════════════════════════════════════

  if (phase === 'pre_flop') {
    const vpipThresh = persona.vpip + (Math.random() - 0.5) * noise * 0.5;
    const pfrThresh  = persona.pfr  + (Math.random() - 0.5) * noise * 0.5;

    // Weak hand: fold or take the free check
    if (strength < vpipThresh * 0.45) {
      return canCheck ? { action: 'check' } : { action: 'fold' };
    }

    // Borderline hand: call if pot odds justify it (with personality-adjusted threshold)
    if (strength < vpipThresh) {
      if (canCheck) return { action: 'check' };
      const callThresh = potOdds * persona.callTight;
      return effEquity > callThresh ? { action: 'call' } : { action: 'fold' };
    }

    // Strong enough to play: raise or call
    if (strength > pfrThresh && chips > toCall + BIG_BLIND) {
      const raiseAmt = calcRaiseAmount(strength, pot, toCall, chips, phase);
      if (raiseAmt >= BIG_BLIND) return { action: 'raise', amount: raiseAmt };
    }

    return canCheck ? { action: 'check' } : { action: 'call' };
  }

  // ═══════════════ POSTFLOP ════════════════════════════════════════════════

  if (canCheck) {
    // Trap with a monster hand (slow play → check-raise next street)
    if (strength > 0.88 && Math.random() < persona.slowPlay) {
      return { action: 'check' };
    }

    // Semi-bluff with a strong draw
    const semiBluff = draws > 0.22 && Math.random() < persona.bluffFreq * bluffScale * 1.8;

    // Bet threshold inversely scaled by aggression
    //   TAG (agg=1.2): threshold ≈ 0.46 → bets ~half+ equity
    //   CS  (agg=0.45): threshold ≈ 1.22 → almost never bets (passive)
    const betThresh = 0.55 / persona.agg;

    if (strength > betThresh || semiBluff) {
      const raiseAmt = calcRaiseAmount(strength, pot, 0, chips, phase);
      if (raiseAmt >= BIG_BLIND) return { action: 'raise', amount: raiseAmt };
    }

    return { action: 'check' };
  }

  // ── Facing a bet ──
  const callThresh = potOdds * persona.callTight;

  if (effEquity < callThresh) {
    // Not enough equity — but aggressive players sometimes bluff-raise
    const bluffRaise = persona.bluffFreq > 0.25
      && Math.random() < persona.bluffFreq * bluffScale * 0.35
      && chips > toCall * 3;

    if (bluffRaise) {
      const raiseAmt = calcRaiseAmount(0.78, pot, toCall, chips, phase);
      if (raiseAmt >= BIG_BLIND) return { action: 'raise', amount: raiseAmt };
    }

    return { action: 'fold' };
  }

  // Enough equity: call or value-raise?
  if (chips <= toCall) return { action: 'all-in' };

  // Value raise threshold: aggressive players raise with a wider range
  //   TAG (agg=1.2): raise if strength > 0.54
  //   CS  (agg=0.45): raise if strength > 1.44 → almost never raises
  const raiseThresh = 0.65 / persona.agg;

  if (strength > raiseThresh && chips > toCall + BIG_BLIND) {
    const raiseAmt = calcRaiseAmount(strength, pot, toCall, chips, phase);
    if (raiseAmt >= BIG_BLIND) return { action: 'raise', amount: raiseAmt };
  }

  return { action: 'call' };
}

module.exports = { getAiDecision };
