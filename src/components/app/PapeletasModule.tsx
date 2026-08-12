import React, { useState, useRef } from 'react';
import { PapeletaSalida, PapeletaAudit, RoleType, PapeletaMotivo, Employee } from '../../types';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Building2,
  History,
  AlertCircle,
  Send,
  PenTool,
  RotateCcw,
  MapPin,
  Shield,
  Crown,
  Eye,
  X,
  XOctagon,
} from 'lucide-react';
import { DataPolicyConfirmModal, DataPolicyConfirmConfig } from './DataPolicyModal';

interface PapeletasModuleProps {
  papeletas: PapeletaSalida[];
  papeletaAudits: PapeletaAudit[];
  employees: Employee[];
  activeRole: RoleType;
  activeUserDni: string;
  onUpdatePapeletaStatus: (
    papeletaId: string,
    action: 'APPROVE_BOSS' | 'APPROVE_HR' | 'REJECT' | 'MARK_OUTING_REAL' | 'MARK_COMPLETED_REAL',
    comment?: string,
    horaReal?: string
  ) => void;
  onCreatePapeleta: (newPapeleta: Omit<PapeletaSalida, 'id' | 'code' | 'created_at' | 'updated_at'>) => void;
}

export const PapeletasModule: React.FC<PapeletasModuleProps> = ({
  papeletas,
  papeletaAudits,
  employees,
  activeRole,
  activeUserDni,
  onUpdatePapeletaStatus,
  onCreatePapeleta,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPapeleta, setSelectedPapeleta] = useState<PapeletaSalida | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [horaRealInput, setHoraRealInput] = useState('10:30');

  // DATA POLICY CONFIRM MODAL STATE
  const [confirmModalConfig, setConfirmModalConfig] = useState<DataPolicyConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'REJECT',
    requireReason: true,
    onConfirm: () => {},
    onCancel: () => {},
  });

  // FORM STATE FOR NEW PAPELETA
  const [formEmployeeId, setFormEmployeeId] = useState(
    employees.find((e) => e.dni === activeUserDni)?.id || employees[0]?.id || ''
  );
  const [formMotivo, setFormMotivo] = useState<PapeletaMotivo>('COMISION_SERVICIOS');
  const [formDestino, setFormDestino] = useState('Agencia Agraria Jaén / Terreno de Cultivo');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formHoraSalida, setFormHoraSalida] = useState('10:00');
  const [formHoraRetorno, setFormHoraRetorno] = useState('12:30');

  // DIGITAL SIGNATURE CANVAS STATE
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Selected Employee object
  const currentEmployee = employees.find((e) => e.id === formEmployeeId) || employees[0];

  // AUTOMATIC APPROVER DETERMINATION based on DRAC Organizational Unit
  const autoSupervisorName = currentEmployee?.supervisor_name || 'Director Regional de Agricultura';
  const autoSupervisorId = currentEmployee?.supervisor_id || 'boss-default';

  // Filter list by role scope
  const scopedPapeletas = papeletas.filter((p) => {
    if (activeRole === 'EMPLOYEE') {
      return p.employee_dni === activeUserDni;
    }
    if (activeRole === 'SECURITY_GUARD') {
      // Security Guard sees APPROVED, IN_OUTING, COMPLETED for today
      return p.status === 'APPROVED' || p.status === 'IN_OUTING' || p.status === 'COMPLETED';
    }
    return true; // Supervisor and HR see all relevant
  });

  // CANVAS SIGNATURE DRAWING HANDLERS
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescripcion || !formDestino) {
      alert('Error: Debe ingresar la descripción del motivo y el lugar de destino.');
      return;
    }

    if (!currentEmployee) {
      alert('Error: No se ha seleccionado un colaborador válido.');
      return;
    }

    onCreatePapeleta({
      employee_id: currentEmployee.id,
      employee_dni: currentEmployee.dni,
      employee_name: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
      dependencia_name: currentEmployee.dependencia_name || 'Sede Central DRAC',
      direccion_organo_name: currentEmployee.direccion_organo_name,
      area_name: currentEmployee.area_name || 'Oficina DRAC',
      supervisor_id: autoSupervisorId,
      supervisor_name: autoSupervisorName,
      motivo: formMotivo,
      descripcion: formDescripcion,
      destino: formDestino,
      fecha: formFecha,
      hora_estimada_salida: formHoraSalida,
      hora_estimada_retorno: formHoraRetorno,
      status: 'PENDING_BOSS',
      digital_signature_data: signatureData || undefined,
      signed_at: new Date().toISOString(),
    });

    setShowCreateModal(false);
    setFormDescripcion('');
    setSignatureData(null);
  };

  const statusBadge: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'BORRADOR', color: 'bg-slate-800 text-slate-400 border-slate-700' },
    PENDING_BOSS: { label: '1º PENDIENTE VOBO JEFE/DIRECTOR', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    PENDING_HR: { label: '2º PENDIENTE VOBO PERSONAL / RRHH', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    APPROVED: { label: 'AUTORIZADA (LISTA EN VIGILANCIA)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    IN_OUTING: { label: 'EN SALIDA REAL (VIGILANCIA)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    COMPLETED: { label: 'FINALIZADA (RETORNO REGISTRADO)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    REJECTED: { label: 'RECHAZADA', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
    CANCELLED: { label: 'CANCELADA', color: 'bg-slate-800 text-slate-500 border-slate-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Papeletas de Salida DRAC (Permisos Oficiales de Jornada)
            </h2>
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold rounded-full">
              AUTO-APROBADOR DETERMINADO
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Flujo institucional: Solicitud + Firma Digital ➔ VoBo Jefe/Director Responsable ➔ VoBo Personal (RRHH) ➔ Registro Garita Vigilancia (Salida y Retorno).
          </p>
        </div>

        {/* Create Papeleta Button */}
        <button
          onClick={() => {
            if (employees.length === 0) {
              alert('Error: No se puede solicitar papeletas sin personal registrado en el sistema.');
              return;
            }
            setShowCreateModal(true);
          }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 self-start md:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Solicitar Papeleta de Salida</span>
        </button>
      </div>

      {/* Role Notice */}
      {activeRole === 'SECURITY_GUARD' && (
        <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl flex items-center gap-3 text-xs text-blue-300">
          <Shield className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <span className="font-bold text-white">Modo Vigilancia de Garita DRAC Activo</span>: Visualiza únicamente papeletas autorizadas para registrar las horas reales de salida y retorno del personal.
          </div>
        </div>
      )}

      {/* Papeletas Table List */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/40 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Nº Papeleta / Colaborador</th>
                <th className="px-4 py-3">Motivo &amp; Destino</th>
                <th className="px-4 py-3">Horas Autorizadas</th>
                <th className="px-4 py-3">Garita Real (Salida - Retorno)</th>
                <th className="px-4 py-3">Estado Workflow</th>
                <th className="px-4 py-3 text-right">Aprobación / Garita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-sans">
              {scopedPapeletas.map((p) => {
                const badge = statusBadge[p.status] || statusBadge.DRAFT;

                // Time Difference Calculation for Garita
                let timeDifferenceLabel = null;
                if (p.hora_real_salida && p.hora_real_retorno) {
                  timeDifferenceLabel = 'Retorno Registrado';
                }

                return (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-indigo-400 font-bold">{p.code}</div>
                      <div className="font-bold text-white text-xs mt-0.5">{p.employee_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {p.dependencia_name} - {p.area_name}
                      </div>
                      <div className="text-[9px] text-amber-400 mt-0.5 flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span>Aprobador: {p.supervisor_name}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200 uppercase text-[10px] tracking-wide">
                        {p.motivo}
                      </div>
                      <div className="text-slate-300 font-medium line-clamp-1 mt-0.5">{p.descripcion}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span>Destino: {p.destino}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <div className="text-slate-200 font-bold">{p.fecha}</div>
                      <div className="text-slate-400 text-[10px]">
                        {p.hora_estimada_salida} ➔ {p.hora_estimada_retorno}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono">
                      {p.hora_real_salida ? (
                        <div>
                          <div className="text-emerald-400 font-bold">Salida: {p.hora_real_salida}</div>
                          <div className="text-purple-400 font-bold">
                            Retorno: {p.hora_real_retorno || 'Pendiente...'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 italic text-[11px]">En Espera Garita</div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPapeleta(p)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha</span>
                        </button>

                        {/* VoBo Boss Step */}
                        {p.status === 'PENDING_BOSS' && (activeRole === 'SUPERVISOR' || activeRole === 'HR_ADMIN') && (
                          <button
                            onClick={() => onUpdatePapeletaStatus(p.id, 'APPROVE_BOSS', 'VoBo Aprobado por Jefe/Director')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Dar VoBo Jefe</span>
                          </button>
                        )}

                        {/* VoBo HR Step */}
                        {p.status === 'PENDING_HR' && activeRole === 'HR_ADMIN' && (
                          <button
                            onClick={() => onUpdatePapeletaStatus(p.id, 'APPROVE_HR', 'Papeleta Autorizada por RRHH')}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Autorizar RRHH</span>
                          </button>
                        )}

                        {/* Reject Option */}
                        {(p.status === 'PENDING_BOSS' || p.status === 'PENDING_HR') && (activeRole === 'SUPERVISOR' || activeRole === 'HR_ADMIN') && (
                          <button
                            onClick={() => {
                              setConfirmModalConfig({
                                isOpen: true,
                                title: 'Rechazar Solicitud de Papeleta',
                                message: `¿Desea rechazar la papeleta ${p.code} de ${p.employee_name}? Ingrese el motivo institucional en la bitácora.`,
                                actionType: 'REJECT',
                                requireReason: true,
                                entityName: `${p.code} - ${p.employee_name}`,
                                confirmText: 'Confirmar Rechazo',
                                onConfirm: (reason) => {
                                  onUpdatePapeletaStatus(p.id, 'REJECT', reason || 'Rechazado por Jefatura / RRHH');
                                  setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
                                },
                                onCancel: () => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false })),
                              });
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-rose-950 text-rose-400 border border-rose-500/20 rounded text-xs font-bold flex items-center gap-1"
                            title="Rechazar Papeleta"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rechazar</span>
                          </button>
                        )}

                        {/* Vigilancia Garita Output */}
                        {p.status === 'APPROVED' && (activeRole === 'SECURITY_GUARD' || activeRole === 'HR_ADMIN') && (
                          <button
                            onClick={() => {
                              const realTime = new Date().toTimeString().substring(0, 5);
                              onUpdatePapeletaStatus(p.id, 'MARK_OUTING_REAL', 'Salida registrada por Garita de Vigilancia', realTime);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Registrar Salida</span>
                          </button>
                        )}

                        {/* Vigilancia Garita Return */}
                        {p.status === 'IN_OUTING' && (activeRole === 'SECURITY_GUARD' || activeRole === 'HR_ADMIN') && (
                          <button
                            onClick={() => {
                              const realTime = new Date().toTimeString().substring(0, 5);
                              onUpdatePapeletaStatus(p.id, 'MARK_COMPLETED_REAL', 'Retorno registrado por Garita de Vigilancia', realTime);
                            }}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Registrar Retorno</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {scopedPapeletas.length === 0 && (
            <div className="p-12 text-center bg-slate-900/40">
              <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-200">No hay papeletas de salida registradas</h4>
              <p className="text-xs text-slate-400 mt-1">Haga clic en "Solicitar Papeleta de Salida" para iniciar una nueva solicitud.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE PAPELETA MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Solicitud de Papeleta de Salida DRAC</h3>
                <p className="text-xs text-slate-400">Permiso oficial durante la jornada laboral</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Trabajador Solicitante</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} ({e.dependencia_name} - {e.area_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* AUTOMATIC APPROVER DISPLAY */}
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs">
                <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-amber-300">Aprobador Asignado Automáticamente por la DRAC:</div>
                  <div className="text-white font-semibold mt-0.5">{autoSupervisorName}</div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    * La papeleta se enviará directamente a la bandeja de visto bueno de esta jefatura asignada.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Motivo de Salida</label>
                  <select
                    value={formMotivo}
                    onChange={(e) => setFormMotivo(e.target.value as PapeletaMotivo)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  >
                    <option value="COMISION_SERVICIOS">Comisión de Servicios Oficial</option>
                    <option value="SALUD_MEDICA">Atención Médica / Cita Essalud</option>
                    <option value="DILIGENCIA_OFICIAL">Diligencia Institucional</option>
                    <option value="PERSONAL">Asunto Personal Justificado</option>
                    <option value="OTRO">Otro Motivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Destino / Lugar</label>
                  <input
                    type="text"
                    placeholder="Ej: Agencia Agraria Jaén / Terreno de Cultivo"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Descripción / Fundamentación</label>
                <textarea
                  rows={2}
                  placeholder="Detalle el motivo institucional o personal de la salida..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Hora Estimada Salida</label>
                  <input
                    type="time"
                    value={formHoraSalida}
                    onChange={(e) => setFormHoraSalida(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Hora Estimada Retorno</label>
                  <input
                    type="time"
                    value={formHoraRetorno}
                    onChange={(e) => setFormHoraRetorno(e.target.value)}
                    className="w-full bg-[#090A0D] border border-slate-800 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>
              </div>

              {/* DIGITAL SIGNATURE CANVAS */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Firma Digital del Solicitante</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] text-slate-400 hover:text-rose-400"
                  >
                    Limpiar Trazo
                  </button>
                </div>

                <div className="bg-[#090A0D] border border-slate-800 rounded-lg p-1 flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={90}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair touch-none bg-[#090A0D] rounded border border-slate-800/80"
                  />
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                  Firme en el recuadro superior usando el mouse o pantalla táctil.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Papeleta a Visto Bueno</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS PAPELETA MODAL */}
      {selectedPapeleta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1115] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-mono text-indigo-400 font-bold text-sm">{selectedPapeleta.code}</div>
                <h3 className="font-bold text-base text-white">Papeleta de Salida Institucional DRAC</h3>
              </div>
              <button onClick={() => setSelectedPapeleta(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-1">
                <div>Colaborador: <span className="font-bold text-white">{selectedPapeleta.employee_name}</span> (DNI: {selectedPapeleta.employee_dni})</div>
                <div>Dependencia: <span className="text-indigo-300 font-medium">{selectedPapeleta.dependencia_name}</span></div>
                <div>Área: <span className="text-slate-300">{selectedPapeleta.area_name}</span></div>
                <div>Aprobador Asignado: <span className="text-amber-400 font-semibold">{selectedPapeleta.supervisor_name}</span></div>
              </div>

              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-1">
                <div>Motivo: <span className="font-bold text-slate-200">{selectedPapeleta.motivo}</span></div>
                <div>Destino: <span className="text-indigo-300 font-medium">{selectedPapeleta.destino}</span></div>
                <div>Descripción: <span className="text-slate-300">{selectedPapeleta.descripcion}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">PROGRAMADO</div>
                  <div className="text-white font-mono mt-1">{selectedPapeleta.fecha}</div>
                  <div className="text-slate-300 font-mono">{selectedPapeleta.hora_estimada_salida} ➔ {selectedPapeleta.hora_estimada_retorno}</div>
                </div>

                <div className="p-3 bg-[#090A0D] rounded-lg border border-slate-800">
                  <div className="font-bold text-slate-400 text-[10px]">REAL GARITA</div>
                  <div className="text-emerald-400 font-mono mt-1">Salida: {selectedPapeleta.hora_real_salida || 'Sin registrar'}</div>
                  <div className="text-purple-400 font-mono">Retorno: {selectedPapeleta.hora_real_retorno || 'Sin registrar'}</div>
                </div>
              </div>

              {/* Digital Signature rendering */}
              {selectedPapeleta.digital_signature_data && (
                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Firma Digital del Solicitante:</span>
                  <img
                    src={selectedPapeleta.digital_signature_data}
                    alt="Firma Digital"
                    className="h-10 bg-[#090A0D] rounded p-1 border border-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedPapeleta(null)}
                className="px-4 py-2 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATA POLICY CONFIRMATION MODAL */}
      <DataPolicyConfirmModal config={confirmModalConfig} />
    </div>
  );
};
