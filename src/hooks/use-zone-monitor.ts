import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

interface ServiceZone {
  lat: number;
  lng: number;
  radius: number;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

export function useZoneMonitor(servicioId: string | null, zoneCenter?: ServiceZone) {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastNotifiedRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const checkZone = useCallback(async (position: GeolocationPosition) => {
    if (!zoneCenter || !user) return;

    // Cooldown: don't notify more than once per hour
    if (Date.now() - lastNotifiedRef.current < COOLDOWN_MS) return;

    const dist = getDistanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      zoneCenter.lat,
      zoneCenter.lng
    );

    if (dist > zoneCenter.radius) {
      lastNotifiedRef.current = Date.now();

      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const mensaje = `⚠️ El guardia ${user.nombre} ${user.apellido} salió de la zona del servicio asignado a las ${hora}. Distancia detectada: ${Math.round(dist)}m (radio permitido: ${zoneCenter.radius}m). Se recomienda verificar su ubicación.`;

      const { error } = await supabase.from('notificaciones').insert({
        tipo: 'zona',
        mensaje,
        guardia_id: user.id,
      });

      if (error) {
        console.error('Error inserting zone notification:', error);
      } else {
        toast({
          title: '⚠️ Fuera de zona',
          description: `Has salido de tu zona de servicio a las ${hora}. Regresa a tu zona asignada lo antes posible. Se notificó al supervisor.`,
          variant: 'destructive',
        });
      }
    }
  }, [zoneCenter, user, toast]);

  useEffect(() => {
    if (!servicioId || !zoneCenter || !user || user.role !== 'guardia') return;

    lastNotifiedRef.current = 0;

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(checkZone, (err) => {
        console.warn('Geolocation error in zone monitor:', err.message);
      }, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      });
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [servicioId, zoneCenter, user, checkZone]);

  // Listen for real-time zone notifications sent TO this guard
  useEffect(() => {
    if (!user || user.role !== 'guardia') return;

    const channel = supabase
      .channel('guard-zone-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `guardia_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.tipo === 'zona') {
          toast({
            title: '⚠️ Alerta de zona',
            description: payload.new.mensaje || 'Se registró una salida de zona.',
            variant: 'destructive',
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);
}
