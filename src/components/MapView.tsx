import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Guard {
  id: string;
  nombre: string;
  status: string;
  lat: number;
  lng: number;
}

const statusLabels: Record<string, string> = {
  activo: 'En Ronda',
  completado: 'Completado',
};

const statusColors: Record<string, string> = {
  activo: '#22c55e',
  completado: '#3b82f6',
};

const MapView = ({ guards }: { guards: Guard[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([19.4326, -99.1332], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    guards.forEach(g => {
      const color = statusColors[g.status] || statusColors.activo;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -12],
      });

      L.marker([g.lat, g.lng], { icon })
        .bindPopup(`<strong>${g.nombre}</strong><br/>${statusLabels[g.status] || g.status}<br/><small>${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}</small>`)
        .addTo(map);
    });

    if (guards.length > 0) {
      const bounds = L.latLngBounds(guards.map(g => [g.lat, g.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [guards]);

  return <div ref={mapRef} className="h-72 w-full z-0" />;
};

export default MapView;
