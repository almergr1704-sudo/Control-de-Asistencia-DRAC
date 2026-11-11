import { MarcacionRaw, AttendanceRecord } from '../types';
import { getApiUrl } from '../utils/apiConfig';

export const attendanceService = {
  /**
   * Obtiene las marcaciones crudas reales desde el backend DRAC o IPC nativo.
   * Si la base de datos no contiene marcaciones físicas, retorna un array vacío.
   * NUNCA retorna marcaciones simuladas ni datos sintéticos.
   */
  async getRawPunches(): Promise<MarcacionRaw[]> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.getRawPunches) {
        const desktopPunches = await (window as any).electronAPI.getRawPunches();
        if (Array.isArray(desktopPunches) && desktopPunches.length > 0) return desktopPunches;
      }
      const res = await fetch(getApiUrl('/api/attendance/punches'));
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        if (list.length > 0) return list;
      }
    } catch (_) {}

    // Fallback Supabase: Recuperar marcaciones reales almacenadas en la base institucional
    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: supaRows } = await supabase
        .from('marcaciones_raw')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (supaRows && supaRows.length > 0) {
        return supaRows.map((r: any) => ({
          id: r.id || `zk_${r.device_sn}_${r.employee_dni}_${r.timestamp}`,
          device_id: r.device_id || 'dev-01',
          device_sn: r.device_sn || 'AEH2223460040',
          device_name: r.device_name || 'ZKTeco G3 Sede Central',
          employee_dni: r.employee_dni || r.dni_trabajador,
          employee_name: r.employee_name || 'Servidor DRAC',
          employee_code: r.employee_code || r.employee_dni,
          timestamp: r.timestamp,
          punch_type: (r.punch_type || 'AUTO') as any,
          punch_state: r.punch_state || 0,
          verify_mode: (r.verify_mode === 'FACE' ? 'FACE' : (r.verify_mode === 'PASSWORD' ? 'PASSWORD' : 'FINGERPRINT')) as any,
          processed: r.processed !== undefined ? Boolean(r.processed) : false,
          fecha: r.fecha || (r.timestamp ? r.timestamp.split(' ')[0] : ''),
          hora: r.hora || (r.timestamp ? r.timestamp.split(' ')[1] : ''),
          raw_payload: r.raw_payload || undefined,
        }));
      }
    } catch (err) {
      console.warn('[attendanceService] Fallback Supabase marcaciones:', err);
    }
    return [];
  },

  /**
   * Obtiene los registros consolidados de asistencia desde el backend DRAC o Supabase.
   * Si no hay asistencia generada de relojes físicos, retorna un array vacío.
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      const res = await fetch(getApiUrl('/api/attendance'));
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data?.data || []);
        if (list.length > 0) return list;
      }
    } catch (_) {}

    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: supaAtts } = await supabase
        .from('asistencia_diaria')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(300);

      if (supaAtts && supaAtts.length > 0) {
        return supaAtts.map((a: any) => ({
          id: a.id,
          employee_id: a.trabajador_id || a.employee_id,
          employee_dni: a.dni || a.employee_dni,
          employee_name: a.nombre_completo || a.employee_name || 'Servidor DRAC',
          dependencia_name: a.dependencia_nombre || a.dependencia_name || 'Sede Central - DRAC Cajamarca',
          area_name: a.area_nombre || a.area_name || 'General',
          fecha: a.fecha,
          horario_name: a.horario_nombre || a.horario_name || 'Jornada Institucional',
          t1_scheduled_in: a.t1_hora_entrada_programada || a.t1_scheduled_in || '08:00',
          t1_scheduled_out: a.t1_hora_salida_programada || a.t1_scheduled_out || '13:00',
          t1_real_in: a.t1_hora_entrada_real || a.t1_real_in || undefined,
          t1_real_out: a.t1_hora_salida_real || a.t1_real_out || undefined,
          t1_tardiness_minutes: a.t1_minutos_tardanza || a.t1_tardiness_minutes || 0,
          t2_scheduled_in: a.t2_hora_entrada_programada || a.t2_scheduled_in || undefined,
          t2_scheduled_out: a.t2_hora_salida_programada || a.t2_scheduled_out || undefined,
          t2_real_in: a.t2_hora_entrada_real || a.t2_real_in || undefined,
          t2_real_out: a.t2_hora_salida_real || a.t2_real_out || undefined,
          t2_tardiness_minutes: a.t2_minutos_tardanza || a.t2_tardiness_minutes || 0,
          total_effective_hours: a.horas_efectivas || a.total_effective_hours || 0,
          total_tardiness_minutes: a.minutos_tardanza || a.total_tardiness_minutes || 0,
          tolerance_applied_minutes: a.minutos_tolerancia || a.tolerance_applied_minutes || 0,
          net_tardiness_minutes: a.minutos_tardanza_neta || a.net_tardiness_minutes || 0,
          overtime_minutes: a.minutos_extra || a.overtime_minutes || 0,
          status: (a.estado || a.status || 'PUNCTUAL') as any,
          has_papeleta: Boolean(a.tiene_papeleta || a.has_papeleta),
          is_vacation_day: Boolean(a.es_dia_vacacion || a.is_vacation_day),
          observations: a.observaciones || a.observations || undefined,
        }));
      }
    } catch (_) {}

    return [];
  },

  /**
   * Sincronización bajo demanda con el reloj ZKTeco vía socket TCP o ADMS.
   */
  async syncDevice(deviceId: string): Promise<{ success: boolean; newPunches: number; message: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/zkteco/devices/${deviceId}/sync`), {
        method: 'POST',
      });
      const data = await res.json();
      return {
        success: data.success ?? false,
        newPunches: data.imported_count || data.new_count || 0,
        message: data.message || 'Sincronización procesada',
      };
    } catch (err: any) {
      return {
        success: false,
        newPunches: 0,
        message: 'Fallo al contactar el servicio de sincronización biométrica: ' + err.message,
      };
    }
  },
};
