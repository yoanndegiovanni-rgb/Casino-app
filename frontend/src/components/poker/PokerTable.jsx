import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/sounds';
import Card from '../common/Card';
import PlayerSeat from './PlayerSeat';
import ActionPanel from './ActionPanel';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PHASE_LABELS = {
  waiting:  'Waiting',
  pre_flop: 'Pre-Flop',
  flop:     'Flop',
  turn:     'Turn',
  river:    'River',
  showdown: 'Showdown',
  complete: 'Game Over',
};

// ─── Circular table layout ────────────────────────────────────────────────────

const W = 860;
const H = 500;
const CX = W / 2;
const CY = H / 2;
const SEAT_RX = 350;
const SEAT_RY = 190;

// Bots spread across the upper arc; human is always at 90° (bottom).
const BOT_ANGLES = [
  [],
  [270],
  [225, 315],
  [185, 270, 355],
  [200, 247, 293, 340],
];

function seatPos(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + SEAT_RX * Math.cos(rad),
    y: CY + SEAT_RY * Math.sin(rad),
  };
}

// ─── Table principale ─────────────────────────────────────────────────────────

export default function PokerTable({ game, onGameUpdate, onLeave }) {
  const { user, updateBalance } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [visibleCommunity, setVisibleCommunity] = useState(0);
  const [visibleHole, setVisibleHole]           = useState(0);
  const [dealing, setDealing]                   = useState(false);
  const prevHandRef    = useRef(null);
  const prevCommRef    = useRef(0);
  const animTimers     = useRef([]);
  const dealTimers     = useRef([]);

  const [chipAnim, setChipAnim]     = useState(null);
  const [showResult, setShowResult] = useState(false);

  // ── Détection changement de main / cartes communes ──
  useEffect(() => {
    if (!game) return;

    const clearAnimTimers = () => { animTimers.current.forEach(clearTimeout); animTimers.current = []; };

    if (game.handNumber !== prevHandRef.current) {
      prevHandRef.current = game.handNumber;
      clearAnimTimers();
      dealTimers.current.forEach(clearTimeout);
      dealTimers.current = [];

      const existingComm = game.communityCards?.length ?? 0;
      prevCommRef.current = existingComm;
      setVisibleCommunity(existingComm);

      setVisibleHole(0);
      setChipAnim(null);
      setShowResult(false);
      setDealing(true);

      const t1 = setTimeout(() => { setVisibleHole(1); sounds.deal(); }, 350);
      const t2 = setTimeout(() => { setVisibleHole(99); sounds.deal(); setDealing(false); }, 750);
      dealTimers.current = [t1, t2];

      return clearAnimTimers;
    }

    const commCount = game.communityCards?.length ?? 0;
    if (commCount > prevCommRef.current) {
      const added = commCount - prevCommRef.current;
      const base  = prevCommRef.current;
      prevCommRef.current = commCount;
      clearAnimTimers();
      setDealing(true);

      const timers = Array.from({ length: added }).map((_, i) => (
        setTimeout(() => {
          setVisibleCommunity(base + i + 1);
          sounds.deal();
          if (i === added - 1) setDealing(false);
        }, 380 * (i + 1))
      ));
      animTimers.current = timers;
      return clearAnimTimers;
    }

    if (game.phase === 'showdown' && !chipAnim) {
      const human    = game.players?.find(p => !p.isBot);
      const isWinner = game.lastHandResult?.some(r => r.playerId === human?.id && r.amount > 0);
      setChipAnim(isWinner ? 'win' : 'lose');
      setTimeout(() => setShowResult(true), 500);
    }
  }, [game]); // eslint-disable-line

  useEffect(() => () => { dealTimers.current.forEach(clearTimeout); }, []);

  // ── Joueur humain ──
  const human     = game?.players?.find(p => !p.isBot);
  const curPlayer = game?.players?.[game.currentPlayerIndex];
  const isMyTurn  = !!(curPlayer && !curPlayer.isBot && human?.status === 'active');

  // ── Actions ──
  async function doAction(action, amount) {
    setError(''); setLoading(true);
    try {
      const { game: g } = await api.poker.action(action, amount);
      onGameUpdate(g);
      if (g.phase === 'showdown') {
        const win = g.lastHandResult?.some(r => r.playerId === human?.id && r.amount > 0);
        win ? sounds.win() : sounds.lose();
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function nextHand() {
    setError(''); setLoading(true);
    try {
      const { game: g } = await api.poker.nextHand();
      onGameUpdate(g);
      sounds.deal();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleLeave() {
    setLoading(true);
    try {
      const { balance } = await api.poker.leave();
      updateBalance(balance);
      onLeave();
    } catch (e) { setError(e.message); setLoading(false); }
  }

  if (!game) return null;

  const community  = game.communityCards ?? [];
  const bots       = game.players.filter(p => p.isBot);
  const phase      = game.phase;
  const isShowdown = phase === 'showdown';
  const botAngles  = BOT_ANGLES[Math.min(bots.length, 4)] ?? [];
  const humanPos   = seatPos(90);

  return (
    <div className="felt-bg min-h-[calc(100vh-64px)] flex flex-col items-center py-4 px-2 gap-3 overflow-x-auto">

      {/* En-tête */}
      <div className="flex items-center gap-4 flex-wrap justify-center shrink-0">
        <h2 className="text-gold-glow text-2xl font-extrabold tracking-widest">TEXAS HOLD'EM</h2>
        <span className="bg-felt-dark border border-gold/30 px-3 py-1 rounded-full text-gold text-sm font-bold">
          {PHASE_LABELS[phase] ?? phase}
        </span>
        <span className="text-gray-500 text-sm">Hand #{game.handNumber}</span>
        <button onClick={handleLeave} disabled={loading}
          className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 px-3 py-1 rounded-lg transition">
          Leave Table
        </button>
      </div>

      {error && (
        <div className="bg-red-900/70 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm shrink-0">
          {error}
        </div>
      )}

      {/* ── Table circulaire ── */}
      <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>

        {/* Fond bois (outer ring) */}
        <div style={{
          position: 'absolute',
          left: CX - 315, top: CY - 180,
          width: 630, height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #8b5e3c 0%, #5c3a1e 60%, #3d2510 100%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        }} />

        {/* Tapis vert (inner felt) */}
        <div style={{
          position: 'absolute',
          left: CX - 295, top: CY - 162,
          width: 590, height: 324,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #1e6b3a 0%, #0d3a1e 100%)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
        }} />

        {/* Liseré gold */}
        <div style={{
          position: 'absolute',
          left: CX - 287, top: CY - 154,
          width: 574, height: 308,
          borderRadius: '50%',
          border: '2px solid rgba(212,175,55,0.3)',
          pointerEvents: 'none',
        }} />

        {/* Cartes communes + pot (centre) */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
        }} className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5 items-center">
            {community.slice(0, visibleCommunity).map((c, i) => (
              <Card key={`comm-${i}`} rank={c.rank} suit={c.suit} animate />
            ))}
            {Array.from({ length: Math.max(0, 5 - visibleCommunity) }).map((_, i) => (
              <div key={`ph-${i}`} className="w-10 h-14 border border-dashed border-white/10 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-4 items-center flex-wrap justify-center">
            <span className="text-gold font-bold text-sm">Pot: {game.pot?.toLocaleString()} 🪙</span>
            {(game.sidePots?.length ?? 0) > 1 && (
              <span className="text-yellow-500 text-xs">({game.sidePots.length} side pots)</span>
            )}
            {game.currentBet > 0 && (
              <span className="text-gray-300 text-xs">Bet: {game.currentBet}</span>
            )}
          </div>
          {dealing && phase !== 'showdown' && (
            <p className="text-gray-400 text-[10px] animate-pulse tracking-widest">Dealing…</p>
          )}
        </div>

        {/* Bots autour de la table */}
        {bots.map((bot, i) => {
          const pos = seatPos(botAngles[i] ?? 270);
          return (
            <div key={bot.id} style={{
              position: 'absolute',
              left: pos.x, top: pos.y,
              transform: 'translate(-50%, -50%)',
            }}>
              <PlayerSeat
                player={bot}
                isActive={game.players[game.currentPlayerIndex]?.id === bot.id}
                isHuman={false}
              />
            </div>
          );
        })}

        {/* Joueur humain en bas */}
        {human && (
          <div style={{
            position: 'absolute',
            left: humanPos.x, top: humanPos.y,
            transform: 'translate(-50%, -50%)',
          }}>
            <PlayerSeat
              player={human}
              isActive={isMyTurn}
              isHuman={true}
              className="border-gold/60"
            />
          </div>
        )}
      </div>

      {/* Résultat showdown */}
      {isShowdown && showResult && game.lastHandResult && (
        <div className="animate-result-pop bg-casino-card border border-gold/40 rounded-2xl p-4 text-center max-w-lg w-full shrink-0">
          <h3 className="text-gold font-extrabold text-lg mb-3">Hand Result</h3>
          {game.lastHandResult.map((r, i) => {
            const isMe = r.playerId === human?.id;
            return (
              <div key={i} className={`text-sm py-1.5 flex justify-between px-2 rounded-lg mb-1
                ${isMe ? 'bg-green-900/40 text-green-300 font-bold' : 'text-gray-400'}`}>
                <span>{r.playerName}</span>
                <span>{r.description ?? r.hand}</span>
                <span className={r.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                  {r.amount > 0 ? `+${r.amount} 🪙` : 'lost'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Journal des actions */}
      {(game.actionLog?.length ?? 0) > 0 && (
        <div className="w-full max-w-md bg-casino-bg/80 border border-gray-800 rounded-xl p-3 shrink-0">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Action Log</p>
          <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto">
            {[...game.actionLog].reverse().map((entry, i) => (
              <p key={i} className="text-gray-400 text-xs">{entry}</p>
            ))}
          </div>
        </div>
      )}

      {/* Boutons de contrôle */}
      <div className="w-full max-w-md shrink-0">
        {isShowdown ? (
          game.players.filter(p => p.status !== 'eliminated').length >= 2 ? (
            <div className="flex justify-center">
              <button onClick={nextHand} disabled={loading}
                className="btn-gold px-10 py-3 rounded-xl text-lg font-extrabold shadow-lg hover:scale-105 active:scale-95 transition">
                Next Hand →
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gold-glow text-xl font-extrabold mb-3">Game Over!</p>
              <button onClick={handleLeave} className="btn-gold px-8 py-2 rounded-xl font-bold">
                Cash Out & Leave
              </button>
            </div>
          )
        ) : phase === 'complete' ? (
          <div className="text-center">
            <button onClick={handleLeave} className="btn-gold px-8 py-2 rounded-xl font-bold">
              Leave Table
            </button>
          </div>
        ) : (
          <ActionPanel game={game} onAction={doAction} disabled={loading || !isMyTurn} />
        )}
      </div>

    </div>
  );
}
