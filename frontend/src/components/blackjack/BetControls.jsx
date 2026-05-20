import { useState } from 'react';
import { ChipButton } from '../common/ChipStack';
import { sounds } from '../../utils/sounds';

const CHIP_VALUES = [10, 25, 50, 100, 500];
const MIN_BET = 10;
const MAX_BET = 500;

function SpotBet({ index, bet, active, onToggle, onChange, balance, disabled }) {
  function addChip(val) {
    if (!active) return;
    sounds.chip();
    onChange(Math.min(bet + val, Math.min(MAX_BET, balance)));
  }

  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition min-w-[130px]
      ${active ? 'border-gold/60 bg-casino-card/60' : 'border-gray-700/40 bg-casino-bg/30 opacity-50'}`}>

      <button
        onClick={onToggle}
        disabled={disabled}
        className={`text-xs font-bold px-3 py-1 rounded-full transition
          ${active ? 'bg-gold text-black' : 'bg-gray-700 text-gray-300'}`}
      >
        Spot {index + 1} {active ? '✓' : '+'}
      </button>

      <div className="text-center">
        <p className="text-gold-glow text-2xl font-extrabold">{active ? bet : '—'}</p>
        <p className="text-gray-500 text-[10px]">chips</p>
      </div>

      {active && (
        <>
          <div className="flex gap-1 flex-wrap justify-center">
            {CHIP_VALUES.map(v => (
              <ChipButton
                key={v}
                value={v}
                size="sm"
                onClick={() => addChip(v)}
                disabled={disabled || bet + v > MAX_BET || v > balance}
              />
            ))}
          </div>

          <input
            type="range"
            min={MIN_BET}
            max={Math.min(MAX_BET, balance)}
            step={10}
            value={bet}
            onChange={e => { sounds.chip(); onChange(Number(e.target.value)); }}
            disabled={disabled}
            className="w-full accent-yellow-500"
          />

          <button
            onClick={() => onChange(MIN_BET)}
            disabled={disabled}
            className="text-xs text-gray-400 hover:text-gray-200 transition"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

export default function BetControls({ balance, onBet, disabled }) {
  const [bets,   setBets]   = useState([10, 0, 0]);
  const [active, setActive] = useState([true, false, false]);

  function toggleSpot(i) {
    setActive(prev => {
      const next = [...prev];
      next[i] = !next[i];
      if (!next[i]) setBets(b => { const n = [...b]; n[i] = 10; return n; });
      return next;
    });
  }

  function setSpotBet(i, val) {
    setBets(prev => { const n = [...prev]; n[i] = val; return n; });
  }

  const finalBets = bets.map((b, i) => active[i] ? b : 0);
  const total     = finalBets.reduce((s, b) => s + b, 0);
  const canDeal   = total > 0 && total <= balance;

  async function deal() {
    if (!canDeal) return;
    sounds.chip();
    await onBet(finalBets);
  }

  return (
    <div className="flex flex-col items-center gap-5 animate-fade-in w-full max-w-3xl">
      <h3 className="text-gold text-lg font-bold tracking-wide">Place Your Bets</h3>

      {/* 3 spots side by side */}
      <div className="flex gap-3 flex-wrap justify-center">
        {[0, 1, 2].map(i => (
          <SpotBet
            key={i}
            index={i}
            bet={bets[i]}
            active={active[i]}
            onToggle={() => toggleSpot(i)}
            onChange={val => setSpotBet(i, val)}
            balance={balance}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Total + deal */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-400 text-sm">
          Total bet: <span className="text-gold font-bold">{total}</span> chips
        </p>
        <button
          onClick={deal}
          disabled={disabled || !canDeal}
          className="btn-gold px-10 py-3 rounded-xl text-xl font-extrabold shadow-lg
            hover:scale-105 active:scale-95 transition
            disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
        >
          DEAL
        </button>
      </div>

      <p className="text-gray-500 text-sm">Balance: {balance?.toLocaleString()} chips</p>
    </div>
  );
}
