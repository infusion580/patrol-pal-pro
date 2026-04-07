import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { notifyZonaExit } from '@/lib/notification-helpers';

interface ServiceZone {
  lat: number;
  lng: number;
  radius: number;
  nombre?: string;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_MS = 60 * 60 * 1000;

export function useZoneMonitor(servicioId: string | null, zoneCenter?: ServiceZone) {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastNotifiedRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const checkZone = useCallback(async (position: GeolocationPosition) => {
    if (!zoneCenter || !user) return;
    if (Date.now() - lastNotifiedRef.current < COOLDOWN_MS) return;

    const dist = getDistanceMeters(
      position.coords.latitude, position.coords.longitude,
      zoneCenter.lat, zoneCenter.lng
    );

    if (dist > zoneCenter.radius) {
      lastNotifiedRef.current = Date.now();

      const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

      // Enhanced notification with full details for admin/supervisor/guardia
      await notifyZonaExit(
        user.id,
        `${user.nombre} ${user.apellido}`,
        dist,
        zoneCenter.radius,
        zoneCenter.nombre,
        position.coords.latitude,
        position.coords.longitude,
      );

      toast({
        title: '⚠️ Fuera de zona',
        description: `Has salido de tu zona de servicio a las ${hora}. Distancia: ${Math.round(dist)}m. Se notificó al supervisor y administrador.`,
        variant: 'destructive',
      });
    }
  }, [zoneCenter, user, toast]);

  useEffect(() => {
    if (!servicioId || !zoneCenter || !user || user.role !== 'guardia') return;
    lastNotifiedRef.current = 0;

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(checkZone, (err) => {
        console.warn('Geolocation error in zone monitor:', err.message);
      }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [servicioId, zoneCenter, user, checkZone]);

  // Listen for realtime zone notifications
  useEffect(() => {
    if (!user || user.role !== 'guardia') return;
    const channel = supabase
      .channel('guard-zone-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notificaciones',
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
