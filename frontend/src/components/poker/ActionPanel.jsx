import { useState } from 'react';
import { sounds } from '../../utils/sounds';

const BIG_BLIND = 20;

export default function ActionPanel({ game, onAction, disabled }) {
  const [raiseAmt, setRaiseAmt] = useState(BIG_BLIND);

  if (!game) return null;

  const human = game.players?.find(p => !p.isBot);
  if (!human || human.status !== 'active') return null;

  const cur      = game.players[game.currentPlayerIndex];
  const isMyTurn = cur && !cur.isBot;

  if (!isMyTurn) {
    return (
      <div className="text-gray-500 text-sm text-center py-3 animate-pulse tracking-widest">
        ⏳ Waiting for opponents...
      </div>
    );
  }

  const toCall   = (game.currentBet ?? 0) - (human.currentBet ?? 0);
  const canCheck = toCall === 0;
  const minRaise = Math.max(BIG_BLIND, game.lastRaise ?? BIG_BLIND);
  const maxRaise = human.chips;

  async function act(action, amount) {
    sounds.chip();
    await onAction(action, amount);
  }

  return (
    <div className="animate-fade-in bg-casino-card/90 border border-gold/30 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
      <h3 className="text-gold text-center font-bold text-sm uppercase tracking-widest">
        Your Turn
      </h3>

      <div className="flex flex-wrap gap-2 justify-center">
        <ActionBtn label="Fold" color="bg-red-800 hover:bg-red-700"
          onClick={() => act('fold')} disabled={disabled} />

        {canCheck ? (
          <ActionBtn label="Check" color="bg-gray-700 hover:bg-gray-600"
            onClick={() => act('check')} disabled={disabled} />
        ) : (
          <ActionBtn label={`Call ${toCall}`} color="bg-blue-700 hover:bg-blue-600"
            onClick={() => act('call')} disabled={disabled || human.chips === 0} />
        )}

        <ActionBtn label="All In" color="bg-yellow-700 hover:bg-yellow-600"
          onClick={() => act('all-in')} disabled={disabled || human.chips === 0} />
      </div>

      {/* Raise */}
      {human.chips > toCall + minRaise && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-xs">Raise by:</span>
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              step={BIG_BLIND}
              value={raiseAmt}
              onChange={e => setRaiseAmt(Math.max(minRaise, Math.min(maxRaise, Number(e.target.value))))}
              className="w-20 bg-casino-bg border border-gray-600 rounded px-2 py-1 text-sm text-white text-center"
            />
            <ActionBtn label={`Raise +${raiseAmt}`} color="bg-purple-700 hover:bg-purple-600"
              onClick={() => act('raise', raiseAmt)} disabled={disabled} />
          </div>
          <input
            type="range"
            min={minRaise}
            max={Math.max(minRaise, maxRaise - toCall)}
            step={BIG_BLIND}
            value={raiseAmt}
            onChange={e => setRaiseAmt(Number(e.target.value))}
            className="w-full accent-purple-500"
          />
        </div>
      )}

      <div className="flex justify-between text-xs text-gray-500 px-1">
        <span>Stack: {human.chips?.toLocaleString()}</span>
        <span>Pot: {game.pot?.toLocaleString()}</span>
        {toCall > 0 && <span className="text-yellow-400">To call: {toCall}</span>}
      </div>
    </div>
  );
}

function ActionBtn({ label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${color} px-4 py-2 rounded-lg font-bold text-sm
        disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 shadow-md`}>
      {label}
    </button>
  );
}
