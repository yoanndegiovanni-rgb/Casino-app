const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

function getToken() {
  return localStorage.getItem('casino_token');
}

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

const get  = (path)         => request(path);
const post = (path, body)   => request(path, { method: 'POST', body: JSON.stringify(body) });

// Auth
export const api = {
  auth: {
    register: (u, p)  => post('/auth/register',    { username: u, password: p }),
    login:    (u, p)  => post('/auth/login',        { username: u, password: p }),
    me:       ()      => get('/auth/me'),
    dailyBonus: ()    => post('/auth/daily-bonus',  {}),
  },
  blackjack: {
    state:     ()          => get('/blackjack/state'),
    bet:       (bets)      => post('/blackjack/bet',       { bets }),
    hit:       ()          => post('/blackjack/hit',       {}),
    stand:     ()          => post('/blackjack/stand',     {}),
    double:    ()          => post('/blackjack/double',    {}),
    split:     ()          => post('/blackjack/split',     {}),
    surrender: ()          => post('/blackjack/surrender', {}),
    newGame:   ()          => post('/blackjack/new-game',  {}),
    insurance: (amount)    => post('/blackjack/insurance', { amount }),
  },
  poker: {
    state:    ()                        => get('/poker/state'),
    join:     (numBots, difficulty)     => post('/poker/join',      { numBots, difficulty }),
    action:   (action, amount)          => post('/poker/action',    { action, amount }),
    nextHand: ()                        => post('/poker/next-hand', {}),
    leave:    ()                        => post('/poker/leave',     {}),
  },
  roulette: {
    spin: (bets) => post('/roulette/spin', { bets }),
  },
  wheel: {
    status: () => get('/wheel/status'),
    spin:   () => post('/wheel/spin', {}),
  },
  leaderboard: {
    get: () => get('/leaderboard'),
  },
  challenges: {
    progress: ()   => get('/challenges/progress'),
    claim:    (id) => post(`/challenges/claim/${id}`, {}),
  },
};
