const express = require('express');
const { authenticate } = require('../middleware/auth');
const { db } = require('../config/db');
const { CHALLENGE_TRACKS, getProgress } = require('../game-logic/challenges');

const router = express.Router();

router.get('/progress', authenticate, (req, res) => {
  const user  = db.users.findById(req.userId);
  const stats = db.game_stats.findByUserId(req.userId) || {};
  if (!user) return res.status(404).json({ error: 'User not found' });

  const progress = getProgress(user, stats);
  const claimed  = user.claimed_challenges || [];

  const tracks = CHALLENGE_TRACKS.map(track => {
    const value  = progress[track.stat] || 0;
    const stages = track.stages.map((stage, i) => {
      const isClaimed   = claimed.includes(stage.id);
      const isLocked    = i > 0 && !claimed.includes(track.stages[i - 1].id);
      const isCompleted = !isClaimed && !isLocked && value >= stage.target;
      return {
        ...stage,
        locked:    isLocked,
        claimed:   isClaimed,
        completed: isCompleted,
        current:   isLocked ? 0 : Math.min(value, stage.target),
      };
    });
    return { id: track.id, icon: track.icon, title: track.title, stages };
  });

  res.json({ tracks });
});

router.post('/claim/:id', authenticate, (req, res) => {
  const user  = db.users.findById(req.userId);
  const stats = db.game_stats.findByUserId(req.userId) || {};
  if (!user) return res.status(404).json({ error: 'User not found' });

  let foundTrack = null, foundStage = null, foundStageIdx = -1;
  for (const track of CHALLENGE_TRACKS) {
    const idx = track.stages.findIndex(s => s.id === req.params.id);
    if (idx !== -1) {
      foundTrack    = track;
      foundStage    = track.stages[idx];
      foundStageIdx = idx;
      break;
    }
  }
  if (!foundStage) return res.status(404).json({ error: 'Challenge not found' });

  const claimed = user.claimed_challenges || [];
  if (claimed.includes(foundStage.id)) {
    return res.status(400).json({ error: 'Already claimed' });
  }

  for (let i = 0; i < foundStageIdx; i++) {
    if (!claimed.includes(foundTrack.stages[i].id)) {
      return res.status(400).json({ error: 'Complete previous stages first' });
    }
  }

  const progress = getProgress(user, stats);
  if ((progress[foundTrack.stat] || 0) < foundStage.target) {
    return res.status(400).json({ error: 'Challenge not completed yet' });
  }

  const newBalance = user.balance + foundStage.reward;
  db.users.update(req.userId, {
    balance: newBalance,
    claimed_challenges: [...claimed, foundStage.id],
  });

  db.transactions.create({
    user_id: req.userId, type: 'bonus', amount: foundStage.reward,
    game: 'challenge', description: `Challenge: ${foundStage.title}`,
    balance_after: newBalance,
  });

  res.json({ balance: newBalance, reward: foundStage.reward });
});

module.exports = router;
