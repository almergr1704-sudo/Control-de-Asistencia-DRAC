/**
 * DRAC Cajamarca - API Configuration Helper
 * Resuelve rutas de API de forma segura para comunicación cliente-servidor e IPC.
 */

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}
