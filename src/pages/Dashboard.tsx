import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import GuardDashboard from './GuardDashboard';
import SupervisorDashboard from './SupervisorDashboard';
import AdminDashboard from './AdminDashboard';

const Dashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.role === 'admin') return <AdminDashboard />;
  return user?.role === 'supervisor' ? <SupervisorDashboard /> : <GuardDashboard />;
};

export default Dashboard;
