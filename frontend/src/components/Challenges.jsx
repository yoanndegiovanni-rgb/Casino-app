import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PANEL_W = 300;
const TAB_W   = 26;

const TIER_BAR = { easy: 'bg-green-400', medium: 'bg-yellow-400', hard: 'bg-red-400' };
const TIER_LABEL = { easy: 'EASY', medium: 'MED', hard: 'HARD' };
const TIER_BADGE = {
  easy:   'bg-green-900/60 text-green-300 border-green-700',
  medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  hard:   'bg-red-900/60 text-red-300 border-red-700',
};

export default function Challenges() {
  const { updateBalance } = useAuth();
  const [open, setOpen]         = useState(false);
  const [tracks, setTracks]     = useState([]);
  const [claiming, setClaiming] = useState(null);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    try {
      const { tracks: t } = await api.challenges.progress();
      setTracks(t);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function claim(id) {
    setClaiming(id);
    setError('');
    try {
      const { balance } = await api.challenges.claim(id);
      updateBalance(balance);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setClaiming(null);
    }
  }

  return (
    <>
      {/* Tab button — sits in the outer flex column */}
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-gold hover:bg-gold-light text-black font-extrabold rounded-br-xl shadow-lg transition active:scale-95"
        style={{ writingMode: 'vertical-rl', letterSpacing: '0.12em', padding: '16px 6px', fontSize: '11px' }}
      >
        {open ? '◀' : '🏆 DÉFIS'}
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
          maxHeight: '80vh',
        }}
        className="bg-casino-card border border-gold/30 rounded-r-2xl p-3 shadow-2xl flex flex-col gap-1 overflow-y-auto"
      >
        <h3 className="text-gold-glow font-extrabold text-sm tracking-widest text-center shrink-0 mb-1">
          CHALLENGES
        </h3>

        {error && <p className="text-red-400 text-[10px] text-center shrink-0">{error}</p>}

        {tracks.map(track => (
          <TrackSection key={track.id} track={track} claiming={claiming} onClaim={claim} />
        ))}
      </div>
    </>
  );
}

function TrackSection({ track, claiming, onClaim }) {
  return (
    <div className="shrink-0">
      <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold px-1 mb-1">
        {track.icon} {track.title}
      </p>
      <div className="flex flex-col gap-1">
        {track.stages.map(stage => (
          <StageRow key={stage.id} stage={stage} claiming={claiming} onClaim={onClaim} />
        ))}
      </div>
    </div>
  );
}

function StageRow({ stage, claiming, onClaim }) {
  const [expanded, setExpanded] = useState(false);

  if (stage.claimed) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded opacity-50">
        <span className="text-green-400 text-[10px]">✓</span>
        <span className="text-gray-400 text-[10px] flex-1 truncate">{stage.title}</span>
        <span className="text-gray-500 text-[9px]">+{stage.reward.toLocaleString()}</span>
      </div>
    );
  }

  if (stage.locked) {
    return (
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2 px-2 py-1 rounded opacity-40 hover:opacity-60 transition-opacity">
          <span className="text-gray-600 text-[10px]">🔒</span>
          <span className="text-gray-500 text-[10px] flex-1 truncate">{stage.title}</span>
          <span className="text-gray-600 text-[9px]">+{stage.reward.toLocaleString()}</span>
        </div>
        {expanded && stage.desc && (
          <div className="mx-2 mb-1 px-2 py-1.5 rounded bg-gray-800/60 border border-gray-700/50">
            <p className="text-gray-400 text-[9px] leading-relaxed">{stage.desc}</p>
            <p className="text-gray-600 text-[9px] mt-0.5 italic">Débloque l'étape précédente d'abord.</p>
          </div>
        )}
      </button>
    );
  }

  const pct = Math.min((stage.current / stage.target) * 100, 100);

  return (
    <div className="bg-felt-light/20 rounded-lg overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left px-2 py-1.5 flex flex-col gap-1 hover:bg-white/5 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${TIER_BADGE[stage.tier]}`}>
            {TIER_LABEL[stage.tier]}
          </span>
          <span className="text-white text-[10px] font-semibold flex-1 truncate">{stage.title}</span>
          <span className="text-gold text-[10px] font-bold shrink-0">+{stage.reward.toLocaleString()}</span>
          <span className="text-gray-500 text-[9px] shrink-0">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${TIER_BAR[stage.tier] || 'bg-gold'} rounded-full transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-gray-400 text-[9px] tabular-nums shrink-0">
            {stage.current.toLocaleString()}/{stage.target.toLocaleString()}
          </span>
        </div>
      </button>

      {/* Detail panel */}
      {expanded && (
        <div className="px-2 pb-2 pt-0.5 border-t border-white/10 flex flex-col gap-1.5">
          {stage.desc && (
            <p className="text-gray-300 text-[10px] leading-relaxed">{stage.desc}</p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-[9px]">Progression</span>
            <span className="text-gray-300 text-[9px] font-bold tabular-nums">
              {stage.current.toLocaleString()} / {stage.target.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-[9px]">Récompense</span>
            <span className="text-gold text-[9px] font-bold">+{stage.reward.toLocaleString()} jetons</span>
          </div>
          {stage.completed && (
            <button
              onClick={() => onClaim(stage.id)}
              disabled={!!claiming}
              className="btn-gold w-full py-0.5 rounded text-[10px] font-extrabold disabled:opacity-50 mt-0.5"
            >
              {claiming === stage.id ? 'Réclamation…' : `RÉCLAMER +${stage.reward.toLocaleString()}`}
            </button>
          )}
          {!stage.completed && (
            <div className="text-center text-[9px] text-gray-500 mt-0.5">
              Encore {(stage.target - stage.current).toLocaleString()} pour compléter
            </div>
          )}
        </div>
      )}

      {/* Claim button outside detail (when not expanded) */}
      {!expanded && stage.completed && (
        <div className="px-2 pb-1.5">
          <button
            onClick={() => onClaim(stage.id)}
            disabled={!!claiming}
            className="btn-gold w-full py-0.5 rounded text-[10px] font-extrabold disabled:opacity-50"
          >
            {claiming === stage.id ? 'Réclamation…' : `RÉCLAMER +${stage.reward.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  );
}
