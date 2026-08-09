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

const Loader = () => (
  <div className="min-h-dvh flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
);

const Dashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const RoleDashboard =
    user?.role === 'admin' ? AdminDashboard
    : user?.role === 'cliente' ? ClienteDashboard
    : user?.role === 'supervisor' ? SupervisorDashboard
    : GuardDashboard;

  return (
    <Suspense fallback={<Loader />}>
      <RoleDashboard />
    </Suspense>
  );
};

export default Dashboard;
