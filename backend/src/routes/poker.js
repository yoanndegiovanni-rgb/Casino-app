const express = require('express');
const { authenticate } = require('../middleware/auth');
const { db }   = require('../config/db');
const engine   = require('../game-logic/poker/engine');

const router = express.Router();

function savePokerResult(userId, game) {
  const user  = db.users.findById(userId);
  const human = game.players.find(p => !p.isBot);
  if (!user || !human) return;

  const prevChips = user.balance;
  const nowChips  = human.chips;
  const netChange = nowChips - prevChips;

  db.users.update(userId, { balance: nowChips });

  if (netChange !== 0) {
    db.transactions.create({
      user_id: userId,
      type: netChange >= 0 ? 'win' : 'loss',
      amount: Math.abs(netChange),
      game: 'poker',
      description: "Texas Hold'em hand",
      balance_after: nowChips,
    });
  }

  const isWinner = (game.lastHandResult || []).some(r => r.playerId === userId && r.amount > 0);
  db.game_stats.increment(userId, {
    poker_wins:   isWinner ? 1 : 0,
    poker_losses: isWinner ? 0 : 1,
    total_won:    isWinner && netChange > 0 ? netChange : 0,
  });
}

router.get('/state', authenticate, (req, res) => {
  const game = engine.getTable(req.userId);
  if (!game) return res.json({ game: null });
  res.json({ game: engine.sanitize(game, req.userId) });
});

router.post('/join', authenticate, (req, res) => {
  const { numBots = 3, difficulty = 'medium' } = req.body || {};
  if (numBots < 1 || numBots > 5)
    return res.status(400).json({ error: 'numBots must be 1–5' });
  if (!['easy','medium','hard'].includes(difficulty))
    return res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });

  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.balance < 20) return res.status(400).json({ error: 'Insufficient balance' });

  engine.removeTable(req.userId);
  const game  = engine.createTable(req.userId, user.username, user.balance, numBots, difficulty);
  const human = game.players.find(p => !p.isBot);
  if (human) human.chips = user.balance;

  engine.startHand(game);
  engine.runBotActions(game);

  res.json({ game: engine.sanitize(game, req.userId) });
});

router.post('/action', authenticate, (req, res) => {
  const game = engine.getTable(req.userId);
  if (!game) return res.status(404).json({ error: 'No active poker game' });

  const { action, amount } = req.body || {};
  try {
    engine.processAction(game, req.userId, action, amount ? Number(amount) : undefined);
    engine.runBotActions(game);
    if (game.phase === 'showdown') savePokerResult(req.userId, game);
    res.json({ game: engine.sanitize(game, req.userId) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/next-hand', authenticate, (req, res) => {
  const game = engine.getTable(req.userId);
  if (!game) return res.status(404).json({ error: 'No active poker game' });
  if (game.phase !== 'showdown') return res.status(400).json({ error: 'Hand not finished' });

  savePokerResult(req.userId, game);

  const alive = game.players.filter(p => p.status !== 'eliminated' && p.chips > 0);
  if (alive.length < 2) {
    game.phase = 'complete';
  } else {
    engine.startHand(game);
    engine.runBotActions(game);
  }

  res.json({ game: engine.sanitize(game, req.userId) });
});

router.post('/leave', authenticate, (req, res) => {
  const game  = engine.getTable(req.userId);
  if (!game) {
    const user = db.users.findById(req.userId);
    return res.json({ balance: user?.balance ?? 0, message: 'No active game' });
  }
  const human = game.players.find(p => !p.isBot);
  const chips  = human?.chips ?? 0;
  db.users.update(req.userId, { balance: chips });
  engine.removeTable(req.userId);
  res.json({ balance: chips, message: `Cashed out ${chips} chips` });
});

module.exports = router;
