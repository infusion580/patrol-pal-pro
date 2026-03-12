import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

interface ServiceZone {
  lat: number;
  lng: number;
  radius: number; // meters
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useZoneMonitor(servicioId: string | null, zoneCenter?: ServiceZone) {
  const { user } = useAuth();
  const { toast } = useToast();
  const notifiedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  const checkZone = useCallback(async (position: GeolocationPosition) => {
    if (!zoneCenter || !user || notifiedRef.current) return;

    const dist = getDistanceMeters(
      position.coords.latitude,
      position.coords.longitude,
      zoneCenter.lat,
      zoneCenter.lng
    );

    if (dist > zoneCenter.radius) {
      notifiedRef.current = true;

      // Insert notification for supervisors
      await supabase.from('notificaciones').insert({
        tipo: 'zona',
        mensaje: `El guardia ${user.nombre} ${user.apellido} salió de la zona del servicio asignado (${Math.round(dist)}m de distancia).`,
        guardia_id: user.id,
      } as any);

      toast({
        title: '⚠️ Fuera de zona',
        description: 'Has salido de tu zona de servicio. Se notificó al supervisor.',
        variant: 'destructive',
      });
    }
  }, [zoneCenter, user, toast]);

  useEffect(() => {
    if (!servicioId || !zoneCenter || !user || user.role !== 'guardia') return;

    notifiedRef.current = false;

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(checkZone, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      });
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [servicioId, zoneCenter, user, checkZone]);
}
