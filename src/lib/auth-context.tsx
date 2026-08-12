import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type UserRole = 'guardia' | 'supervisor' | 'admin' | 'cliente';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  numeroEmpleado: string;
  role: UserRole;
  email: string;
  avatarUrl: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

interface RegisterData {
  nombre: string;
  apellido: string;
  numeroEmpleado: string;
  email: string;
  password: string;
  role: UserRole;
}

/**
 * El contexto se guarda en un singleton global: si HMR recarga este módulo,
 * las copias duplicadas siguen compartiendo la MISMA instancia de contexto y
 * los consumidores no pierden el provider ("useAuth must be used within...").
 */
const g = globalThis as unknown as { __authCtx?: React.Context<AuthContextType | undefined> };
const AuthContext = g.__authCtx ?? (g.__authCtx = createContext<AuthContextType | undefined>(undefined));

/** Cross-tab bus for auth events (logout in one tab -> propagate to others). */
const AUTH_BUS = 'defender-auth-bus';

async function fetchUserProfile(userId: string): Promise<User | null> {
  const [{ data: profile }, { data: roleData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
  ]);

  if (!profile) return null;

  return {
    id: userId,
    nombre: profile.nombre,
    apellido: profile.apellido,
    numeroEmpleado: profile.numero_empleado,
    role: (roleData?.role as UserRole) || 'guardia',
    email: profile.email,
    avatarUrl: (profile as any).avatar_url || '',
  };
}

/**
 * Fully clear client-side traces of a session:
 * - localStorage keys used by Supabase auth (sb-*-auth-token)
 * - any legacy demo keys used by this app
 * - service worker caches (best-effort)
 * The Supabase SDK already removes its own key, but browsers occasionally
 * keep stale copies when logout coincides with a network error, so we do a
 * belt-and-braces cleanup.
 */
async function purgeLocalSession() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('defender-user');
  } catch {
    /* localStorage may be unavailable in private mode */
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.includes('supabase')).map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  }
}

const SESSION_TOKEN_KEY = 'defender-session-token';

/** Genera un token de sesión y lo registra como la sesión activa del usuario. */
async function claimActiveSession(userId: string): Promise<string> {
  const token = (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random()}`;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  await supabase.from('profiles').update({ active_session_id: token } as any).eq('user_id', userId);
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const busRef = useRef<BroadcastChannel | null>(null);
  const sessionWatchRef = useRef<number | null>(null);

  // Announce logout across tabs so every open window returns to /login together.
  const broadcastLogout = useCallback(() => {
    try {
      busRef.current?.postMessage({ type: 'signed_out' });
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Cierra la sesión local si otra sesión tomó el lugar.
   * Reglas: si el token guardado en el perfil difiere del local => forzar logout.
   */
  const enforceSingleSession = useCallback(async (userId: string) => {
    const local = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!local) return;
    const { data } = await supabase
      .from('profiles')
      .select('active_session_id')
      .eq('user_id', userId)
      .maybeSingle();
    const remote = (data as any)?.active_session_id;
    if (remote && remote !== local) {
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
      await purgeLocalSession();
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setUser(null);
      toast.error('Tu sesión se cerró: se inició sesión en otro dispositivo.');
    }
  }, []);

  useEffect(() => {
    // Cross-tab channel: if the user signs out in tab A, tab B should follow.
    if (typeof BroadcastChannel !== 'undefined') {
      busRef.current = new BroadcastChannel(AUTH_BUS);
      busRef.current.onmessage = (ev) => {
        if (ev.data?.type === 'signed_out') {
          setUser(null);
        }
      };
    }

    // 1) Subscribe FIRST so we never miss an event fired during bootstrap.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer any Supabase call to avoid deadlocks inside the auth callback.
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        // Silent success — refresh token still valid, nothing else to do.
        return;
      }

      if (session?.user) {
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
          setLoading(false);
          if (event === 'SIGNED_IN') {
            // Nuevo login en esta pestaña => reclamar sesión (invalida las demás).
            await claimActiveSession(session.user.id);
          } else {
            await enforceSingleSession(session.user.id);
          }
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // 2) THEN restore any persisted session.
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          await purgeLocalSession();
          setUser(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
          await enforceSingleSession(session.user.id);
        }
        setLoading(false);
      })
      .catch(async () => {
        await purgeLocalSession();
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
      busRef.current?.close();
      busRef.current = null;
      if (sessionWatchRef.current) window.clearInterval(sessionWatchRef.current);
    };
  }, [enforceSingleSession]);

  // Vigilar cambios de sesión: cada 20s + al volver el foco.
  useEffect(() => {
    if (!user) return;
    const check = () => enforceSingleSession(user.id);
    sessionWatchRef.current = window.setInterval(check, 20000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      if (sessionWatchRef.current) window.clearInterval(sessionWatchRef.current);
      sessionWatchRef.current = null;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user, enforceSingleSession]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Registrar el inicio de sesión (con dispositivo) en notificaciones y en la
    // bitácora inmutable de auditoría — fire-and-forget.
    if (data?.user) {
      const uid = data.user.id;
      const nombreVisible = data.user.email || 'Usuario';
      // Validación fotográfica de ingreso (la pantalla la muestra SessionCaptureGate).
      import('./sesion-registros')
        .then(({ marcarCapturaLoginPendiente }) => marcarCapturaLoginPendiente(uid))
        .catch(() => {});
      import('./notification-helpers')
        .then(({ notifySesionInicio }) => notifySesionInicio(uid, nombreVisible))
        .catch(() => {});
      import('./audit')
        .then(({ logAudit }) => logAudit({ accion: 'login', tabla: 'auth', registroId: uid }))
        .catch(() => {});
    }

    return true;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          numero_empleado: data.numeroEmpleado,
        },
      },
    });
    if (error) throw error;
    return true;
  };

  const logout = useCallback(async () => {
    // Validación fotográfica de salida (guardias): se ejecuta con la sesión
    // todavía activa para que RLS acepte la escritura del registro.
    try {
      const { getLogoutCaptureHandler } = await import('./sesion-registros');
      const capture = getLogoutCaptureHandler();
      if (capture) {
        const ok = await capture();
        if (!ok) return; // el usuario canceló el cierre de sesión
      }
    } catch { /* si falla la captura no bloqueamos el cierre */ }

    // Avisar a admin/supervisores del cierre de sesión ANTES de invalidar el
    // token (de lo contrario la escritura sería rechazada por RLS).
    if (user) {
      const nombre = `${user.nombre} ${user.apellido}`.trim() || user.email;
      try {
        const { notifySesionCierre, notifySesionCierreEnTurno } = await import('./notification-helpers');
        await notifySesionCierre(user.id, nombre, user.role);

        // Si el usuario tiene un turno activo, se genera una alerta adicional.
        const { data: turnoActivo } = await supabase
          .from('asistencias')
          .select('inicio, servicios:servicio_id (nombre)')
          .eq('guardia_id', user.id)
          .eq('status', 'activo')
          .order('inicio', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (turnoActivo) {
          const servicioNombre = (turnoActivo as any).servicios?.nombre as string | undefined;
          await notifySesionCierreEnTurno(user.id, nombre, servicioNombre, turnoActivo.inicio);
        }
      } catch { /* fire-and-forget */ }
      import('./audit')
        .then(({ logAudit }) => logAudit({ accion: 'logout', tabla: 'auth', registroId: user.id }))
        .catch(() => {});
    }
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* even if the network call fails we still want to clear locally */
    }
    await purgeLocalSession();
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    broadcastLogout();
    toast.success('Sesión cerrada correctamente');
  }, [broadcastLogout, user]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
