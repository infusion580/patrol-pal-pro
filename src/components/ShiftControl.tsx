import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, UserCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { notifyTurnoInicio, notifyTurnoFin } from '@/lib/notification-helpers';
import { TipoTurno, tipoTurnoLabel, tipoTurnoHoras, generarAsistenciasCorridoFaltantes } from '@/lib/asistencias-helpers';
import { loadServiciosParaUsuario } from '@/lib/guardia-servicios';

interface Turno {
  id: string;
  inicio: string;
  status: string;
  servicio_id?: string | null;
}

interface Servicio {
  id: string;
  nombre: string;
  tipo_turno: TipoTurno;
}

const ShiftControl = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTurno, setActiveTurno] = useState<Turno | null>(null);
  const [activeAsistenciaId, setActiveAsistenciaId] = useState<string | null>(null);
  const [activeTipoTurno, setActiveTipoTurno] = useState<TipoTurno>('12h');
  const [loading, setLoading] = useState(true);
  const [showHandoff, setShowHandoff] = useState(false);
  const [guardiaEntrante, setGuardiaEntrante] = useState('');
  const [comentario, setComentario] = useState('');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [selectedServicio, setSelectedServicio] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadServicios();
      await loadActiveTurno();
      // Generar asistencias automáticas para turnos de corrido
      await generarAsistenciasCorridoFaltantes(user.id);
    })();
  }, [user]);

  const loadActiveTurno = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('turnos')
      .select('id, inicio, status, servicio_id')
      .eq('guardia_id', user.id)
      .eq('status', 'activo')
      .maybeSingle();
    setActiveTurno(data as any);

    if (data) {
      // Buscar asistencia activa asociada
      const { data: asist } = await supabase
        .from('asistencias' as any)
        .select('id, tipo_turno')
        .eq('guardia_id', user.id)
        .eq('status', 'activo')
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (asist) {
        setActiveAsistenciaId((asist as any).id);
        setActiveTipoTurno((asist as any).tipo_turno as TipoTurno);
      }
    }
    setLoading(false);
  };

  const loadServicios = async () => {
    if (!user) return;
    const data = await loadServiciosParaUsuario(user.id, user.role);
    const list = data.map((d: any) => ({
      id: d.id,
      nombre: d.nombre,
      tipo_turno: (d.tipo_turno || '12h') as TipoTurno,
    }));
    setServicios(list);
    if (list.length > 0) setSelectedServicio(list[0].id);
  };

  const startShift = async () => {
    if (!user) return;
    const servicio = servicios.find(s => s.id === selectedServicio);
    const tipoTurno: TipoTurno = servicio?.tipo_turno || '12h';

    const { data: turnoData, error: turnoErr } = await supabase.from('turnos').insert({
      guardia_id: user.id,
      servicio_id: selectedServicio || null,
    } as any).select('id, inicio, status, servicio_id').single();

    if (turnoErr || !turnoData) {
      toast({ title: 'Error', description: 'No se pudo iniciar el turno.', variant: 'destructive' });
      return;
    }

    // Crear asistencia
    const inicio = new Date(turnoData.inicio);
    const horas = tipoTurnoHoras(tipoTurno);
    const finEsperado = new Date(inicio.getTime() + horas * 60 * 60 * 1000);

    const { data: asist } = await supabase.from('asistencias' as any).insert({
      guardia_id: user.id,
      servicio_id: selectedServicio || null,
      turno_id: turnoData.id,
      tipo_turno: tipoTurno,
      inicio: turnoData.inicio,
      fin_esperado: finEsperado.toISOString(),
      status: 'activo',
    } as any).select('id').single();

    setActiveTurno(turnoData as any);
    setActiveAsistenciaId((asist as any)?.id || null);
    setActiveTipoTurno(tipoTurno);
    toast({ title: '✅ Turno iniciado', description: `Tipo: ${tipoTurnoLabel(tipoTurno)}.` });
    notifyTurnoInicio(user.id, `${user.nombre} ${user.apellido}`, servicio?.nombre);
  };

  const endShift = async (forzarIncompleto = false) => {
    if (!activeTurno || !user) return;
    const ahora = new Date();
    const inicio = new Date(activeTurno.inicio);
    const horasReales = (ahora.getTime() - inicio.getTime()) / (60 * 60 * 1000);
    const horasRequeridas = tipoTurnoHoras(activeTipoTurno);
    const completado = horasReales >= horasRequeridas - 0.01;
    const status = completado ? 'completo' : 'incompleto';
    const horasExtra = completado ? Math.max(0, +(horasReales - horasRequeridas).toFixed(2)) : 0;

    await supabase.from('turnos').update({
      fin: ahora.toISOString(),
      status: 'completado',
      comentario_cambio: comentario,
      guardia_entrante: guardiaEntrante,
    } as any).eq('id', activeTurno.id);

    if (activeAsistenciaId) {
      const obsExtra = horasExtra > 0 ? ` | Horas extra: ${horasExtra.toFixed(2)}h` : '';
      await supabase.from('asistencias' as any).update({
        fin: ahora.toISOString(),
        duracion_minutos: Math.round((ahora.getTime() - inicio.getTime()) / 60000),
        status,
        horas_extra: horasExtra,
        observaciones: (comentario || (status === 'incompleto' ? 'Finalizado antes del tiempo requerido' : '')) + obsExtra,
      } as any).eq('id', activeAsistenciaId);
    }

    setActiveTurno(null);
    setActiveAsistenciaId(null);
    setShowHandoff(false);
    setComentario('');
    setGuardiaEntrante('');
    toast({
      title: completado ? (horasExtra > 0 ? '✅ Turno completo + horas extra' : '✅ Turno completo') : '⚠️ Turno incompleto',
      description: completado
        ? (horasExtra > 0
            ? `Se contabiliza 1 turno + ${horasExtra.toFixed(2)} hrs extra.`
            : 'Cumpliste el tiempo requerido.')
        : `Solo se trabajaron ${horasReales.toFixed(1)} de ${horasRequeridas} hrs.`,
    });
    const servicioFin = servicios.find(s => s.id === activeTurno.servicio_id);
    notifyTurnoFin(user.id, `${user.nombre} ${user.apellido}`, servicioFin?.nombre, status);
  };


  if (loading) return null;

  const elapsed = activeTurno
    ? Math.floor((Date.now() - new Date(activeTurno.inicio).getTime()) / 60000)
    : 0;
  const hrs = Math.floor(elapsed / 60);
  const mins = elapsed % 60;
  const horasRequeridas = tipoTurnoHoras(activeTipoTurno);
  const horasReales = elapsed / 60;
  const cumpleTiempo = horasReales >= horasRequeridas - 0.01;

  return (
    <div className="bg-card rounded-xl p-4 shadow-card mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold text-sm text-foreground">Control de Turno</h3>
      </div>

      {activeTurno ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Turno {tipoTurnoLabel(activeTipoTurno)} • desde</p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(activeTurno.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full ${cumpleTiempo ? 'bg-success/10' : 'bg-warning/10'}`}>
              <p className={`text-xs font-bold ${cumpleTiempo ? 'text-success' : 'text-warning'}`}>{hrs}h {mins}m</p>
            </div>
          </div>

          {cumpleTiempo && activeTipoTurno !== 'corrido' && (horasReales - horasRequeridas) > 0.01 && (
            <div className="bg-success/5 border border-success/30 rounded-lg p-2 mb-3">
              <p className="text-[11px] text-foreground">
                <strong>1 turno completo</strong> + <strong>{(horasReales - horasRequeridas).toFixed(2)} hrs extra</strong> acumuladas. Se seguirán contando hasta que finalices.
              </p>
            </div>
          )}

          {activeTipoTurno === 'corrido' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 mb-3">
              <p className="text-[11px] text-foreground">
                <strong>Turno de corrido:</strong> Se registrará una asistencia automática cada 24h. No necesitas finalizar diariamente.
              </p>
            </div>
          )}


          {!showHandoff ? (
            <Button
              onClick={() => setShowHandoff(true)}
              className="w-full bg-emergency text-emergency-foreground hover:bg-emergency/90"
            >
              <LogOut className="w-4 h-4 mr-2" /> Finalizar Turno / Cambio de Guardia
            </Button>
          ) : (
            <div className="space-y-3">
              {!cumpleTiempo && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] text-foreground">
                    Aún no cumples las {horasRequeridas} horas requeridas. Si finalizas, la asistencia quedará marcada como <strong>incompleta</strong>.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  <UserCheck className="w-3 h-3 inline mr-1" />
                  ¿Quién se queda? (guardia entrante)
                </label>
                <input
                  type="text"
                  value={guardiaEntrante}
                  onChange={(e) => setGuardiaEntrante(e.target.value)}
                  placeholder="Nombre del guardia que entra"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Comentario {!cumpleTiempo && <span className="text-warning">(motivo de salida anticipada)</span>}
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Novedades, pendientes, observaciones..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowHandoff(false)} className="flex-1">Cancelar</Button>
                <Button onClick={() => endShift()} className="flex-1 bg-emergency text-emergency-foreground hover:bg-emergency/90">
                  Confirmar Cambio
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {servicios.length > 1 && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground block mb-1">Servicio</label>
              <select
                value={selectedServicio}
                onChange={(e) => setSelectedServicio(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({tipoTurnoLabel(s.tipo_turno)})</option>)}
              </select>
            </div>
          )}
          {selectedServicio && (
            <p className="text-[11px] text-muted-foreground mb-2">
              Tipo de turno: <strong>{tipoTurnoLabel(servicios.find(s => s.id === selectedServicio)?.tipo_turno || '12h')}</strong>
            </p>
          )}
          <Button onClick={startShift} className="w-full bg-success text-success-foreground hover:bg-success/90">
            <LogIn className="w-4 h-4 mr-2" /> Iniciar Turno
          </Button>
        </>
      )}
    </div>
  );
};

export default ShiftControl;
