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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/rondines" element={<Rondines />} />
            <Route path="/reportes" element={<ReporteTurno />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat-rh" element={<ChatRH />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/mapa" element={<MapaSupervisor />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/reportes-supervisor" element={<ReportesSupervisor />} />
            <Route path="/servicios" element={<Servicios />} />
            <Route path="/gestion-rh" element={<GestionRH />} />
            <Route path="/notificaciones" element={<Notificaciones />} />
            <Route path="/visitas" element={<Visitas />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/estadisticas" element={<EstadisticasAdmin />} />
            <Route path="/actividad-guardia" element={<GuardActivityPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
