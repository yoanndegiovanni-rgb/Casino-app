import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BlackjackTable from '../components/blackjack/BlackjackTable';

export default function BlackjackPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <BlackjackTable />;
}
