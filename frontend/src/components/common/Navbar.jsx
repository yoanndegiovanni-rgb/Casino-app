import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="bg-casino-card border-b border-gold/20 px-4 py-3 flex items-center justify-between shadow-lg">
      <Link to="/" className="text-gold-glow text-2xl font-extrabold tracking-widest hover:opacity-90 transition">
        ♠ ROYAL CASINO
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <Link to="/blackjack" className="nav-link">Blackjack</Link>
            <Link to="/poker"     className="nav-link">Poker</Link>
            <Link to="/roulette"  className="nav-link">Roulette</Link>
            <Link to="/leaderboard" className="nav-link">Leaderboard</Link>

            <div className="flex items-center gap-2 bg-felt/50 px-3 py-1.5 rounded-full border border-gold/30">
              <span className="text-gold text-sm font-bold">💰 {user.balance?.toLocaleString()}</span>
              <span className="text-gray-400 text-sm">|</span>
              <Link to="/profile" className="text-gray-300 text-sm hover:text-white">{user.username}</Link>
            </div>

            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-400 text-sm transition"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className="nav-link">Login</Link>
            <Link to="/register" className="btn-gold px-4 py-1.5 rounded-full text-sm font-bold">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
