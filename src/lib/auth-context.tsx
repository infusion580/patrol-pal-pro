import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'guardia' | 'supervisor' | 'admin';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  numeroEmpleado: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
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

// Demo users for prototype
const DEMO_USERS: User[] = [
  { id: '1', nombre: 'Carlos', apellido: 'López', numeroEmpleado: 'EMP001', role: 'guardia', email: 'guardia@demo.com' },
  { id: '2', nombre: 'María', apellido: 'García', numeroEmpleado: 'SUP001', role: 'supervisor', email: 'supervisor@demo.com' },
  { id: '3', nombre: 'Roberto', apellido: 'Díaz', numeroEmpleado: 'ADM001', role: 'admin', email: 'admin@demo.com' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, _password: string): Promise<boolean> => {
    const found = DEMO_USERS.find(u => u.email === email);
    if (found) {
      setUser(found);
      return true;
    }
    // For demo, accept any login and default to guardia
    setUser({
      id: Date.now().toString(),
      nombre: 'Usuario',
      apellido: 'Demo',
      numeroEmpleado: 'EMP999',
      role: 'guardia',
      email,
    });
    return true;
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    setUser({
      id: Date.now().toString(),
      nombre: data.nombre,
      apellido: data.apellido,
      numeroEmpleado: data.numeroEmpleado,
      role: data.role,
      email: data.email,
    });
    return true;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
