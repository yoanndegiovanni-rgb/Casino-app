const express = require('express');
const { db }  = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ leaderboard: db.users.getTop10() });
});

module.exports = router;
