import { lazy, Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';

/**
 * Each role dashboard is a separate chunk: a guard never downloads the admin
 * charting/export code and vice versa (QA observation 6.1).
 */
const GuardDashboard = lazy(() => import('./GuardDashboard'));
const SupervisorDashboard = lazy(() => import('./SupervisorDashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const ClienteDashboard = lazy(() => import('./ClienteDashboard'));

const Dashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user?.role === 'admin') return <AdminDashboard />;
  if (user?.role === 'cliente') return <ClienteDashboard />;
  return user?.role === 'supervisor' ? <SupervisorDashboard /> : <GuardDashboard />;
};

export default Dashboard;
