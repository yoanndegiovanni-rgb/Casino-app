const express = require('express');
const { authenticate } = require('../middleware/auth');
const { db }  = require('../config/db');
const bj      = require('../game-logic/blackjack');
const { updateDailyStreak } = require('../game-logic/challenges');

const router = express.Router();

function saveResult(userId, game) {
  const user = db.users.findById(userId);
  if (!user) return;

  const totalBet = game.hands.reduce((s, h) => s + h.bet, 0);
  const payout   = game.result.totalPayout;
  const net      = payout - totalBet;

  db.users.update(userId, { balance: game.balance });

  const outcomes = game.result.handResults.map(r => r.outcome).join(', ');
  db.transactions.create({
    user_id: userId, type: net >= 0 ? 'win' : 'loss',
    amount: Math.abs(net), game: 'blackjack',
    description: `Blackjack: ${outcomes}`, balance_after: game.balance,
  });

  const wins           = game.result.handResults.filter(r => ['win','blackjack'].includes(r.outcome)).length;
  const losses         = game.result.handResults.filter(r => ['lose','bust'].includes(r.outcome)).length;
  const pushes         = game.result.handResults.filter(r => r.outcome === 'push').length;
  const blackjacksCount = game.result.handResults.filter(r => r.outcome === 'blackjack').length;

  db.game_stats.increment(userId, {
    blackjack_wins:   wins,
    blackjack_losses: losses,
    blackjack_pushes: pushes,
    blackjacks_count: blackjacksCount,
    total_wagered:    totalBet,
    total_won:        payout,
  });

  updateDailyStreak(userId, db);
}

router.get('/state', authenticate, (req, res) => {
  const game = bj.getGame(req.userId);
  const user = db.users.findById(req.userId);
  res.json({ game, balance: user?.balance ?? 0 });
});

router.post('/bet', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Accept either legacy { bet: 100 } or new { bets: [100, 50, 0] }
  let bets;
  if (Array.isArray(req.body?.bets)) {
    bets = req.body.bets.slice(0, 3).map(Number);
  } else {
    bets = [Number(req.body?.bet)];
  }

  bj.endGame(req.userId);
  try {
    const game = bj.placeBet(req.userId, bets, user.balance);
    if (game.status === 'complete') { saveResult(req.userId, game); bj.endGame(req.userId); }
    res.json({ game });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

function actionRoute(action) {
  return (req, res) => {
    try {
      const game = bj[action](req.userId);
      if (game.status === 'complete') { saveResult(req.userId, game); bj.endGame(req.userId); }
      res.json({ game });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };
}

router.post('/hit',       authenticate, actionRoute('hit'));
router.post('/stand',     authenticate, actionRoute('stand'));
router.post('/double',    authenticate, actionRoute('doubleDown'));
router.post('/split',     authenticate, actionRoute('split'));
router.post('/surrender', authenticate, actionRoute('surrender'));

router.post('/new-game', authenticate, (req, res) => {
  bj.endGame(req.userId);
  const user = db.users.findById(req.userId);
  res.json({ balance: user?.balance ?? 0 });
});

module.exports = router;
