import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, UserRole } from '@/lib/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoDefender from '@/assets/logo-defender.png';

const ROLE_LABEL: Record<UserRole, string> = {
  guardia: 'Guardia',
  supervisor: 'Supervisor',
  admin: 'Administrador',
  cliente: 'Cliente',
};

const Register = () => {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    numeroEmpleado: '',
    email: '',
    password: '',
    role: 'guardia' as UserRole,
    nip: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroEmpleado.trim()) {
      toast({ title: 'Error', description: 'El número de empleado es obligatorio', variant: 'destructive' });
      return;
    }
    if (!form.nip.trim() || form.nip.trim().length < 4) {
      toast({ title: 'NIP requerido', description: 'Solicita tu NIP de registro a la empresa.', variant: 'destructive' });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // 1. Crear cuenta (siempre se asigna 'guardia' por defecto en el trigger)
      await register(form);

      // 2. Iniciar sesión para poder llamar a la función SECURITY DEFINER
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError || !signInData.user) throw signInError || new Error('No se pudo iniciar sesión');

      // 3. Consumir el NIP — esto valida y asigna el rol correcto
      const { data: assignedRole, error: nipError } = await supabase.rpc('consume_registration_nip' as any, {
        _code: form.nip.trim().toUpperCase(),
        _user_id: signInData.user.id,
      });
      if (nipError) {
        // Cuenta creada pero NIP inválido → cerrar sesión y avisar
        await supabase.auth.signOut();
        toast({
          title: 'NIP no válido',
          description: nipError.message || 'El NIP es incorrecto, ya fue usado o venció. Tu cuenta fue creada pero no activada — pide un NIP nuevo y vuelve a iniciar sesión.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      toast({
        title: '¡Cuenta creada!',
        description: `Bienvenido a SecureOps como ${ROLE_LABEL[(assignedRole as UserRole) || 'guardia']}.`,
      });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo crear la cuenta. Intenta de nuevo.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <img
            src={logoDefender}
            alt="Defender Seguridad Privada"
            className="h-auto mb-3 drop-shadow-[0_8px_24px_hsl(0_82%_52%/0.45)]"
            style={{ width: 'clamp(160px, 55vw, 240px)' }}
          />
          <p className="text-xs text-muted-foreground mt-1">Crear cuenta</p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" placeholder="Juan" value={form.nombre} onChange={(e) => update('nombre', e.target.value)} required className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apellido">Apellido</Label>
                <Input id="apellido" placeholder="Pérez" value={form.apellido} onChange={(e) => update('apellido', e.target.value)} required className="h-11" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="numEmp">Número de Empleado *</Label>
              <Input id="numEmp" placeholder="EMP001" value={form.numeroEmpleado} onChange={(e) => update('numeroEmpleado', e.target.value)} required className="h-11 font-mono" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Tipo de Usuario *</Label>
              <select
                id="role"
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                required
              >
                <option value="guardia">Guardia</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
                <option value="cliente">Cliente</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                El tipo final lo confirma el NIP que te entregó la empresa.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nip" className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                NIP de Registro *
              </Label>
              <Input
                id="nip"
                placeholder="Ej. AB12CD"
                value={form.nip}
                onChange={(e) => update('nip', e.target.value.toUpperCase())}
                required
                maxLength={20}
                className="h-11 font-mono tracking-widest uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Solicita este código a tu administrador.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" placeholder="tu@correo.com" value={form.email} onChange={(e) => update('email', e.target.value)} required className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña (mín. 6 caracteres)</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={(e) => update('password', e.target.value)} required className="h-11 pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
