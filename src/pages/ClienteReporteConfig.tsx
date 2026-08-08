import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Eye, Users } from 'lucide-react';
import {
  REPORT_SECTIONS,
  defaultClienteReportConfig,
  loadClienteReportConfig,
  type ClienteReportConfig,
  type ClienteReportSectionKey,
} from '@/lib/cliente-report-config';

interface ClienteRow {
  user_id: string;
  nombre: string;
  apellido: string;
  email: string;
}

/**
 * Admin > Configuración de Reporte del Cliente
 *
 * Permite al admin elegir qué secciones del Portal Cliente son visibles
 * para cada usuario cliente. Guarda un registro por cliente en
 * `cliente_reporte_config` (upsert). Los cambios se aplican la próxima vez
 * que el cliente abra su dashboard.
 */
const ClienteReporteConfig = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<ClienteReportConfig>(defaultClienteReportConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- Data loading ----
  useEffect(() => { if (user) loadClientes(); }, [user]);

  const loadClientes = async () => {
    setLoading(true);
    // Traer todos los usuarios con rol 'cliente'
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'cliente');
    const ids = (roles || []).map(r => r.user_id);
    if (ids.length === 0) { setClientes([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, nombre, apellido, email')
      .in('user_id', ids);

    const sorted = (profiles || []).sort((a, b) =>
      `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    );
    setClientes(sorted);
    if (sorted.length && !selectedId) selectCliente(sorted[0].user_id);
    setLoading(false);
  };

  const selectCliente = async (clienteId: string) => {
    setSelectedId(clienteId);
    const cfg = await loadClienteReportConfig(clienteId);
    setConfig(cfg);
  };

  // ---- Actions ----
  const toggle = (key: ClienteReportSectionKey) =>
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const setAll = (value: boolean) => {
    const next = { ...config };
    REPORT_SECTIONS.forEach(s => { next[s.key] = value; });
    setConfig(next);
  };

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    const { error } = await supabase
      .from('cliente_reporte_config' as any)
      .upsert({ cliente_id: selectedId, ...config }, { onConflict: 'cliente_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Configuración guardada', description: 'El cliente verá estos cambios al recargar su portal.' });
  };

  // ---- Derived ----
  const grouped = useMemo(() => {
    const map: Record<string, typeof REPORT_SECTIONS> = {};
    REPORT_SECTIONS.forEach(s => {
      (map[s.group] ||= []).push(s);
    });
    return map;
  }, []);

  const selectedCliente = clientes.find(c => c.user_id === selectedId);
  const visibles = REPORT_SECTIONS.filter(s => config[s.key]).length;

  // ---- Render ----
  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader
        eyebrow="Administración"
        title="Reporte del Cliente"
        subtitle="Elige qué información verá cada cliente en su portal"
      />

      <div className="max-w-5xl mx-auto px-4 -mt-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver al panel
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <Card className="p-6 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <h3 className="font-semibold text-foreground">No hay clientes registrados</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Genera un NIP con rol "cliente" y pídele que se registre para poder configurar su reporte.
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr] gap-4">
            {/* Lista de clientes */}
            <Card className="p-2 h-fit md:sticky md:top-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1">
                Clientes ({clientes.length})
              </p>
              <div className="max-h-[70vh] overflow-y-auto space-y-1">
                {clientes.map(c => (
                  <button
                    key={c.user_id}
                    onClick={() => selectCliente(c.user_id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                      c.user_id === selectedId
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <p className="truncate">{c.nombre} {c.apellido}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Panel de secciones */}
            <div className="space-y-3">
              {selectedCliente && (
                <Card className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {selectedCliente.nombre} {selectedCliente.apellido}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Eye className="w-3 h-3" />
                        {visibles} de {REPORT_SECTIONS.length} secciones visibles
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAll(true)}>Marcar todo</Button>
                      <Button size="sm" variant="outline" onClick={() => setAll(false)}>Ocultar todo</Button>
                    </div>
                  </div>
                </Card>
              )}

              {Object.entries(grouped).map(([group, sections]) => (
                <Card key={group} className="p-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    {group}
                  </h4>
                  <div className="space-y-3">
                    {sections.map(s => (
                      <label
                        key={s.key}
                        className="flex items-start justify-between gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{s.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        </div>
                        <Switch
                          checked={config[s.key]}
                          onCheckedChange={() => toggle(s.key)}
                        />
                      </label>
                    ))}
                  </div>
                </Card>
              ))}

              <div className="sticky bottom-20 md:bottom-4">
                <Button onClick={save} disabled={saving || !selectedId} className="w-full h-12 shadow-elevated">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando…' : 'Guardar configuración'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ClienteReporteConfig;
