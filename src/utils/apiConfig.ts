/**
 * DRAC Cajamarca - API Configuration Helper
 * Resuelve rutas de API de forma segura para comunicación cliente-servidor e IPC.
 */

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    // Si la aplicación se ejecuta bajo protocolo file:/// (ej. Electron empaquetado)
    if (window.location.protocol === 'file:') {
      return `http://127.0.0.1:3000${cleanPath}`;
    }
  }
  return cleanPath;
}
