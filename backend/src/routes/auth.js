const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db }  = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function sign(userId, username) {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters' });

  if (db.users.findByUsername(username))
    return res.status(409).json({ error: 'Username already taken' });

  const hash = await bcrypt.hash(password, 10);
  const user = db.users.create({ username, password_hash: hash, balance: 1000 });
  db.game_stats.create(user.id);
  db.transactions.create({
    user_id: user.id, type: 'bonus', amount: 1000,
    game: null, description: 'Welcome bonus', balance_after: 1000,
  });

  res.status(201).json({ token: sign(user.id, username), user: { id: user.id, username, balance: 1000 } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  const user = db.users.findByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid credentials' });

  res.json({
    token: sign(user.id, user.username),
    user: { id: user.id, username: user.username, balance: user.balance },
  });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });

  const { password_hash: _, ...safeUser } = user;
  const stats        = db.game_stats.findByUserId(req.userId) || {};
  const transactions = db.transactions.findByUserId(req.userId, 30);

  res.json({ user: safeUser, stats, transactions });
});

router.post('/daily-bonus', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Not found' });

  if (user.balance >= 100)
    return res.status(400).json({ error: 'Balance must be below 100 chips to claim the daily bonus' });

  const today = new Date().toISOString().slice(0, 10);
  if (user.last_daily_bonus === today)
    return res.status(400).json({ error: 'Daily bonus already claimed today' });

  const newBalance = user.balance + 100;
  db.users.update(req.userId, { balance: newBalance, last_daily_bonus: today });
  db.transactions.create({
    user_id: req.userId, type: 'bonus', amount: 100,
    game: null, description: 'Daily bonus', balance_after: newBalance,
  });

  res.json({ balance: newBalance, message: 'Daily bonus claimed: +100 chips!' });
});

module.exports = router;
