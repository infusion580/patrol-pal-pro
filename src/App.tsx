import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Rondines from "./pages/Rondines";
import ReporteTurno from "./pages/ReporteTurno";
import Chat from "./pages/Chat";
import DashboardOperativo from "./pages/DashboardOperativo";
import ChatRH from "./pages/ChatRH";
import Perfil from "./pages/Perfil";
import MapaSupervisor from "./pages/MapaSupervisor";
import Metricas from "./pages/Metricas";
import ReportesSupervisor from "./pages/ReportesSupervisor";
import Servicios from "./pages/Servicios";
import NotFound from "./pages/NotFound";
import GestionRH from "./pages/GestionRH";
import Notificaciones from "./pages/Notificaciones";
import Visitas from "./pages/Visitas";
import Historial from "./pages/Historial";
import EstadisticasAdmin from "./pages/EstadisticasAdmin";
import GuardActivityPage from "./pages/GuardActivityPage";
import MetasServicio from "./pages/MetasServicio";
import CuadroHonor from "./pages/CuadroHonor";
import ReporteAsistencias from "./pages/ReporteAsistencias";
import PendientesPuesto from "./pages/PendientesPuesto";
import RegistrationNips from "./pages/RegistrationNips";
import ClienteReporteConfig from "./pages/ClienteReporteConfig";

import GlobalZoneMonitor from "./components/GlobalZoneMonitor";
import RondinAlarmMonitor from "./components/RondinAlarmMonitor";
import ProtectedRoute from "./components/ProtectedRoute";
import ConnectionBanner from "./components/ConnectionBanner";
import OfflineQueueIndicator from "./components/OfflineQueueIndicator";
import { initOfflineQueue } from "./lib/offline-queue";

// Start replaying any pending offline writes as soon as the app boots.
initOfflineQueue();

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
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ConnectionBanner />
        <OfflineQueueIndicator />
        <GlobalZoneMonitor />
        <BrowserRouter>
          <RondinAlarmMonitor />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

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
            <Route path="/cliente-reporte-config" element={<ProtectedRoute roles={['admin']}><ClienteReporteConfig /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

