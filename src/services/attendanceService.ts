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
        if (Array.isArray(desktopPunches)) return desktopPunches;
      }
      const res = await fetch(getApiUrl('/api/attendance/punches'));
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (err) {
      console.warn('[attendanceService] No se pudieron cargar marcaciones desde el servidor:', err);
      return [];
    }
  },

  /**
   * Obtiene los registros consolidados de asistencia desde el backend DRAC.
   * Si no hay asistencia generada de relojes físicos, retorna un array vacío.
   */
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      const res = await fetch(getApiUrl('/api/attendance'));
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (err) {
      console.warn('[attendanceService] No se pudo cargar asistencia desde el servidor:', err);
      return [];
    }
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
