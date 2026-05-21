import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useState, useEffect } from 'react';
import { CasinoChipSVG, CHIP_DENOMS } from '../components/common/ChipStack';

// ─── Chip rain ────────────────────────────────────────────────────────────────

// Generated once at module load — mix all denominations for variety
const CHIPS = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  left:     (Math.random() * 96 + 2).toFixed(1),
  size:     Math.floor(Math.random() * 22 + 22),   // 22–44 px
  duration: (Math.random() * 9 + 7).toFixed(1),    // 7–16 s
  delay:    -(Math.random() * 14).toFixed(1),       // already in progress
  denomIdx: Math.floor(Math.random() * CHIP_DENOMS.length),
}));

function FallingChip({ left, size, duration, delay, denomIdx }) {
  const d = CHIP_DENOMS[denomIdx % CHIP_DENOMS.length];
  return (
    <div style={{
      position: 'absolute',
      left: `${left}%`,
      top: -size - 10,
      animation: `chipFall ${duration}s ${delay}s linear infinite`,
      willChange: 'transform, opacity',
      opacity: 0,
    }}>
      <CasinoChipSVG label={d.label} color={d.color} text={d.text} size={size} shadow={false} />
    </div>
  );
}

function ChipRain() {
  return (
    <>
      <style>{`
        @keyframes chipFall {
          0%   { transform: translateY(0)      rotate(0deg);   opacity: 0;    }
          6%   { opacity: 0.70; }
          90%  { opacity: 0.50; }
          100% { transform: translateY(110vh)  rotate(600deg); opacity: 0;    }
        }
      `}</style>
      <div style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        {CHIPS.map(c => <FallingChip key={c.id} {...c} />)}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, updateBalance, fetchMe } = useAuth();
  const [bonusMsg, setBonusMsg] = useState('');
  const [bonusErr, setBonusErr] = useState('');

  // Refresh balance from server each time the user comes back to home
  useEffect(() => { fetchMe(); }, []); // eslint-disable-line

  async function claimBonus() {
    setBonusMsg(''); setBonusErr('');
    try {
      const { balance, message } = await api.auth.dailyBonus();
      updateBalance(balance);
      setBonusMsg(message);
    } catch (e) {
      setBonusErr(e.message);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden flex flex-col items-center justify-center py-16 px-4 gap-10">

      <ChipRain />

      {/* Content above the chips */}
      <div className="relative z-10 flex flex-col items-center gap-10 w-full">

        {/* Hero */}
        <div className="text-center">
          <h1 className="text-gold-glow text-6xl font-extrabold tracking-widest mb-3">
            ♠ ROYAL CASINO ♦
          </h1>
          <p className="text-gray-400 text-xl max-w-md mx-auto">
            Jouez au Blackjack, au Texas Hold'em et à la Roulette. Aucun téléchargement, aucun dépôt — que des jetons.
          </p>
        </div>

        {/* Games */}
        <div className="flex gap-6 flex-wrap justify-center">
          <GameCard
            title="Blackjack"
            emoji="🃏"
            desc="Hit, Stand, Double, Split. Beat the dealer without busting."
            to="/blackjack"
            color="from-green-900 to-felt-dark"
          />
          <GameCard
            title="Texas Hold'em"
            emoji="♠♥♦♣"
            desc="Full 6-player table with AI bots. Three difficulty levels."
            to="/poker"
            color="from-indigo-900 to-casino-card"
          />
          <GameCard
            title="Roulette"
            emoji="🎡"
            desc="European roulette, single zero. Straight, dozens, colours and more."
            to="/roulette"
            color="from-red-900 to-casino-card"
          />
        </div>

        {/* Balance + daily bonus */}
        {user && (
          <div className="bg-casino-card border border-gold/30 rounded-2xl p-6 text-center shadow-xl max-w-sm w-full">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Your Balance</p>
            <p className="text-gold-glow text-5xl font-extrabold my-2">{user.balance?.toLocaleString()}</p>
            <p className="text-gray-500 text-sm mb-4">chips</p>

            {user.balance < 100 && (
              <>
                {bonusMsg && <p className="text-green-400 text-sm mb-2">{bonusMsg}</p>}
                {bonusErr && <p className="text-red-400 text-sm mb-2">{bonusErr}</p>}
                <button
                  onClick={claimBonus}
                  className="btn-gold px-6 py-2 rounded-xl font-bold text-sm"
                >
                  🎁 Claim Daily Bonus (+100)
                </button>
              </>
            )}
          </div>
        )}

        {!user && (
          <div className="flex gap-4">
            <Link to="/login" className="btn-gold px-8 py-3 rounded-xl font-extrabold text-lg">
              Login
            </Link>
            <Link to="/register" className="bg-felt hover:bg-felt-light border border-gold/40 text-gold px-8 py-3 rounded-xl font-extrabold text-lg transition">
              Register
            </Link>
          </div>
        )}

        {/* Leaderboard link */}
        <Link to="/leaderboard" className="text-gray-400 hover:text-gold transition text-sm underline underline-offset-4">
          View Leaderboard →
        </Link>

      </div>
    </div>
  );
}

function GameCard({ title, emoji, desc, to, color }) {
  return (
    <Link
      to={to}
      className={`bg-gradient-to-br ${color} border border-gold/20 rounded-2xl p-6 w-64
        hover:border-gold/60 hover:scale-105 transition shadow-xl text-center`}
    >
      <div className="text-4xl mb-3">{emoji}</div>
      <h2 className="text-gold font-extrabold text-xl mb-2">{title}</h2>
      <p className="text-gray-400 text-sm">{desc}</p>
      <div className="mt-4 btn-gold inline-block px-6 py-2 rounded-full text-sm font-bold">
        Play Now →
      </div>
    </Link>
  );
}
