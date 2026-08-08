import { describe, it, expect } from 'vitest';
import { tipoTurnoHoras, tipoTurnoLabel, type TipoTurno } from '@/lib/asistencias-helpers';

/**
 * Critical business rules for shifts and overtime.
 *
 * These mirror the calculation used by ShiftControl: once a guard passes the
 * expected shift length, the shift still counts as ONE turno and the surplus
 * is reported separately as `horas_extra`.
 */
function calcularHorasExtra(inicio: Date, fin: Date, tipo: TipoTurno): number {
  const horas = (fin.getTime() - inicio.getTime()) / 3_600_000;
  const esperado = tipoTurnoHoras(tipo);
  return Math.max(0, Number((horas - esperado).toFixed(2)));
}

function esTurnoIncompleto(inicio: Date, fin: Date, tipo: TipoTurno): boolean {
  const horas = (fin.getTime() - inicio.getTime()) / 3_600_000;
  return horas < tipoTurnoHoras(tipo);
}

const at = (h: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + h * 3_600_000);

describe('reglas de turno', () => {
  it('define las horas esperadas por tipo de turno', () => {
    expect(tipoTurnoHoras('12h')).toBe(12);
    expect(tipoTurnoHoras('24h')).toBe(24);
    expect(tipoTurnoHoras('corrido')).toBe(24);
  });

  it('etiqueta los tipos de turno en español', () => {
    expect(tipoTurnoLabel('12h')).toBe('12 horas');
    expect(tipoTurnoLabel('corrido')).toBe('De corrido');
  });

  it('no genera horas extra dentro del turno', () => {
    expect(calcularHorasExtra(at(0), at(11.5), '12h')).toBe(0);
    expect(calcularHorasExtra(at(0), at(12), '12h')).toBe(0);
  });

  it('cuenta las horas extra a partir del fin esperado', () => {
    expect(calcularHorasExtra(at(0), at(14.5), '12h')).toBe(2.5);
    expect(calcularHorasExtra(at(0), at(26), '24h')).toBe(2);
  });

  it('marca incompleto cuando se finaliza antes del tiempo', () => {
    expect(esTurnoIncompleto(at(0), at(8), '12h')).toBe(true);
    expect(esTurnoIncompleto(at(0), at(12), '12h')).toBe(false);
  });
});
