require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./src/config/db');

const SEED_USERS = [
  { username: 'test1', password: 'test1', balance: 2500 },
  { username: 'test2', password: 'test2', balance: 1000 },
  { username: 'test3', password: 'test3', balance: 500  },
];

async function seed() {
  for (const u of SEED_USERS) {
    if (db.users.findByUsername(u.username)) {
      console.log(`  [skip] ${u.username} already exists`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const user = db.users.create({ username: u.username, password_hash: hash, balance: u.balance });
    db.game_stats.create(user.id);
    db.transactions.create({
      user_id: user.id, type: 'bonus', amount: u.balance,
      game: null, description: 'Seed account', balance_after: u.balance,
    });
    console.log(`  [ok] Created ${u.username} (balance: ${u.balance})`);
  }
  console.log('Seed complete.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
