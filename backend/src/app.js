require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const blackjackRoutes   = require('./routes/blackjack');
const pokerRoutes       = require('./routes/poker');
const rouletteRoutes    = require('./routes/roulette');
const leaderboardRoutes = require('./routes/leaderboard');
const wheelRoutes       = require('./routes/wheel');
const challengesRoutes  = require('./routes/challenges');

const app = express();

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/blackjack',   blackjackRoutes);
app.use('/api/poker',       pokerRoutes);
app.use('/api/roulette',    rouletteRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/wheel',       wheelRoutes);
app.use('/api/challenges',  challengesRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Casino backend running on http://localhost:${PORT}`));
