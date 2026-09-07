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
  remoteUrl?: string;
  description: string;
}

const DEFAULT_EXE_FILENAME = 'DRAC-Asistencia-Setup.exe';
const DEFAULT_ZIP_FILENAME = 'DRAC-Asistencia-Windows.zip';

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
        exeSize: data?.exe?.size && data.exe.size !== '0 MB' ? data.exe.size : '363 KB',
        zipAvailable: Boolean(data?.zip?.available),
        zipSize: data?.zip?.size || '32 MB',
      };
    }
  } catch {}
  return {
    exeAvailable: false,
    exeSize: '363 KB',
    zipAvailable: false,
    zipSize: '32 MB',
  };
}

export function getDesktopDownloadOptions(): { exe: DownloadOptionInfo; zip: DownloadOptionInfo } {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

  const remoteExeUrl = metaEnv?.VITE_DESKTOP_EXE_URL || '';
  const remoteZipUrl = metaEnv?.VITE_DESKTOP_ZIP_URL || '';

  return {
    exe: {
      type: 'exe',
      label: 'Instalador Windows (.exe)',
      filename: DEFAULT_EXE_FILENAME,
      size: '363 KB',
      recommended: true,
      directUrl: `/download/${DEFAULT_EXE_FILENAME}`,
      apiUrl: '/api/download/exe',
      remoteUrl: remoteExeUrl,
      description: 'Instalador ejecutable de 64 bits para Windows 10 y 11. Conecta con Supabase institucional.',
    },
    zip: {
      type: 'zip',
      label: 'Paquete Portable ZIP (.zip)',
      filename: DEFAULT_ZIP_FILENAME,
      size: '32 MB',
      directUrl: `/download/${DEFAULT_ZIP_FILENAME}`,
      apiUrl: '/api/download/zip',
      remoteUrl: remoteZipUrl,
      description: 'Versión comprimida portable lista para descomprimir y ejecutar directamente sin instalación previa.',
    },
  };
}

/**
 * Checks if a specific download URL is serving a valid file (not 404 or index.html rewrite).
 */
export async function verifyDownloadAvailable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    // If Vercel rewrites to SPA HTML, contentType will be text/html
    if (contentType.includes('text/html')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Initiates a browser download reliably, bypassing iframe sandbox restrictions
 * and popup blockers by using an invisible DOM anchor element.
 */
export async function initiateDesktopDownload(
  type: 'exe' | 'zip',
  onNotification?: (msg: { text: string; type: 'info' | 'success' | 'warning' | 'error' }) => void
): Promise<{ success: boolean; url: string; source: 'local' | 'remote' }> {
  const options = getDesktopDownloadOptions();
  const target = options[type];

  let resolvedUrl = target.directUrl;
  let source: 'local' | 'remote' = 'local';

  // 1. Check server status first
  const status = await fetchServerDownloadStatus();
  const isAvailableLocally = type === 'exe' ? status.exeAvailable : status.zipAvailable;

  if (isAvailableLocally) {
    resolvedUrl = target.directUrl;
    source = 'local';
  } else {
    // Verify endpoints
    const isLocalAvailable = await verifyDownloadAvailable(target.directUrl);
    if (isLocalAvailable) {
      resolvedUrl = target.directUrl;
      source = 'local';
    } else {
      const isApiAvailable = await verifyDownloadAvailable(target.apiUrl);
      if (isApiAvailable) {
        resolvedUrl = target.apiUrl;
        source = 'local';
      } else if (target.remoteUrl && target.remoteUrl.trim() !== '') {
        resolvedUrl = target.remoteUrl;
        source = 'remote';
        if (onNotification) {
          onNotification({
            text: `Iniciando descarga desde almacenamiento remoto institucional (${target.filename})...`,
            type: 'info',
          });
        }
      } else {
        if (onNotification) {
          onNotification({
            text: `El archivo ${target.filename} no está publicado en este servidor web. En Vercel o hosting estático, compile los instaladores localmente con "npm run build:desktop" o configure el repositorio institucional.`,
            type: 'warning',
          });
        }
        return { success: false, url: '', source: 'local' };
      }
    }
  }

  // Trigger download via invisible anchor tag
  try {
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.setAttribute('download', target.filename);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 500);

    if (onNotification) {
      onNotification({
        text: `Descarga de ${target.filename} iniciada correctamente (${target.size}).`,
        type: 'success',
      });
    }

    return { success: true, url: resolvedUrl, source };
  } catch (err: any) {
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    return { success: true, url: resolvedUrl, source };
  }
}
