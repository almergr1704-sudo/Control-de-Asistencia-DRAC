import { MarcacionRaw } from '../types';

/**
 * REGLA INSTITUCIONAL ESTRICTA (DRAC CAJAMARCA):
 * Queda terminantemente prohibido generar, simular, autocompletar o mostrar marcaciones ficticias.
 * Solamente se almacenan y muestran registros reales recibidos y verificados desde el marcador
 * biométrico ZKTeco G3 (192.168.1.198:7496) vía Socket TCP o ADMS Push.
 * Si el marcador no ha transmitido marcaciones, el estado inicial es un conjunto vacío ([]).
 */
export const INITIAL_RAW_PUNCHES: MarcacionRaw[] = [];
