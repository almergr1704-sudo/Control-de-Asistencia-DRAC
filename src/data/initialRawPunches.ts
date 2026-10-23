import { MarcacionRaw } from '../types';

/**
 * REGLA INSTITUCIONAL ESTRICTA:
 * No mostrar datos, marcaciones o información ficticia, simulada o sintética.
 * Solo se almacenan y visualizan marcaciones reales provenientes de hardware ZKTeco
 * (G3-id vía Socket TCP 192.168.1.180:4370, ADMS Push HTTP /api/zkteco/push,
 * o exportación real USB .dat).
 */
export const INITIAL_RAW_PUNCHES: MarcacionRaw[] = [];
