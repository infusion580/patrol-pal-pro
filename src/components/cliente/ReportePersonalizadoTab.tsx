/**
 * Pestaña "REPORTE" del Perfil del Cliente.
 *
 * Un solo componente con dos modos:
 *  - mode="admin"  → redacta, guarda, publica y descarga el reporte del cliente.
 *  - mode="cliente"→ consulta y descarga los reportes publicados.
 *
 * Toda la lógica de datos vive en `@/lib/cliente-reporte-personalizado`, de modo
 * que agregar secciones nuevas no requiere tocar este archivo.
 */
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/lib/branding';
import { FileText, Download, Save, Send, Trash2, Plus, RefreshCw } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  REPORTE_SECCIONES,
  buildMetrics,
  descargarReportePersonalizadoPdf,
  eliminarReporte,
  guardarReporte,
  listarReportes,
  seccionesPorDefecto,
  type ClienteReporte,
  type MetricasPorSeccion,
  type SeccionReporte,
} from '@/lib/cliente-reporte-personalizado';

interface Props {
  clienteId: string;
  clienteNombre: string;
  mode: 'admin' | 'cliente';
  /** Nombre de quien redacta (sólo modo admin) */
  autorId?: string;
  autorNombre?: string;
}

const hoy = () => format(new Date(), 'yyyy-MM-dd');

const ReportePersonalizadoTab = ({ clienteId, clienteNombre, mode, autorId, autorNombre }: Props) => {
  const { toast } = useToast();
  const { logoUrl, colors } = useBranding();

  const [reportes, setReportes] = useState<ClienteReporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Editor (modo admin)
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('Reporte de servicios de seguridad');
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(hoy());
  const [secciones, setSecciones] = useState<SeccionReporte[]>(seccionesPorDefecto());
  const [metrics, setMetrics] = useState<MetricasPorSeccion>({});

  const cargar = useCallback(async () => {
    setLoading(true);
    setReportes(await listarReportes(clienteId));
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarMetricas = useCallback(async (d: string, h: string) => {
    const { metrics } = await buildMetrics(clienteId, new Date(`${d}T12:00:00`), new Date(`${h}T12:00:00`));
    setMetrics(metrics);
    return metrics;
  }, [clienteId]);

  useEffect(() => {
    if (mode === 'admin') cargarMetricas(desde, hasta);
  }, [mode, desde, hasta, cargarMetricas]);

  // ---------------- acciones admin ----------------
  const nuevo = () => {
    setEditId(null);
    setTitulo('Reporte de servicios de seguridad');
    setDesde(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setHasta(hoy());
    setSecciones(seccionesPorDefecto());
  };

  const editar = (r: ClienteReporte) => {
    setEditId(r.id);
    setTitulo(r.titulo);
    setDesde(r.periodo_inicio);
    setHasta(r.periodo_fin);
    setSecciones(r.secciones);
  };

  const persistir = async (estado: 'borrador' | 'publicado') => {
    setBusy(true);
    const saved = await guardarReporte({
      id: editId ?? undefined,
      cliente_id: clienteId,
      titulo,
      periodo_inicio: desde,
      periodo_fin: hasta,
      estado,
      secciones,
      autor_id: autorId ?? null,
      autor_nombre: autorNombre ?? '',
    });
    setBusy(false);
    if (!saved) { toast({ title: 'No se pudo guardar', variant: 'destructive' }); return; }
    setEditId(saved.id);
    toast({ title: estado === 'publicado' ? 'Reporte publicado' : 'Borrador guardado' });
    cargar();
  };

  const borrar = async (id: string) => {
    await eliminarReporte(id);
    if (editId === id) nuevo();
    toast({ title: 'Reporte eliminado' });
    cargar();
  };

  const descargar = async (r: ClienteReporte) => {
    setBusy(true);
    const m = await cargarMetricas(r.periodo_inicio, r.periodo_fin);
    await descargarReportePersonalizadoPdf({
      reporte: r, clienteNombre, metrics: m, logoUrl, primaryHsl: colors.primary_hsl,
    });
    setBusy(false);
  };

  const descargarBorradorActual = async () => {
    setBusy(true);
    const m = await cargarMetricas(desde, hasta);
    await descargarReportePersonalizadoPdf({
      reporte: {
        id: editId || 'preview', cliente_id: clienteId, titulo,
        periodo_inicio: desde, periodo_fin: hasta, estado: 'borrador',
        secciones, autor_nombre: autorNombre || '', publicado_at: null,
        created_at: '', updated_at: '',
      },
      clienteNombre, metrics: m, logoUrl, primaryHsl: colors.primary_hsl,
    });
    setBusy(false);
  };

  const setSeccion = (key: string, patch: Partial<SeccionReporte>) =>
    setSecciones(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));

  // ---------------- vista cliente ----------------
  if (mode === 'cliente') {
    const publicados = reportes.filter(r => r.estado === 'publicado');
    return (
      <div className="space-y-3 mt-3">
        <Card className="p-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Reportes del periodo
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Reportes elaborados por tu proveedor de seguridad. Descárgalos en PDF.
          </p>
        </Card>

        {loading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Cargando…</Card>
        ) : publicados.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay reportes publicados para tu cuenta.
          </Card>
        ) : (
          publicados.map(r => (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{r.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(`${r.periodo_inicio}T12:00:00`), "dd MMM yyyy", { locale: es })} –{' '}
                  {format(new Date(`${r.periodo_fin}T12:00:00`), "dd MMM yyyy", { locale: es })}
                  {r.autor_nombre ? ` · ${r.autor_nombre}` : ''}
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => descargar(r)}>
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </Card>
          ))
        )}
      </div>
    );
  }

  // ---------------- vista admin ----------------
  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {editId ? 'Editar reporte' : 'Nuevo reporte personalizado'}
          </h3>
          <Button variant="outline" size="sm" onClick={nuevo}><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase text-muted-foreground">Título</label>
          <Input value={titulo} onChange={e => setTitulo(e.target.value)} className="mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => cargarMetricas(desde, hasta)}>
          <RefreshCw className="w-4 h-4 mr-2" /> Actualizar datos del sistema
        </Button>
      </Card>

      {/* Secciones */}
      {secciones.map(s => {
        const cat = REPORTE_SECCIONES.find(c => c.key === s.key)!;
        const datos = metrics[s.key] || [];
        return (
          <Card key={s.key} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground">{cat.titulo}</p>
                <p className="text-xs text-muted-foreground">{cat.descripcion}</p>
              </div>
              <Switch checked={s.incluir} onCheckedChange={v => setSeccion(s.key, { incluir: v })} />
            </div>

            {s.incluir && (
              <>
                <Textarea
                  value={s.texto}
                  onChange={e => setSeccion(s.key, { texto: e.target.value })}
                  placeholder="Escribe aquí el texto de esta sección…"
                  rows={3}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Incluir datos del sistema ({datos.length} indicadores)
                  </span>
                  <Switch checked={s.incluir_datos} onCheckedChange={v => setSeccion(s.key, { incluir_datos: v })} />
                </div>
                {s.incluir_datos && datos.length > 0 && (
                  <div className="rounded-lg bg-accent/40 p-2 space-y-1">
                    {datos.map((d, i) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground truncate">{d.label}</span>
                        <span className="font-semibold text-foreground">{d.valor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => persistir('borrador')}>
          <Save className="w-4 h-4 mr-2" /> Guardar borrador
        </Button>
        <Button disabled={busy} onClick={() => persistir('publicado')}>
          <Send className="w-4 h-4 mr-2" /> Publicar al cliente
        </Button>
        <Button variant="secondary" disabled={busy} onClick={descargarBorradorActual}>
          <Download className="w-4 h-4 mr-2" /> Descargar PDF
        </Button>
      </div>

      {/* Historial */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm text-foreground mb-2">Reportes de este cliente</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : reportes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aún no hay reportes.</p>
        ) : (
          <div className="divide-y divide-border">
            {reportes.map(r => (
              <div key={r.id} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.periodo_inicio} → {r.periodo_fin}
                  </p>
                </div>
                <Badge variant={r.estado === 'publicado' ? 'default' : 'secondary'}>{r.estado}</Badge>
                <Button size="sm" variant="ghost" onClick={() => editar(r)}>Editar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => descargar(r)}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => borrar(r.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReportePersonalizadoTab;
