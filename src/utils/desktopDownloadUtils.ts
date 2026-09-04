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

const DEFAULT_EXE_FILENAME = 'DRAC-Control-de-Asistencia-Setup.exe';
const DEFAULT_ZIP_FILENAME = 'DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip';

// Fallback GitHub release / Supabase storage URLs for production deployments like Vercel
// where files >100 MB cannot be tracked in Git.
const GITHUB_REPO_RELEASES = 'https://github.com/drac-cajamarca/drac-control-asistencia/releases/latest/download';

export function getDesktopDownloadOptions(): { exe: DownloadOptionInfo; zip: DownloadOptionInfo } {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

  const remoteExeUrl = metaEnv?.VITE_DESKTOP_EXE_URL || `${GITHUB_REPO_RELEASES}/${DEFAULT_EXE_FILENAME}`;
  const remoteZipUrl = metaEnv?.VITE_DESKTOP_ZIP_URL || `${GITHUB_REPO_RELEASES}/${DEFAULT_ZIP_FILENAME}`;

  return {
    exe: {
      type: 'exe',
      label: 'Instalador Windows (.exe)',
      filename: DEFAULT_EXE_FILENAME,
      size: '129 MB',
      recommended: true,
      directUrl: `/download/${DEFAULT_EXE_FILENAME}`,
      apiUrl: '/api/download/exe',
      remoteUrl: remoteExeUrl,
      description: 'Instalador autónomo NSIS para Windows 10 y 11 de 64 bits. Crea accesos directos en Escritorio y Menú Inicio.',
    },
    zip: {
      type: 'zip',
      label: 'Paquete ZIP Windows (.zip)',
      filename: DEFAULT_ZIP_FILENAME,
      size: '129 MB',
      directUrl: `/download/${DEFAULT_ZIP_FILENAME}`,
      apiUrl: '/api/download/zip',
      remoteUrl: remoteZipUrl,
      description: 'Incluye el instalador .exe, el manual técnico README_INSTALACION.txt y utilitarios de inicio rápido.',
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

  // 1. Verify if local endpoint is responsive
  const isLocalAvailable = await verifyDownloadAvailable(target.directUrl);

  if (!isLocalAvailable) {
    // 2. Try the /api/download/* endpoint
    const isApiAvailable = await verifyDownloadAvailable(target.apiUrl);
    if (isApiAvailable) {
      resolvedUrl = target.apiUrl;
      source = 'local';
    } else if (target.remoteUrl) {
      // 3. In Vercel or static hosting, use remote release URL
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
          text: `El archivo ${target.filename} no se encuentra disponible temporalmente. Configure VITE_DESKTOP_EXE_URL o consulte la guía técnica.`,
          type: 'warning',
        });
      }
      return { success: false, url: resolvedUrl, source: 'local' };
    }
  }

  // 4. Trigger download via invisible anchor tag
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
        text: `Descarga de ${target.filename} iniciada correctamente.`,
        type: 'success',
      });
    }

    return { success: true, url: resolvedUrl, source };
  } catch (err) {
    // Fallback: window.open
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    return { success: true, url: resolvedUrl, source };
  }
}
