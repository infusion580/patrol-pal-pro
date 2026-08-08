import { describe, it, expect } from 'vitest';

/**
 * Geofence rule used by Rondines / GlobalZoneMonitor.
 *
 * A guard is considered INSIDE the zone when the distance to the point is
 * within the configured radius plus the GPS accuracy margin. Anything else
 * blocks the action (start rondín, take photo, verify checkpoint).
 */
function distanciaMetros(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function dentroDeZona(distancia: number, radio: number, precisionGps: number): boolean {
  return distancia <= radio + Math.min(precisionGps, 50);
}

const base = { lat: 19.4326, lng: -99.1332 }; // CDMX

describe('geocerca', () => {
  it('calcula ~0 m para el mismo punto', () => {
    expect(distanciaMetros(base, base)).toBeLessThan(1);
  });

  it('calcula una distancia razonable a 0.001° de latitud (~111 m)', () => {
    const d = distanciaMetros(base, { lat: base.lat + 0.001, lng: base.lng });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it('permite la acción dentro del radio', () => {
    expect(dentroDeZona(40, 100, 10)).toBe(true);
  });

  it('bloquea la acción fuera del radio aun con margen de GPS', () => {
    expect(dentroDeZona(400, 100, 30)).toBe(false);
  });

  it('tolera imprecisión de GPS hasta 50 m como máximo', () => {
    expect(dentroDeZona(145, 100, 500)).toBe(true);
    expect(dentroDeZona(160, 100, 500)).toBe(false);
  });
});
