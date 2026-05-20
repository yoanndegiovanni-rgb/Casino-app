import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import PokerTable from '../components/poker/PokerTable';
import { sounds } from '../utils/sounds';

const DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   desc: 'Bots play loosely and fold often' },
  { value: 'medium', label: 'Medium', desc: 'Balanced play, some bluffing'     },
  { value: 'hard',   label: 'Hard',   desc: 'Tight, aggressive, occasional bluffs' },
];

export default function PokerPage() {
  const { user, updateBalance } = useAuth();
  const [game, setGame]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(false);
  const [error, setError]       = useState('');
  const [config, setConfig]     = useState({ numBots: 3, difficulty: 'medium' });

  useEffect(() => {
    if (!user) return;
    api.poker.state()
      .then(({ game: g }) => setGame(g))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="flex items-center justify-center h-64 text-gold">Loading…</div>;

  async function joinTable() {
    setError(''); setJoining(true);
    try {
      const { game: g } = await api.poker.join(config.numBots, config.difficulty);
      setGame(g);
      sounds.deal();
    } catch (e) {
      setError(e.message);
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    setGame(null);
    api.auth.me().then(({ user: u }) => updateBalance(u.balance)).catch(() => {});
  }

  if (game) {
    return <PokerTable game={game} onGameUpdate={setGame} onLeave={handleLeave} />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="bg-casino-card border border-gold/30 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <h1 className="text-gold-glow text-3xl font-extrabold mb-2">Texas Hold'em</h1>
        <p className="text-gray-400 text-sm mb-6">Configure your table, then join to play</p>

        {error && (
          <div className="bg-red-900/60 border border-red-500 text-red-200 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Num bots */}
        <div className="mb-5 text-left">
          <label className="text-gray-400 text-xs uppercase tracking-widest block mb-2">
            Number of Opponents ({config.numBots})
          </label>
          <input
            type="range" min={1} max={5} step={1}
            value={config.numBots}
            onChange={e => setConfig(c => ({ ...c, numBots: +e.target.value }))}
            className="w-full accent-yellow-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>1 bot</span><span>5 bots</span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6 text-left">
          <label className="text-gray-400 text-xs uppercase tracking-widest block mb-2">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                onClick={() => setConfig(c => ({ ...c, difficulty: d.value }))}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition
                  ${config.difficulty === d.value
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'bg-casino-bg border-gray-700 text-gray-400 hover:border-gray-500'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-1.5">
            {DIFFICULTIES.find(d => d.value === config.difficulty)?.desc}
          </p>
        </div>

        <div className="mb-4 text-gray-500 text-sm">
          Your stake: <span className="text-gold font-bold">{user.balance?.toLocaleString()}</span> chips
          <br />
          <span className="text-xs">Blinds: 10 / 20</span>
        </div>

        <button
          onClick={joinTable}
          disabled={joining || user.balance < 20}
          className="btn-gold w-full py-3 rounded-xl font-extrabold text-xl disabled:opacity-50"
        >
          {joining ? 'Joining…' : '🃏 Join Table'}
        </button>

        {user.balance < 20 && (
          <p className="text-red-400 text-xs mt-2">You need at least 20 chips (1 big blind) to play.</p>
        )}
      </div>
    </div>
  );
}
