import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding";

/**
 * Route-level code splitting: only Login and Dashboard-critical shells are part
 * of the initial bundle; every other screen is fetched on demand. This keeps
 * the first load small on slow mobile networks (QA observation 6.1).
 */
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Rondines = lazy(() => import("./pages/Rondines"));
const ReporteTurno = lazy(() => import("./pages/ReporteTurno"));
const Chat = lazy(() => import("./pages/Chat"));
const DashboardOperativo = lazy(() => import("./pages/DashboardOperativo"));
const ChatRH = lazy(() => import("./pages/ChatRH"));
const Perfil = lazy(() => import("./pages/Perfil"));
const MapaSupervisor = lazy(() => import("./pages/MapaSupervisor"));
const Metricas = lazy(() => import("./pages/Metricas"));
const ReportesSupervisor = lazy(() => import("./pages/ReportesSupervisor"));
const Servicios = lazy(() => import("./pages/Servicios"));
const GestionRH = lazy(() => import("./pages/GestionRH"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));
const Visitas = lazy(() => import("./pages/Visitas"));
const Historial = lazy(() => import("./pages/Historial"));
const EstadisticasAdmin = lazy(() => import("./pages/EstadisticasAdmin"));
const GuardActivityPage = lazy(() => import("./pages/GuardActivityPage"));
const MetasServicio = lazy(() => import("./pages/MetasServicio"));
const CuadroHonor = lazy(() => import("./pages/CuadroHonor"));
const ReporteAsistencias = lazy(() => import("./pages/ReporteAsistencias"));
const PendientesPuesto = lazy(() => import("./pages/PendientesPuesto"));
const RegistrationNips = lazy(() => import("./pages/RegistrationNips"));
const ClienteReporteConfig = lazy(() => import("./pages/ClienteReporteConfig"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Branding = lazy(() => import("./pages/Branding"));
const SoporteConfig = lazy(() => import("./pages/SoporteConfig"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));


/** Lightweight placeholder while a route chunk downloads. */
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
  </div>
);

import GlobalZoneMonitor from "./components/GlobalZoneMonitor";
import RondinAlarmMonitor from "./components/RondinAlarmMonitor";
import GlobalAlertSound from "./components/GlobalAlertSound";
import ProtectedRoute from "./components/ProtectedRoute";
import ConnectionBanner from "./components/ConnectionBanner";
import SoporteChat from "./components/SoporteChat";
import OfflineQueueIndicator from "./components/OfflineQueueIndicator";
import { initOfflineQueue } from "./lib/offline-queue";
import { initPhotoQueue } from "./lib/offline-photo-queue";
import { initErrorMonitor } from "./lib/error-monitor";
import { initRealtimeManager } from "./lib/realtime";

// Start replaying any pending offline writes / photo uploads on boot.
initOfflineQueue();
initPhotoQueue();
initErrorMonitor();
initRealtimeManager();

/**
 * Global react-query defaults tuned for a long-lived operational app:
 *  - `refetchOnReconnect`: re-sync when the network returns.
 *  - `refetchOnWindowFocus`: refresh when the user returns to the tab.
 *  - `staleTime` 30s: avoids thrashing during rapid navigation.
 *  - `retry` with backoff: survives transient blips without user action.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: 1 },
  },
});

/** Helper: any authenticated user. */
const Auth = ({ children }: { children: JSX.Element }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrandingProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ConnectionBanner />
        <OfflineQueueIndicator />
        <GlobalZoneMonitor />
        <GlobalAlertSound />
        <BrowserRouter>
          <RondinAlarmMonitor />
          <SoporteChat />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />


            {/* Authenticated — any role */}
            <Route path="/dashboard" element={<Auth><Dashboard /></Auth>} />
            <Route path="/rondines" element={<Auth><Rondines /></Auth>} />
            <Route path="/reportes" element={<Auth><ReporteTurno /></Auth>} />
            <Route path="/chat" element={<Auth><Chat /></Auth>} />
            <Route path="/chat-rh" element={<Auth><ChatRH /></Auth>} />
            <Route path="/perfil" element={<Auth><Perfil /></Auth>} />
            <Route path="/notificaciones" element={<Auth><Notificaciones /></Auth>} />
            <Route path="/historial" element={<Auth><Historial /></Auth>} />
            <Route path="/actividad-guardia" element={<Auth><GuardActivityPage /></Auth>} />
            <Route path="/cuadro-honor" element={<Auth><CuadroHonor /></Auth>} />
            <Route path="/pendientes" element={<Auth><PendientesPuesto /></Auth>} />
            <Route path="/visitas" element={<Auth><Visitas /></Auth>} />

            {/* Role-scoped */}
            <Route path="/mapa" element={<ProtectedRoute roles={['supervisor', 'admin']}><MapaSupervisor /></ProtectedRoute>} />
            <Route path="/metricas" element={<ProtectedRoute roles={['supervisor', 'admin']}><Metricas /></ProtectedRoute>} />
            <Route path="/reportes-supervisor" element={<ProtectedRoute roles={['supervisor', 'admin']}><ReportesSupervisor /></ProtectedRoute>} />
            <Route path="/dashboard-operativo" element={<ProtectedRoute roles={['supervisor', 'admin']}><DashboardOperativo /></ProtectedRoute>} />
            <Route path="/gestion-rh" element={<ProtectedRoute roles={['supervisor', 'admin']}><GestionRH /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute roles={['supervisor', 'admin']}><MetasServicio /></ProtectedRoute>} />
            <Route path="/reporte-asistencias" element={<ProtectedRoute roles={['supervisor', 'admin']}><ReporteAsistencias /></ProtectedRoute>} />
            <Route path="/servicios" element={<ProtectedRoute roles={['admin']}><Servicios /></ProtectedRoute>} />
            <Route path="/estadisticas" element={<ProtectedRoute roles={['admin']}><EstadisticasAdmin /></ProtectedRoute>} />
            <Route path="/nips" element={<ProtectedRoute roles={['admin']}><RegistrationNips /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute roles={['admin']}><AuditLog /></ProtectedRoute>} />
            <Route path="/identidad" element={<ProtectedRoute roles={['admin']}><Branding /></ProtectedRoute>} />
            <Route path="/soporte-config" element={<ProtectedRoute roles={['admin']}><SoporteConfig /></ProtectedRoute>} />
            <Route path="/cliente-reporte-config" element={<ProtectedRoute roles={['admin']}><ClienteReporteConfig /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </BrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

