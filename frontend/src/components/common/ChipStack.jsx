// ─── Chip color map (matches photo: 1=vert, 5=rose, 10=bleu, 20=bordeaux,
//     50=bleu clair, 100=rouge, 500=vert lime, 1K=jaune, 5K=orange) ─────────

export const CHIP_DENOMS = [
  { value: 5000, label: '5K',  color: '#e65100', text: '#fff' },
  { value: 1000, label: '1K',  color: '#f9a825', text: '#000' },
  { value: 500,  label: '500', color: '#7cb342', text: '#fff' },
  { value: 100,  label: '100', color: '#c62828', text: '#fff' },
  { value: 50,   label: '50',  color: '#0288d1', text: '#fff' },
  { value: 25,   label: '25',  color: '#7b1c2a', text: '#fff' },
  { value: 10,   label: '10',  color: '#1565c0', text: '#fff' },
  { value: 5,    label: '5',   color: '#c2185b', text: '#fff' },
  { value: 1,    label: '1',   color: '#2e7d32', text: '#fff' },
];

export function chipForValue(amount) {
  for (const d of CHIP_DENOMS) {
    if (amount >= d.value) return d;
  }
  return CHIP_DENOMS[CHIP_DENOMS.length - 1];
}

// ─── SVG chip — même design que la photo ────────────────────────────────────

const NOTCHES   = 8;
const GAP_DEG   = 360 / NOTCHES; // 45°
const NOTCH_ANG = Array.from({ length: NOTCHES }, (_, i) => i * GAP_DEG);
// 2 dots between each pair of notches
const DOT_ANG   = NOTCH_ANG.flatMap(a => [a + GAP_DEG / 3, a + (GAP_DEG * 2) / 3]);

function toXY(deg, r) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: +(50 + r * Math.cos(rad)).toFixed(2), y: +(50 + r * Math.sin(rad)).toFixed(2) };
}

export function CasinoChipSVG({ label, color, text = '#fff', size = 64, shadow = true }) {
  const fs = label.length <= 1 ? 28 : label.length === 2 ? 24 : label.length === 3 ? 18 : 14;

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      style={{ display: 'block', filter: shadow ? 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))' : 'none' }}
    >
      {/* Disque coloré extérieur */}
      <circle cx="50" cy="50" r="48" fill={color} />

      {/* 8 encoches blanches à la périphérie */}
      {NOTCH_ANG.map((a, i) => (
        <rect key={i} x="43" y="2" width="14" height="12" rx="2.5" fill="white"
              transform={`rotate(${a},50,50)`} />
      ))}

      {/* 16 petits points blancs entre les encoches */}
      {DOT_ANG.map((a, i) => {
        const { x, y } = toXY(a, 41);
        return <circle key={i} cx={x} cy={y} r="2.6" fill="white" />;
      })}

      {/* Anneau blanc */}
      <circle cx="50" cy="50" r="36" fill="white" />

      {/* Disque central coloré */}
      <circle cx="50" cy="50" r="29" fill={color} />

      {/* Valeur */}
      <text
        x="50" y="50"
        textAnchor="middle" dominantBaseline="central"
        fill={text}
        fontWeight="900"
        fontSize={fs}
        fontFamily="'Arial Black', Arial, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

// ─── ChipStack : pile de jetons représentant une mise ────────────────────────

export default function ChipStack({ amount, size = 'md', label = true }) {
  if (!amount || amount <= 0) return null;

  const chips = [];
  let rem = amount;
  for (const denom of CHIP_DENOMS) {
    while (rem >= denom.value && chips.length < 6) {
      chips.push(denom);
      rem -= denom.value;
    }
    if (chips.length >= 6) break;
  }

  const chipPx = size === 'sm' ? 30 : 38;
  const step   = size === 'sm' ? 8  : 10;
  const stackH = chipPx + (chips.length - 1) * step;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: chipPx, height: stackH }}>
        {chips.map((chip, i) => (
          <div
            key={i}
            className="absolute"
            style={{ bottom: i * step, left: 0, zIndex: i }}
          >
            <CasinoChipSVG
              label={chip.label}
              color={chip.color}
              text={chip.text}
              size={chipPx}
              shadow={i === chips.length - 1}
            />
          </div>
        ))}
      </div>
      {label && (
        <span className="text-gold text-xs font-bold">{amount}</span>
      )}
    </div>
  );
}

// ─── ChipButton : jeton cliquable pour la mise ────────────────────────────────

export function ChipButton({ value, onClick, disabled, size = 'md' }) {
  const denom = chipForValue(value);
  const px    = size === 'sm' ? 48 : 60;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="transition hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: 'none', border: 'none', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <CasinoChipSVG
        label={denom.label}
        color={denom.color}
        text={denom.text}
        size={px}
      />
    </button>
  );
}
