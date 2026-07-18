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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const busRef = useRef<BroadcastChannel | null>(null);

  // Announce logout across tabs so every open window returns to /login together.
  const broadcastLogout = useCallback(() => {
    try {
      busRef.current?.postMessage({ type: 'signed_out' });
    } catch {
      /* ignore */
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
          // Refresh token was rejected (expired/revoked): treat as signed out.
          await purgeLocalSession();
          setUser(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
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
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
    try {
      // `scope: 'local'` avoids invalidating other devices' sessions —
      // matches the "logout from this browser" UX and keeps mobile logged in.
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* even if the network call fails we still want to clear locally */
    }
    await purgeLocalSession();
    setUser(null);
    broadcastLogout();
    toast.success('Sesión cerrada correctamente');
  }, [broadcastLogout]);

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
