const express = require('express');
const { authenticate } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// 12 segments ordered around the wheel
const SEGMENTS = [
  { chips: 200  },
  { chips: 1000 },
  { chips: 300  },
  { chips: 2500 },
  { chips: 200  },
  { chips: 750  },
  { chips: 500  },
  { chips: 200  },
  { chips: 1500 },
  { chips: 300  },
  { chips: 2000 },
  { chips: 500  },
];

// Weighted random: lower prizes more likely
const WEIGHTS = [5, 2, 4, 1, 5, 2, 3, 5, 1, 4, 1, 3];
const TOTAL_WEIGHT = WEIGHTS.reduce((s, w) => s + w, 0);

function pickSegment() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return WEIGHTS.length - 1;
}

router.get('/status', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const lastSpin    = user.last_spin_time || 0;
  const nextSpin    = lastSpin + COOLDOWN_MS;
  const now         = Date.now();
  const canSpin     = now >= nextSpin;
  const msRemaining = canSpin ? 0 : nextSpin - now;

  res.json({ canSpin, msRemaining, segments: SEGMENTS });
});

router.post('/spin', authenticate, (req, res) => {
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const lastSpin = user.last_spin_time || 0;
  const now      = Date.now();

  if (now - lastSpin < COOLDOWN_MS) {
    return res.status(429).json({
      error: 'Wheel not ready yet',
      msRemaining: (lastSpin + COOLDOWN_MS) - now,
    });
  }

  const segmentIndex = pickSegment();
  const chips        = SEGMENTS[segmentIndex].chips;
  const newBalance   = user.balance + chips;

  db.users.update(req.userId, { balance: newBalance, last_spin_time: now });
  db.game_stats.increment(req.userId, { wheel_spins: 1 });
  db.transactions.create({
    user_id: req.userId, type: 'bonus', amount: chips,
    game: 'wheel', description: `Spin wheel: +${chips} chips`,
    balance_after: newBalance,
  });

  res.json({ segmentIndex, chips, balance: newBalance });
});

module.exports = router;
