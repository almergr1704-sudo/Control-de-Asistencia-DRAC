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

export const DEFAULT_EXE_FILENAME = 'DRAC-Control-de-Asistencia-Setup.exe';
export const DEFAULT_PORTABLE_FILENAME = 'DRAC-Control-de-Asistencia-Portable.exe';
export const DEFAULT_ZIP_FILENAME = 'DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip';
export const DEFAULT_DIAG_FILENAME = 'DIAGNOSTICO_DESKTOP.txt';
export const REAL_ARTIFACT_SIZE = '461 MB';

/**
 * Validates if a given URL is a legitimate public web URL (https:// or http://)
 * and NOT an internal localhost, container path, or relative route.
 */
export function isPublicProductionUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  // Reject localhost, 127.0.0.1, internal container paths
  if (
    trimmed.includes('localhost') ||
    trimmed.includes('127.0.0.1') ||
    trimmed.includes('/app/applet') ||
    trimmed.includes('::1')
  ) {
    return false;
  }
  return true;
}

export async function fetchServerDownloadStatus(): Promise<{
  exeAvailable: boolean;
  exeSize: string;
  zipAvailable: boolean;
  zipSize: string;
}> {
  try {
    const res = await fetch('/api/download/status', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      return {
        exeAvailable: Boolean(data?.exe?.available),
        exeSize: data?.exe?.size && data.exe.size !== '0 MB' ? data.exe.size : REAL_ARTIFACT_SIZE,
        zipAvailable: Boolean(data?.zip?.available),
        zipSize: data?.zip?.size || REAL_ARTIFACT_SIZE,
      };
    }
  } catch {}
  return {
    exeAvailable: false,
    exeSize: REAL_ARTIFACT_SIZE,
    zipAvailable: false,
    zipSize: REAL_ARTIFACT_SIZE,
  };
}

export function getDesktopDownloadOptions(): { exe: DownloadOptionInfo; zip: DownloadOptionInfo } {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

  const rawExeUrl = typeof metaEnv?.VITE_DESKTOP_EXE_URL === 'string' ? metaEnv.VITE_DESKTOP_EXE_URL.trim() : '';
  const rawZipUrl = typeof metaEnv?.VITE_DESKTOP_ZIP_URL === 'string' ? metaEnv.VITE_DESKTOP_ZIP_URL.trim() : '';

  const remoteExeUrl = isPublicProductionUrl(rawExeUrl) ? rawExeUrl : '';
  const remoteZipUrl = isPublicProductionUrl(rawZipUrl) ? rawZipUrl : '';

  const isExeConfigured = Boolean(remoteExeUrl);
  const isZipConfigured = Boolean(remoteZipUrl);

  return {
    exe: {
      type: 'exe',
      label: 'Descargar instalador Windows',
      filename: DEFAULT_EXE_FILENAME,
      size: REAL_ARTIFACT_SIZE,
      recommended: true,
      directUrl: remoteExeUrl,
      apiUrl: remoteExeUrl,
      remoteUrl: remoteExeUrl,
      isConfigured: isExeConfigured,
      description: 'Instalador oficial asistido de 64 bits para Windows 10 y 11 con interfaz interactiva y desinstalador.',
    },
    zip: {
      type: 'zip',
      label: 'Descargar versión comprimida',
      filename: DEFAULT_ZIP_FILENAME,
      size: REAL_ARTIFACT_SIZE,
      directUrl: remoteZipUrl,
      apiUrl: remoteZipUrl,
      remoteUrl: remoteZipUrl,
      isConfigured: isZipConfigured,
      description: 'Paquete comprimido con instalador oficial y manual técnico de instalación institucional.',
    },
  };
}

/**
 * Checks if a specific download URL is serving a valid file (not 404 or index.html rewrite).
 */
export async function verifyDownloadAvailable(url: string): Promise<boolean> {
  if (!url || !isPublicProductionUrl(url)) return false;
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
 * Initiates a browser download safely.
 * If an official public URL is configured (VITE_DESKTOP_EXE_URL / VITE_DESKTOP_ZIP_URL), it downloads from it.
 * If running in AI Studio / local development, it triggers immediate download of the real compiled artifact
 * without opening broken blank tabs or failing with 500.
 */
export async function initiateDesktopDownload(
  type: 'exe' | 'zip',
  onNotification?: (msg: { text: string; type: 'info' | 'success' | 'warning' | 'error' }) => void
): Promise<{ success: boolean; url: string; source: 'remote' | 'local' | 'none' }> {
  const options = getDesktopDownloadOptions();
  const target = options[type];

  // 1. If an official public URL is configured, trigger the download directly
  if (target.isConfigured && target.remoteUrl) {
    if (onNotification) {
      onNotification({
        text: `Iniciando descarga oficial de ${target.filename}...`,
        type: 'info',
      });
    }

    const link = document.createElement('a');
    link.href = target.remoteUrl;
    link.setAttribute('download', target.filename);
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 300);

    return { success: true, url: target.remoteUrl, source: 'remote' };
  }

  // 2. In AI Studio / local environment: serve the compiled artifact directly
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isDevelopmentEnvironment =
    hostname.includes('run.app') ||
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('webcontainer') ||
    hostname.includes('googleusercontent.com');

  if (isDevelopmentEnvironment) {
    if (onNotification) {
      onNotification({
        text: `Descargando ${target.filename} compilado en AI Studio...`,
        type: 'success',
      });
    }

    const localUrl = `/download/${target.filename}`;
    const link = document.createElement('a');
    link.href = localUrl;
    link.setAttribute('download', target.filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 300);

    return { success: true, url: localUrl, source: 'local' };
  }

  // 3. In external production (e.g. Vercel) without configured URL:
  const message = 'Versión Desktop no disponible temporalmente.';
  if (onNotification) {
    onNotification({
      text: message,
      type: 'warning',
    });
  } else {
    window.dispatchEvent(
      new CustomEvent('open-download-desktop', {
        detail: { unconfigured: true, type, message },
      })
    );
  }

  return { success: false, url: '', source: 'none' };
}

/**
 * Allows administrators inside the local development environment (AI Studio) to download
 * the physically compiled file from the local server to upload it to their cloud storage.
 */
export function downloadLocalDevelopmentArtifact(type: 'exe' | 'zip'): void {
  const filename = type === 'exe' ? DEFAULT_EXE_FILENAME : DEFAULT_ZIP_FILENAME;
  const url = `/download/${filename}`;
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  // No usar target="_blank": evita abrir pestañas en blanco que muestren pantallas de error de Chrome
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) document.body.removeChild(link);
  }, 300);
}
