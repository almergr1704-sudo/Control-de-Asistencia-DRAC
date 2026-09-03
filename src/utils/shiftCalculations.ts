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
 * Convierte cualquier formato de tiempo ("HH:mm:ss", "HH:mm" o "YYYY-MM-DD HH:mm:ss")
 * a segundos desde medianoche (0 - 86399).
 */
export function timeToSeconds(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const clean = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr.trim();
  const parts = clean.split(':').map(Number);
  const h = isNaN(parts[0]) ? 0 : parts[0];
  const m = isNaN(parts[1]) ? 0 : parts[1];
  const s = parts.length >= 3 && !isNaN(parts[2]) ? parts[2] : 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Convierte segundos a formato "HH:mm:ss" o "HH:mm".
 */
export function secondsToTime(totalSeconds: number, includeSeconds = true): string {
  const normSec = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const h = Math.floor(normSec / 3600);
  const m = Math.floor((normSec % 3600) / 60);
  const s = normSec % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return includeSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

/**
 * Extrae la porción de tiempo de un timestamp ("YYYY-MM-DD HH:mm:ss" -> "HH:mm:ss").
 */
export function extractPunchTime(timestamp: string): string {
  if (!timestamp) return '';
  const timePart = timestamp.includes(' ') ? timestamp.split(' ')[1] : timestamp.trim();
  return timePart;
}

/**
 * Parsea el límite de salida a segundos exactos.
 * Soporta segundos explícitos ("13:59:59") y formato estándar "HH:mm".
 */
export function parseExitLimitToSeconds(limitStr?: string, defaultEndShiftSec?: number): number {
  if (!limitStr || !limitStr.trim()) {
    return (defaultEndShiftSec || 0) + 59 * 60 + 59;
  }
  const clean = limitStr.includes(' ') ? limitStr.split(' ')[1] : limitStr.trim();
  const parts = clean.split(':').map(Number);
  const h = isNaN(parts[0]) ? 0 : parts[0];
  const m = isNaN(parts[1]) ? 0 : parts[1];

  if (parts.length >= 3 && !isNaN(parts[2])) {
    return h * 3600 + m * 60 + parts[2];
  }

  // Si no tiene segundos explícitos:
  // Si m == 59 (ej. "13:59"), el segundo final de ese minuto es 13:59:59
  if (m === 59) {
    return h * 3600 + 59 * 60 + 59;
  }
  // Si se configuró hora en punto posterior al fin de turno (ej. "14:00" para turno que termina 13:00)
  // donde 14:00:00 queda fuera de rango, el límite inclusivo es 13:59:59 (14:00:00 - 1)
  if (defaultEndShiftSec && (h * 3600 + m * 60) > defaultEndShiftSec && m === 0) {
    return (h * 3600 + m * 60) - 1;
  }
  // Por defecto, hasta el final del minuto especificado
  return h * 3600 + m * 60 + 59;
}

export interface ShiftEvaluationRanges {
  startTime: string;
  endTime: string;
  startShiftSec: number;
  endShiftSec: number;

  entryStartSec: number;
  entryEndSec: number;
  entryStartText: string;
  entryEndText: string;
  entryRangeText: string;

  exitStartSec: number;
  exitEndSec: number;
  exitStartText: string;
  exitEndText: string;
  exitRangeText: string;

  toleranceMinutes: number;
}

/**
 * Calcula los rangos estrictos en segundos de Entrada y Salida para un turno.
 * 
 * Regla de Entrada:
 * - Inicio: window_entry_start (o 60 mins antes del inicio si no está configurado)
 * - Fin: start_time + tolerance_minutes
 * - Rango: [entryStartSec, entryEndSec]
 * 
 * Regla de Salida:
 * - Inicio: end_time + 1 segundo (estrictamente posterior a la finalización del turno)
 * - Fin: window_exit_limit (o end_time + 59 min 59 sec)
 * - Rango: [exitStartSec, exitEndSec]
 */
export function getShiftEvaluationRanges(turno: {
  start_time: string;
  end_time: string;
  window_entry_start?: string;
  window_exit_limit?: string;
  tolerance_minutes?: number;
} | undefined): ShiftEvaluationRanges {
  const startTime = turno?.start_time || '08:00';
  const endTime = turno?.end_time || '13:00';
  const toleranceMinutes = turno?.tolerance_minutes ?? 10;

  const startShiftSec = timeToSeconds(startTime);
  const endShiftSec = timeToSeconds(endTime);

  // Entrada:
  // window_entry_start o 60 minutos antes
  const entryStartSec = turno?.window_entry_start
    ? timeToSeconds(turno.window_entry_start)
    : Math.max(0, startShiftSec - 60 * 60);

  // Fin de rango de entrada = inicio de turno + tolerancia en segundos
  const entryEndSec = startShiftSec + toleranceMinutes * 60;

  // Salida:
  // Comienza 1 segundo después del fin de turno
  const exitStartSec = endShiftSec + 1;
  // Termina en window_exit_limit (o fin de turno + 59 min 59 sec)
  const exitEndSec = parseExitLimitToSeconds(turno?.window_exit_limit, endShiftSec);

  const entryStartText = secondsToTime(entryStartSec);
  const entryEndText = secondsToTime(entryEndSec);
  const exitStartText = secondsToTime(exitStartSec);
  const exitEndText = secondsToTime(exitEndSec);

  return {
    startTime,
    endTime,
    startShiftSec,
    endShiftSec,
    entryStartSec,
    entryEndSec,
    entryStartText,
    entryEndText,
    entryRangeText: `${entryStartText} - ${entryEndText}`,
    exitStartSec,
    exitEndSec,
    exitStartText,
    exitEndText,
    exitRangeText: `${exitStartText} - ${exitEndText}`,
    toleranceMinutes,
  };
}

export interface ShiftPunchEvaluation {
  firstValidEntry?: string; // Hora formateada (ej. "06:05:00" o "06:05")
  firstValidExit?: string; // Hora formateada (ej. "13:05:00" o "13:05")
  firstValidEntryPunch?: any;
  firstValidExitPunch?: any;
  repeatedEntryPunches: any[];
  repeatedExitPunches: any[];
  invalidPunches: any[];
  ranges: ShiftEvaluationRanges;
}

/**
 * Evalúa una lista de marcaciones contra las reglas estrictas de un turno.
 * 
 * 1. Ordena cronológicamente todas las marcaciones.
 * 2. Identifica la PRIMERA marcación cronológica dentro de [entryStartSec, entryEndSec].
 *    Las marcaciones posteriores en este rango son repetidas (ignoradas).
 * 3. Identifica la PRIMERA marcación cronológica dentro de [exitStartSec, exitEndSec].
 *    Las marcaciones posteriores en este rango son repetidas (ignoradas, nunca reemplazan la primera).
 * 4. Las marcaciones fuera de los rangos no se convierten en válidas.
 */
export function evaluatePunchesForShift(
  punches: Array<{ timestamp: string; [key: string]: any }>,
  turno: {
    start_time: string;
    end_time: string;
    window_entry_start?: string;
    window_exit_limit?: string;
    tolerance_minutes?: number;
  } | undefined
): ShiftPunchEvaluation {
  const ranges = getShiftEvaluationRanges(turno);

  // Ordenar cronológicamente todas las marcaciones
  const sortedPunches = [...punches].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  let firstValidEntry: string | undefined;
  let firstValidExit: string | undefined;
  let firstValidEntryPunch: any = undefined;
  let firstValidExitPunch: any = undefined;

  const repeatedEntryPunches: any[] = [];
  const repeatedExitPunches: any[] = [];
  const invalidPunches: any[] = [];

  for (const punch of sortedPunches) {
    const timeStr = extractPunchTime(punch.timestamp);
    const punchSec = timeToSeconds(timeStr);

    // 1. Evaluar para Rango de Entrada [entryStartSec, entryEndSec]
    if (punchSec >= ranges.entryStartSec && punchSec <= ranges.entryEndSec) {
      if (!firstValidEntry) {
        firstValidEntry = timeStr;
        firstValidEntryPunch = punch;
      } else {
        // Marcación repetida dentro del rango permitido de entrada (se ignora para asistencia)
        repeatedEntryPunches.push(punch);
      }
      continue;
    }

    // 2. Evaluar para Rango de Salida [exitStartSec, exitEndSec]
    if (punchSec >= ranges.exitStartSec && punchSec <= ranges.exitEndSec) {
      if (!firstValidExit) {
        firstValidExit = timeStr;
        firstValidExitPunch = punch;
      } else {
        // Marcación repetida dentro del rango permitido de salida (nunca reemplaza a la primera válida)
        repeatedExitPunches.push(punch);
      }
      continue;
    }

    // 3. Fuera de rangos permitidos (ej. antes de inicio permitido, después de tolerancia, o durante el turno)
    invalidPunches.push(punch);
  }

  return {
    firstValidEntry,
    firstValidExit,
    firstValidEntryPunch,
    firstValidExitPunch,
    repeatedEntryPunches,
    repeatedExitPunches,
    invalidPunches,
    ranges,
  };
}

export interface DaySchedulePunchEvaluation {
  t1_real_in?: string;
  t1_real_out?: string;
  t2_real_in?: string;
  t2_real_out?: string;
  t1_evaluation: ShiftPunchEvaluation;
  t2_evaluation?: ShiftPunchEvaluation;
  t1_tardiness_minutes: number;
  t2_tardiness_minutes: number;
  total_tardiness_minutes: number;
  net_tardiness_minutes: number;
  tolerance_applied_minutes: number;
  observations: string;
}

/**
 * Evalúa las marcaciones de un día completo para un horario institucional (1 o 2 turnos independientes).
 */
export function evaluatePunchesForSchedule(
  punches: Array<{ timestamp: string; [key: string]: any }>,
  horario: {
    turn_count?: 1 | 2 | number;
    turno1_id?: string | null;
    turno2_id?: string | null;
  } | undefined,
  turnos: Array<{
    id: string;
    start_time: string;
    end_time: string;
    window_entry_start?: string;
    window_exit_limit?: string;
    tolerance_minutes: number;
  }>
): DaySchedulePunchEvaluation {
  const t1 = horario?.turno1_id ? turnos.find((t) => t.id === horario.turno1_id) : turnos[0];
  const isDual = (horario?.turn_count === 2 || Boolean(horario?.turno2_id)) && turnos.length > 1;
  const t2 = isDual && horario?.turno2_id ? turnos.find((t) => t.id === horario.turno2_id) : (isDual ? turnos[1] : undefined);

  // 1. Evaluar Turno 1
  const t1Evaluation = evaluatePunchesForShift(punches, t1);

  // 2. Si existe Turno 2, evaluar Turno 2 independientemente
  let t2Evaluation: ShiftPunchEvaluation | undefined;
  if (isDual && t2) {
    // Si una marcación ya fue consumida como entrada o salida válida de Turno 1, no duplicarla en Turno 2
    const remainingPunches = punches.filter(
      (p) => p !== t1Evaluation.firstValidEntryPunch && p !== t1Evaluation.firstValidExitPunch
    );
    t2Evaluation = evaluatePunchesForShift(remainingPunches, t2);
  }

  const t1_real_in = t1Evaluation.firstValidEntry;
  const t1_real_out = t1Evaluation.firstValidExit;
  const t2_real_in = t2Evaluation?.firstValidEntry;
  const t2_real_out = t2Evaluation?.firstValidExit;

  // Cálculo de tardanza Turno 1: Se compara t1_real_in con t1.start_time
  let t1Tardiness = 0;
  const t1Tol = t1?.tolerance_minutes ?? 10;
  if (t1_real_in && t1) {
    const punchSec = timeToSeconds(t1_real_in);
    const startSec = timeToSeconds(t1.start_time);
    if (punchSec > startSec) {
      t1Tardiness = Math.ceil((punchSec - startSec) / 60);
    }
  }

  // Cálculo de tardanza Turno 2
  let t2Tardiness = 0;
  const t2Tol = t2?.tolerance_minutes ?? 10;
  if (t2_real_in && t2) {
    const punchSec = timeToSeconds(t2_real_in);
    const startSec = timeToSeconds(t2.start_time);
    if (punchSec > startSec) {
      t2Tardiness = Math.ceil((punchSec - startSec) / 60);
    }
  }

  const totalTardiness = t1Tardiness + t2Tardiness;
  const toleranceApplied = t1Tol + (t2 ? t2Tol : 0);
  const netTardiness = totalTardiness > toleranceApplied ? totalTardiness - toleranceApplied : 0;

  // Generar observaciones
  const obsList: string[] = [];
  if (!t1_real_in) {
    obsList.push(`T1: Sin marcación válida de entrada (${t1Evaluation.ranges.entryRangeText})`);
  }
  if (!t1_real_out) {
    obsList.push(`T1: Sin marcación válida de salida (${t1Evaluation.ranges.exitRangeText})`);
  }
  if (t2) {
    if (!t2_real_in) {
      obsList.push(`T2: Sin marcación válida de entrada (${t2Evaluation?.ranges.entryRangeText})`);
    }
    if (!t2_real_out) {
      obsList.push(`T2: Sin marcación válida de salida (${t2Evaluation?.ranges.exitRangeText})`);
    }
  }

  const observations = obsList.length > 0 ? obsList.join('. ') : 'Marcaciones procesadas conforme a rangos estrictos.';

  return {
    t1_real_in,
    t1_real_out,
    t2_real_in,
    t2_real_out,
    t1_evaluation: t1Evaluation,
    t2_evaluation: t2Evaluation,
    t1_tardiness_minutes: t1Tardiness,
    t2_tardiness_minutes: t2Tardiness,
    total_tardiness_minutes: totalTardiness,
    net_tardiness_minutes: netTardiness,
    tolerance_applied_minutes: toleranceApplied,
    observations,
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

  const startShiftSec = timeToSeconds(startTime);
  let endShiftSec = timeToSeconds(endTime);
  let isOvernight = false;

  if (endShiftSec <= startShiftSec) {
    endShiftSec += 24 * 3600; // Cruce de medianoche
    isOvernight = true;
  }

  const scheduledDurationMinutes = Math.round((endShiftSec - startShiftSec) / 60);
  const scheduledDurationText = formatMinutesToText(scheduledDurationMinutes);

  // Rango estricto de entrada:
  // [entryStartSec, entryEndSec] donde entryEndSec = startShiftSec + toleranceMinutes * 60
  const entryStartSec = windowEntryStart
    ? timeToSeconds(windowEntryStart)
    : Math.max(0, startShiftSec - 60 * 60);
  const entryEndSec = startShiftSec + toleranceMinutes * 60;

  // Rango estricto de salida:
  // [exitStartSec, exitEndSec] donde exitStartSec = endShiftSec + 1 y exitEndSec = parseExitLimitToSeconds(...)
  const exitStartSec = endShiftSec + 1;
  const exitEndSec = parseExitLimitToSeconds(windowExitLimit, endShiftSec);

  const winEntryStr = secondsToTime(entryStartSec);
  const winExitStr = secondsToTime(exitEndSec);

  // Validación de marcaciones reales con precisión de segundos
  let isEntryInWindow = true;
  let isExitInWindow = true;
  let rawTardinessMinutes = 0;
  let netTardinessMinutes = 0;
  let isTolerated = false;
  let earlyExitMinutes = 0;

  let effectiveStartSec = startShiftSec;
  let effectiveEndSec = endShiftSec;

  if (realIn) {
    let rInSec = timeToSeconds(realIn);
    if (isOvernight && rInSec < entryStartSec && rInSec < startShiftSec) {
      rInSec += 24 * 3600;
    }

    // Verificar si la entrada está en el rango permitido: [entryStartSec, entryEndSec]
    isEntryInWindow = rInSec >= entryStartSec && rInSec <= entryEndSec;

    // Regla de inicio efectivo:
    // Si marca dentro de la ventana anticipada (antes de startShiftSec), el cómputo inicia a la hora de inicio del turno.
    if (rInSec <= startShiftSec) {
      effectiveStartSec = startShiftSec; // Topado al inicio del turno
      rawTardinessMinutes = 0;
      netTardinessMinutes = 0;
      isTolerated = true;
    } else {
      // Marcó después de la hora de inicio
      effectiveStartSec = rInSec;
      const tardinessSec = rInSec - startShiftSec;
      rawTardinessMinutes = Math.ceil(tardinessSec / 60);
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
    let rOutSec = timeToSeconds(realOut);
    if (isOvernight && rOutSec < startShiftSec) {
      rOutSec += 24 * 3600;
    }

    // Verificar si la salida está en el rango permitido: [exitStartSec, exitEndSec]
    isExitInWindow = rOutSec >= exitStartSec && rOutSec <= exitEndSec;

    // Regla de fin efectivo:
    // Si marca salida igual o después del fin del turno, el tiempo efectivo se topa a la hora fin del turno.
    if (rOutSec >= endShiftSec) {
      effectiveEndSec = endShiftSec; // Topado al fin del turno
      earlyExitMinutes = 0;
    } else {
      // Marcó salida antes de la hora final configurada
      effectiveEndSec = rOutSec;
      const rawEarlyExitSec = endShiftSec - rOutSec;
      const rawEarlyExit = Math.ceil(rawEarlyExitSec / 60);
      if (toleranceExitMinutes > 0 && rawEarlyExit <= toleranceExitMinutes) {
        earlyExitMinutes = 0;
      } else {
        earlyExitMinutes = rawEarlyExit;
      }
    }
  }

  const isValidPunchWindow = Boolean(realIn && realOut && isEntryInWindow && isExitInWindow);
  
  const effectiveMinutes = Math.max(0, Math.round((effectiveEndSec - effectiveStartSec) / 60));
  const effectiveHours = Math.round((effectiveMinutes / 60) * 100) / 100;
  const effectiveDurationText = formatMinutesToText(effectiveMinutes);

  const effectiveStart = secondsToTime(effectiveStartSec, false);
  const effectiveEnd = secondsToTime(effectiveEndSec, false);

  // Explicación textual de la regla aplicada
  let ruleExplanation = `Jornada estándar: ${startTime} a ${endTime} (${scheduledDurationText}). Rango Entrada: ${secondsToTime(entryStartSec)} a ${secondsToTime(entryEndSec)}. Rango Salida: ${secondsToTime(exitStartSec)} a ${secondsToTime(exitEndSec)}.`;
  if (realIn && realOut) {
    if (!isEntryInWindow) {
      ruleExplanation = `Marcación de entrada (${realIn}) fuera del rango permitido (${secondsToTime(entryStartSec)} - ${secondsToTime(entryEndSec)}).`;
    } else if (!isExitInWindow) {
      ruleExplanation = `Marcación de salida (${realOut}) fuera del rango permitido (${secondsToTime(exitStartSec)} - ${secondsToTime(exitEndSec)}).`;
    } else if (timeToSeconds(realIn) <= startShiftSec && timeToSeconds(realOut) >= endShiftSec) {
      ruleExplanation = `Marcó entrada válida anticipada/puntual (${realIn}) y salida válida (${realOut}). Tiempo efectivo contabilizado estrictamente al turno: ${effectiveDurationText} (${startTime} a ${endTime}).`;
    } else if (timeToSeconds(realIn) > startShiftSec && timeToSeconds(realOut) < endShiftSec) {
      ruleExplanation = `Marcó con tardanza (${realIn}) y salida anticipada (${realOut}, -${earlyExitMinutes} min). Inicio efectivo: ${effectiveStart}, Fin efectivo: ${effectiveEnd}. Tiempo efectivo: ${effectiveDurationText}.`;
    } else if (timeToSeconds(realIn) > startShiftSec) {
      ruleExplanation = `Marcó con tardanza tolerada/registrada (${realIn}). Inicio efectivo: ${effectiveStart}. Tiempo efectivo computado: ${effectiveDurationText}.`;
    } else if (timeToSeconds(realOut) < endShiftSec) {
      ruleExplanation = `Salida anticipada (${realOut}, -${earlyExitMinutes} min). Fin efectivo: ${effectiveEnd}. Tiempo efectivo computado: ${effectiveDurationText}.`;
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
