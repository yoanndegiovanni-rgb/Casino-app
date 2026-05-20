import Card from '../common/Card';

const STATUS_BADGE = {
  folded:     'bg-gray-700 text-gray-400',
  all_in:     'bg-yellow-700 text-yellow-200',
  eliminated: 'bg-red-900 text-red-400',
  active:     'bg-green-700/40 text-green-300',
};

const STATUS_LABEL = {
  folded:     'FOLDED',
  all_in:     'ALL IN',
  eliminated: 'OUT',
};

const ACTION_LABEL = {
  fold:     a => '❌ Fold',
  check:    a => '✋ Check',
  call:     a => `📞 Call ${a.amount}`,
  raise:    a => `📈 Raise ${a.amount}`,
  'all-in': a => '🎰 All In!',
};

function SpeechBubble({ action }) {
  const label = ACTION_LABEL[action.type]?.(action) ?? action.type;
  return (
    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20, whiteSpace: 'nowrap' }}>
      <div className="bg-white text-gray-900 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl relative">
        {label}
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid white',
        }} />
      </div>
    </div>
  );
}

export default function PlayerSeat({ player, isActive, isHuman, visibleHoleCards = 99, className = '' }) {
  const { name, chips, holeCards, currentBet, status, isBot, handResult, lastAction } = player;
  const statusLabel = STATUS_LABEL[status] ?? null;

  const shownCards = isHuman ? Math.min(holeCards?.length ?? 0, visibleHoleCards) : holeCards?.length ?? 0;

  return (
    <div className="relative flex flex-col items-center">
      {lastAction && <SpeechBubble action={lastAction} />}

      <div className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition min-w-[110px]
          ${isActive ? 'border-gold animate-pulse-gold' : 'border-felt-light/30'}
          ${status === 'eliminated' ? 'opacity-40' : ''}
          ${className}`}
      >
        <div className="flex items-center gap-1">
          <span className={`text-xs font-bold truncate max-w-[90px] ${isHuman ? 'text-gold' : 'text-gray-200'}`}>
            {isHuman ? '★ ' : ''}{name}
          </span>
          {isBot && <span className="text-[9px] text-gray-500">BOT</span>}
        </div>

        <span className="text-green-400 text-sm font-bold">{chips?.toLocaleString()} 🪙</span>

        <div className="flex gap-1 min-h-[56px] items-center">
          {holeCards?.length > 0 ? (
            holeCards.slice(0, shownCards).map((c, i) => (
              <Card key={i} rank={c.rank} suit={c.suit} faceDown={c.rank === '?'} animate className="w-10 h-14" />
            ))
          ) : (
            <div className="h-14 flex items-center justify-center text-gray-600 text-xs">—</div>
          )}
        </div>

        {statusLabel && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
            {statusLabel}
          </span>
        )}

        {currentBet > 0 && (
          <span className="text-yellow-400 text-xs">Bet: {currentBet}</span>
        )}

        {handResult && (
          <span className="animate-result-pop text-gold text-[10px] font-semibold bg-casino-bg/80 px-1.5 py-0.5 rounded text-center">
            {handResult.description}
          </span>
        )}
      </div>
    </div>
  );
}
