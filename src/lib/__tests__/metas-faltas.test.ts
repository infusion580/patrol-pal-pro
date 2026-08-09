import { describe, it, expect } from 'vitest';

/**
 * Daily goal + honor-board scoring rules.
 *
 * Mirrors the scoring used by `goals-helpers.computeGuardProgress`:
 *   rondín = 10 pts, reporte = 20 pts, pendiente = 15 pts.
 * A guard earns the daily trophy only when EVERY configured goal is met.
 */
const PUNTOS = { rondin: 10, reporte: 20, pendiente: 15 } as const;

function calcularPuntos(rondines: number, reportes: number, pendientes: number): number {
  return rondines * PUNTOS.rondin + reportes * PUNTOS.reporte + pendientes * PUNTOS.pendiente;
}

interface Meta {
  rondines: number;
  reportes: number;
  pendientes: number;
}

function metaCumplida(hecho: Meta, meta: Meta): boolean {
  return (
    hecho.rondines >= meta.rondines &&
    hecho.reportes >= meta.reportes &&
    hecho.pendientes >= meta.pendientes
  );
}

describe('metas diarias y cuadro de honor', () => {
  it('suma puntos por cada tipo de actividad', () => {
    expect(calcularPuntos(0, 0, 0)).toBe(0);
    expect(calcularPuntos(3, 1, 2)).toBe(30 + 20 + 30);
  });

  it('otorga el trofeo solo si se cumplen todas las metas', () => {
    const meta = { rondines: 4, reportes: 1, pendientes: 2 };
    expect(metaCumplida({ rondines: 4, reportes: 1, pendientes: 2 }, meta)).toBe(true);
    expect(metaCumplida({ rondines: 4, reportes: 1, pendientes: 1 }, meta)).toBe(false);
    expect(metaCumplida({ rondines: 3, reportes: 5, pendientes: 9 }, meta)).toBe(false);
  });

  it('acepta rebasar la meta sin penalizar', () => {
    const meta = { rondines: 2, reportes: 1, pendientes: 0 };
    expect(metaCumplida({ rondines: 8, reportes: 3, pendientes: 4 }, meta)).toBe(true);
  });
});

/**
 * Absence rules: a day is only an unexcused "falta" when there is no approved
 * HR record (vacaciones / incapacidad / permiso) covering that date.
 */
interface RegistroRH {
  tipo: 'vacaciones' | 'incapacidad' | 'permiso' | 'prestamo' | 'turno_extra';
  status: 'pendiente' | 'aprobado' | 'rechazado';
  fecha: string;
  fecha_fin?: string | null;
}

function esJustificada(fecha: string, registros: RegistroRH[]): boolean {
  return registros.some(
    (r) =>
      r.status === 'aprobado' &&
      ['vacaciones', 'incapacidad', 'permiso'].includes(r.tipo) &&
      fecha >= r.fecha &&
      fecha <= (r.fecha_fin || r.fecha),
  );
}

describe('faltas justificadas', () => {
  const vacaciones: RegistroRH = {
    tipo: 'vacaciones',
    status: 'aprobado',
    fecha: '2026-02-10',
    fecha_fin: '2026-02-14',
  };

  it('justifica los días dentro del rango aprobado', () => {
    expect(esJustificada('2026-02-10', [vacaciones])).toBe(true);
    expect(esJustificada('2026-02-14', [vacaciones])).toBe(true);
  });

  it('no justifica días fuera del rango', () => {
    expect(esJustificada('2026-02-15', [vacaciones])).toBe(false);
  });

  it('ignora registros no aprobados', () => {
    expect(esJustificada('2026-02-11', [{ ...vacaciones, status: 'pendiente' }])).toBe(false);
  });

  it('ignora tipos que no son ausencia (préstamo, turno extra)', () => {
    expect(
      esJustificada('2026-02-11', [{ ...vacaciones, tipo: 'prestamo' }]),
    ).toBe(false);
  });

  it('soporta registros de un solo día sin fecha_fin', () => {
    const permiso: RegistroRH = { tipo: 'permiso', status: 'aprobado', fecha: '2026-03-02', fecha_fin: null };
    expect(esJustificada('2026-03-02', [permiso])).toBe(true);
    expect(esJustificada('2026-03-03', [permiso])).toBe(false);
  });
});
