import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logoDefender from '@/assets/logo-defender.png';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: 'Correo enviado', description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar el correo. Verifica tu dirección.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-foreground rounded-2xl p-4 mb-3 shadow-elevated w-full max-w-[220px] flex items-center justify-center">
            <img src={logoDefender} alt="Defender Seguridad Privada" className="w-full h-auto" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Recuperar contraseña</p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card">
          {sent ? (
            <div className="text-center space-y-3">
              <Mail className="w-12 h-12 text-primary mx-auto" />
              <p className="text-sm text-foreground font-semibold">¡Correo enviado!</p>
              <p className="text-xs text-muted-foreground">Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 text-base" />
              </div>
              <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-semibold hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
