const CHALLENGE_TRACKS = [
  {
    id: 'wager', title: 'Flambeur', icon: '💰', stat: 'total_wagered',
    stages: [
      { id: 'wager_1k',   title: 'Premiers pas',  desc: 'Miser 1 000 jetons',    target: 1000,   reward: 300,   tier: 'easy'   },
      { id: 'wager_10k',  title: 'Flambeur I',    desc: 'Miser 10 000 jetons',   target: 10000,  reward: 1000,  tier: 'medium' },
      { id: 'wager_100k', title: 'Flambeur II',   desc: 'Miser 100 000 jetons',  target: 100000, reward: 5000,  tier: 'hard'   },
    ],
  },
  {
    id: 'bj_wins', title: 'Requin des Cartes', icon: '🃏', stat: 'blackjack_wins',
    stages: [
      { id: 'bj_wins_5',   title: 'Chance du débutant', desc: 'Gagner 5 mains de blackjack',   target: 5,   reward: 300,  tier: 'easy'   },
      { id: 'bj_wins_25',  title: 'Requin des cartes',  desc: 'Gagner 25 mains de blackjack',  target: 25,  reward: 1000, tier: 'medium' },
      { id: 'bj_wins_100', title: 'Maître du blackjack',desc: 'Gagner 100 mains de blackjack', target: 100, reward: 3000, tier: 'hard'   },
    ],
  },
  {
    id: 'blackjacks', title: 'Naturels', icon: '⭐', stat: 'blackjacks_count',
    stages: [
      { id: 'blackjack_3',  title: 'Naturel !',      desc: 'Obtenir 3 blackjacks',  target: 3,  reward: 1500,  tier: 'medium' },
      { id: 'blackjack_10', title: 'Talent naturel',  desc: 'Obtenir 10 blackjacks', target: 10, reward: 5000,  tier: 'hard'   },
      { id: 'blackjack_25', title: 'Né pour gagner',  desc: 'Obtenir 25 blackjacks', target: 25, reward: 15000, tier: 'hard'   },
    ],
  },
  {
    id: 'wheel_spins', title: 'La Roue', icon: '🎡', stat: 'wheel_spins',
    stages: [
      { id: 'wheel_1',  title: 'Premier tour',   desc: 'Tourner la roue 1 fois',   target: 1,  reward: 200,  tier: 'easy'   },
      { id: 'wheel_5',  title: 'Chanceux',       desc: 'Tourner la roue 5 fois',   target: 5,  reward: 1000, tier: 'medium' },
      { id: 'wheel_20', title: 'Accro à la roue',desc: 'Tourner la roue 20 fois',  target: 20, reward: 4000, tier: 'hard'   },
    ],
  },
  {
    id: 'streak', title: 'Série Quotidienne', icon: '📅', stat: 'daily_streak',
    stages: [
      { id: 'streak_3',  title: 'Régulier',       desc: 'Jouer 3 jours de suite',  target: 3,  reward: 750,  tier: 'easy'   },
      { id: 'streak_7',  title: 'Assidu',          desc: 'Jouer 7 jours de suite',  target: 7,  reward: 2500, tier: 'medium' },
      { id: 'streak_14', title: 'Joueur fidèle',   desc: 'Jouer 14 jours de suite', target: 14, reward: 7500, tier: 'hard'   },
    ],
  },
];

// Stats that live on user record rather than game_stats
const USER_STATS = new Set(['daily_streak']);

function updateDailyStreak(userId, db) {
  const today = new Date().toISOString().split('T')[0];
  const user  = db.users.findById(userId);
  if (!user) return;

  const lastDate = user.last_play_date;
  if (lastDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const current   = user.daily_streak || 0;
  const newStreak = lastDate === yesterdayStr ? current + 1 : 1;

  db.users.update(userId, { daily_streak: newStreak, last_play_date: today });
}

function getProgress(user, stats) {
  return {
    total_wagered:    stats.total_wagered    || 0,
    blackjack_wins:   stats.blackjack_wins   || 0,
    blackjacks_count: stats.blackjacks_count || 0,
    wheel_spins:      stats.wheel_spins      || 0,
    daily_streak:     user.daily_streak      || 0,
  };
}

module.exports = { CHALLENGE_TRACKS, USER_STATS, updateDailyStreak, getProgress };
