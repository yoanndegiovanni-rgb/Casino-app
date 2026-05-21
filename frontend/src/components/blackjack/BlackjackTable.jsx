import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/sounds';
import Card from '../common/Card';
import BetControls from './BetControls';
import ChipStack from '../common/ChipStack';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.faceDown) continue;
    if (c.rank === 'A') { aces++; total += 11; }
    else if (['J','Q','K'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank, 10) || 0;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function rankVal(r) {
  if (['J','Q','K'].includes(r)) return 10;
  return parseInt(r, 10) || 0;
}

const OUTCOME_STYLE = {
  win:       'text-green-300 bg-green-900/80 border-green-500',
  blackjack: 'text-yellow-200 bg-yellow-900/80 border-yellow-400',
  bust:      'text-red-300   bg-red-900/80   border-red-500',
  lose:      'text-red-300   bg-red-900/80   border-red-500',
  push:      'text-blue-300  bg-blue-900/80  border-blue-500',
  surrender: 'text-gray-400  bg-gray-800/80  border-gray-600',
};

const OUTCOME_LABEL = {
  win: '✓ WIN', blackjack: '★ BLACKJACK!', bust: '✗ CRAMÉ',
  lose: '✗ LOSE', push: '= PUSH', surrender: '½ SURRENDER',
};

// ─── Main component ──────────────────────────────────────────────────────────

// Deal animation order: playerCard[0], dealerCard[0], playerCard[1], dealerCard[1]
const DEAL_DELAYS = [280, 560, 840, 1120]; // ms

export default function BlackjackTable() {
  const { user, updateBalance } = useAuth();
  const [game, setGame]         = useState(null);
  const [balance, setBalance]   = useState(user?.balance ?? 0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Deal animation state
  const [shownPlayer, setShownPlayer] = useState(99);
  const [shownDealer, setShownDealer] = useState(99);
  const [dealing, setDealing]         = useState(false);
  const gameIdRef = useRef(null);
  const timersRef = useRef([]);

  // Chip / result animation
  const [chipAnim, setChipAnim]     = useState(null); // 'win' | 'lose' | null
  const [showResult, setShowResult] = useState(false);

  // Last bets (to replay with "Same Bet")
  const [lastBets, setLastBets] = useState(null);

  // ── Load existing game on mount ──
  const refreshState = useCallback(async () => {
    try {
      const { game: g, balance: b } = await api.blackjack.state();
      if (g) { setGame(g); gameIdRef.current = g.id; }
      setBalance(b); updateBalance(b);
    } catch { /* no-op */ }
  }, [updateBalance]);

  useEffect(() => { refreshState(); }, [refreshState]);

  // ── Trigger deal animation when a new hand starts ──
  useEffect(() => {
    if (!game || game.id === gameIdRef.current) return;
    gameIdRef.current = game.id;

    if (game.status !== 'playing') return;

    // Clear any running timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setShownPlayer(0);
    setShownDealer(0);
    setDealing(true);
    setChipAnim(null);
    setShowResult(false);

    // Reveal: P1 → D1 → P2 → D2
    const t1 = setTimeout(() => { setShownPlayer(1); sounds.deal(); }, DEAL_DELAYS[0]);
    const t2 = setTimeout(() => { setShownDealer(1); sounds.deal(); }, DEAL_DELAYS[1]);
    const t3 = setTimeout(() => { setShownPlayer(2); sounds.deal(); }, DEAL_DELAYS[2]);
    const t4 = setTimeout(() => { setShownDealer(2); sounds.deal(); setDealing(false); }, DEAL_DELAYS[3]);

    timersRef.current = [t1, t2, t3, t4];
    return () => timersRef.current.forEach(clearTimeout);
  }, [game?.id]); // eslint-disable-line

  // ── Action handler ──
  async function doAction(fn) {
    setError('');
    setLoading(true);
    try {
      const { game: g } = await fn();
      setGame(g);

      if (g.status === 'complete') {
        // Show all cards (dealer reveal)
        setShownPlayer(99);
        setShownDealer(99);

        const results  = g.result?.handResults ?? [];
        const outcomes = results.map(r => r.outcome);
        const isWin    = outcomes.some(o => ['win','blackjack'].includes(o));
        const isPush   = outcomes.every(o => o === 'push');

        // Sound
        if (isWin)       sounds.win();
        else if (isPush) sounds.push();
        else             sounds.lose();

        // Chip animation + result banner
        setChipAnim(isWin ? 'win' : isPush ? null : 'lose');
        setTimeout(() => setShowResult(true), 400);

        updateBalance(g.balance);
        setBalance(g.balance);
      } else if (g.id === gameIdRef.current) {
        // Same game — hit/double/split — animate new card only
        setShownPlayer(prev => Math.max(prev, (g.hands?.[g.currentHandIndex]?.cards?.length ?? 0)));
        setShownDealer(prev => Math.max(prev, g.dealerCards?.length ?? 0));
        sounds.deal();
      }
      // New game: useEffect on game?.id handles the deal animation
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function newRound() {
    setError('');
    setLoading(true);
    setChipAnim(null);
    setShowResult(false);
    timersRef.current.forEach(clearTimeout);
    try {
      const { balance: b } = await api.blackjack.newGame();
      setGame(null);
      setBalance(b);
      updateBalance(b);
      gameIdRef.current = null;
      setShownPlayer(99);
      setShownDealer(99);
    } finally {
      setLoading(false);
    }
  }

  async function handleBet(bets) {
    setLastBets(bets);
    await doAction(() => api.blackjack.bet(bets));
  }

  async function replayBet() {
    if (!lastBets) return;
    const totalBet = lastBets.reduce((s, b) => s + b, 0);
    if (totalBet > balance) { setError('Insufficient balance for same bet'); return; }
    setChipAnim(null);
    setShowResult(false);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    gameIdRef.current = null; // force l'animation de distribution à se déclencher
    await doAction(() => api.blackjack.bet(lastBets));
  }

  // ── Derived state ──
  const playing  = game?.status === 'playing';
  const complete = game?.status === 'complete';
  const hand     = game?.hands?.[game.currentHandIndex];

  const canSplit = playing && hand?.cards?.length === 2 &&
    rankVal(hand.cards[0]?.rank) === rankVal(hand.cards[1]?.rank) &&
    (hand.splitCount ?? 0) < 3 && balance >= (hand?.bet ?? 0);
  const canDouble    = playing && hand?.cards?.length === 2 && balance >= (hand?.bet ?? 0);
  const canSurrender = playing && hand?.cards?.length === 2 && !hand?.fromSplit;

  const totalBet = game?.hands?.reduce((s, h) => s + h.bet, 0) ?? 0;

  return (
    <div className="felt-bg min-h-[calc(100vh-64px)] flex flex-col items-center justify-start py-8 px-4 gap-6"
      style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ── Décor latéral fondu ── */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>

        {/* Symboles de couleurs — gauche */}
        <span style={{ position:'absolute', left:'-2%',  top:'8%',  fontSize:220, opacity:0.09, color:'#fff', lineHeight:1, userSelect:'none', transform:'rotate(-12deg)' }}>♠</span>
        <span style={{ position:'absolute', left:'3%',   top:'52%', fontSize:160, opacity:0.07, color:'#d4af37', lineHeight:1, userSelect:'none', transform:'rotate(8deg)' }}>♣</span>
        <span style={{ position:'absolute', left:'-1%',  top:'78%', fontSize:100, opacity:0.06, color:'#fff', lineHeight:1, userSelect:'none', transform:'rotate(-5deg)' }}>♠</span>

        {/* Symboles de couleurs — droite */}
        <span style={{ position:'absolute', right:'-2%', top:'6%',  fontSize:200, opacity:0.09, color:'#c0392b', lineHeight:1, userSelect:'none', transform:'rotate(10deg)' }}>♥</span>
        <span style={{ position:'absolute', right:'2%',  top:'48%', fontSize:170, opacity:0.07, color:'#c0392b', lineHeight:1, userSelect:'none', transform:'rotate(-8deg)' }}>♦</span>
        <span style={{ position:'absolute', right:'-1%', top:'76%', fontSize:110, opacity:0.06, color:'#d4af37', lineHeight:1, userSelect:'none', transform:'rotate(6deg)' }}>♣</span>

        {/* Lignes ornementales dorées — gauche */}
        <svg style={{ position:'absolute', left:0, top:0, width:'18%', height:'100%', opacity:0.18 }} viewBox="0 0 120 800" preserveAspectRatio="none">
          <line x1="110" y1="0" x2="110" y2="800" stroke="#d4af37" strokeWidth="0.8"/>
          <line x1="105" y1="0" x2="105" y2="800" stroke="#d4af37" strokeWidth="0.3"/>
          {[80,200,320,440,560,680].map(y => (
            <g key={y}>
              <circle cx="110" cy={y} r="5" fill="none" stroke="#d4af37" strokeWidth="0.8"/>
              <line x1="85" y1={y} x2="128" y2={y} stroke="#d4af37" strokeWidth="0.4"/>
            </g>
          ))}
        </svg>

        {/* Lignes ornementales dorées — droite */}
        <svg style={{ position:'absolute', right:0, top:0, width:'18%', height:'100%', opacity:0.18 }} viewBox="0 0 120 800" preserveAspectRatio="none">
          <line x1="10" y1="0" x2="10" y2="800" stroke="#d4af37" strokeWidth="0.8"/>
          <line x1="15" y1="0" x2="15" y2="800" stroke="#d4af37" strokeWidth="0.3"/>
          {[80,200,320,440,560,680].map(y => (
            <g key={y}>
              <circle cx="10" cy={y} r="5" fill="none" stroke="#d4af37" strokeWidth="0.8"/>
              <line x1="-8" y1={y} x2="35" y2={y} stroke="#d4af37" strokeWidth="0.4"/>
            </g>
          ))}
        </svg>

        {/* Losanges dorés dans les coins */}
        {[['-14px','-14px'],['auto','-14px'],['-14px','auto'],['auto','auto']].map(([t,b,l,r],i) => (
          <svg key={i} style={{ position:'absolute', top: i<2?'-14px':'auto', bottom:i>=2?'-14px':'auto', left:i%2===0?'-14px':'auto', right:i%2===1?'-14px':'auto', width:90, height:90, opacity:0.18 }} viewBox="0 0 80 80">
            <rect x="15" y="15" width="50" height="50" fill="none" stroke="#d4af37" strokeWidth="1.2" transform="rotate(45 40 40)"/>
            <rect x="22" y="22" width="36" height="36" fill="none" stroke="#d4af37" strokeWidth="0.6" transform="rotate(45 40 40)"/>
          </svg>
        ))}
      </div>
      {/* Header */}
      <div className="text-center" style={{ position:'relative', zIndex:1 }}>
        <h2 className="text-gold-glow text-3xl font-extrabold tracking-widest">BLACKJACK</h2>
        <p className="text-gray-400 text-sm mt-1">Le croupier s'arrête sur tous les 17 · Blackjack paie 3:2</p>
      </div>

      {error && (
        <div className="bg-red-900/70 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm" style={{ position:'relative', zIndex:1 }}>
          {error}
        </div>
      )}

      {game ? (
        <div className="relative flex flex-col items-center gap-6 w-full max-w-2xl" style={{ zIndex:1 }}>
          {/* ── Dealer area ── */}
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-3 uppercase tracking-widest font-semibold">
              Dealer {complete ? `— ${game.result?.dealerValue ?? ''}` : ''}
            </p>
            <div className="flex gap-2 justify-center flex-wrap min-h-[96px] items-center">
              {(game.dealerCards ?? []).slice(0, shownDealer).map((card, i) => (
                <Card
                  key={`d${i}`}
                  rank={card.rank}
                  suit={card.suit}
                  faceDown={card.faceDown}
                  animate
                />
              ))}
            </div>
          </div>

          {/* Pot */}
          <div className="flex items-center gap-3">
            <ChipStack amount={totalBet} size="sm" />
            <span className="text-gold text-sm font-bold">Bet: {totalBet} chips</span>
          </div>

          {/* ── Player hands – arc layout ── */}
          <div className="flex items-end justify-center gap-8 w-full overflow-x-auto pb-4 px-2">
            {game.hands?.map((h, hIdx) => {
              const isActive = playing && hIdx === game.currentHandIndex;
              const result   = complete ? game.result?.handResults?.[hIdx] : null;
              const hv       = handValue(h.cards);
              const visCards = h.cards.slice(0, shownPlayer);
              const multi    = game.hands.length > 1;

              // Arc toward dealer: outer spots rise UP and rotate inward
              const center = (game.hands.length - 1) / 2;
              const offset = hIdx - center;
              const rot    = -offset * 5;           // left tilts right, right tilts left
              const ty     = -Math.abs(offset) * 14; // outer hands go UP toward dealer

              return (
                <div
                  key={hIdx}
                  style={{
                    transform: `rotate(${rot}deg) translateY(${ty}px)`,
                    transformOrigin: 'bottom center',
                    flexShrink: 0,
                    width: multi ? '160px' : '220px',
                  }}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition
                    ${isActive ? 'border-gold animate-pulse-gold' : 'border-felt-light/40'}`}
                >
                  <p className="text-gray-400 text-[10px] uppercase tracking-wide">
                    {multi ? `Hand ${hIdx + 1}` : 'Your Hand'}
                    {h.doubled && ' · Doubled'}
                    {h.fromSplit && ' · Split'}
                  </p>
                  <div className="flex gap-1 flex-wrap justify-center min-h-[64px] items-center">
                    {visCards.map((c, i) => (
                      <Card key={`p${hIdx}-${i}`} rank={c.rank} suit={c.suit} animate size={multi ? 'sm' : 'md'} />
                    ))}
                  </div>
                  <p className="text-white font-bold text-base">{visCards.length > 0 && hv > 0 ? hv : ''}</p>
                  <p className="text-gold text-[10px]">Bet: {h.bet}</p>
                  {result && complete && showResult && (
                    <div className={`animate-result-pop px-2 py-0.5 rounded-full text-[10px] font-bold border ${OUTCOME_STYLE[result.outcome] || ''}`}>
                      {OUTCOME_LABEL[result.outcome]}{result.payout > 0 ? ` +${result.payout}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Action buttons ── */}
          {playing && !dealing && (
            <div className="flex flex-wrap gap-2 justify-center animate-fade-in">
              <ActionBtn onClick={() => doAction(() => api.blackjack.hit())}       disabled={loading} label="HIT"        color="bg-blue-700 hover:bg-blue-600" />
              <ActionBtn onClick={() => doAction(() => api.blackjack.stand())}     disabled={loading} label="STAND"      color="bg-gray-600 hover:bg-gray-500" />
              {canDouble    && <ActionBtn onClick={() => doAction(() => api.blackjack.double())}    disabled={loading} label="DOUBLE DOWN" color="bg-purple-700 hover:bg-purple-600" />}
              {canSplit     && <ActionBtn onClick={() => doAction(() => api.blackjack.split())}     disabled={loading} label="SPLIT"       color="bg-indigo-700 hover:bg-indigo-600" />}
              {canSurrender && <ActionBtn onClick={() => doAction(() => api.blackjack.surrender())} disabled={loading} label="SURRENDER"   color="bg-red-800 hover:bg-red-700" />}
            </div>
          )}

          {dealing && (
            <p className="text-gray-500 text-sm animate-pulse tracking-widest">Dealing...</p>
          )}

          {/* ── New hand / Same bet buttons ── */}
          {complete && (
            <div className="flex flex-col items-center gap-3 animate-fade-in mt-2">
              <p className="text-gold font-bold text-xl">
                Balance: {game.balance?.toLocaleString()} chips
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={newRound}
                  disabled={loading}
                  className="btn-gold px-8 py-3 rounded-xl text-lg font-extrabold shadow-lg hover:scale-105 active:scale-95 transition"
                >
                  NEW HAND
                </button>
                {lastBets && lastBets.reduce((s,b) => s+b, 0) <= balance && (
                  <button
                    onClick={replayBet}
                    disabled={loading}
                    className="bg-felt-light border-2 border-gold/60 hover:border-gold text-gold px-8 py-3 rounded-xl text-lg font-extrabold shadow-lg hover:scale-105 active:scale-95 transition"
                  >
                    SAME BET
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ position:'relative', zIndex:1 }}>
          <BetControls balance={balance} onBet={handleBet} disabled={loading} />
        </div>
      )}

      {/* Balance strip */}
      <div className="fixed bottom-4 right-4 bg-casino-card border border-gold/30 rounded-xl px-4 py-2 shadow-xl">
        <span className="text-gold text-sm font-bold">💰 {balance?.toLocaleString()} chips</span>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, label, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} px-5 py-2.5 rounded-lg font-extrabold text-sm tracking-wide
        shadow-md disabled:opacity-40 disabled:cursor-not-allowed
        transition active:scale-95`}
    >
      {label}
    </button>
  );
}
