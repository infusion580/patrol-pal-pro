import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import GuardDashboard from './GuardDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import AdminDashboard from './AdminDashboard';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.role === 'admin') return <AdminDashboard />;
  return user?.role === 'supervisor' ? <SupervisorDashboard /> : <GuardDashboard />;
};

export default Dashboard;
