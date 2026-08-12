import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, Clock, Download, MapPin, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/lib/branding';
import { generateReportPdf } from '@/lib/pdf-report';
import { SignedImg } from '@/components/SignedImg';
import BottomNav from '@/components/BottomNav';
import { formatFechaHora, listNovedades, type Novedad } from '@/lib/novedades';

/**
 * Consulta de reportes de novedades (admin y supervisor).
 * Permite filtrar por fecha o rango de fechas y por guardia,
 * y descargar el reporte en PDF con la identidad de marca.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);
const hace7ISO = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

interface GuardiaOption {
  user_id: string;
  nombre: string;
}

const NovedadesReportes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logoUrl, colors } = useBranding();

  const [desde, setDesde] = useState(hace7ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [guardiaId, setGuardiaId] = useState('');
  const [soloImportantes, setSoloImportantes] = useState(false);

  const [guardias, setGuardias] = useState<GuardiaOption[]>([]);
  const [servicios, setServicios] = useState<Record<string, string>>({});
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: svcs }] = await Promise.all([
        supabase.from('profiles').select('user_id, nombre, apellido').order('nombre'),
        supabase.from('servicios').select('id, nombre'),
      ]);
      setGuardias(
        (profiles || []).map((p: any) => ({
          user_id: p.user_id,
          nombre: `${p.nombre} ${p.apellido}`.trim() || 'Sin nombre',
        })),
      );
      setServicios(Object.fromEntries((svcs || []).map((s: any) => [s.id, s.nombre])));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNovedades({
        desde,
        hasta,
        guardiaId: guardiaId || null,
        importancia: soloImportantes ? 'importante' : null,
      });
      setNovedades(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las novedades.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, guardiaId, soloImportantes, toast]);

  useEffect(() => { load(); }, [load]);

  const nombreDe = useCallback(
    (id: string) => guardias.find((g) => g.user_id === id)?.nombre || 'Guardia',
    [guardias],
  );

  const importantes = useMemo(
    () => novedades.filter((n) => n.importancia === 'importante').length,
    [novedades],
  );

  /** Agrupa por guardia + día: cada bloque del PDF es una jornada. */
  const grupos = useMemo(() => {
    const map = new Map<string, { guardia: string; fecha: string; items: Novedad[] }>();
    for (const n of [...novedades].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const fecha = formatFechaHora(n.created_at).fecha;
      const key = `${n.guardia_id}|${fecha}`;
      if (!map.has(key)) map.set(key, { guardia: nombreDe(n.guardia_id), fecha, items: [] });
      map.get(key)!.items.push(n);
    }
    return Array.from(map.values());
  }, [novedades, nombreDe]);

  const exportarPdf = async () => {
    setExporting(true);
    try {
      await generateReportPdf({
        title: 'Reporte de Novedades',
        subtitle: 'Novedades registradas durante los turnos',
        logoUrl,
        primaryHsl: colors.primary_hsl,
        meta: [
          { label: 'Periodo', value: desde === hasta ? desde : `${desde} a ${hasta}` },
          { label: 'Guardia', value: guardiaId ? nombreDe(guardiaId) : 'Todos' },
          { label: 'Total de novedades', value: String(novedades.length) },
          { label: 'Novedades importantes', value: String(importantes) },
        ],
        sections: grupos.length
          ? grupos.map((g) => {
              const horas = g.items.map((i) => new Date(i.created_at).getTime());
              const inicio = formatFechaHora(new Date(Math.min(...horas)).toISOString()).hora;
              const fin = formatFechaHora(new Date(Math.max(...horas)).toISOString()).hora;
              return {
                title: `${g.guardia} — ${g.fecha} (de ${inicio} a ${fin})`,
                columns: ['Hora', 'Importancia', 'Novedad', 'Ubicación', 'Coordenadas', 'Servicio', 'Evidencia'],
                rows: g.items.map((n) => [
                  formatFechaHora(n.created_at).hora,
                  n.importancia === 'importante' ? 'IMPORTANTE' : 'Normal',
                  n.descripcion,
                  n.ubicacion_texto || '—',
                  n.lat && n.lng ? `${n.lat.toFixed(5)}, ${n.lng.toFixed(5)}` : '—',
                  n.servicio_id ? servicios[n.servicio_id] || '—' : '—',
                  n.foto_url ? 'Sí' : 'No',
                ]),
              };
            })
          : [
              {
                title: 'Detalle',
                columns: ['Hora', 'Novedad'],
                rows: [],
                emptyText: 'Sin novedades registradas en el periodo seleccionado.',
              },
            ],
        footerNote: 'Reporte de novedades · Defender Seguridad Privada',
        fileName: `novedades-${desde}_${hasta}.pdf`,
      });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="text-primary-foreground px-4 pt-12 pb-6 rounded-b-3xl app-header">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm opacity-80 mb-2">
            <ArrowLeft className="w-4 h-4" /> Regresar
          </button>
          <h1 className="text-xl font-display font-bold">Reportes de Novedades</h1>
          <p className="text-sm opacity-70 mt-1">Consulta por fecha, rango y guardia</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4 space-y-4">
        <div className="bg-card rounded-xl p-4 shadow-card grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Guardia</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={guardiaId}
              onChange={(e) => setGuardiaId(e.target.value)}
            >
              <option value="">Todos</option>
              {guardias.map((g) => (
                <option key={g.user_id} value={g.user_id}>{g.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" className="flex-1" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Filtrar
            </Button>
          </div>
          <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={soloImportantes ? 'destructive' : 'secondary'}
              onClick={() => setSoloImportantes((v) => !v)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" /> Solo importantes
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDesde(hoyISO()); setHasta(hoyISO()); }}>
              Hoy
            </Button>
            <Button size="sm" className="ml-auto" onClick={exportarPdf} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" /> {exporting ? 'Generando…' : 'Descargar PDF'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Novedades</p>
            <p className="text-2xl font-bold">{novedades.length}</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Importantes</p>
            <p className="text-2xl font-bold text-emergency">{importantes}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground px-1">Cargando…</p>
        ) : grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">Sin novedades en el periodo seleccionado.</p>
        ) : (
          grupos.map((g) => (
            <div key={`${g.guardia}-${g.fecha}`} className="bg-card rounded-xl p-4 shadow-card space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{g.guardia}</p>
                <p className="text-xs text-muted-foreground">{g.fecha} · {g.items.length} novedad(es)</p>
              </div>
              {g.items.map((n) => {
                const esImportante = n.importancia === 'importante';
                return (
                  <div
                    key={n.id}
                    className={`rounded-xl p-3 border ${esImportante ? 'border-emergency/40 bg-emergency/5' : 'border-border bg-accent/40'}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatFechaHora(n.created_at).hora}</span>
                      {n.servicio_id && servicios[n.servicio_id] && <span>· {servicios[n.servicio_id]}</span>}
                      {esImportante && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emergency/15 text-emergency font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Importante
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{n.descripcion}</p>
                    {(n.ubicacion_texto || (n.lat && n.lng)) && (
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {n.ubicacion_texto || `${n.lat?.toFixed(5)}, ${n.lng?.toFixed(5)}`}
                      </p>
                    )}
                    {n.foto_url && (
                      <SignedImg bucket="evidencias" path={n.foto_url} alt="Evidencia" className="mt-2 w-28 h-28 rounded-lg object-cover" />
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default NovedadesReportes;
