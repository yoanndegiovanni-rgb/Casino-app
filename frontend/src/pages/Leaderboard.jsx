import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { user }   = useAuth();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leaderboard.get()
      .then(({ leaderboard }) => setRows(leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center py-10 px-4">
      <h1 className="text-gold-glow text-4xl font-extrabold tracking-widest mb-2">Leaderboard</h1>
      <p className="text-gray-500 text-sm mb-8">Top 10 players by chip balance</p>

      {loading ? (
        <div className="text-gold animate-pulse">Loading…</div>
      ) : (
        <div className="w-full max-w-2xl bg-casino-card border border-gold/20 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold/20 bg-felt-dark/60 text-gray-400 text-xs uppercase tracking-widest">
                <th className="py-3 px-4 text-left">Rank</th>
                <th className="py-3 px-4 text-left">Player</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-right hidden sm:table-cell">BJ Wins</th>
                <th className="py-3 px-4 text-right hidden sm:table-cell">Poker Wins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-800/60 transition
                    ${row.username === user?.username ? 'bg-gold/5 border-gold/30' : 'hover:bg-felt-dark/30'}`}
                >
                  <td className="py-3 px-4 font-bold text-lg">
                    {MEDALS[i] ?? <span className="text-gray-500">#{i + 1}</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-semibold ${row.username === user?.username ? 'text-gold' : 'text-white'}`}>
                      {row.username}
                      {row.username === user?.username && ' (you)'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gold whitespace-nowrap">
                    {row.balance?.toLocaleString()} 💰
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 hidden sm:table-cell">
                    {row.blackjack_wins}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 hidden sm:table-cell">
                    {row.poker_wins}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No players yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
