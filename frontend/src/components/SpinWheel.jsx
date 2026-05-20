import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Wheel segments (must match backend order) ─────────────────────────────────

const SEGMENTS = [
  { chips: 200,  color: '#1a4a2a' },
  { chips: 1000, color: '#7c3aed' },
  { chips: 300,  color: '#1a4a2a' },
  { chips: 2500, color: '#d97706' },
  { chips: 200,  color: '#1a4a2a' },
  { chips: 750,  color: '#0369a1' },
  { chips: 500,  color: '#15803d' },
  { chips: 200,  color: '#1a4a2a' },
  { chips: 1500, color: '#be185d' },
  { chips: 300,  color: '#1a4a2a' },
  { chips: 2000, color: '#b45309' },
  { chips: 500,  color: '#15803d' },
];

const N        = SEGMENTS.length;
const SLICE    = 360 / N; // 30°

// ── SVG wheel ─────────────────────────────────────────────────────────────────

function polarToXY(deg, r) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

function WheelSVG({ rotation }) {
  const R = 140;
  const cx = 150, cy = 150;

  return (
    <svg width="300" height="300" viewBox="0 0 300 300">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={R + 8} fill="#d4af37" />
      <circle cx={cx} cy={cy} r={R + 4} fill="#0a1a0f" />

      {/* Segments */}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 4s cubic-bezier(0.17,0.67,0.12,0.99)' }}>
        {SEGMENTS.map((seg, i) => {
          const startDeg = i * SLICE;
          const endDeg   = startDeg + SLICE;
          const p1 = polarToXY(startDeg, R);
          const p2 = polarToXY(endDeg, R);
          const mid = polarToXY(startDeg + SLICE / 2, R * 0.65);
          const midRot = startDeg + SLICE / 2;

          return (
            <g key={i}>
              <path
                d={`M ${cx} ${cy} L ${cx + p1.x} ${cy + p1.y} A ${R} ${R} 0 0 1 ${cx + p2.x} ${cy + p2.y} Z`}
                fill={seg.color}
                stroke="#0a1a0f"
                strokeWidth="1.5"
              />
              <text
                x={cx + mid.x}
                y={cy + mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="11"
                fontWeight="bold"
                transform={`rotate(${midRot}, ${cx + mid.x}, ${cy + mid.y})`}
              >
                {seg.chips >= 1000 ? `${seg.chips / 1000}k` : seg.chips}
              </text>
            </g>
          );
        })}

        {/* Center cap */}
        <circle cx={cx} cy={cy} r={18} fill="#d4af37" />
        <circle cx={cx} cy={cy} r={13} fill="#0a1a0f" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#d4af37" fontSize="8" fontWeight="bold">🎡</text>
      </g>

      {/* Fixed pointer at top */}
      <polygon
        points={`${cx},${cy - R - 4} ${cx - 10},${cy - R + 14} ${cx + 10},${cy - R + 14}`}
        fill="#d4af37"
        stroke="#0a1a0f"
        strokeWidth="1"
      />
    </svg>
  );
}

// ── Countdown helper ──────────────────────────────────────────────────────────

function formatCountdown(ms) {
  if (ms <= 0) return 'Ready!';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpinWheel() {
  const { updateBalance } = useAuth();
  const [open, setOpen]         = useState(false);
  const [canSpin, setCanSpin]   = useState(false);
  const [msLeft, setMsLeft]     = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize]       = useState(null);
  const [error, setError]       = useState('');
  const tickRef = useRef(null);

  // Load status on mount
  useEffect(() => {
    api.wheel.status().then(({ canSpin: cs, msRemaining }) => {
      setCanSpin(cs);
      setMsLeft(msRemaining);
    }).catch(() => {});
  }, []);

  // Live countdown ticker
  useEffect(() => {
    if (canSpin || msLeft <= 0) return;
    tickRef.current = setInterval(() => {
      setMsLeft(prev => {
        if (prev <= 1000) { setCanSpin(true); clearInterval(tickRef.current); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [canSpin, msLeft]);

  async function spin() {
    if (!canSpin || spinning) return;
    setError('');
    setSpinning(true);
    setPrize(null);

    try {
      const { segmentIndex, chips, balance } = await api.wheel.spin();

      // Each segment i has its center at (i*30 + 15)° in the wheel's own frame.
      // CSS rotate(R) moves each point clockwise by R, so a segment at angle α
      // reaches the pointer (0°/top) when (α + R) ≡ 0 (mod 360) → R ≡ -α (mod 360).
      const segCenter   = segmentIndex * SLICE + SLICE / 2;
      const target      = (360 - (segCenter % 360)) % 360;
      const currentMod  = rotation % 360;
      const extra       = (target - currentMod + 360) % 360 || 360;
      const newRotation = rotation + 5 * 360 + extra;

      setRotation(newRotation);

      // Wait for CSS transition (4s) then show result
      setTimeout(() => {
        setPrize(chips);
        setCanSpin(false);
        setMsLeft(4 * 60 * 60 * 1000);
        updateBalance(balance);
        setSpinning(false);
      }, 4200);
    } catch (e) {
      setError(e.message);
      setSpinning(false);
    }
  }

  const PANEL_W = 300;
  const TAB_W   = 26;

  return (
    <>
      {/* Tab button — sits in the outer flex column, contributes only its own height */}
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-gold hover:bg-gold-light text-black font-extrabold rounded-tr-xl shadow-lg transition active:scale-95"
        style={{ writingMode: 'vertical-rl', letterSpacing: '0.12em', padding: '16px 6px', fontSize: '11px' }}
      >
        {open ? '◀' : '🎡 WHEEL'}
      </button>

      {/* Panel body — fixed, independent of flex column layout */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: open ? TAB_W : -PANEL_W,
          transform: 'translateY(-50%)',
          transition: 'left 0.3s ease',
          zIndex: 49,
          width: PANEL_W,
        }}
        className="bg-casino-card border border-gold/30 rounded-r-2xl p-4 shadow-2xl flex flex-col items-center gap-3"
      >
        <h3 className="text-gold-glow font-extrabold text-lg tracking-widest">SPIN WHEEL</h3>
        <p className="text-gray-400 text-xs">Every 4 hours · Win up to 2500 chips</p>

        <WheelSVG rotation={rotation} />

        {prize !== null && (
          <div className="animate-result-pop bg-green-900/80 border border-green-400 rounded-xl px-4 py-2 text-center">
            <p className="text-green-300 font-extrabold text-xl">+{prize} chips! 🎉</p>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={spin}
          disabled={!canSpin || spinning}
          className="btn-gold w-full py-2.5 rounded-xl font-extrabold text-sm tracking-widest
            disabled:opacity-40 disabled:cursor-not-allowed transition hover:scale-105 active:scale-95"
        >
          {spinning ? 'Spinning…' : canSpin ? '🎡 SPIN!' : formatCountdown(msLeft)}
        </button>
      </div>
    </>
  );
}
