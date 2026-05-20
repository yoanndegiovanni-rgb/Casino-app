import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TYPE_STYLE = {
  win:   'text-green-400',
  loss:  'text-red-400',
  bonus: 'text-blue-400',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <div className="flex items-center justify-center h-64 text-gold">Loading…</div>;

  const stats = data?.stats ?? {};
  const txns  = data?.transactions ?? [];

  return (
    <div className="min-h-[calc(100vh-64px)] py-10 px-4 max-w-3xl mx-auto">
      <h1 className="text-gold-glow text-4xl font-extrabold mb-6">{user.username}'s Profile</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Balance" value={`${user.balance?.toLocaleString()} 💰`} />
        <StatCard label="BJ Wins" value={stats.blackjack_wins ?? 0} />
        <StatCard label="BJ Losses" value={stats.blackjack_losses ?? 0} />
        <StatCard label="Poker Wins" value={stats.poker_wins ?? 0} />
      </div>

      {/* Transaction history */}
      <h2 className="text-gold font-bold text-xl mb-3">Transaction History</h2>
      <div className="bg-casino-card border border-gray-800 rounded-2xl overflow-hidden">
        {txns.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No transactions yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-left">Game</th>
                <th className="py-2 px-4 text-left">Description</th>
                <th className="py-2 px-4 text-right">Amount</th>
                <th className="py-2 px-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map(t => (
                <tr key={t.id} className="border-b border-gray-900 hover:bg-felt-dark/20">
                  <td className={`py-2 px-4 font-bold capitalize ${TYPE_STYLE[t.type] ?? 'text-gray-300'}`}>
                    {t.type}
                  </td>
                  <td className="py-2 px-4 text-gray-400">{t.game ?? '—'}</td>
                  <td className="py-2 px-4 text-gray-400 truncate max-w-[160px]">{t.description}</td>
                  <td className={`py-2 px-4 text-right font-bold ${t.type === 'loss' ? 'text-red-400' : 'text-green-400'}`}>
                    {t.type === 'loss' ? '-' : '+'}{t.amount}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-300">{t.balance_after?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-casino-card border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white font-bold text-xl">{value}</p>
    </div>
  );
}
