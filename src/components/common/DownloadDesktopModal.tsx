import React, { useState } from 'react';
import {
  Download,
  Monitor,
  FileArchive,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  X,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

interface DownloadDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadDesktopModal: React.FC<DownloadDesktopModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      id="modal-download-desktop-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="modal-download-desktop-card"
        className="relative w-full max-w-3xl bg-[#0F131C] border border-slate-700/80 rounded-2xl shadow-2xl text-slate-200 overflow-hidden my-6"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090C14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                Descarga de Versión Desktop Windows
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono normal-case">
                  v1.0.0 Oficial
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sistema de Control de Asistencia Institucional — DRAC Cajamarca
              </p>
            </div>
          </div>
          <button
            id="btn-close-download-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Download Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Direct Installer .EXE */}
            <div className="p-5 rounded-xl bg-[#131824] border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Recomendado
                  </span>
                  <span className="text-xs font-mono text-slate-400">129 MB</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    Instalador Windows (.exe)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Instalador autónomo NSIS para Windows 10 y 11 de 64 bits. Crea accesos directos en Escritorio y Menú Inicio.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 truncate">
                  DRAC-Control-de-Asistencia-Setup.exe
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-800/80">
                <a
                  id="btn-download-exe-direct"
                  href="/download/DRAC-Control-de-Asistencia-Setup.exe"
                  download="DRAC-Control-de-Asistencia-Setup.exe"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer group-hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Instalador .EXE</span>
                </a>
              </div>
            </div>

            {/* Option 2: Full ZIP Package */}
            <div className="p-5 rounded-xl bg-[#131824] border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                    <FileArchive className="w-3.5 h-3.5 text-indigo-400" />
                    Paquete Completo
                  </span>
                  <span className="text-xs font-mono text-slate-400">129 MB</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileArchive className="w-4 h-4 text-indigo-400" />
                    Paquete ZIP Windows (.zip)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Incluye el instalador .exe, el manual técnico <code className="text-indigo-300 font-mono">README_INSTALACION.txt</code> y ficha de versión.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 truncate">
                  DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-800/80">
                <a
                  id="btn-download-zip-direct"
                  href="/download/DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip"
                  download="DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer group-hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Paquete .ZIP</span>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Technical Specs */}
          <div className="p-4 rounded-xl bg-[#090C14] border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Especificaciones de Instalación y Biométricos ZKTeco
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Sistema Operativo:</div>
                <div className="font-semibold text-white mt-0.5">Windows 10 / 11 (64-bit)</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Puerto ZKTeco Marcador:</div>
                <div className="font-semibold text-emerald-400 font-mono mt-0.5">TCP/UDP 4370</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="text-slate-400 text-[11px]">Tecnología Base:</div>
                <div className="font-semibold text-white mt-0.5">Electron + React + TS</div>
              </div>
            </div>
          </div>

          {/* Step by Step Guide */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              Pasos para Instalar en Windows
            </h4>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside bg-slate-900/40 p-3 rounded-xl border border-slate-800">
              <li>Haga clic en el botón verde superior <strong>"Descargar Instalador .EXE"</strong>.</li>
              <li>Ubique el archivo en su carpeta de descargas, haga clic derecho y elija <strong>"Ejecutar como administrador"</strong>.</li>
              <li>Si aparece la ventana de protección de Windows SmartScreen, pulse <em>"Más información"</em> y luego <em>"Ejecutar de todas formas"</em>.</li>
              <li>Siga los pasos del asistente de instalación NSIS (deje marcada la casilla para crear accesos directos).</li>
              <li>Inicie el sistema desde el acceso directo <strong>"DRAC Control de Asistencia"</strong> en su Escritorio.</li>
            </ol>
          </div>

          {/* Direct URL copy box for browser address bar */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400 truncate">
              <span className="text-slate-300 font-medium">Ruta directa de descarga en el navegador:</span>{' '}
              <span className="font-mono text-emerald-400">{window.location.origin}/download/DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip</span>
            </div>
            <button
              id="btn-copy-download-url"
              onClick={() => handleCopy(`${window.location.origin}/download/DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip`, 'url')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {copied === 'url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied === 'url' ? 'Copiado' : 'Copiar URL'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#090C14] flex items-center justify-between text-xs text-slate-400">
          <span>Dirección Regional de Agricultura Cajamarca — DRAC</span>
          <button
            id="btn-close-modal-footer"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
