import { AttendanceRecord } from '../types';

/**
 * REGLA INSTITUCIONAL ESTRICTA:
 * No mostrar datos de asistencia ficticios o generados aleatoriamente.
 * La asistencia se procesa exclusivamente a partir de marcaciones físicas reales.
 */
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
