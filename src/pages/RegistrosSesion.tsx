import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, LogIn, LogOut, MapPin, RefreshCw, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SignedImg } from '@/components/SignedImg';
import BottomNav from '@/components/BottomNav';
import { listSesionRegistros, type SesionEvento, type SesionRegistro } from '@/lib/sesion-registros';

const MapView = lazy(() => import('@/components/MapView'));

/**
 * Registros de sesión (admin/supervisor): fotografía, fecha, hora, usuario,
 * coordenadas, precisión, dispositivo y ubicación en mapa.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);
const hace7ISO = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

const RegistrosSesion = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [desde, setDesde] = useState(hace7ISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [userId, setUserId] = useState('');
  const [evento, setEvento] = useState<SesionEvento | ''>('');

  const [usuarios, setUsuarios] = useState<{ user_id: string; nombre: string }[]>([]);
  const [registros, setRegistros] = useState<SesionRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, nombre, apellido')
      .order('nombre')
      .then(({ data }) =>
        setUsuarios(
          (data || []).map((p: any) => ({
            user_id: p.user_id,
            nombre: `${p.nombre} ${p.apellido}`.trim() || 'Sin nombre',
          })),
        ),
      );
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(await listSesionRegistros({ desde, hasta, userId: userId || null, evento: evento || null }));
    } catch {
      toast({ title: 'No se pudieron cargar los registros', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, userId, evento, toast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombrePorId = useMemo(
    () => Object.fromEntries(usuarios.map((u) => [u.user_id, u.nombre])),
    [usuarios],
  );

  const puntos = useMemo(
    () =>
      registros
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({
          id: r.id,
          nombre: `${nombrePorId[r.user_id] || 'Usuario'} · ${r.evento === 'login' ? 'Ingreso' : 'Cierre'}`,
          status: r.evento === 'login' ? 'activo' : 'completado',
          lat: r.lat as number,
          lng: r.lng as number,
        })),
    [registros, nombrePorId],
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="app-header flex items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Registros de sesión</h1>
          <p className="text-xs text-muted-foreground">Fotografía, ubicación y dispositivo por ingreso y cierre</p>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="desde" className="text-xs">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="hasta" className="text-xs">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="usuario" className="text-xs">Usuario</Label>
              <select
                id="usuario"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="evento" className="text-xs">Evento</Label>
              <select
                id="evento"
                value={evento}
                onChange={(e) => setEvento(e.target.value as SesionEvento | '')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                <option value="login">Inicio de sesión</option>
                <option value="logout">Cierre de sesión</option>
              </select>
            </div>
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={cargar} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </section>

        {puntos.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <Suspense fallback={<div className="h-72 animate-pulse bg-muted" />}>
              <MapView guards={puntos} />
            </Suspense>
          </section>
        )}

        <section className="space-y-3">
          {!loading && registros.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin registros en el periodo seleccionado.</p>
          )}

          {registros.map((r) => {
            const d = new Date(r.created_at);
            const disp = (r.dispositivo || {}) as Record<string, string>;
            return (
              <article key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  {r.foto_url ? (
                    <SignedImg
                      bucket="evidencias"
                      path={r.foto_url}
                      alt="Fotografía de sesión"
                      className="h-20 w-20 rounded-lg object-cover"
                      fallback={<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted"><Camera className="h-5 w-5 text-muted-foreground" /></div>}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {r.evento === 'login' ? (
                        <LogIn className="h-4 w-4 text-success" />
                      ) : (
                        <LogOut className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-sm font-semibold">
                        {r.evento === 'login' ? 'Inicio de sesión' : 'Cierre de sesión'}
                      </span>
                    </div>
                    <p className="text-sm">{nombrePorId[r.user_id] || r.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })} ·{' '}
                      {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {r.lat != null && r.lng != null
                        ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}${r.precision_metros ? ` (±${r.precision_metros} m)` : ''}`
                        : r.ubicacion_error || 'Sin ubicación'}
                    </p>
                    {disp.label && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5" /> {disp.label}
                      </p>
                    )}
                    {r.lat != null && r.lng != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-medium text-primary underline"
                      >
                        Ver en mapa
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default RegistrosSesion;
