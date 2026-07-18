import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * Optional list of roles allowed to see this route.
   * If omitted, any authenticated user can enter.
   */
  roles?: UserRole[];
}

/**
 * Wraps a route so only authenticated users can access it.
 * - While the session is being restored: shows a loader (avoids flashing /login).
 * - If the session has expired or the user logged out: redirects to /login
 *   and preserves the intended destination in `location.state.from` so we can
 *   return the user there after re-authenticating.
 * - If `roles` is provided and the current user does not match: redirects to
 *   /dashboard so unauthorized areas cannot be reached by URL guessing.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
