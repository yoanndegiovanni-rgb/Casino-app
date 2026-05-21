import { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CasinoChipSVG, CHIP_DENOMS } from '../common/ChipStack';

// ─── Constants ────────────────────────────────────────────────────────────────

const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMS    = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SECTOR_DEG  = 360 / 37;

const BOARD_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const ROULETTE_CHIP_VALUES = [1, 2, 5, 10, 25, 50, 100, 500];

// ─── Board geometry & split/corner zones ─────────────────────────────────────

const CW = 32, CH = 38, G = 2;         // cell width, height, gap
const SX = CW + G, SY = CH + G;         // grid step
const GRID_W = 12 * SX - G;             // = 406 px
const GRID_H = 3  * SY - G;             // = 118 px

// Pre-compute every split and corner zone position once at module load
const H_SPLITS     = [];  // horizontal: same row, adjacent cols
const V_SPLITS     = [];  // vertical:   same col, adjacent rows
const CORNER_ZONES = [];  // 2×2 block of 4 cells

for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 11; c++) {
    H_SPLITS.push({
      nums: [BOARD_ROWS[r][c], BOARD_ROWS[r][c + 1]],
      cx: (c + 1) * SX - G / 2,   // centre of horizontal gap
      cy: r * SY + CH / 2,
    });
    if (r < 2) {
      CORNER_ZONES.push({
        nums: [BOARD_ROWS[r][c], BOARD_ROWS[r][c + 1],
               BOARD_ROWS[r + 1][c], BOARD_ROWS[r + 1][c + 1]],
        cx: (c + 1) * SX - G / 2,
        cy: (r + 1) * SY - G / 2,  // centre of both gaps
      });
    }
  }
}
for (let c = 0; c < 12; c++) {
  for (let r = 0; r < 2; r++) {
    V_SPLITS.push({
      nums: [BOARD_ROWS[r][c], BOARD_ROWS[r + 1][c]],
      cx: c * SX + CW / 2,
      cy: (r + 1) * SY - G / 2,   // centre of vertical gap
    });
  }
}

// ─── Wheel geometry (SVG 300×300) ─────────────────────────────────────────────

const W = 300, C = 150;
const R_FRAME   = 147;   // outermost gold decorative ring
const R_TRACK   = 135;   // ball track outer edge
const R_BALL    = 128;   // ball track inner + bump zone
const R_OUT     = 122;   // sector outer edge
const R_IN      = 83;    // sector inner edge
const R_WOOD    = 80;    // inner mahogany cone
const R_HUB     = 46;    // hub
const R_CAP     = 28;    // non-spinning center cap

function d2r(deg) { return (deg - 90) * Math.PI / 180; }
function pt(r, deg) {
  return { x: C + r * Math.cos(d2r(deg)), y: C + r * Math.sin(d2r(deg)) };
}

// Pre-compute sector paths & text positions once (module level)
const SECTORS = WHEEL_ORDER.map((n, i) => {
  const s = i * SECTOR_DEG, e = (i + 1) * SECTOR_DEG;
  const o1 = pt(R_OUT, s), o2 = pt(R_OUT, e);
  const i1 = pt(R_IN,  e), i2 = pt(R_IN,  s);
  const path =
    `M${o1.x.toFixed(2)},${o1.y.toFixed(2)} ` +
    `A${R_OUT},${R_OUT} 0 0,1 ${o2.x.toFixed(2)},${o2.y.toFixed(2)} ` +
    `L${i1.x.toFixed(2)},${i1.y.toFixed(2)} ` +
    `A${R_IN},${R_IN} 0 0,0 ${i2.x.toFixed(2)},${i2.y.toFixed(2)}Z`;
  const mid  = (i + 0.5) * SECTOR_DEG;
  const tp   = pt((R_OUT + R_IN) / 2, mid);
  const fill = n === 0 ? '#16a34a' : RED_NUMS.has(n) ? '#991b1b' : '#111827';
  return { n, path, tx: tp.x, ty: tp.y, rot: mid, fill };
});

// Fret boundary lines (gold dividers between pockets)
const FRETS = WHEEL_ORDER.map((_, i) => {
  const deg = i * SECTOR_DEG;
  const o = pt(R_OUT + 1, deg), inn = pt(R_IN - 1, deg);
  return `M${o.x.toFixed(2)},${o.y.toFixed(2)} L${inn.x.toFixed(2)},${inn.y.toFixed(2)}`;
});

// Ball-stop diamonds in the track (18 bumps, standard European wheel)
const BUMPS = Array.from({ length: 18 }, (_, i) => {
  const deg = i * 20;
  const p = pt(R_BALL, deg);
  return { x: p.x, y: p.y, rot: deg + 45 };
});

// Decorative diamonds on the inner mahogany cone (8)
const DIAMONDS = Array.from({ length: 8 }, (_, i) => {
  const deg = i * 45 + 22;
  const p = pt(62, deg);
  return { x: p.x, y: p.y, rot: deg + 45 };
});

function betKey(b) {
  if (b.type === 'straight') return `s-${b.number}`;
  if (b.type === 'split')    return `sp-${[...b.numbers].sort((x, y) => x - y).join('_')}`;
  if (b.type === 'corner')   return `co-${[...b.numbers].sort((x, y) => x - y).join('_')}`;
  if (b.type === 'dozen')    return `d-${b.which}`;
  if (b.type === 'column')   return `c-${b.which}`;
  return b.type;
}

function betLabel(b) {
  if (b.type === 'straight') return `Plein ${b.number}`;
  if (b.type === 'split')    return `Cheval ${b.numbers.join('-')}`;
  if (b.type === 'corner')   return `Carré ${b.numbers.join('-')}`;
  if (b.type === 'dozen')    return `${b.which === 1 ? '1ère' : b.which === 2 ? '2ème' : '3ème'} douzaine`;
  if (b.type === 'column')   return `Colonne ${b.which}`;
  const labels = { red: 'Rouge', black: 'Noir', odd: 'Impair', even: 'Pair', low: 'Manque 1–18', high: 'Passe 19–36' };
  return labels[b.type] || b.type;
}

// ─── SVG Roulette Wheel ───────────────────────────────────────────────────────

function Wheel({ rotation, spinning, result }) {
  const capFill = !result    ? '#0f0f0f'
    : result.winningNumber === 0 ? '#16a34a'
    : RED_NUMS.has(result.winningNumber) ? '#991b1b' : '#111827';

  return (
    <div className="relative select-none"
      style={{ width: W, height: W, filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.9))' }}>
      <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
        <defs>
          {/* Gold outer ring gradient */}
          <radialGradient id="rFrameGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#f5e070" />
            <stop offset="40%"  stopColor="#c5a028" />
            <stop offset="75%"  stopColor="#7a5c10" />
            <stop offset="100%" stopColor="#3a2800" />
          </radialGradient>
          {/* Ball track gradient (dark metallic) */}
          <radialGradient id="rTrackGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%"  stopColor="#1c1c1c" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
          {/* Inner mahogany wood */}
          <radialGradient id="rWoodGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#3d1f06" />
            <stop offset="100%" stopColor="#1a0a02" />
          </radialGradient>
          {/* Center brass hub */}
          <radialGradient id="rHubGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#f5e070" />
            <stop offset="45%"  stopColor="#c5a028" />
            <stop offset="100%" stopColor="#4a3000" />
          </radialGradient>
          {/* Subtle sector highlight (lighter toward outer edge) */}
          <radialGradient id="rSectorHighlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="rgba(255,255,255,0)" />
            <stop offset="80%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </radialGradient>
        </defs>

        {/* ── Outermost gold decorative ring (static) ── */}
        <circle cx={C} cy={C} r={R_FRAME} fill="url(#rFrameGrad)" />
        {/* Fine engraved circles on frame */}
        <circle cx={C} cy={C} r={R_FRAME - 3} fill="none" stroke="rgba(255,220,80,0.25)" strokeWidth="0.6" />
        <circle cx={C} cy={C} r={R_FRAME - 7} fill="none" stroke="rgba(255,220,80,0.15)" strokeWidth="0.4" />

        {/* ── Ball track (static ring) ── */}
        <circle cx={C} cy={C} r={R_TRACK} fill="url(#rTrackGrad)" />
        <circle cx={C} cy={C} r={R_TRACK}     fill="none" stroke="#c5a028" strokeWidth="0.8" />
        <circle cx={C} cy={C} r={R_TRACK - 11} fill="none" stroke="#3a3a3a" strokeWidth="0.4" />

        {/* Ball-stop bumps (diamonds in the track, static) */}
        {BUMPS.map(({ x, y, rot }, i) => (
          <rect key={i}
            x={x - 3.5} y={y - 3.5} width={7} height={7}
            fill="#d4a017" opacity="0.75"
            rx="0.5"
            transform={`rotate(${rot},${x},${y})`}
          />
        ))}

        {/* ── SPINNING GROUP ── */}
        <g style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4s cubic-bezier(0.05, 0.75, 0.15, 1)' : 'none',
        }}>
          {/* Individual colored pockets */}
          {SECTORS.map(({ n, path, tx, ty, rot, fill }) => (
            <g key={n}>
              <path d={path} fill={fill} />
              {/* Subtle highlight layer */}
              <path d={path} fill="url(#rSectorHighlight)" />
              {/* Pocket number */}
              <text
                x={tx.toFixed(2)} y={ty.toFixed(2)}
                fill="white"
                fontSize="8.5"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${rot.toFixed(2)},${tx.toFixed(2)},${ty.toFixed(2)})`}
                style={{ letterSpacing: '-0.3px' }}
              >
                {n}
              </text>
            </g>
          ))}

          {/* Gold fret divider lines */}
          {FRETS.map((d, i) => (
            <path key={i} d={d} stroke="#c5a028" strokeWidth="0.9" strokeLinecap="round" />
          ))}

          {/* Sector ring borders */}
          <circle cx={C} cy={C} r={R_OUT}     fill="none" stroke="#c5a028" strokeWidth="1.2" />
          <circle cx={C} cy={C} r={R_IN}      fill="none" stroke="#c5a028" strokeWidth="0.8" />

          {/* Inner mahogany cone */}
          <circle cx={C} cy={C} r={R_WOOD}    fill="url(#rWoodGrad)" />
          <circle cx={C} cy={C} r={R_WOOD}    fill="none" stroke="#c5a028" strokeWidth="0.8" />

          {/* Decorative spire diamonds on the cone */}
          {DIAMONDS.map(({ x, y, rot }, i) => (
            <rect key={i}
              x={x - 4} y={y - 4} width={8} height={8}
              fill="#c5a028" opacity="0.55" rx="1"
              transform={`rotate(${rot},${x},${y})`}
            />
          ))}
          {/* Inner cone ring detail */}
          <circle cx={C} cy={C} r={44}  fill="none" stroke="#c5a028" strokeWidth="0.5" opacity="0.4" />

          {/* Hub (brass center) */}
          <circle cx={C} cy={C} r={R_HUB}     fill="url(#rHubGrad)" />
          <circle cx={C} cy={C} r={R_HUB}     fill="none" stroke="#f0d060" strokeWidth="1.5" />
          <circle cx={C} cy={C} r={R_HUB - 9} fill="none" stroke="#c5a028" strokeWidth="0.8" />
          <circle cx={C} cy={C} r={R_HUB - 16} fill="none" stroke="#c5a028" strokeWidth="0.5" opacity="0.5" />
        </g>

        {/* ── Non-spinning center cap ── */}
        <circle cx={C} cy={C} r={R_CAP}     fill={capFill} stroke="#c5a028" strokeWidth="2.5" />
        <circle cx={C} cy={C} r={R_CAP - 6} fill="none"    stroke="rgba(255,200,60,0.3)" strokeWidth="0.8" />

        {/* Top ball indicator (static) */}
        <polygon
          points={`${C},${C - R_FRAME + 4} ${C - 7},${C - R_FRAME - 8} ${C + 7},${C - R_FRAME - 8}`}
          fill="#f0d060" stroke="#7a5c00" strokeWidth="1"
        />
      </svg>

      {/* Center number / icon (HTML overlay so it's crisp) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {result ? (
          <span className="text-white font-black leading-none"
            style={{ fontSize: 22, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
            {result.winningNumber}
          </span>
        ) : (
          <span className={`text-yellow-400 leading-none ${spinning ? 'animate-spin' : 'opacity-50'}`}
            style={{ fontSize: 20, display: 'inline-block' }}>◉</span>
        )}
      </div>
    </div>
  );
}

// ─── Chip indicator on bet cell ───────────────────────────────────────────────

// Small chip pip shown on number cells (straight bets)
function ChipPip({ amount }) {
  if (!amount) return null;
  const label = amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount;
  return (
    <span style={{
      position: 'absolute', top: -6, right: -6, zIndex: 15,
      background: '#d4af37', color: '#000',
      borderRadius: '50%', width: 16, height: 16,
      fontSize: 8, fontWeight: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
      pointerEvents: 'none',
    }}>
      {label}
    </span>
  );
}

// ─── Overlay zone for split / corner bets ─────────────────────────────────────

function OverlayZone({ zone, betType, w, h, zIdx = 5, betMap, onBet, spinning, result }) {
  const k      = betKey({ type: betType, numbers: zone.nums });
  const amount = betMap[k] || 0;
  const won    = result && zone.nums.includes(result.winningNumber);

  return (
    <button
      className="split-zone"
      title={betType === 'corner'
        ? `Carré ${zone.nums.join('-')} · 8:1`
        : `Cheval ${zone.nums.join('-')} · 17:1`}
      onClick={() => !spinning && onBet({ type: betType, numbers: zone.nums })}
      disabled={spinning}
      style={{
        position: 'absolute',
        left: zone.cx - w / 2,
        top:  zone.cy - h / 2,
        width: w, height: h,
        zIndex: zIdx,
        background: won
          ? 'rgba(212,175,55,0.5)'
          : amount > 0 ? 'rgba(212,175,55,0.18)' : 'transparent',
        border: won ? '1px solid #d4af37' : 'none',
        borderRadius: 2,
        padding: 0,
        cursor: spinning ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {amount > 0 && (
        <span style={{
          background: '#d4af37', color: '#000',
          borderRadius: '50%', width: 14, height: 14,
          fontSize: 7, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
          pointerEvents: 'none', flexShrink: 0,
        }}>
          {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
        </span>
      )}
    </button>
  );
}

// ─── Casino betting table ─────────────────────────────────────────────────────

function BettingBoard({ bets, onBet, spinning, result }) {
  const betMap = {};
  bets.forEach(b => { betMap[betKey(b)] = (betMap[betKey(b)] || 0) + b.amount; });
  const g = k => betMap[k] || 0;

  const isWin = n => result && result.winningNumber === n;

  function numCellStyle(n) {
    return {
      width: CW, height: CH,
      background: isWin(n) ? '#d4af37' : n === 0 ? '#155a2a' : RED_NUMS.has(n) ? '#7f1d1d' : '#111111',
      border: '1px solid rgba(197,160,40,0.45)',
      cursor: spinning ? 'not-allowed' : 'pointer',
      opacity: spinning ? 0.65 : 1,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: isWin(n) ? '#000' : '#fff',
      fontWeight: 900, fontSize: 13,
      userSelect: 'none', flexShrink: 0,
      borderRadius: 2,
    };
  }

  function outsideStyle(key, bg = null) {
    return {
      height: CH - 4,
      border: '1px solid rgba(197,160,40,0.45)',
      background: g(key) > 0 ? 'rgba(212,175,55,0.22)' : (bg ?? 'rgba(255,255,255,0.04)'),
      cursor: spinning ? 'not-allowed' : 'pointer',
      opacity: spinning ? 0.65 : 1,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: g(key) > 0 ? '#f0d060' : '#d1c8a8',
      fontWeight: 700, fontSize: 11,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      userSelect: 'none', transition: 'background 0.15s',
    };
  }

  // Left offset for dozen/outside rows (past zero-cell + gap)
  const ML = 30 + G + G;  // = 34
  // Right offset (col-bet cells + gap)
  const MR = 36 + G;      // = 38

  return (
    <div translate="no" style={{ background: '#3d2007', padding: 6, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
      <div style={{ background: '#0a4a1e', borderRadius: 8, border: '1px solid rgba(197,160,40,0.6)', padding: 8, boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)' }}>

        {/* Helper legend */}
        <div style={{ textAlign: 'center', marginBottom: 5, color: 'rgba(212,175,55,0.5)', fontSize: 9, letterSpacing: '0.05em' }}>
          Cliquez sur les <strong style={{ color: 'rgba(212,175,55,0.75)' }}>bordures</strong> pour jouer à cheval (17:1) ou en carré (8:1)
        </div>

        {/* ── Main row: [0] + [grid + overlays] + [2:1] ── */}
        <div style={{ display: 'flex', gap: G, alignItems: 'stretch' }}>

          {/* Zero */}
          <button
            onClick={() => !spinning && onBet({ type: 'straight', number: 0 })}
            style={{ ...numCellStyle(0), width: 30, height: GRID_H, borderRadius: 4 }}
          >
            0
            <ChipPip amount={g('s-0')} />
          </button>

          {/* Fixed-width number grid + overlay zones */}
          <div style={{ position: 'relative', width: GRID_W, height: GRID_H, flexShrink: 0 }}>
            {/* Number cells */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(12, ${CW}px)`, gap: G }}>
              {BOARD_ROWS.map(row =>
                row.map(n => (
                  <button key={n}
                    onClick={() => !spinning && onBet({ type: 'straight', number: n })}
                    style={numCellStyle(n)}
                  >
                    {n}
                    <ChipPip amount={g(`s-${n}`)} />
                  </button>
                ))
              )}
            </div>

            {/* Horizontal split zones */}
            {H_SPLITS.map((z, i) => (
              <OverlayZone key={`hs${i}`} zone={z} betType="split"
                w={8} h={26} zIdx={5}
                betMap={betMap} onBet={onBet} spinning={spinning} result={result} />
            ))}

            {/* Vertical split zones */}
            {V_SPLITS.map((z, i) => (
              <OverlayZone key={`vs${i}`} zone={z} betType="split"
                w={26} h={8} zIdx={5}
                betMap={betMap} onBet={onBet} spinning={spinning} result={result} />
            ))}

            {/* Corner zones — higher z-index so they win at intersections */}
            {CORNER_ZONES.map((z, i) => (
              <OverlayZone key={`cz${i}`} zone={z} betType="corner"
                w={10} h={10} zIdx={6}
                betMap={betMap} onBet={onBet} spinning={spinning} result={result} />
            ))}
          </div>

          {/* Column 2:1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: G, width: 36 }}>
            {[1, 2, 3].map(col => (
              <button key={col}
                onClick={() => !spinning && onBet({ type: 'column', which: col })}
                style={{ ...outsideStyle(`c-${col}`), flex: 1, borderRadius: 4, fontSize: 10 }}
              >
                2:1
                <ChipPip amount={g(`c-${col}`)} />
              </button>
            ))}
          </div>
        </div>

        {/* Dozen bets */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: G, marginTop: G, marginLeft: ML, marginRight: MR }}>
          {[[1,'1ère douzaine'],[2,'2ème douzaine'],[3,'3ème douzaine']].map(([w, label]) => (
            <button key={w}
              onClick={() => !spinning && onBet({ type: 'dozen', which: w })}
              style={{ ...outsideStyle(`d-${w}`), borderRadius: 3 }}
            >
              {label}
              <ChipPip amount={g(`d-${w}`)} />
            </button>
          ))}
        </div>

        {/* Outside bets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: G, marginTop: G, marginLeft: ML, marginRight: MR }}>
          {[
            ['Manque\n1–18', { type: 'low' }],
            ['Pair',         { type: 'even' }],
            ['Rouge',        { type: 'red' }],
            ['Noir',         { type: 'black' }],
            ['Impair',       { type: 'odd' }],
            ['Passe\n19–36', { type: 'high' }],
          ].map(([label, bet]) => {
            const k   = betKey(bet);
            const bg  = bet.type === 'red' ? '#7f1d1d' : bet.type === 'black' ? '#111111' : null;
            return (
              <button key={label}
                onClick={() => !spinning && onBet(bet)}
                style={{ ...outsideStyle(k, bg), flexDirection: 'column', gap: 1, borderRadius: 3, lineHeight: 1.2 }}
              >
                {label.split('\n').map((l, i) => (
                  <span key={i} style={{ fontSize: i === 1 ? 9 : 11, opacity: i === 1 ? 0.7 : 1 }}>{l}</span>
                ))}
                <ChipPip amount={g(k)} />
              </button>
            );
          })}
        </div>

        {/* Odds reference */}
        <div style={{ marginTop: 6, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['Plein','35:1'],['Cheval','17:1'],['Carré','8:1'],['Douzaine','2:1'],['Colonne','2:1'],['Pair/Imp.','1:1'],['Rouge/Noir','1:1']].map(([n,p]) => (
            <span key={n} style={{ color: 'rgba(200,180,120,0.55)', fontSize: 9 }}>
              {n} <strong style={{ color: 'rgba(212,175,55,0.8)' }}>{p}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Chip selector ────────────────────────────────────────────────────────────

function ChipSelector({ selected, onSelect }) {
  const col1 = ROULETTE_CHIP_VALUES.filter(v => v <= 10);
  const col2 = ROULETTE_CHIP_VALUES.filter(v => v >= 25);

  function chipDenom(value) {
    return CHIP_DENOMS.find(d => d.value === value) || CHIP_DENOMS[CHIP_DENOMS.length - 1];
  }

  function ChipBtn({ value }) {
    const denom = chipDenom(value);
    const isSelected = selected === value;
    return (
      <button
        onClick={() => onSelect(value)}
        style={{
          background: 'none', border: 'none', padding: 0,
          cursor: 'pointer',
          transition: 'transform 0.1s',
          transform: isSelected ? 'scale(1.2)' : 'scale(1)',
          filter: isSelected
            ? `drop-shadow(0 0 8px ${denom.color}aa)`
            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
          outline: 'none',
          flexShrink: 0,
        }}
      >
        <CasinoChipSVG
          label={denom.label}
          color={denom.color}
          text={denom.text}
          size={46}
          shadow={false}
        />
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
        {col1.map(v => <ChipBtn key={v} value={v} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
        {col2.map(v => <ChipBtn key={v} value={v} />)}
      </div>
    </div>
  );
}

// ─── Number history pill ──────────────────────────────────────────────────────

function HistoryPill({ n }) {
  const bg = n === 0 ? '#16a34a' : RED_NUMS.has(n) ? '#991b1b' : '#111827';
  return (
    <span style={{
      width: 26, height: 26,
      borderRadius: '50%',
      background: bg,
      border: '1px solid rgba(197,160,40,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: 11,
      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      flexShrink: 0,
    }}>
      {n}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RouletteTable() {
  const { user, updateBalance } = useAuth();
  const [balance,       setBalance]       = useState(user?.balance ?? 0);
  const [bets,          setBets]          = useState([]);
  const [selectedChip,  setSelectedChip]  = useState(25);
  const [spinning,      setSpinning]      = useState(false);
  const [result,        setResult]        = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [history,       setHistory]       = useState([]);
  const [error,         setError]         = useState('');

  function addBet(betSpec) {
    if (spinning) return;
    setBets(prev => {
      const k = betKey(betSpec);
      const idx = prev.findIndex(b => betKey(b) === k);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], amount: copy[idx].amount + selectedChip };
        return copy;
      }
      return [...prev, { ...betSpec, amount: selectedChip }];
    });
  }

  function removeBet(k) {
    setBets(prev => prev.filter(b => betKey(b) !== k));
  }

  async function handleSpin() {
    if (bets.length === 0 || spinning) return;
    const total = bets.reduce((s, b) => s + b.amount, 0);
    if (total > balance) { setError('Solde insuffisant'); return; }

    setError('');
    setSpinning(true);
    setResult(null);

    try {
      const data = await api.roulette.spin(bets);

      // Compute precise landing: CSS rotate(R) moves a sector from angle θ to θ+R,
      // so to bring sector to top (0°) we need R ≡ -θ (mod 360) = 360 - θ.
      const winIdx      = WHEEL_ORDER.indexOf(data.winningNumber);
      const sectorAngle = ((winIdx + 0.5) * SECTOR_DEG) % 360;
      const targetRot   = (360 - sectorAngle) % 360;   // rotation that lands winner at top
      const currentMod  = ((wheelRotation % 360) + 360) % 360;
      const extra       = (targetRot - currentMod + 360) % 360;
      setWheelRotation(wheelRotation + 5 * 360 + extra);

      await new Promise(r => setTimeout(r, 4300));  // wait for CSS transition

      setResult(data);
      setBalance(data.balance);
      updateBalance(data.balance);
      setHistory(h => [data.winningNumber, ...h].slice(0, 15));
      setBets([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSpinning(false);
    }
  }

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);

  return (
    <div lang="fr" style={{
      minHeight: 'calc(100vh - 64px)',
      background: 'radial-gradient(ellipse at 50% 25%, #0d3d18 0%, #04100a 80%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '28px 16px 80px',
      gap: 20,
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 className="text-gold-glow" style={{ fontSize: 30, fontWeight: 900, letterSpacing: '0.2em', margin: 0 }}>
          ROULETTE
        </h2>
        <p style={{ color: 'rgba(200,180,120,0.6)', fontSize: 12, margin: '4px 0 0', letterSpacing: '0.06em' }}>
          Roulette Européenne · Zéro Unique · 37 Numéros
        </p>
      </div>

      {/* ── Wheel + history + result (centré) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

        <Wheel rotation={wheelRotation} spinning={spinning} result={result} />

        {history.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: W }}>
            {history.map((n, i) => <HistoryPill key={i} n={n} />)}
          </div>
        )}

        {result && (
          <div style={{
            textAlign: 'center', padding: '12px 22px', borderRadius: 12,
            border: `1px solid ${result.net >= 0 ? '#16a34a' : '#991b1b'}`,
            background: result.net >= 0 ? 'rgba(22,163,74,0.15)' : 'rgba(153,27,27,0.15)',
            color: result.net >= 0 ? '#4ade80' : '#f87171',
            animation: 'fadeIn 0.3s ease-out forwards', minWidth: 200,
          }}>
            <div style={{ fontWeight: 900, fontSize: 24 }}>{result.net >= 0 ? '+' : ''}{result.net} jetons</div>
            {result.totalPayout > 0 && (
              <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: '#f0d060', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 11 }}>Payé :</span>
                <span>+{result.totalPayout.toLocaleString()} jetons</span>
                <span style={{ opacity: 0.5, fontSize: 10 }}>— Mise : {result.totalBet}</span>
              </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Caisse : {result.balance.toLocaleString()} jetons</div>
          </div>
        )}
      </div>

      {/* ── Chip selector + table + controls (centré) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>

          {error && (
            <div style={{
              background: 'rgba(153,27,27,0.7)', border: '1px solid #991b1b',
              color: '#fca5a5', padding: '8px 16px', borderRadius: 8, fontSize: 13
            }}>
              {error}
            </div>
          )}

          {/* Chip selector à gauche + tapis à droite */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(0,0,0,0.25)', borderRadius: 10,
              border: '1px solid rgba(197,160,40,0.25)',
              padding: '10px 6px', gap: 6, alignSelf: 'stretch', justifyContent: 'center',
            }}>
              <ChipSelector selected={selectedChip} onSelect={setSelectedChip} />
            </div>

            <BettingBoard bets={bets} onBet={addBet} spinning={spinning} result={result} />
          </div>

          {/* Bet list with individual remove buttons */}
          {bets.length > 0 && (
            <div style={{
              width: '100%', maxHeight: 160, overflowY: 'auto',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(197,160,40,0.3)',
              borderRadius: 8, padding: '6px 8px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {bets.map(b => {
                const k = betKey(b);
                return (
                  <div key={k} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 5, padding: '4px 8px', gap: 8,
                  }}>
                    <span style={{ color: '#d1c8a8', fontSize: 12, flex: 1 }}>{betLabel(b)}</span>
                    <span style={{ color: '#f0d060', fontWeight: 700, fontSize: 12, minWidth: 40, textAlign: 'right' }}>
                      {b.amount} <span style={{ opacity: 0.6, fontWeight: 400 }}>chips</span>
                    </span>
                    <button
                      onClick={() => removeBet(k)}
                      disabled={spinning}
                      title="Supprimer cette mise"
                      style={{
                        background: 'rgba(220,50,50,0.2)',
                        border: '1px solid rgba(220,50,50,0.4)',
                        color: '#f87171',
                        borderRadius: 4, width: 22, height: 22,
                        cursor: spinning ? 'not-allowed' : 'pointer',
                        fontSize: 13, fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, padding: 0,
                        opacity: spinning ? 0.4 : 1,
                        transition: 'background 0.1s',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => setBets([])}
              disabled={spinning || bets.length === 0}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(197,160,40,0.4)',
                color: '#d1c8a8',
                padding: '10px 22px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: spinning || !bets.length ? 'not-allowed' : 'pointer',
                opacity: spinning || !bets.length ? 0.4 : 1,
                letterSpacing: '0.06em',
                transition: 'opacity 0.15s',
              }}
            >
              ANNULER
            </button>

            <button
              onClick={handleSpin}
              disabled={spinning || bets.length === 0}
              className="btn-gold"
              style={{
                padding: '10px 32px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.06em',
                boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
                opacity: spinning || !bets.length ? 0.4 : 1,
                cursor: spinning || !bets.length ? 'not-allowed' : 'pointer',
                transform: 'none',
              }}
            >
              {spinning ? 'TIRAGE EN COURS…' : `LANCER  ${totalBet > 0 ? `(${totalBet})` : ''}`}
            </button>
          </div>
        </div>

      {/* Balance strip */}
      <div className="fixed bottom-4 right-4 bg-casino-card border border-gold/30 rounded-xl px-4 py-2 shadow-xl">
        <span className="text-gold text-sm font-bold">💰 {balance?.toLocaleString()} jetons</span>
      </div>
    </div>
  );
}
