/**
 * DRAC - Cálculo de Turnos, Ventanas de Marcación y Horas Efectivas Trabajadas
 * Dirección Regional de Agricultura Cajamarca
 */

export interface ShiftCalculationResult {
  scheduledDurationMinutes: number;
  scheduledDurationText: string;
  isOvernight: boolean;
  
  // Ventana validation
  isEntryInWindow: boolean;
  isExitInWindow: boolean;
  isValidPunchWindow: boolean;
  windowEntryStart: string;
  windowExitLimit: string;

  // Cómputo de horas efectivas
  effectiveStart: string;
  effectiveEnd: string;
  effectiveMinutes: number;
  effectiveHours: number;
  effectiveDurationText: string;

  // Tardanzas & Salidas anticipadas
  rawTardinessMinutes: number;
  netTardinessMinutes: number;
  isTolerated: boolean;
  earlyExitMinutes: number;
  
  // Resumen textual explicativo
  ruleExplanation: string;
}

/**
 * Convierte "HH:MM" a minutos transcurridos desde medianoche (0 - 1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Convierte minutos a formato "HH:MM".
 */
export function minutesToTime(mins: number): string {
  const normMins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normMins / 60);
  const m = normMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formatea minutos a "Xh Ym" o "X horas".
 */
export function formatMinutesToText(totalMins: number): string {
  if (totalMins <= 0) return '0h 00m';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Función principal para calcular duración del turno, validar ventana y calcular horas trabajadas efectivas.
 */
export function calculateShiftAndWorkedHours(params: {
  startTime: string; // ej: "08:00" (Horario del Turno: Inicio)
  endTime: string; // ej: "13:00" (Horario del Turno: Fin)
  windowEntryStart?: string; // ej: "07:00" (Ventana: Inicio marcación entrada)
  windowExitLimit?: string; // ej: "13:59" (Ventana: Límite marcación salida)
  realIn?: string | null; // ej: "07:00" o "08:05" (Marcación real biométrica)
  realOut?: string | null; // ej: "13:59" o "13:00" (Marcación real biométrica)
  toleranceMinutes?: number; // ej: 10
}): ShiftCalculationResult {
  const {
    startTime,
    endTime,
    windowEntryStart = '',
    windowExitLimit = '',
    realIn,
    realOut,
    toleranceMinutes = 10,
  } = params;

  let sMins = timeToMinutes(startTime);
  let eMins = timeToMinutes(endTime);
  let isOvernight = false;

  if (eMins <= sMins) {
    eMins += 24 * 60; // Cruce de medianoche
    isOvernight = true;
  }

  const scheduledDurationMinutes = eMins - sMins;
  const scheduledDurationText = formatMinutesToText(scheduledDurationMinutes);

  // Defaults para ventanas si no fueron especificadas explícitamente:
  // Entrada permitida por defecto: 60 mins antes del turno
  // Salida límite por defecto: 59 mins después del fin del turno
  const winEntryStr = windowEntryStart || minutesToTime(sMins - 60);
  let winExitStr = windowExitLimit || minutesToTime(eMins + 59);

  let winEntryMins = timeToMinutes(winEntryStr);
  let winExitMins = timeToMinutes(winExitStr);

  if (winEntryMins > sMins && !isOvernight) {
    // Si la hora de ventana inicio parece mayor en reloj normal (ej: 23:00 para turno 00:00)
    winEntryMins -= 24 * 60;
  }

  if (winExitMins < eMins) {
    winExitMins += 24 * 60;
  }

  // Validación de marcaciones reales (si están presentes)
  let isEntryInWindow = true;
  let isExitInWindow = true;
  let rawTardinessMinutes = 0;
  let netTardinessMinutes = 0;
  let isTolerated = false;
  let earlyExitMinutes = 0;

  let effectiveStartMins = sMins;
  let effectiveEndMins = eMins;

  if (realIn) {
    let rInMins = timeToMinutes(realIn);
    if (isOvernight && rInMins < winEntryMins && rInMins < sMins) {
      rInMins += 24 * 60;
    }

    // Verificar ventana de entrada
    isEntryInWindow = rInMins >= winEntryMins && rInMins <= eMins;

    // Regla de inicio efectivo:
    // Si marca dentro de la ventana anticipada (ej: 07:00 para turno de 08:00),
    // el cálculo empieza estrictamente a la hora de inicio del turno (08:00).
    if (rInMins <= sMins) {
      effectiveStartMins = sMins; // Topado al inicio del turno
      rawTardinessMinutes = 0;
      netTardinessMinutes = 0;
    } else {
      // Marcó después de la hora de inicio (ej: 08:15)
      effectiveStartMins = rInMins;
      rawTardinessMinutes = rInMins - sMins;
      if (rawTardinessMinutes <= toleranceMinutes) {
        isTolerated = true;
        netTardinessMinutes = 0;
      } else {
        isTolerated = false;
        netTardinessMinutes = rawTardinessMinutes;
      }
    }
  }

  if (realOut) {
    let rOutMins = timeToMinutes(realOut);
    if (isOvernight && rOutMins < sMins) {
      rOutMins += 24 * 60;
    }

    // Verificar ventana de salida
    isExitInWindow = rOutMins >= sMins && rOutMins <= winExitMins;

    // Regla de fin efectivo:
    // Si marca salida después del fin del turno (ej: 13:59 para turno de 13:00),
    // el tiempo efectivo se topa estrictamente a la hora fin del turno (13:00).
    if (rOutMins >= eMins) {
      effectiveEndMins = eMins; // Topado al fin del turno
      earlyExitMinutes = 0;
    } else {
      // Marcó salida antes de tiempo (ej: 12:45 para turno de 13:00)
      effectiveEndMins = rOutMins;
      earlyExitMinutes = eMins - rOutMins;
    }
  }

  const isValidPunchWindow = Boolean(realIn && realOut && isEntryInWindow && isExitInWindow);
  
  const effectiveMinutes = Math.max(0, effectiveEndMins - effectiveStartMins);
  const effectiveHours = Math.round((effectiveMinutes / 60) * 100) / 100;
  const effectiveDurationText = formatMinutesToText(effectiveMinutes);

  const effectiveStart = minutesToTime(effectiveStartMins);
  const effectiveEnd = minutesToTime(effectiveEndMins);

  // Explicación textual de la regla aplicada
  let ruleExplanation = `Jornada estándar: ${startTime} a ${endTime} (${scheduledDurationText}).`;
  if (realIn && realOut) {
    if (timeToMinutes(realIn) < sMins && timeToMinutes(realOut) > (eMins % 1440)) {
      ruleExplanation = `Marcó entrada anticipada (${realIn}) y salida extendida (${realOut}) dentro de ventana permitida. Tiempo efectivo contabilizado estrictamente al turno: ${effectiveDurationText} (${startTime} a ${endTime}).`;
    } else if (timeToMinutes(realIn) > sMins) {
      ruleExplanation = `Marcó con tardanza (${realIn}). Inicio efectivo: ${effectiveStart}. Tiempo efectivo computado: ${effectiveDurationText}.`;
    } else if (timeToMinutes(realOut) < (eMins % 1440)) {
      ruleExplanation = `Marcó salida anticipada (${realOut}). Fin efectivo: ${effectiveEnd}. Tiempo efectivo computado: ${effectiveDurationText}.`;
    }
  }

  return {
    scheduledDurationMinutes,
    scheduledDurationText,
    isOvernight,
    isEntryInWindow,
    isExitInWindow,
    isValidPunchWindow,
    windowEntryStart: winEntryStr,
    windowExitLimit: winExitStr,
    effectiveStart,
    effectiveEnd,
    effectiveMinutes,
    effectiveHours,
    effectiveDurationText,
    rawTardinessMinutes,
    netTardinessMinutes,
    isTolerated,
    earlyExitMinutes,
    ruleExplanation,
  };
}
