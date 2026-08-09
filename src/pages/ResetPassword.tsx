import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBrandLogo } from '@/lib/branding';

const ResetPassword = () => {
  const logoDefender = useBrandLogo();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setIsRecovery(true);
        setLinkError(null);
      }
    });

    const resolveLink = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);

      // 1) Errores devueltos por el proveedor (enlace vencido o ya usado)
      const errDesc = hashParams.get('error_description') || queryParams.get('error_description');
      if (errDesc) {
        setLinkError(decodeURIComponent(errDesc));
        return;
      }

      // 2) Flujo implícito: tokens en el hash
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) return setLinkError('El enlace de recuperación no es válido o ya expiró.');
        setIsRecovery(true);
        window.history.replaceState({}, '', '/reset-password');
        return;
      }

      // 3) Flujo PKCE: ?code=
      const code = queryParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return setLinkError('El enlace de recuperación no es válido o ya expiró.');
        setIsRecovery(true);
        window.history.replaceState({}, '', '/reset-password');
        return;
      }

      // 4) Enlace con token_hash (verificación por OTP)
      const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
        if (error) return setLinkError('El enlace de recuperación no es válido o ya expiró.');
        setIsRecovery(true);
        window.history.replaceState({}, '', '/reset-password');
        return;
      }

      // 5) Sesión de recuperación ya activa
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsRecovery(true);
        return;
      }

      setLinkError('Abre el enlace que enviamos a tu correo para restablecer tu contraseña.');
    };

    resolveLink();
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Contraseña actualizada', description: 'Tu contraseña ha sido cambiada exitosamente.' });
      navigate('/dashboard');
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar la contraseña. Intenta de nuevo.', variant: 'destructive' });
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Verificando enlace de recuperación...</p>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoDefender}
            alt="Defender Seguridad Privada"
            className="h-auto mb-3 drop-shadow-[0_8px_24px_hsl(0_82%_52%/0.45)]"
            style={{ width: 'clamp(160px, 55vw, 240px)' }}
          />
          <p className="text-xs text-muted-foreground mt-1">Establecer nueva contraseña</p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 text-base pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-12 text-base" />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
