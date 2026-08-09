import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldCheck, RefreshCw, Search, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  datos_antes: any;
  datos_despues: any;
  dispositivo: any;
  created_at: string;
}

const ACCION_LABEL: Record<string, string> = {
  insert: 'Creación',
  update: 'Modificación',
  delete: 'Eliminación',
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  export: 'Exportación',
  client_error: 'Error de la app',
  aprobacion_reporte: 'Reporte aprobado',
  retroalimentacion_reporte: 'Reporte devuelto',
};

const ACCION_STYLE: Record<string, string> = {
  insert: 'bg-primary/10 text-primary',
  update: 'bg-warning/10 text-warning',
  delete: 'bg-emergency/10 text-emergency',
  client_error: 'bg-emergency/10 text-emergency',
};

/**
 * Immutable audit trail viewer (admin only).
 *
 * Rows come from `public.audit_log`, which the database protects with a
 * trigger that rejects UPDATE and DELETE — so what is shown here is exactly
 * what happened, with no possibility of tampering from the app.
 */
const AuditLog = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tabla, setTabla] = useState<string>('');

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('audit_log' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (tabla) q = q.eq('tabla', tabla);
    const { data } = await q;
    setRows((data || []) as unknown as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla]);

  const tablas = useMemo(() => [...new Set(rows.map((r) => r.tabla))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.actor_email, r.accion, r.tabla, r.registro_id, JSON.stringify(r.datos_despues)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AppHeader />
      <main className="p-4 space-y-4">
        <header className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Bitácora de auditoría</h1>
            <p className="text-xs text-muted-foreground">
              Registro inmutable: no puede editarse ni borrarse.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void runBackup()}
            disabled={backingUp}
            className="min-h-11"
            aria-label="Generar respaldo de la base de datos ahora"
          >
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Respaldo</span>
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Recargar bitácora" className="min-h-11 min-w-11">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </header>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Buscar por usuario, acción o dato…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar en la bitácora"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={tabla}
            onChange={(e) => setTabla(e.target.value)}
            aria-label="Filtrar por tabla"
          >
            <option value="">Todas</option>
            {tablas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {!loading && filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-60" aria-hidden="true" />
            No hay eventos registrados con este filtro.
          </Card>
        )}

        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ACCION_STYLE[r.accion] || 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ACCION_LABEL[r.accion] || r.accion}
                      </span>
                      <span className="text-sm font-semibold truncate">{r.tabla}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {r.actor_email || r.actor_id || 'Sistema'}
                      {r.registro_id ? ` · ${r.registro_id.slice(0, 8)}…` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap" dateTime={r.created_at}>
                    {format(new Date(r.created_at), "dd MMM HH:mm:ss", { locale: es })}
                  </time>
                </div>
                {(r.datos_despues || r.datos_antes) && (
                  <details className="mt-2">
                    <summary className="text-xs text-primary cursor-pointer">Ver detalle</summary>
                    <pre className="mt-2 text-[10px] bg-muted/50 rounded p-2 overflow-x-auto max-h-56">
                      {JSON.stringify({ antes: r.datos_antes, despues: r.datos_despues }, null, 2)}
                    </pre>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </div>
  );
};

export default AuditLog;
