import { useEffect, useState } from 'react';
import { sounds } from '../../utils/sounds';

const SUIT_SYMBOL = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED_SUITS   = new Set(['hearts', 'diamonds']);

export default function Card({ rank, suit, faceDown = false, animate = false, className = '', size = 'md' }) {
  const [flipped, setFlipped] = useState(faceDown);

  // When faceDown flips from true → false, animate the reveal
  useEffect(() => {
    if (!faceDown && flipped) {
      setTimeout(() => { setFlipped(false); sounds.flip(); }, 50);
    } else {
      setFlipped(faceDown);
    }
  }, [faceDown]); // eslint-disable-line

  const isRed = RED_SUITS.has(suit);
  const sym   = SUIT_SYMBOL[suit] || '?';
  const isUnknown = rank === '?' || !rank;

  const szClass = size === 'sm' ? 'w-11 h-16' : 'w-16 h-24';

  return (
    <div className={`card-scene ${szClass} flex-shrink-0 ${animate ? 'animate-deal-card' : ''} ${className}`}>
      <div className={`card-inner ${flipped ? '' : 'is-flipped'}`}>
        {/* Back */}
        <div className="card-face bg-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center overflow-hidden">
          <div className="w-12 h-20 border-2 border-blue-600/50 rounded bg-blue-800/60 flex items-center justify-center">
            <div className="text-blue-500 text-2xl opacity-60">★</div>
          </div>
        </div>

        {/* Front */}
        <div className={`card-face card-front bg-white shadow-xl border border-gray-200 overflow-hidden relative ${isUnknown ? 'flex items-center justify-center' : ''}`}>
          {isUnknown ? (
            <span className="text-gray-400 text-3xl">?</span>
          ) : (
            <>
              {/* Top-left corner */}
              <div className={`absolute top-1 left-1 flex flex-col items-center leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
                <span className="text-[11px] font-bold leading-tight">{rank}</span>
                <span className="text-[9px] leading-tight">{sym}</span>
              </div>
              {/* Center suit */}
              <div className={`absolute inset-0 flex items-center justify-center text-3xl ${isRed ? 'text-red-500' : 'text-gray-800'}`}>
                {sym}
              </div>
              {/* Bottom-right corner (rotated) */}
              <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
                <span className="text-[11px] font-bold leading-tight">{rank}</span>
                <span className="text-[9px] leading-tight">{sym}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
