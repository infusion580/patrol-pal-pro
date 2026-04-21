import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, UserRole } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Register = () => {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    numeroEmpleado: '',
    email: '',
    password: '',
    role: 'guardia' as UserRole // Always guardia - role is enforced server-side
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
    if (form.password.length < 6) {
      toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast({ title: '¡Cuenta creada!', description: 'Bienvenido a SecureOps' });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({ title: 'Error', description: 'No se pudo crear la cuenta. Intenta de nuevo.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-elevated bg-destructive">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-display font-bold text-foreground text-center">Defender Seguridad Privada</h1>
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
    </div>);

};

export default Register;