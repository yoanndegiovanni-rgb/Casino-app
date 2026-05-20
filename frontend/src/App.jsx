import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar        from './components/common/Navbar';
import SpinWheel     from './components/SpinWheel';
import Challenges    from './components/Challenges';
import Home          from './pages/Home';
import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import BlackjackPage from './pages/BlackjackPage';
import PokerPage     from './pages/PokerPage';
import RoulettePage  from './pages/RoulettePage';
import Leaderboard   from './pages/Leaderboard';
import ProfilePage   from './pages/ProfilePage';

function AppContent() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      {user && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: 0,
          transform: 'translateY(-50%)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <SpinWheel />
          <Challenges />
        </div>
      )}
      <main className="flex-1">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/login"       element={<LoginPage />} />
          <Route path="/register"    element={<RegisterPage />} />
          <Route path="/blackjack"   element={<BlackjackPage />} />
          <Route path="/poker"       element={<PokerPage />} />
          <Route path="/roulette"    element={<RoulettePage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile"     element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
