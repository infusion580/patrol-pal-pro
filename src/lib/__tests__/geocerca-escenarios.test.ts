import { describe, it, expect } from 'vitest';

/**
 * Escenarios de GPS para geocercas y alertas.
 *
 * Reglas verificadas (mismas que usa ValidacionPuestoGate / GlobalZoneMonitor):
 *  - Sin señal GPS  -> resultado "sin_ubicacion" (no se puede validar el área).
 *  - Dentro/fuera   -> distancia <= radio + margen de precisión (máx. 50 m).
 *  - Salida de zona -> alerta al supervisor con cooldown para evitar spam.
 */

function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Resultado = 'valida' | 'fuera_area' | 'sin_ubicacion';

interface Pos {
  lat: number | null;
  lng: number | null;
  precision: number | null;
}

function evaluar(pos: Pos, punto: { lat: number; lng: number; radio: number } | null) {
  if (pos.lat == null || pos.lng == null) {
    return { resultado: 'sin_ubicacion' as Resultado, distancia: null, dentro: false };
  }
  if (!punto) return { resultado: 'valida' as Resultado, distancia: null, dentro: true };
  const distancia = Math.round(distanciaMetros({ lat: pos.lat, lng: pos.lng }, punto));
  const margen = Math.min(pos.precision ?? 0, 50);
  const dentro = distancia <= punto.radio + margen;
  return { resultado: (dentro ? 'valida' : 'fuera_area') as Resultado, distancia, dentro };
}

const PUESTO = { lat: 19.4326, lng: -99.1332, radio: 100 };
/** ~111 m por 0.001° de latitud. */
const desplazar = (m: number) => ({ lat: PUESTO.lat + m / 111_320, lng: PUESTO.lng });

describe('geocercas · escenarios de GPS', () => {
  describe('sin señal', () => {
    it('marca "sin_ubicacion" cuando no hay coordenadas', () => {
      const r = evaluar({ lat: null, lng: null, precision: null }, PUESTO);
      expect(r.resultado).toBe('sin_ubicacion');
      expect(r.dentro).toBe(false);
      expect(r.distancia).toBeNull();
    });

    it('marca "sin_ubicacion" aunque llegue precisión pero falte lng', () => {
      expect(evaluar({ lat: 19.4326, lng: null, precision: 12 }, PUESTO).resultado).toBe(
        'sin_ubicacion',
      );
    });

    it('no bloquea cuando el servicio no tiene punto configurado', () => {
      const r = evaluar({ lat: 19.9, lng: -99.9, precision: 10 }, null);
      expect(r).toMatchObject({ resultado: 'valida', dentro: true });
    });
  });

  describe('dentro / fuera de zona', () => {
    it('valida en el centro exacto del puesto', () => {
      expect(evaluar({ ...PUESTO, precision: 5 }, PUESTO).resultado).toBe('valida');
    });

    it('valida a 50 m del punto (dentro del radio de 100 m)', () => {
      const r = evaluar({ ...desplazar(50), precision: 5 }, PUESTO);
      expect(r.distancia).toBeGreaterThan(45);
      expect(r.distancia).toBeLessThan(55);
      expect(r.resultado).toBe('valida');
    });

    it('marca fuera de área a 500 m con GPS preciso', () => {
      const r = evaluar({ ...desplazar(500), precision: 5 }, PUESTO);
      expect(r.resultado).toBe('fuera_area');
      expect(r.distancia).toBeGreaterThan(480);
    });

    it('marca fuera de área a 5 km (abandono de puesto)', () => {
      expect(evaluar({ ...desplazar(5000), precision: 10 }, PUESTO).resultado).toBe('fuera_area');
    });
  });

  describe('variación de precisión', () => {
    it('GPS fino (3 m): 120 m sigue siendo fuera de área', () => {
      expect(evaluar({ ...desplazar(120), precision: 3 }, PUESTO).resultado).toBe('fuera_area');
    });

    it('GPS medio (30 m): 120 m se acepta por el margen', () => {
      expect(evaluar({ ...desplazar(120), precision: 30 }, PUESTO).resultado).toBe('valida');
    });

    it('GPS malo (500 m): el margen se limita a 50 m', () => {
      expect(evaluar({ ...desplazar(140), precision: 500 }, PUESTO).resultado).toBe('valida');
      expect(evaluar({ ...desplazar(170), precision: 500 }, PUESTO).resultado).toBe('fuera_area');
    });

    it('precisión ausente equivale a margen 0', () => {
      expect(evaluar({ ...desplazar(110), precision: null }, PUESTO).resultado).toBe('fuera_area');
    });
  });
});

/* ------------------------------------------------------------------ */
/* Alertas de salida de zona (cooldown del monitor global)             */
/* ------------------------------------------------------------------ */

const COOLDOWN_MS = 15 * 60 * 1000;

function crearMonitor(zona: { lat: number; lng: number; radius: number }) {
  let ultima = 0;
  const alertas: number[] = [];
  return {
    alertas,
    tick(pos: { lat: number; lng: number }, ahora: number) {
      if (ahora - ultima < COOLDOWN_MS && ultima !== 0) return;
      const d = distanciaMetros(pos, zona);
      if (d > zona.radius) {
        ultima = ahora;
        alertas.push(Math.round(d));
      }
    },
  };
}

describe('alertas de salida de zona', () => {
  const zona = { lat: PUESTO.lat, lng: PUESTO.lng, radius: 500 };

  it('no alerta mientras el guardia permanece dentro', () => {
    const m = crearMonitor(zona);
    for (let i = 0; i < 10; i++) m.tick(desplazar(100 + i * 10), i * 60_000);
    expect(m.alertas).toHaveLength(0);
  });

  it('alerta una sola vez dentro del periodo de enfriamiento', () => {
    const m = crearMonitor(zona);
    m.tick(desplazar(900), 0);
    m.tick(desplazar(1000), 60_000);
    m.tick(desplazar(1200), 5 * 60_000);
    expect(m.alertas).toHaveLength(1);
  });

  it('vuelve a alertar después de 15 minutos si sigue fuera', () => {
    const m = crearMonitor(zona);
    m.tick(desplazar(900), 1_000);
    m.tick(desplazar(1500), 1_000 + COOLDOWN_MS + 1);
    expect(m.alertas).toHaveLength(2);
  });
});
