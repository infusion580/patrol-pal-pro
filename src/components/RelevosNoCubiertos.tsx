import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBranding } from '@/lib/branding';
import { generateReportPdf } from '@/lib/pdf-report';

/**
 * Relevo no cubierto = el cron `check-relevo-pendiente` detectó que un turno
 * estaba por terminar sin guardia entrante y notificó a los supervisores.
 * Cada evento queda registrado en `notificaciones` con tipo `relevo_pendiente`.
 */
interface RelevoEvento {
  turnoId: string;
  guardia: string;
  servicio: string;
  finEsperado: string | null;
  notificadoAt: string;
  avisados: number;
}

const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Rango por defecto: últimos 30 días. */
const hoyISO = () => new Date().toISOString().slice(0, 10);
const hace30ISO = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

/**
 * Bloque de RH que muestra los turnos que terminaron sin relevo y por los que
 * ya se envió la alerta a supervisión. Incluye exportación impresa (PDF).
 */
const RelevosNoCubiertos = () => {
  const { toast } = useToast();
  const { logoUrl, colors } = useBranding();
  const [desde, setDesde] = useState(hace30ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [eventos, setEventos] = useState<RelevoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const desdeTs = new Date(`${desde}T00:00:00`).toISOString();
    const hastaTs = new Date(`${hasta}T23:59:59`).toISOString();

    const { data } = await supabase
      .from('notificaciones')
      .select('id, mensaje, metadata, created_at, guardia_id')
      .eq('tipo', 'relevo_pendiente')
      .gte('created_at', desdeTs)
      .lte('created_at', hastaTs)
      .order('created_at', { ascending: false });

    // Se genera una notificación por supervisor: se agrupa por turno para no duplicar.
    const porTurno = new Map<string, RelevoEvento>();
    for (const n of data || []) {
      const meta = (n.metadata || {}) as Record<string, string | null>;
      const key = meta.turno_id || n.id;
      const previo = porTurno.get(key);
      if (previo) {
        previo.avisados += 1;
        continue;
      }
      porTurno.set(key, {
        turnoId: key,
        guardia: meta.guardia || 'Guardia',
        servicio: meta.servicio || 'N/A',
        finEsperado: meta.fin_esperado || null,
        notificadoAt: n.created_at,
        avisados: 1,
      });
    }

    setEventos(Array.from(porTurno.values()));
    setLoading(false);
  }, [desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      eventos.map((e) => [
        fmtFecha(e.finEsperado),
        e.guardia,
        e.servicio,
        fmtFecha(e.notificadoAt),
        `${e.avisados} supervisor(es)`,
      ]),
    [eventos],
  );

  const exportarPdf = async () => {
    setExporting(true);
    try {
      await generateReportPdf({
        title: 'Relevos no cubiertos',
        subtitle: 'Turnos que finalizaron sin guardia entrante registrado',
        logoUrl,
        primaryHsl: colors.primary_hsl,
        meta: [
          { label: 'Periodo', value: `${desde} a ${hasta}` },
          { label: 'Eventos detectados', value: String(eventos.length) },
        ],
        sections: [
          {
            title: 'Detalle de eventos',
            columns: ['Fin de turno esperado', 'Guardia saliente', 'Servicio', 'Fecha de notificación', 'Alerta enviada a'],
            rows,
            emptyText: 'Sin relevos no cubiertos en el periodo. Todos los turnos tuvieron guardia entrante.',
          },
        ],
        footerNote: 'Gestión RH · Defender Seguridad Privada',
        fileName: `relevos-no-cubiertos-${desde}_${hasta}.pdf`,
      });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el PDF.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-warning" /> Relevos no cubiertos
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Turnos que terminaron sin guardia entrante y que ya fueron notificados a supervisión.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={exportarPdf} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : eventos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Sin relevos no cubiertos en el periodo seleccionado.
        </p>
      ) : (
        <div className="space-y-2">
          {eventos.map((e) => (
            <div key={e.turnoId} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{e.guardia}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                  Notificado
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{e.servicio}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Fin esperado: {fmtFecha(e.finEsperado)} · Aviso: {fmtFecha(e.notificadoAt)} · {e.avisados} supervisor(es)
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RelevosNoCubiertos;
