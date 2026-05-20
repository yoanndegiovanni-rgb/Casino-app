const express = require('express');
const { authenticate }      = require('../middleware/auth');
const { db }                = require('../config/db');
const { spin, evaluateBet } = require('../game-logic/roulette');
const { updateDailyStreak } = require('../game-logic/challenges');

const router = express.Router();

router.post('/spin', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const bets = req.body.bets;
  if (!Array.isArray(bets) || bets.length === 0)
    return res.status(400).json({ error: 'No bets placed' });

  const totalBet = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  if (totalBet <= 0)  return res.status(400).json({ error: 'Invalid bet amount' });
  if (totalBet > user.balance) return res.status(400).json({ error: 'Insufficient balance' });

  const winningNumber = spin();

  let totalPayout = 0;
  const betResults = bets.map(bet => {
    const payout = evaluateBet({ ...bet, amount: Number(bet.amount) }, winningNumber);
    totalPayout += payout;
    return { ...bet, payout, won: payout > 0 };
  });

  const newBalance = user.balance - totalBet + totalPayout;
  const net = totalPayout - totalBet;

  db.users.update(req.userId, { balance: newBalance });

  db.transactions.create({
    user_id: req.userId,
    type: net >= 0 ? 'win' : 'loss',
    amount: Math.abs(net),
    game: 'roulette',
    description: `Roulette: numéro ${winningNumber} · ${net >= 0 ? '+' : ''}${net}`,
    balance_after: newBalance,
  });

  db.game_stats.increment(req.userId, {
    roulette_spins:   1,
    roulette_wins:    net > 0  ? 1 : 0,
    roulette_losses:  net < 0  ? 1 : 0,
    total_wagered:    totalBet,
    total_won:        totalPayout,
  });

  updateDailyStreak(req.userId, db);

  res.json({ winningNumber, betResults, totalPayout, totalBet, net, balance: newBalance });
});

module.exports = router;
