# Royal Casino 🎰

Full-stack casino app with **Blackjack** and **Texas Hold'em Poker**.
Built with React + Tailwind (frontend) and Node.js + Express + SQLite (backend).

---

## Prerequisites

- **Node.js 18+** — install via [https://nodejs.org](https://nodejs.org) or `brew install node`
- **npm** (bundled with Node.js)

---

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd casino-app/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment

The backend `.env` is pre-created with sensible defaults.
To customise, edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=casino_jwt_secret_change_in_production_xK9mP2nQ
DB_PATH=./database.db
```

### 3. Seed the database (test accounts)

```bash
cd backend
npm run seed
```

This creates three accounts:
| Username | Password | Starting balance |
|----------|----------|-----------------|
| test1    | test1    | 2,500 chips     |
| test2    | test2    | 1,000 chips     |
| test3    | test3    | 500 chips       |

### 4. Start the servers

Open **two terminal tabs**:

```bash
# Tab 1 – Backend (port 3001)
cd casino-app/backend
npm run dev       # uses nodemon for auto-reload
# or: npm start

# Tab 2 – Frontend (port 5173)
cd casino-app/frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Game Rules

### Blackjack
| Rule | Value |
|------|-------|
| Decks | 6 (shuffled when < 25% remains) |
| Dealer | Hits soft 17, stands on hard 17+ |
| Blackjack pays | 3:2 |
| Split | Up to 4 hands; re-split allowed |
| Split Aces | 1 card each, no further hit |
| Double after split | Allowed |
| Surrender | Early surrender on initial two cards only |
| Bet range | 10 – 500 chips |

### Texas Hold'em
| Rule | Value |
|------|-------|
| Players | 1 human + 1–5 AI bots |
| Blinds | Small 10, Big 20 (fixed) |
| Hand cycle | Pre-Flop → Flop → Turn → River → Showdown |
| Side pots | Fully supported |
| AI difficulties | Easy / Medium / Hard |
| Bot elimination | Bots are eliminated when their chips reach 0 (no rebuy) |
| Leave table | Cash out at any time; chips return to your balance |

### Economy
- Starting balance: **1,000 chips**
- **Daily bonus**: +100 chips if balance is below 100 (claim from Home page)
- All wins/losses are persisted to your account

---

## Project Structure

```
casino-app/
├── backend/
│   ├── src/
│   │   ├── config/db.js            # SQLite schema + connection
│   │   ├── middleware/auth.js      # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js             # Register, login, /me, daily bonus
│   │   │   ├── blackjack.js        # BJ game REST API
│   │   │   ├── poker.js            # Poker game REST API
│   │   │   └── leaderboard.js
│   │   ├── game-logic/
│   │   │   ├── deck.js             # Deck class (multi-deck shoe)
│   │   │   ├── blackjack.js        # BJ state machine
│   │   │   └── poker/
│   │   │       ├── engine.js       # Poker state machine
│   │   │       ├── evaluator.js    # 7-card hand evaluator
│   │   │       ├── ai.js           # Bot decision engine
│   │   │       └── sidepots.js     # Side pot calculation
│   │   └── app.js
│   ├── seed.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/             # Card, ChipStack, Navbar
    │   │   ├── blackjack/          # BlackjackTable, BetControls
    │   │   └── poker/              # PokerTable, PlayerSeat, ActionPanel
    │   ├── pages/                  # Home, Login, Register, BJ, Poker, Leaderboard, Profile
    │   ├── context/AuthContext.jsx
    │   ├── services/api.js
    │   └── utils/sounds.js         # Web Audio API sound effects
    └── package.json
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET  | `/api/auth/me` | Get profile + stats + transactions |
| POST | `/api/auth/daily-bonus` | Claim daily bonus |

### Blackjack
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/blackjack/state` | Get current game |
| POST | `/api/blackjack/bet` | Start hand `{ bet }` |
| POST | `/api/blackjack/hit` | Hit |
| POST | `/api/blackjack/stand` | Stand |
| POST | `/api/blackjack/double` | Double down |
| POST | `/api/blackjack/split` | Split |
| POST | `/api/blackjack/surrender` | Surrender |
| POST | `/api/blackjack/new-game` | Clear game |

### Poker
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/poker/state` | Get table state |
| POST | `/api/poker/join` | Join table `{ numBots, difficulty }` |
| POST | `/api/poker/action` | Player action `{ action, amount? }` |
| POST | `/api/poker/next-hand` | Start next hand after showdown |
| POST | `/api/poker/leave` | Cash out and leave |

### Misc
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/leaderboard` | Top 10 players |

---

## Sound Effects

Uses the **Web Audio API** — no external files required. Sounds include:
card deal, chip drop, win fanfare, lose tone, and push chime.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite |
| Backend | Node.js, Express 4 |
| Database | SQLite via better-sqlite3 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| State | In-memory game state, persisted to SQLite on completion |
