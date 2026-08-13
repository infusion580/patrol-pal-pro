/**
 * Pestaña "Datos" del Portal Cliente.
 *
 * Muestra todos los datos capturados por la plataforma para los servicios del
 * cliente, respetando exactamente lo que el administrador habilitó en
 * Administración > Reporte del Cliente. Permite exportar todo a PDF.
 */
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignedImg } from '@/components/SignedImg';
import { useToast } from '@/hooks/use-toast';
import { Download, Database } from 'lucide-react';
import { format } from 'date-fns';
import { generateReportPdf } from '@/lib/pdf-report';
import { useBranding } from '@/lib/branding';
import { cargarDatosCapturados, type BloqueDatos } from '@/lib/cliente-datos-capturados';
import type { ClienteReportConfig } from '@/lib/cliente-report-config';

interface Props {
  clienteId: string;
  clienteNombre: string;
  config: ClienteReportConfig;
  desde: Date;
  hasta: Date;
  servicioFiltro?: string;
}

const DatosCapturadosTab = ({ clienteId, clienteNombre, config, desde, hasta, servicioFiltro = 'all' }: Props) => {
  const { toast } = useToast();
  const { logoUrl, colors } = useBranding();
  const [bloques, setBloques] = useState<BloqueDatos[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    cargarDatosCapturados(clienteId, desde, hasta, config, servicioFiltro)
      .then(res => { if (!cancel) setBloques(res.bloques); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [clienteId, desde, hasta, config, servicioFiltro]);

  const exportarPdf = async () => {
    setExportando(true);
    try {
      await generateReportPdf({
        title: 'Datos capturados en el periodo',
        subtitle: clienteNombre,
        logoUrl: logoUrl ?? undefined,
        primaryHsl: colors?.primary,
        meta: [
          { label: 'Cliente', value: clienteNombre },
          { label: 'Periodo', value: `${format(desde, 'dd/MM/yyyy')} al ${format(hasta, 'dd/MM/yyyy')}` },
          { label: 'Emitido', value: format(new Date(), 'dd/MM/yyyy HH:mm') },
        ],
        sections: bloques.map(b => ({
          title: `${b.titulo} (${b.total})`,
          columns: b.columnas,
          rows: b.filas,
          emptyText: 'Sin registros en el periodo.',
        })),
        footerNote: 'Documento confidencial generado automáticamente.',
        fileName: `Datos_${format(desde, 'yyyy-MM-dd')}_${format(hasta, 'yyyy-MM-dd')}.pdf`,
      });
    } catch (e: any) {
      toast({ title: 'No se pudo generar el PDF', description: e?.message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (bloques.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Database className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <h3 className="font-semibold text-foreground">Sin datos habilitados</h3>
        <p className="text-sm text-muted-foreground mt-1">
          El administrador aún no ha habilitado datos detallados para este portal.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {config.show_export_pdf && (
        <Button onClick={exportarPdf} disabled={exportando} className="w-full h-11">
          <Download className="w-4 h-4 mr-2" />
          {exportando ? 'Generando…' : 'Descargar datos en PDF'}
        </Button>
      )}

      {bloques.map(b => (
        <Card key={b.key} className="p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            {b.titulo}
            <span className="text-xs font-normal text-muted-foreground">({b.total})</span>
          </h3>

          {b.filas.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sin registros en el período.</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    {b.columnas.map(c => (
                      <th key={c} className="text-left font-semibold text-muted-foreground px-2 py-2 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {b.filas.map((fila, i) => (
                    <tr key={i} className="hover:bg-accent/30">
                      {fila.map((celda, j) => (
                        <td key={j} className="px-2 py-1.5 align-top text-foreground">{String(celda)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {b.total > b.filas.length && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Mostrando {b.filas.length} de {b.total} registros. Descarga el PDF para el detalle completo.
            </p>
          )}

          {b.fotos && b.fotos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {b.fotos.map((f, i) => (
                <figure key={`${f.path}-${i}`} className="space-y-1">
                  <SignedImg
                    bucket={f.bucket}
                    path={f.path}
                    alt={f.caption}
                    className="w-full h-24 object-cover rounded-lg border border-border"
                  />
                  <figcaption className="text-[10px] text-muted-foreground leading-tight">{f.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default DatosCapturadosTab;
