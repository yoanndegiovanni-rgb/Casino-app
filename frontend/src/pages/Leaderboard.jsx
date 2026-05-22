import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MEDALS = ['🥇', '🥈', '🥉'];

const TABS = [
  {
    id: 'general',
    label: 'Général',
    icon: '💰',
    sortKey: 'balance',
    columns: [
      { label: 'Solde',          key: 'balance',        format: v => v?.toLocaleString() + ' 💰', className: 'text-gold font-bold' },
      { label: 'BJ Wins',        key: 'blackjack_wins', className: 'text-gray-400' },
      { label: 'Roulette Wins',  key: 'roulette_wins',  className: 'text-gray-400' },
      { label: 'Poker Wins',     key: 'poker_wins',     className: 'text-gray-400' },
    ],
  },
  {
    id: 'blackjack',
    label: 'Blackjack',
    icon: '🃏',
    sortKey: 'blackjack_wins',
    columns: [
      { label: 'Victoires',   key: 'blackjack_wins',   className: 'text-green-400 font-bold' },
      { label: 'Blackjacks',  key: 'blackjacks_count', className: 'text-yellow-400' },
      { label: 'Solde',       key: 'balance',          format: v => v?.toLocaleString(), className: 'text-gold' },
    ],
  },
  {
    id: 'roulette',
    label: 'Roulette',
    icon: '🎡',
    sortKey: 'roulette_wins',
    columns: [
      { label: 'Victoires',  key: 'roulette_wins',           className: 'text-green-400 font-bold' },
      { label: 'Pleins 35:1',key: 'roulette_straight_wins',  className: 'text-yellow-400' },
      { label: 'Tours joués',key: 'roulette_spins',          className: 'text-gray-400' },
      { label: 'Solde',      key: 'balance',                 format: v => v?.toLocaleString(), className: 'text-gold' },
    ],
  },
  {
    id: 'poker',
    label: 'Poker',
    icon: '♠',
    sortKey: 'poker_wins',
    columns: [
      { label: 'Victoires', key: 'poker_wins', className: 'text-green-400 font-bold' },
      { label: 'Solde',     key: 'balance',    format: v => v?.toLocaleString(), className: 'text-gold' },
    ],
  },
];

export default function Leaderboard() {
  const { user }              = useAuth();
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    api.leaderboard.get()
      .then(({ leaderboard }) => setAllRows(leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tab = TABS.find(t => t.id === activeTab);
  const rows = [...allRows]
    .sort((a, b) => (b[tab.sortKey] ?? 0) - (a[tab.sortKey] ?? 0))
    .slice(0, 10);

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center py-10 px-4">
      <h1 className="text-gold-glow text-4xl font-extrabold tracking-widest mb-2">Classement</h1>
      <p className="text-gray-500 text-sm mb-6">Top 10 joueurs</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-casino-card border border-gold/20 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition
              ${activeTab === t.id
                ? 'bg-gold text-black'
                : 'text-gray-400 hover:text-white hover:bg-felt-dark/60'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gold animate-pulse">Chargement…</div>
      ) : (
        <div className="w-full max-w-2xl bg-casino-card border border-gold/20 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold/20 bg-felt-dark/60 text-gray-400 text-xs uppercase tracking-widest">
                <th className="py-3 px-4 text-left">Rang</th>
                <th className="py-3 px-4 text-left">Joueur</th>
                {tab.columns.map(col => (
                  <th key={col.key} className="py-3 px-4 text-right hidden sm:table-cell">
                    {col.label}
                  </th>
                ))}
                {/* Mobile: just the main stat */}
                <th className="py-3 px-4 text-right sm:hidden">
                  {tab.columns[0].label}
                </th>
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
                      {row.username === user?.username && <span className="text-gold/60 text-xs ml-1">(vous)</span>}
                    </span>
                  </td>
                  {tab.columns.map(col => (
                    <td key={col.key} className={`py-3 px-4 text-right hidden sm:table-cell ${col.className ?? ''}`}>
                      {col.format ? col.format(row[col.key]) : (row[col.key] ?? 0)}
                    </td>
                  ))}
                  {/* Mobile: main stat only */}
                  <td className={`py-3 px-4 text-right sm:hidden ${tab.columns[0].className ?? ''}`}>
                    {tab.columns[0].format
                      ? tab.columns[0].format(row[tab.columns[0].key])
                      : (row[tab.columns[0].key] ?? 0)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={tab.columns.length + 2} className="py-8 text-center text-gray-500">
                    Aucun joueur pour l'instant
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
