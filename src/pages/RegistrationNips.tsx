import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Copy, Trash2, Plus, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import type { UserRole } from '@/lib/auth-context';

interface Nip {
  id: string;
  code: string;
  role: UserRole;
  label: string;
  used: boolean;
  used_at: string | null;
  used_by: string | null;
  expires_at: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<UserRole, string> = {
  guardia: 'Guardia',
  supervisor: 'Supervisor',
  admin: 'Administrador',
  cliente: 'Cliente',
};

const ROLE_BADGE: Record<UserRole, string> = {
  guardia: 'bg-primary/10 text-primary',
  supervisor: 'bg-secondary/10 text-secondary',
  admin: 'bg-emergency/10 text-emergency',
  cliente: 'bg-warning/10 text-warning',
};

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const RegistrationNips = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [nips, setNips] = useState<Nip[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState<UserRole>('guardia');
  const [newLabel, setNewLabel] = useState('');
  const [newDays, setNewDays] = useState('14');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('registration_nips' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setNips((data as any) || []);
    setLoading(false);
  };

  const create = async () => {
    if (!user) return;
    setCreating(true);
    const code = generateCode();
    const days = parseInt(newDays, 10);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const { error } = await supabase.from('registration_nips' as any).insert({
      code,
      role: newRole,
      label: newLabel.trim().slice(0, 80),
      expires_at,
      created_by: user.id,
    } as any);
    setCreating(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setNewLabel('');
    toast({ title: 'NIP generado', description: `Código: ${code}` });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('registration_nips' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'NIP eliminado' });
    load();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: 'Copiado', description: code });
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'destructive' });
    }
  };

  if (authLoading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const activos = nips.filter(n => !n.used && (!n.expires_at || new Date(n.expires_at) > new Date()));
  const usados = nips.filter(n => n.used);
  const vencidos = nips.filter(n => !n.used && n.expires_at && new Date(n.expires_at) <= new Date());

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader
        eyebrow="Administración"
        title="NIPs de Registro"
        subtitle="Genera códigos para que nuevos usuarios puedan registrarse"
        showBack
      />

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">
        {/* Crear */}
        <Card className="p-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Generar nuevo NIP
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Tipo de usuario</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full h-10 mt-1 rounded-lg border border-border bg-background px-2 text-sm"
              >
                <option value="guardia">Guardia</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Vence en (días)</label>
              <Input
                type="number"
                min={0}
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                className="h-10 mt-1"
                placeholder="0 = sin vencimiento"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground">Etiqueta (opcional)</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                maxLength={80}
                className="h-10 mt-1"
                placeholder="Ej. Cliente Walmart sucursal 23"
              />
            </div>
          </div>
          <Button onClick={create} disabled={creating} className="mt-3 w-full sm:w-auto">
            <KeyRound className="w-4 h-4 mr-2" />
            {creating ? 'Generando...' : 'Generar NIP'}
          </Button>
        </Card>

        {/* Activos */}
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            NIPs activos <span className="text-primary">({activos.length})</span>
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : activos.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground italic">No hay NIPs activos.</Card>
          ) : (
            <div className="space-y-2">
              {activos.map(n => <NipRow key={n.id} nip={n} onCopy={copy} onDelete={remove} />)}
            </div>
          )}
        </section>

        {/* Vencidos */}
        {vencidos.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Vencidos <span className="text-warning">({vencidos.length})</span>
            </h3>
            <div className="space-y-2">
              {vencidos.map(n => <NipRow key={n.id} nip={n} onCopy={copy} onDelete={remove} expired />)}
            </div>
          </section>
        )}

        {/* Usados */}
        {usados.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Usados <span className="text-success">({usados.length})</span>
            </h3>
            <div className="space-y-2">
              {usados.map(n => <NipRow key={n.id} nip={n} onCopy={copy} onDelete={remove} used />)}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

const NipRow = ({ nip, onCopy, onDelete, used, expired }: {
  nip: Nip;
  onCopy: (c: string) => void;
  onDelete: (id: string) => void;
  used?: boolean;
  expired?: boolean;
}) => (
  <Card className="p-3 flex items-center gap-3">
    <div
      className="font-mono text-lg font-bold tracking-widest text-foreground cursor-pointer select-all"
      onClick={() => !used && onCopy(nip.code)}
      title="Click para copiar"
    >
      {nip.code}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[nip.role]}`}>
          {ROLE_LABEL[nip.role]}
        </span>
        {used && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Usado
          </span>
        )}
        {expired && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning flex items-center gap-1">
            <Clock className="w-3 h-3" /> Vencido
          </span>
        )}
      </div>
      {nip.label && <p className="text-xs text-muted-foreground truncate mt-0.5">{nip.label}</p>}
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {used && nip.used_at
          ? `Usado ${format(new Date(nip.used_at), "dd MMM yyyy HH:mm", { locale: es })}`
          : nip.expires_at
            ? `Vence ${format(new Date(nip.expires_at), "dd MMM yyyy", { locale: es })}`
            : 'Sin vencimiento'}
      </p>
    </div>
    {!used && (
      <Button size="icon" variant="ghost" onClick={() => onCopy(nip.code)} title="Copiar">
        <Copy className="w-4 h-4" />
      </Button>
    )}
    <Button size="icon" variant="ghost" onClick={() => onDelete(nip.id)} title="Eliminar" className="text-emergency hover:text-emergency hover:bg-emergency/10">
      <Trash2 className="w-4 h-4" />
    </Button>
  </Card>
);

export default RegistrationNips;
