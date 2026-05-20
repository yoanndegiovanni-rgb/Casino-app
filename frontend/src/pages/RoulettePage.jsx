import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RouletteTable from '../components/roulette/RouletteTable';

export default function RoulettePage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <RouletteTable />;
}
