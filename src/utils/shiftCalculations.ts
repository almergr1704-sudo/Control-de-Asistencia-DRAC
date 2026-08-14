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

export interface ShiftDetails {
  hours: number;
  minutes: number;
  totalMinutes: number;
  text: string;
  isOvernight: boolean;
  isValid: boolean;
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
  if (totalMins <= 0) return '0 horas';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Calcula la duración exacta de un turno laboral a partir de inicio y fin.
 */
export function getShiftDurationDetails(startTime: string, endTime: string): ShiftDetails {
  if (!startTime || !endTime) {
    return { hours: 0, minutes: 0, totalMinutes: 0, text: '0 horas', isOvernight: false, isValid: false };
  }
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if (
    isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM) ||
    sH < 0 || sH > 23 || eH < 0 || eH > 23 || sM < 0 || sM > 59 || eM < 0 || eM > 59
  ) {
    return { hours: 0, minutes: 0, totalMinutes: 0, text: 'Hora Inválida', isOvernight: false, isValid: false };
  }

  let sMins = sH * 60 + sM;
  let eMins = eH * 60 + eM;
  let isOvernight = false;

  if (eMins <= sMins) {
    eMins += 24 * 60;
    isOvernight = true;
  }

  const diffMins = eMins - sMins;
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  let text = '';
  if (minutes === 0) {
    text = `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else {
    text = `${hours}h ${minutes}m`;
  }

  if (isOvernight) {
    text += ' (+1 día)';
  }

  return { hours, minutes, totalMinutes: diffMins, text, isOvernight, isValid: true };
}

/**
 * Valida si dos turnos dentro de un mismo horario se superponen temporalmente.
 */
export function validateShiftOverlap(
  t1: { start_time: string; end_time: string; name?: string } | null,
  t2: { start_time: string; end_time: string; name?: string } | null
): { hasOverlap: boolean; message?: string } {
  if (!t1 || !t2) return { hasOverlap: false };
  if (!t1.start_time || !t1.end_time || !t2.start_time || !t2.end_time) {
    return { hasOverlap: false };
  }

  let s1 = timeToMinutes(t1.start_time);
  let e1 = timeToMinutes(t1.end_time);
  let s2 = timeToMinutes(t2.start_time);
  let e2 = timeToMinutes(t2.end_time);

  // Cruce de medianoche en turno 1
  if (e1 <= s1) e1 += 24 * 60;
  // Cruce de medianoche en turno 2
  if (e2 <= s2) e2 += 24 * 60;

  // Validación 1: Mismo horario exacto
  if (s1 === s2 && e1 === e2) {
    return {
      hasOverlap: true,
      message: `El Turno 1 y el Turno 2 tienen exactamente el mismo rango horario (${t1.start_time} → ${t1.end_time}).`,
    };
  }

  // Validación 2: Superposición directa en el mismo día
  // Caso A: intervalo estándar [s1, e1) y [s2, e2)
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  if (overlapStart < overlapEnd) {
    const startStr = minutesToTime(overlapStart);
    const endStr = minutesToTime(overlapEnd);
    return {
      hasOverlap: true,
      message: `Los turnos se superponen entre las ${startStr} y las ${endStr}. El Turno 1 (${t1.start_time} → ${t1.end_time}) y Turno 2 (${t2.start_time} → ${t2.end_time}) no pueden cruzar sus horarios.`,
    };
  }

  // Caso B: Si turno 1 cruza medianoche y turno 2 se ubica al día siguiente en el rango traslapado
  if (e1 > 1440) {
    const wrappedE1 = e1 - 1440;
    if (s2 < wrappedE1) {
      return {
        hasOverlap: true,
        message: `El Turno 1 cruza la medianoche hasta las ${t1.end_time} y se superpone con el Turno 2 que inicia a las ${t2.start_time}.`,
      };
    }
  }

  return { hasOverlap: false };
}

/**
 * Calcula la duración total combinada de un horario (1 o 2 turnos).
 */
export function calculateScheduleTotalDuration(
  t1?: { start_time: string; end_time: string; name?: string } | null,
  t2?: { start_time: string; end_time: string; name?: string } | null
): {
  totalHours: number;
  totalMinutes: number;
  totalDurationText: string;
  breakdownText: string;
  t1Details?: ShiftDetails;
  t2Details?: ShiftDetails;
} {
  const d1 = t1 ? getShiftDurationDetails(t1.start_time, t1.end_time) : null;
  const d2 = t2 ? getShiftDurationDetails(t2.start_time, t2.end_time) : null;

  const totalMinutes = (d1 ? d1.totalMinutes : 0) + (d2 ? d2.totalMinutes : 0);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const totalDurationText = formatMinutesToText(totalMinutes);

  let breakdownText = '';
  if (d1 && d2) {
    breakdownText = `${d1.text} (T1) + ${d2.text} (T2) = ${totalDurationText}`;
  } else if (d1) {
    breakdownText = `${d1.text} (Jornada Continua)`;
  } else {
    breakdownText = '0 horas';
  }

  return {
    totalHours,
    totalMinutes,
    totalDurationText,
    breakdownText,
    t1Details: d1 || undefined,
    t2Details: d2 || undefined,
  };
}

/**
 * Función principal para calcular duración del turno, validar ventana y calcular horas trabajadas efectivas.
 */
export function calculateShiftAndWorkedHours(params: {
  startTime: string; // Horario del Turno: Inicio (TIME)
  endTime: string; // Horario del Turno: Fin (TIME) - Evaluación estricta
  windowEntryStart?: string; // Ventana: Inicio marcación entrada (TIME)
  windowExitLimit?: string; // Ventana: Límite marcación salida (TIME)
  realIn?: string | null; // Marcación real biométrica entrada (TIME)
  realOut?: string | null; // Marcación real biométrica salida (TIME)
  toleranceMinutes?: number; // Tolerancia de entrada en minutos
  toleranceExitMinutes?: number; // Tolerancia de salida en minutos
}): ShiftCalculationResult {
  const {
    startTime,
    endTime,
    windowEntryStart = '',
    windowExitLimit = '',
    realIn,
    realOut,
    toleranceMinutes = 10,
    toleranceExitMinutes = 0,
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
    winEntryMins -= 24 * 60;
  }

  if (winExitMins < eMins) {
    winExitMins += 24 * 60;
  }

  // Validación de marcaciones reales
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
    // Si marca dentro de la ventana anticipada, el cómputo inicia a la hora de inicio del turno.
    if (rInMins <= sMins) {
      effectiveStartMins = sMins; // Topado al inicio del turno
      rawTardinessMinutes = 0;
      netTardinessMinutes = 0;
    } else {
      // Marcó después de la hora de inicio
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
    // Si marca salida igual o después del fin del turno, el tiempo efectivo se topa a la hora fin del turno.
    if (rOutMins >= eMins) {
      effectiveEndMins = eMins; // Topado al fin del turno
      earlyExitMinutes = 0;
    } else {
      // Marcó salida antes de la hora final configurada
      effectiveEndMins = rOutMins;
      const rawEarlyExit = eMins - rOutMins;
      if (toleranceExitMinutes > 0 && rawEarlyExit <= toleranceExitMinutes) {
        earlyExitMinutes = 0;
      } else {
        earlyExitMinutes = rawEarlyExit;
      }
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
    if (timeToMinutes(realIn) < sMins && timeToMinutes(realOut) >= (eMins % 1440)) {
      ruleExplanation = `Marcó entrada anticipada (${realIn}) y salida regular/extendida (${realOut}) dentro de ventana permitida. Tiempo efectivo contabilizado estrictamente al turno: ${effectiveDurationText} (${startTime} a ${endTime}).`;
    } else if (timeToMinutes(realIn) > sMins && timeToMinutes(realOut) < (eMins % 1440)) {
      ruleExplanation = `Marcó con tardanza (${realIn}) y salida anticipada (${realOut}, -${earlyExitMinutes} min). Inicio efectivo: ${effectiveStart}, Fin efectivo: ${effectiveEnd}. Tiempo efectivo: ${effectiveDurationText}.`;
    } else if (timeToMinutes(realIn) > sMins) {
      ruleExplanation = `Marcó con tardanza (${realIn}). Inicio efectivo: ${effectiveStart}. Tiempo efectivo computado: ${effectiveDurationText}.`;
    } else if (timeToMinutes(realOut) < (eMins % 1440)) {
      ruleExplanation = `Salida anticipada (${realOut}, -${earlyExitMinutes} min de diferencia exacta). Fin efectivo: ${effectiveEnd}. Tiempo efectivo computado: ${effectiveDurationText}.`;
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
