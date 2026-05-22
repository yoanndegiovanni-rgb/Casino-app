/**
 * Pure-JS JSON database — no native compilation required.
 * Data is stored in /backend/data/db.json and persisted after every write.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE  = path.join(DATA_DIR, 'db.json');

const EMPTY = {
  users:        [],
  game_stats:   [],
  transactions: [],
  _seq: { users: 1, game_stats: 1, transactions: 1 },
};

let data = JSON.parse(JSON.stringify(EMPTY));

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { /* use empty */ }
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(table) {
  const id = data._seq[table] || 1;
  data._seq[table] = id + 1;
  return id;
}

load();

// ─── Users ───────────────────────────────────────────────────────────────────
const users = {
  findByUsername(username) {
    return data.users.find(u => u.username === username) || null;
  },
  findById(id) {
    return data.users.find(u => u.id === id) || null;
  },
  create({ username, password_hash, balance = 1000 }) {
    const user = {
      id: nextId('users'),
      username,
      password_hash,
      balance,
      created_at: new Date().toISOString(),
      last_daily_bonus: null,
    };
    data.users.push(user);
    save();
    return user;
  },
  update(id, changes) {
    const user = data.users.find(u => u.id === id);
    if (user) { Object.assign(user, changes); save(); }
    return user || null;
  },
  getTop10() {
    return [...data.users]
      .map(u => {
        const s = game_stats.findByUserId(u.id) || {};
        return {
          id: u.id,
          username: u.username,
          balance: u.balance,
          blackjack_wins:  s.blackjack_wins  || 0,
          blackjacks_count: s.blackjacks_count || 0,
          poker_wins:      s.poker_wins      || 0,
          roulette_wins:   s.roulette_wins   || 0,
          roulette_spins:  s.roulette_spins  || 0,
          roulette_straight_wins: s.roulette_straight_wins || 0,
          total_wagered:   s.total_wagered   || 0,
        };
      });
  },
};

// ─── Game stats ───────────────────────────────────────────────────────────────
const game_stats = {
  findByUserId(userId) {
    return data.game_stats.find(s => s.user_id === userId) || null;
  },
  create(userId) {
    const s = {
      id: nextId('game_stats'),
      user_id: userId,
      blackjack_wins: 0, blackjack_losses: 0, blackjack_pushes: 0,
      poker_wins: 0, poker_losses: 0,
      total_wagered: 0, total_won: 0,
    };
    data.game_stats.push(s);
    save();
    return s;
  },
  // Pass deltas: { blackjack_wins: 1, total_wagered: 50, ... }
  increment(userId, deltas) {
    const s = data.game_stats.find(s => s.user_id === userId);
    if (s) {
      for (const [k, v] of Object.entries(deltas)) s[k] = (s[k] || 0) + v;
      save();
    }
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────
const transactions = {
  create({ user_id, type, amount, game, description, balance_after }) {
    const tx = {
      id: nextId('transactions'),
      user_id, type, amount,
      game: game || null,
      description,
      balance_after,
      created_at: new Date().toISOString(),
    };
    data.transactions.push(tx);
    save();
    return tx;
  },
  findByUserId(userId, limit = 30) {
    return data.transactions
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },
};

module.exports = { db: { users, game_stats, transactions } };
