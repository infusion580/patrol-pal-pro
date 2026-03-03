import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import GuardDashboard from './GuardDashboard';
import SupervisorDashboard from './SupervisorDashboard';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return user?.role === 'supervisor' ? <SupervisorDashboard /> : <GuardDashboard />;
};

export default Dashboard;
