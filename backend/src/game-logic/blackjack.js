const { Deck } = require('./deck');
const { v4: uuidv4 } = require('uuid');

// Shared shoe for all players
const shoe = new Deck(6);

// In-memory game store keyed by userId
const activeGames = new Map();

function rankValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank, 10);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.faceDown) continue;
    if (card.rank === 'A') { aces++; total += 11; }
    else total += rankValue(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoft(cards) {
  let total = 0, aces = 0;
  for (const card of cards) {
    if (card.faceDown) continue;
    if (card.rank === 'A') { aces++; total += 11; }
    else total += rankValue(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return aces > 0;
}

function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

// Dealer hits on soft 17
function dealerShouldHit(cards) {
  const v = handValue(cards);
  return v < 17 || (v === 17 && isSoft(cards));
}

function canSplit(hand, balance) {
  if (hand.cards.length !== 2) return false;
  if ((hand.splitCount || 0) >= 3) return false;
  if (balance < hand.bet) return false;
  return rankValue(hand.cards[0].rank) === rankValue(hand.cards[1].rank);
}

function canDouble(hand, balance) {
  return hand.cards.length === 2 && balance >= hand.bet;
}

function canSurrender(hand) {
  return hand.cards.length === 2 && !hand.fromSplit;
}

// ─── Game lifecycle ──────────────────────────────────────────────────────────

// bets: array of up to 3 amounts (0 = skip that spot)
function placeBet(userId, bets, balance) {
  const activeBets = bets.filter(b => b > 0);
  if (activeBets.length === 0)
    throw new Error('Place at least one bet');

  for (const b of activeBets) {
    if (!Number.isFinite(b) || b < 10 || b > 500)
      throw new Error('Each bet must be between 10 and 500 chips');
  }

  const totalBet = activeBets.reduce((s, b) => s + b, 0);
  if (totalBet > balance)
    throw new Error('Insufficient balance');

  const game = {
    id: uuidv4(),
    userId,
    status: 'playing',
    balance: balance - totalBet,
    hands: activeBets.map(bet => ({
      cards: [],
      bet,
      status: 'active',
      doubled: false,
      splitCount: 0,
      fromSplit: false,
    })),
    currentHandIndex: 0,
    dealerCards: [],
    result: null,
  };

  // Deal 2 cards to each hand, then dealer (face-up + hole)
  for (const hand of game.hands) {
    hand.cards.push(shoe.deal(), shoe.deal());
  }
  game.dealerCards.push(shoe.deal(), { ...shoe.deal(), faceDown: true });

  activeGames.set(userId, game);

  // Mark blackjack hands immediately
  for (const hand of game.hands) {
    if (isBlackjack(hand.cards)) hand.status = 'blackjack';
  }

  // If every hand is already resolved (all blackjack), go straight to dealer
  if (game.hands.every(h => h.status !== 'active')) {
    return resolveDealer(game);
  }

  // Point to first still-active hand
  game.currentHandIndex = game.hands.findIndex(h => h.status === 'active');
  return game;
}

function hit(userId) {
  const game = requireActiveGame(userId);
  const hand = currentHand(game);

  // Split aces only get one card (already handled in split(), but guard here)
  if (hand.fromSplit && hand.cards[0].rank === 'A' && hand.cards.length >= 2)
    throw new Error('Cannot hit split aces');

  hand.cards.push(shoe.deal());
  const v = handValue(hand.cards);

  if (v > 21) {
    hand.status = 'bust';
    return advanceHand(game);
  }
  if (v === 21) {
    hand.status = 'stand';
    return advanceHand(game);
  }
  return game;
}

function stand(userId) {
  const game = requireActiveGame(userId);
  currentHand(game).status = 'stand';
  return advanceHand(game);
}

function doubleDown(userId) {
  const game = requireActiveGame(userId);
  const hand = currentHand(game);

  if (!canDouble(hand, game.balance))
    throw new Error('Cannot double down');

  game.balance -= hand.bet;
  hand.bet *= 2;
  hand.doubled = true;
  hand.cards.push(shoe.deal());
  hand.status = handValue(hand.cards) > 21 ? 'bust' : 'stand';
  return advanceHand(game);
}

function split(userId) {
  const game = requireActiveGame(userId);
  const hand = currentHand(game);

  if (!canSplit(hand, game.balance))
    throw new Error('Cannot split');

  game.balance -= hand.bet;
  const splitCard = hand.cards.pop();
  hand.cards.push(shoe.deal());
  hand.splitCount = (hand.splitCount || 0) + 1;
  hand.fromSplit = true;

  const newHand = {
    cards: [splitCard, shoe.deal()],
    bet: hand.bet,
    status: 'active',
    doubled: false,
    splitCount: hand.splitCount,
    fromSplit: true,
  };

  game.hands.splice(game.currentHandIndex + 1, 0, newHand);

  // Split aces: each hand stands immediately with 2 cards
  if (hand.cards[0].rank === 'A') {
    hand.status = 'stand';
    newHand.status = 'stand';
    return advanceHand(game);
  }

  return game;
}

function surrender(userId) {
  const game = requireActiveGame(userId);
  const hand = currentHand(game);

  if (!canSurrender(hand))
    throw new Error('Surrender only allowed on initial two cards');

  hand.status = 'surrender';
  const refund = Math.floor(hand.bet / 2);
  game.balance += refund;
  hand.bet -= refund; // tracks net loss
  return advanceHand(game);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function requireActiveGame(userId) {
  const game = activeGames.get(userId);
  if (!game || game.status !== 'playing')
    throw new Error('No active game in progress');
  return game;
}

function currentHand(game) {
  const hand = game.hands[game.currentHandIndex];
  if (!hand || hand.status !== 'active')
    throw new Error('No active hand');
  return hand;
}

function advanceHand(game) {
  const nextIdx = game.hands.findIndex(
    (h, i) => i > game.currentHandIndex && h.status === 'active'
  );

  if (nextIdx !== -1) {
    game.currentHandIndex = nextIdx;
    return game;
  }

  return resolveDealer(game);
}

function resolveDealer(game) {
  game.status = 'complete';

  // Reveal hole card
  game.dealerCards = game.dealerCards.map(c => ({ ...c, faceDown: false }));

  // Dealer draws according to soft-17 rule
  while (dealerShouldHit(game.dealerCards)) {
    game.dealerCards.push(shoe.deal());
  }

  const dealerVal = handValue(game.dealerCards);
  const dealerBJ = isBlackjack(game.dealerCards);

  let totalPayout = 0;
  const handResults = [];

  for (const hand of game.hands) {
    const hv = handValue(hand.cards);
    let outcome, payout;

    if (hand.status === 'surrender') {
      outcome = 'surrender'; payout = 0;
    } else if (hand.status === 'bust') {
      outcome = 'bust'; payout = 0;
    } else if (hand.status === 'blackjack') {
      if (dealerBJ) { outcome = 'push'; payout = hand.bet; }
      else { outcome = 'blackjack'; payout = hand.bet + Math.floor(hand.bet * 1.5); }
    } else {
      // stand
      if (dealerVal > 21 || hv > dealerVal) { outcome = 'win'; payout = hand.bet * 2; }
      else if (hv === dealerVal) { outcome = 'push'; payout = hand.bet; }
      else { outcome = 'lose'; payout = 0; }
    }

    totalPayout += payout;
    handResults.push({ outcome, payout, handValue: hv });
  }

  game.balance += totalPayout;
  game.result = { handResults, totalPayout, dealerValue: dealerVal };

  return game;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function getGame(userId) { return activeGames.get(userId) || null; }
function endGame(userId) { activeGames.delete(userId); }

module.exports = {
  placeBet, hit, stand, doubleDown, split, surrender,
  getGame, endGame,
  handValue, canSplit, canDouble, canSurrender,
};
