/**
 * DRAC CAJAMARCA - Desktop Download Management Utility
 * Handles reliable downloads for Windows Desktop installer (.exe) and package (.zip)
 * across Local Dev, AI Studio Sandbox, and Production Web (Vercel / Cloud).
 */

export interface DownloadOptionInfo {
  type: 'exe' | 'zip';
  label: string;
  filename: string;
  size: string;
  recommended?: boolean;
  directUrl: string;
  apiUrl: string;
  remoteUrl: string;
  isConfigured: boolean;
  description: string;
}

const DEFAULT_EXE_FILENAME = 'DRAC-Control-de-Asistencia.exe';
const DEFAULT_ZIP_FILENAME = 'DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip';

export async function fetchServerDownloadStatus(): Promise<{
  exeAvailable: boolean;
  exeSize: string;
  zipAvailable: boolean;
  zipSize: string;
}> {
  try {
    const res = await fetch('/api/download/status');
    if (res.ok) {
      const data = await res.json();
      return {
        exeAvailable: Boolean(data?.exe?.available),
        exeSize: data?.exe?.size && data.exe.size !== '0 MB' ? data.exe.size : '34.4 MB',
        zipAvailable: Boolean(data?.zip?.available),
        zipSize: data?.zip?.size || '34.4 MB',
      };
    }
  } catch {}
  return {
    exeAvailable: false,
    exeSize: '34.4 MB',
    zipAvailable: false,
    zipSize: '34.4 MB',
  };
}

export function getDesktopDownloadOptions(): { exe: DownloadOptionInfo; zip: DownloadOptionInfo } {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

  const rawExeUrl = typeof metaEnv?.VITE_DESKTOP_EXE_URL === 'string' ? metaEnv.VITE_DESKTOP_EXE_URL.trim() : '';
  const rawZipUrl = typeof metaEnv?.VITE_DESKTOP_ZIP_URL === 'string' ? metaEnv.VITE_DESKTOP_ZIP_URL.trim() : '';

  const isValidUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

  const remoteExeUrl = isValidUrl(rawExeUrl) ? rawExeUrl : '';
  const remoteZipUrl = isValidUrl(rawZipUrl) ? rawZipUrl : '';

  const isExeConfigured = Boolean(remoteExeUrl);
  const isZipConfigured = Boolean(remoteZipUrl);

  return {
    exe: {
      type: 'exe',
      label: 'Instalador Windows (.exe)',
      filename: DEFAULT_EXE_FILENAME,
      size: '34.4 MB',
      recommended: true,
      directUrl: remoteExeUrl,
      apiUrl: remoteExeUrl || '/api/download/exe',
      remoteUrl: remoteExeUrl,
      isConfigured: isExeConfigured,
      description: 'Instalador ejecutable de 64 bits para Windows 10 y 11. Conecta con la base institucional.',
    },
    zip: {
      type: 'zip',
      label: 'Paquete Portable Completo (.zip)',
      filename: DEFAULT_ZIP_FILENAME,
      size: '34.4 MB',
      directUrl: remoteZipUrl,
      apiUrl: remoteZipUrl || '/api/download/zip',
      remoteUrl: remoteZipUrl,
      isConfigured: isZipConfigured,
      description: 'Paquete comprimido con instalador, script automatizado y manual técnico oficial.',
    },
  };
}

/**
 * Checks if a specific download URL is serving a valid file (not 404 or index.html rewrite).
 */
export async function verifyDownloadAvailable(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initiates a browser download reliably, prioritizing the remote storage URL (VITE_DESKTOP_EXE_URL / VITE_DESKTOP_ZIP_URL),
 * or serving from local environment if available.
 */
export async function initiateDesktopDownload(
  type: 'exe' | 'zip',
  onNotification?: (msg: { text: string; type: 'info' | 'success' | 'warning' | 'error' }) => void
): Promise<{ success: boolean; url: string; source: 'local' | 'remote' | 'none' }> {
  const options = getDesktopDownloadOptions();
  const target = options[type];

  // 1. If an external URL is configured, download directly from it
  if (target.isConfigured && target.remoteUrl) {
    if (onNotification) {
      onNotification({
        text: `Iniciando descarga oficial de ${target.filename}...`,
        type: 'info',
      });
    }
    window.open(target.remoteUrl, '_blank', 'noopener,noreferrer');
    return { success: true, url: target.remoteUrl, source: 'remote' };
  }

  // 2. Otherwise check if running in local environment where binary exists
  const status = await fetchServerDownloadStatus();
  const isAvailableLocally = type === 'exe' ? status.exeAvailable : status.zipAvailable;

  if (isAvailableLocally) {
    const link = document.createElement('a');
    link.href = target.apiUrl;
    link.setAttribute('download', target.filename);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 500);

    if (onNotification) {
      onNotification({
        text: `Descarga de ${target.filename} iniciada correctamente (${target.size}).`,
        type: 'success',
      });
    }
    return { success: true, url: target.apiUrl, source: 'local' };
  }

  // 3. Not configured with an external URL and not available locally:
  // Show a clear, friendly institutional message instead of letting browser 404 or Not Found
  if (onNotification) {
    onNotification({
      text: `El instalador para Windows (${target.filename}) aún no está publicado. Configure la variable VITE_DESKTOP_${type.toUpperCase()}_URL con el enlace de descarga oficial para habilitarlo.`,
      type: 'warning',
    });
  }
  return { success: false, url: '', source: 'none' };
}
