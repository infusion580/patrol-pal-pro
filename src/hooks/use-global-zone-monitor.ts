import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { notifyZonaExit } from '@/lib/notification-helpers';

interface ZoneCenter {
  lat: number;
  lng: number;
  radius: number;
  nombre?: string;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre alertas

/**
 * Monitor GLOBAL de zona: corre en toda la app mientras el guardia tenga turno activo.
 * Dispara notificación del sistema operativo + toast cuando el guardia sale del radio permitido.
 */
export function useGlobalZoneMonitor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [zone, setZone] = useState<ZoneCenter | null>(null);
  const [turnoActivo, setTurnoActivo] = useState(false);
  const lastNotifiedRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  // Pedir permiso de notificación una vez por sesión cuando hay usuario guardia
  useEffect(() => {
    if (!user || user.role !== 'guardia') return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [user]);

  // Detectar turno activo + cargar zona del servicio asignado
  useEffect(() => {
    if (!user || user.role !== 'guardia') {
      setTurnoActivo(false);
      setZone(null);
      return;
    }

    let cancelled = false;

    const loadTurnoYZona = async () => {
      const { data: turno } = await supabase
        .from('turnos')
        .select('id, servicio_id')
        .eq('guardia_id', user.id)
        .eq('status', 'activo')
        .maybeSingle();

      if (cancelled) return;

      if (!turno) {
        setTurnoActivo(false);
        setZone(null);
        return;
      }

      setTurnoActivo(true);

      // Buscar primer checkpoint con coordenadas del servicio para definir el centro de la zona
      if (turno.servicio_id) {
        const { data: cps } = await supabase
          .from('checkpoints')
          .select('lat, lng, radius_metros, nombre, servicio_id, servicios(nombre)')
          .eq('servicio_id', turno.servicio_id)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .limit(1);

        if (cancelled) return;

        const cp: any = cps?.[0];
        if (cp) {
          setZone({
            lat: Number(cp.lat),
            lng: Number(cp.lng),
            radius: (cp.radius_metros || 50) * 10, // zona = 10x el radio del checkpoint
            nombre: cp.servicios?.nombre || cp.nombre,
          });
        } else {
          setZone(null);
        }
      }
    };

    loadTurnoYZona();

    // Realtime: recargar al cambiar turno
    const ch = supabase
      .channel('global-zone-turno')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos', filter: `guardia_id=eq.${user.id}` },
        () => loadTurnoYZona(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const checkZone = useCallback(
    async (position: GeolocationPosition) => {
      if (!zone || !user) return;
      if (Date.now() - lastNotifiedRef.current < COOLDOWN_MS) return;

      const dist = getDistanceMeters(
        position.coords.latitude,
        position.coords.longitude,
        zone.lat,
        zone.lng,
      );

      if (dist > zone.radius) {
        lastNotifiedRef.current = Date.now();
        const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        await notifyZonaExit(
          user.id,
          `${user.nombre} ${user.apellido}`,
          dist,
          zone.radius,
          zone.nombre,
          position.coords.latitude,
          position.coords.longitude,
        );

        // Notificación del sistema operativo (visible aunque la pestaña esté en background)
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('⚠️ Saliste de tu zona de servicio', {
              body: `${zone.nombre || 'Zona'} • Distancia: ${Math.round(dist)}m • ${hora}`,
              icon: '/logo-defender.png',
              badge: '/logo-defender.png',
              tag: 'zona-exit',
              requireInteraction: true,
            });
          }
        } catch (e) {
          console.warn('Notification failed', e);
        }

        toast({
          title: '⚠️ Fuera de zona',
          description: `Distancia: ${Math.round(dist)}m del radio permitido (${zone.radius}m).`,
          variant: 'destructive',
        });
      }
    },
    [zone, user, toast],
  );

  // Geolocalización continua mientras haya turno activo + zona definida
  useEffect(() => {
    if (!turnoActivo || !zone || !user || user.role !== 'guardia') {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) return;
    lastNotifiedRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      checkZone,
      (err) => console.warn('Global zone monitor GPS error:', err.message),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [turnoActivo, zone, user, checkZone]);
}
