import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Navigate once auth is confirmed — avoids race condition
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      // Don't navigate here — the useEffect above handles it after profile loads
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Correo o contraseña incorrectos.',
        variant: 'destructive'
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-elevated bg-destructive">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground text-center">Defender Seguridad Privada</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistema de Seguridad Operativa</p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-xl p-6 shadow-card">
          <h2 className="text-lg font-display font-bold text-foreground mb-6">Iniciar Sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base" />
              
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 text-base pr-12" />
                
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="text-primary font-semibold hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>);

};

export default Login;