const { Deck } = require('../deck');
const { evaluateBestHand } = require('./evaluator');
const { getAiDecision } = require('./ai');
const { calculateSidePots } = require('./sidepots');
const { v4: uuidv4 } = require('uuid');

const SMALL_BLIND = 10;
const BIG_BLIND = 20;

// In-memory tables keyed by userId
const tables = new Map();

const BOT_NAMES = ['Dealer Dan', "Lucky Larry", "Bluffin' Bob", 'Ace Alice', 'River Rick'];

// ─── Factory ─────────────────────────────────────────────────────────────────

function createTable(userId, username, userBalance, numBots, difficulty) {
  const players = [
    makePlayer(userId, username, userBalance, false, null),
  ];
  for (let i = 0; i < numBots; i++) {
    players.push(makePlayer(`bot_${i}`, BOT_NAMES[i % BOT_NAMES.length], 1000, true, difficulty));
  }

  const game = {
    id: uuidv4(),
    humanId: userId,
    players,
    deck: null,
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    lastRaise: BIG_BLIND,
    phase: 'waiting',
    dealerIndex: 0,
    smallBlindIndex: 0,
    bigBlindIndex: 0,
    currentPlayerIndex: 0,
    waitingFor: [],
    handNumber: 0,
    lastHandResult: null,
    actionLog: [],
  };

  tables.set(userId, game);
  return game;
}

function makePlayer(id, name, chips, isBot, difficulty) {
  return { id, name, chips, holeCards: [], currentBet: 0, totalBet: 0, status: 'active', isBot, difficulty, lastAction: null };
}

function getTable(userId) { return tables.get(userId) || null; }

function removeTable(userId) { tables.delete(userId); }

// ─── Hand lifecycle ──────────────────────────────────────────────────────────

function startHand(game) {
  const alive = game.players.filter(p => p.status !== 'eliminated' && p.chips > 0);
  if (alive.length < 2) {
    game.phase = 'complete';
    return;
  }

  game.deck = new Deck(1);
  game.communityCards = [];
  game.pot = 0;
  game.sidePots = [];
  game.currentBet = BIG_BLIND;
  game.lastRaise = BIG_BLIND;
  game.handNumber++;
  game.lastHandResult = null;
  game.actionLog = [];

  for (const p of game.players) {
    p.holeCards = [];
    p.currentBet = 0;
    p.totalBet = 0;
    p.lastAction = null;
    if (p.status !== 'eliminated') p.status = p.chips > 0 ? 'active' : 'eliminated';
  }

  // Advance dealer (skip eliminated)
  game.dealerIndex = nextAliveIndex(game, game.dealerIndex);

  game.smallBlindIndex = nextAliveIndex(game, game.dealerIndex);
  game.bigBlindIndex = nextAliveIndex(game, game.smallBlindIndex);

  postBlind(game, game.smallBlindIndex, SMALL_BLIND);
  postBlind(game, game.bigBlindIndex, BIG_BLIND);

  // Deal 2 hole cards to each alive player
  for (let r = 0; r < 2; r++) {
    for (const p of game.players) {
      if (p.status !== 'eliminated') p.holeCards.push(game.deck.deal());
    }
  }

  game.phase = 'pre_flop';

  // Pre-flop: first to act is left of BB
  const utg = nextAliveIndex(game, game.bigBlindIndex);
  game.currentPlayerIndex = utg;
  // Everyone (including BB) still needs to act
  game.waitingFor = game.players.filter(p => p.status === 'active').map(p => p.id);
}

function postBlind(game, idx, amount) {
  const p = game.players[idx];
  const actual = Math.min(amount, p.chips);
  p.chips -= actual;
  p.currentBet = actual;
  p.totalBet = actual;
  game.pot += actual;
  if (p.chips === 0) p.status = 'all_in';
}

// ─── Action processing ───────────────────────────────────────────────────────

function processAction(game, playerId, action, raiseAmount) {
  const idx = game.players.findIndex(p => p.id === playerId);
  if (idx === -1) throw new Error('Player not in game');
  if (game.currentPlayerIndex !== idx) throw new Error('Not your turn');

  const player = game.players[idx];
  if (player.status !== 'active') throw new Error('You are not in the hand');

  const toCall = game.currentBet - player.currentBet;

  switch (action) {
    case 'fold':
      player.status = 'folded';
      player.lastAction = { type: 'fold' };
      logAction(game, player.name, 'Fold');
      break;

    case 'check':
      if (toCall > 0) throw new Error('Cannot check — must call, raise, or fold');
      player.lastAction = { type: 'check' };
      logAction(game, player.name, 'Check');
      break;

    case 'call': {
      const amt = Math.min(toCall, player.chips);
      contribute(game, player, amt);
      if (player.chips === 0) player.status = 'all_in';
      player.lastAction = { type: 'call', amount: amt };
      logAction(game, player.name, `Call ${amt}`);
      break;
    }

    case 'raise': {
      if (!raiseAmount || raiseAmount < BIG_BLIND)
        throw new Error(`Raise must be at least ${BIG_BLIND}`);
      const totalNeeded = toCall + raiseAmount;
      const actual = Math.min(totalNeeded, player.chips);
      contribute(game, player, actual);
      game.lastRaise = player.currentBet - game.currentBet;
      game.currentBet = player.currentBet;
      if (player.chips === 0) player.status = 'all_in';
      game.waitingFor = game.players
        .filter(p => p.status === 'active' && p.id !== playerId)
        .map(p => p.id);
      player.lastAction = { type: 'raise', amount: game.currentBet };
      logAction(game, player.name, `Raise to ${game.currentBet}`);
      break;
    }

    case 'all-in': {
      const all = player.chips;
      contribute(game, player, all);
      if (player.currentBet > game.currentBet) {
        game.lastRaise = player.currentBet - game.currentBet;
        game.currentBet = player.currentBet;
        game.waitingFor = game.players
          .filter(p => p.status === 'active' && p.id !== playerId)
          .map(p => p.id);
        logAction(game, player.name, `All-in (raise to ${game.currentBet})`);
      } else {
        logAction(game, player.name, `All-in (call ${all})`);
      }
      player.lastAction = { type: 'all-in', amount: player.currentBet };
      player.status = 'all_in';
      break;
    }

    default:
      throw new Error('Invalid action');
  }

  game.waitingFor = game.waitingFor.filter(id => id !== playerId);

  // Check if only one player remains in hand
  const stillIn = game.players.filter(p => ['active', 'all_in'].includes(p.status));
  if (stillIn.length === 1) {
    resolveImmediate(game);
    return;
  }
  const stillActive = game.players.filter(p => p.status === 'active');
  if (stillActive.length === 0) {
    // Everyone is all-in: deal out board and showdown
    while (game.communityCards.length < 5) game.communityCards.push(game.deck.deal());
    showdown(game);
    return;
  }

  if (isBettingRoundComplete(game)) {
    advancePhase(game);
    return;
  }

  // Advance to next active player
  game.currentPlayerIndex = nextActiveIndex(game, idx);
}

function contribute(game, player, amount) {
  player.chips -= amount;
  player.currentBet += amount;
  player.totalBet += amount;
  game.pot += amount;
}

function isBettingRoundComplete(game) {
  if (game.waitingFor.length > 0) return false;
  const active = game.players.filter(p => p.status === 'active');
  return active.every(p => p.currentBet === game.currentBet);
}

function advancePhase(game) {
  game.sidePots = calculateSidePots(game.players);

  // Reset round bets
  for (const p of game.players) {
    if (p.status !== 'eliminated') p.currentBet = 0;
  }
  game.currentBet = 0;
  game.lastRaise = BIG_BLIND;

  switch (game.phase) {
    case 'pre_flop':
      game.phase = 'flop';
      game.communityCards.push(game.deck.deal(), game.deck.deal(), game.deck.deal());
      break;
    case 'flop':
      game.phase = 'turn';
      game.communityCards.push(game.deck.deal());
      break;
    case 'turn':
      game.phase = 'river';
      game.communityCards.push(game.deck.deal());
      break;
    case 'river':
      showdown(game);
      return;
  }

  const activePlayers = game.players.filter(p => p.status === 'active');
  if (activePlayers.length === 0) {
    while (game.communityCards.length < 5) game.communityCards.push(game.deck.deal());
    showdown(game);
    return;
  }

  // Post-flop action starts left of dealer
  game.currentPlayerIndex = nextActiveIndex(game, game.dealerIndex);
  game.waitingFor = activePlayers.map(p => p.id);
}

function resolveImmediate(game) {
  const winner = game.players.find(p => ['active', 'all_in'].includes(p.status));
  if (winner) {
    winner.chips += game.pot;
    game.lastHandResult = [{
      playerId: winner.id,
      playerName: winner.name,
      amount: game.pot,
      description: 'All others folded',
    }];
    logAction(game, winner.name, `Wins pot of ${game.pot} (all others folded)`);
  }
  finalizeHand(game);
}

function showdown(game) {
  game.phase = 'showdown';
  const contestants = game.players.filter(p => ['active', 'all_in'].includes(p.status));

  for (const p of contestants) {
    p.handResult = evaluateBestHand([...p.holeCards, ...game.communityCards]);
  }

  const pots = calculateSidePots(game.players);
  const results = [];

  for (const pot of pots) {
    if (pot.amount === 0) continue;
    const eligible = contestants.filter(p => pot.eligible.includes(p.id));
    if (eligible.length === 0) continue;

    let bestScore = -1;
    for (const p of eligible) {
      if (p.handResult && p.handResult.score > bestScore) bestScore = p.handResult.score;
    }

    const winners = eligible.filter(p => p.handResult && p.handResult.score === bestScore);
    const share = Math.floor(pot.amount / winners.length);
    const rem = pot.amount - share * winners.length;

    for (let i = 0; i < winners.length; i++) {
      const winAmt = i === 0 ? share + rem : share; // remainder to first winner
      winners[i].chips += winAmt;
      results.push({
        playerId: winners[i].id,
        playerName: winners[i].name,
        amount: winAmt,
        hand: winners[i].handResult?.description,
      });
    }
  }

  game.lastHandResult = results;
  finalizeHand(game);
}

function finalizeHand(game) {
  game.phase = 'showdown';
  for (const p of game.players) {
    if (p.chips === 0 && p.status !== 'eliminated') p.status = 'eliminated';
  }
}

// ─── Bot runner ──────────────────────────────────────────────────────────────

function runBotActions(game) {
  let safety = 100;
  while (safety-- > 0) {
    if (['showdown', 'complete', 'waiting'].includes(game.phase)) break;

    const cur = game.players[game.currentPlayerIndex];
    if (!cur) break;
    if (!cur.isBot) break;
    if (cur.status !== 'active') {
      const next = nextActiveIndex(game, game.currentPlayerIndex);
      if (next === game.currentPlayerIndex) break; // no active players
      game.currentPlayerIndex = next;
      continue;
    }

    const decision = getAiDecision(cur, game);
    try {
      processAction(game, cur.id, decision.action, decision.amount);
    } catch {
      try { processAction(game, cur.id, 'fold'); } catch { break; }
    }
  }
}

// ─── Index helpers ───────────────────────────────────────────────────────────

function nextAliveIndex(game, from) {
  const n = game.players.length;
  let idx = (from + 1) % n;
  for (let i = 0; i < n; i++) {
    if (game.players[idx].status !== 'eliminated') return idx;
    idx = (idx + 1) % n;
  }
  return from;
}

function nextActiveIndex(game, from) {
  const n = game.players.length;
  let idx = (from + 1) % n;
  for (let i = 0; i < n; i++) {
    if (game.players[idx].status === 'active') return idx;
    idx = (idx + 1) % n;
  }
  return from; // fallback (shouldn't happen)
}

function logAction(game, name, text) {
  game.actionLog = [...(game.actionLog || []).slice(-19), `${name}: ${text}`];
}

// ─── View sanitization ───────────────────────────────────────────────────────

function sanitize(game, userId) {
  const isShowdown = game.phase === 'showdown';
  return {
    ...game,
    deck: null, // never send deck to client
    players: game.players.map(p => ({
      ...p,
      holeCards:
        p.id === userId || isShowdown
          ? p.holeCards
          : p.holeCards.map(() => ({ rank: '?', suit: '?' })),
      handResult: isShowdown ? p.handResult : undefined,
    })),
  };
}

module.exports = {
  createTable, getTable, removeTable,
  startHand, processAction, runBotActions, sanitize,
};
