import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Building2,
  Users,
  Briefcase,
  Layers,
  FileCheck,
  RefreshCw,
  Info,
  ChevronRight,
  AlertCircle,
  FileText,
  Filter,
  Check,
  X,
} from 'lucide-react';
import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  Employee,
  Encargatura,
  RoleType,
} from '../../types';
import {
  BulkUploadEntityType,
  ImportMode,
  ValidationSummary,
  RowValidationError,
  generateTemplateDireccionesOrganos,
  generateTemplateAreasOficinas,
  generateTemplateTrabajadores,
  generateTemplateEncargaturas,
  generateErrorReportExcel,
  readExcelFileRows,
  validateDireccionesOrganosExcel,
  validateAreasExcel,
  validateTrabajadoresExcel,
  validateEncargaturasExcel,
} from '../../utils/bulkUploadUtils';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntityType?: BulkUploadEntityType;
  dependencias: Dependencia[];
  direccionesOrganos: DireccionOrgano[];
  areas: Area[];
  cargos: Cargo[];
  employees: Employee[];
  encargaturas?: Encargatura[];
  activeRole: RoleType;
  onConfirmDirecciones: (validDirs: DireccionOrgano[], updateDirs: DireccionOrgano[], summary: ValidationSummary<DireccionOrgano>) => void;
  onConfirmAreas: (validAreas: Area[], updateAreas: Area[], summary: ValidationSummary<Area>) => void;
  onConfirmTrabajadores: (validEmps: Employee[], updateEmps: Employee[], summary: ValidationSummary<Employee>) => void;
  onConfirmEncargaturas?: (validEncs: Encargatura[], summary: ValidationSummary<Encargatura>) => void;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  initialEntityType = 'DIRECCIONES',
  dependencias,
  direccionesOrganos,
  areas,
  cargos,
  employees,
  encargaturas = [],
  activeRole,
  onConfirmDirecciones,
  onConfirmAreas,
  onConfirmTrabajadores,
  onConfirmEncargaturas,
}) => {
  if (!isOpen) return null;

  // Selected Entity and Step
  const [selectedEntity, setSelectedEntity] = useState<BulkUploadEntityType>(initialEntityType);
  const [importMode, setImportMode] = useState<ImportMode>('NEW_AND_UPDATE');
  const [currentStep, setCurrentStep] = useState<'SELECT_AND_UPLOAD' | 'PREVIEW_AND_VALIDATE' | 'SUCCESS'>('SELECT_AND_UPLOAD');

  // File and Validation State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary<any> | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'ERROR'>('ALL');
  const [errorSearchTerm, setErrorSearchTerm] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download template for currently selected entity
  const handleDownloadTemplate = (type: BulkUploadEntityType = selectedEntity) => {
    if (type === 'DIRECCIONES') {
      generateTemplateDireccionesOrganos(dependencias);
    } else if (type === 'AREAS') {
      generateTemplateAreasOficinas(direccionesOrganos);
    } else if (type === 'TRABAJADORES') {
      generateTemplateTrabajadores(direccionesOrganos, areas, cargos);
    } else if (type === 'ENCARGATURAS') {
      generateTemplateEncargaturas(direccionesOrganos, areas, employees);
    }
  };

  // Process File when selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setUploadedFile(file);

    try {
      const rawRows = await readExcelFileRows(file);

      if (rawRows.length === 0) {
        alert('⚠️ El archivo Excel está vacío o no contiene filas de datos válidas.');
        setIsLoading(false);
        return;
      }

      let summary: ValidationSummary<any>;

      if (selectedEntity === 'DIRECCIONES') {
        summary = validateDireccionesOrganosExcel(rawRows, direccionesOrganos, dependencias, importMode, file.name);
      } else if (selectedEntity === 'AREAS') {
        summary = validateAreasExcel(rawRows, areas, direccionesOrganos, dependencias, importMode, file.name);
      } else if (selectedEntity === 'TRABAJADORES') {
        summary = validateTrabajadoresExcel(rawRows, employees, direccionesOrganos, areas, cargos, dependencias, importMode, file.name);
      } else {
        summary = validateEncargaturasExcel(rawRows, encargaturas, employees, direccionesOrganos, areas, dependencias, file.name);
      }

      setValidationSummary(summary);
      setCurrentStep('PREVIEW_AND_VALIDATE');
    } catch (err: any) {
      alert(`Error al procesar el archivo Excel: ${err?.message || 'Formato no compatible'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Revalidate with new import mode
  const handleRevalidateWithMode = (mode: ImportMode) => {
    setImportMode(mode);
    if (validationSummary && validationSummary.rawRows.length > 0) {
      let summary: ValidationSummary<any>;
      const rawRows = validationSummary.rawRows;
      const fileName = validationSummary.fileName;

      if (selectedEntity === 'DIRECCIONES') {
        summary = validateDireccionesOrganosExcel(rawRows, direccionesOrganos, dependencias, mode, fileName);
      } else if (selectedEntity === 'AREAS') {
        summary = validateAreasExcel(rawRows, areas, direccionesOrganos, dependencias, mode, fileName);
      } else if (selectedEntity === 'TRABAJADORES') {
        summary = validateTrabajadoresExcel(rawRows, employees, direccionesOrganos, areas, cargos, dependencias, mode, fileName);
      } else {
        summary = validateEncargaturasExcel(rawRows, encargaturas, employees, direccionesOrganos, areas, dependencias, fileName);
      }
      setValidationSummary(summary);
    }
  };

  // Download error report
  const handleDownloadErrors = () => {
    if (!validationSummary || validationSummary.errors.length === 0) return;
    generateErrorReportExcel(selectedEntity, validationSummary.errors, validationSummary.fileName);
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (!validationSummary) return;

    if (selectedEntity === 'DIRECCIONES') {
      onConfirmDirecciones(
        validationSummary.parsedValidRecords,
        validationSummary.parsedUpdateRecords,
        validationSummary
      );
    } else if (selectedEntity === 'AREAS') {
      onConfirmAreas(
        validationSummary.parsedValidRecords,
        validationSummary.parsedUpdateRecords,
        validationSummary
      );
    } else if (selectedEntity === 'TRABAJADORES') {
      onConfirmTrabajadores(
        validationSummary.parsedValidRecords,
        validationSummary.parsedUpdateRecords,
        validationSummary
      );
    } else if (selectedEntity === 'ENCARGATURAS' && onConfirmEncargaturas) {
      onConfirmEncargaturas(
        validationSummary.parsedValidRecords,
        validationSummary
      );
    }

    setCurrentStep('SUCCESS');
  };

  const handleReset = () => {
    setUploadedFile(null);
    setValidationSummary(null);
    setCurrentStep('SELECT_AND_UPLOAD');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const entityConfig = {
    DIRECCIONES: {
      title: 'Direcciones / Órganos DRAC',
      stepNumber: '1',
      description: 'Paso 1 obligatorio de la estructura organizacional. Registre las Direcciones de Línea, Órganos de Apoyo, Jefaturas de Agencia y Oficinas Agrarias.',
      templateName: 'Plantilla_Direcciones_Organos_DRAC.xlsx',
      icon: Building2,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/30',
    },
    AREAS: {
      title: 'Áreas / Oficinas / Subáreas',
      stepNumber: '2',
      description: 'Paso 2 de la estructura organizacional. Requiere que las Direcciones/Órganos ya existan para establecer la dependencia jerárquica.',
      templateName: 'Plantilla_Areas_Oficinas_DRAC.xlsx',
      icon: Layers,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    TRABAJADORES: {
      title: 'Directorio de Trabajadores DRAC',
      stepNumber: '3',
      description: 'Paso 3. Todo trabajador recibe automáticamente el perfil base TRABAJADOR. Los perfiles adicionales (Jefe Inmediato, RRHH, etc.) se validan contra la unidad orgánica.',
      templateName: 'Plantilla_Trabajadores_DRAC.xlsx',
      icon: Users,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    },
    ENCARGATURAS: {
      title: 'Encargaturas Temporales de Jefatura',
      stepNumber: '4',
      description: 'Paso 4. Registre encargaturas de funciones por vacaciones, licencias o comisión con sustento documental formal.',
      templateName: 'Plantilla_Encargaturas_DRAC.xlsx',
      icon: Briefcase,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
  };

  const currentEntityConfig = entityConfig[selectedEntity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0D0E12] border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* MODAL TOP HEADER */}
        <div className="px-6 py-4 bg-[#13151C] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${currentEntityConfig.bgColor} border ${currentEntityConfig.borderColor}`}>
              <FileSpreadsheet className={`w-5 h-5 ${currentEntityConfig.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Carga Masiva de Información Institucional
                </h2>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded-full uppercase">
                  Excel .xlsx
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Importación controlada, validada y trazable para la Dirección Regional de Agricultura Cajamarca
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ORDEN OBLIGATORIO DE CARGA — PIPELINE VISUAL DE 4 ETAPAS */}
        <div className="px-6 py-3 bg-[#0A0B0E] border-b border-slate-800/80 shrink-0">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Orden Obligatorio de Carga Estructural:</span>
            <span className="text-slate-500 text-[10px] font-normal">
              Las dependencias deben respetarse secuencialmente
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['DIRECCIONES', 'AREAS', 'TRABAJADORES', 'ENCARGATURAS'] as BulkUploadEntityType[]).map((type, idx) => {
              const cfg = entityConfig[type];
              const isSelected = selectedEntity === type;
              const Icon = cfg.icon;

              return (
                <button
                  key={type}
                  onClick={() => {
                    if (currentStep === 'PREVIEW_AND_VALIDATE') {
                      if (confirm('¿Desea cambiar de entidad? Los datos no guardados del archivo actual se descartarán.')) {
                        setSelectedEntity(type);
                        handleReset();
                      }
                    } else {
                      setSelectedEntity(type);
                      handleReset();
                    }
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? `${cfg.bgColor} ${cfg.borderColor} ring-1 ring-indigo-500/50 shadow-md`
                      : 'bg-[#111318] border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                      <span className="truncate">{cfg.title.split(' ')[0]} {cfg.title.split(' ')[1] || ''}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Paso {idx + 1}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SELECT AND UPLOAD */}
          {currentStep === 'SELECT_AND_UPLOAD' && (
            <div className="space-y-6">
              {/* ENTITY BANNER & DOWNLOAD TEMPLATE */}
              <div className={`p-4 rounded-xl border ${currentEntityConfig.bgColor} ${currentEntityConfig.borderColor} flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 shrink-0">
                    <currentEntityConfig.icon className={`w-6 h-6 ${currentEntityConfig.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-200 text-[10px] font-bold rounded">
                        Paso {currentEntityConfig.stepNumber} de 4
                      </span>
                      <h3 className="text-sm font-bold text-white">{currentEntityConfig.title}</h3>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {currentEntityConfig.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(selectedEntity)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 shrink-0 whitespace-nowrap transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Plantilla Oficial (.xlsx)</span>
                </button>
              </div>

              {/* MODO DE IMPORTACIÓN */}
              <div className="bg-[#111318] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-200">
                    Modo de Procesamiento de Registros
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Control de integridad y protección de campos no editables
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      importMode === 'NEW_AND_UPDATE'
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                        : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'NEW_AND_UPDATE'}
                      onChange={() => handleRevalidateWithMode('NEW_AND_UPDATE')}
                      className="mt-1 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Nuevos y Actualización (Recomendado)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Crea registros nuevos y actualiza los campos permitidos de los registros existentes. Los campos no editables (como DNI, fecha de ingreso original o código institucional) permanecen protegidos.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      importMode === 'ONLY_NEW'
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                        : 'bg-[#090A0D] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'ONLY_NEW'}
                      onChange={() => handleRevalidateWithMode('ONLY_NEW')}
                      className="mt-1 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Solo Nuevos Registros</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Solo inserta registros que no existan previamente. Si el DNI o Código ya está en el sistema, lo ignora y lo reporta como advertencia sin modificar los datos vigentes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* DRAG & DROP / FILE UPLOAD BOX */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-[#090A0D] hover:bg-[#0E1017] rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>

                <div>
                  <p className="text-sm font-bold text-white">
                    Haga clic o arrastre su archivo Excel aquí
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Archivos compatibles: <strong className="text-indigo-300">.xlsx, .xls, .csv</strong> (Plantilla oficial DRAC recomendada)
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800">
                  <FileCheck className="w-3 h-3 text-emerald-400" />
                  <span>Validación automática antes de guardar en base de datos</span>
                </div>
              </div>

              {/* REGLAS & INSTRUCCIONES RÁPIDAS */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span>Reglas Institucionales de Validación:</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-1.5 pl-5 list-disc leading-relaxed">
                  <li>
                    <strong>Direcciones / Órganos:</strong> Solo se permiten las 4 clasificaciones orgánicas: <em>DIRECCIÓN, ÓRGANOS DE APOYO, JEFATURA DE AGENCIA, OFICINA AGRARIA</em>.
                  </li>
                  <li>
                    <strong>Áreas / Oficinas:</strong> El código de la Dirección referenciada debe existir previamente en el sistema.
                  </li>
                  <li>
                    <strong>Trabajadores:</strong> Todo trabajador recibe automáticamente el perfil <em>TRABAJADOR</em>. La asignación de <em>JEFE INMEDIATO</em> requiere que pertenezca a una de las 4 clasificaciones orgánicas permitidas.
                  </li>
                  <li>
                    <strong>Evitar duplicados:</strong> El DNI es el identificador primario no modificable.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATE */}
          {currentStep === 'PREVIEW_AND_VALIDATE' && validationSummary && (
            <div className="space-y-6">
              {/* SUMMARY STATS BAR */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-[#111318] border border-slate-800 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Encontrados</div>
                  <div className="text-lg font-bold text-white mt-1 font-mono">
                    {validationSummary.totalFound}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 truncate">Filas en archivo</div>
                </div>

                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                  <div className="text-[10px] font-bold text-emerald-300 uppercase">Registros Válidos</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1 font-mono">
                    {validationSummary.validCount}
                  </div>
                  <div className="text-[9px] text-emerald-400/80 mt-0.5">Listos para importar</div>
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl">
                  <div className="text-[10px] font-bold text-blue-300 uppercase">Nuevos</div>
                  <div className="text-lg font-bold text-blue-400 mt-1 font-mono">
                    {validationSummary.newCount}
                  </div>
                  <div className="text-[9px] text-blue-400/80 mt-0.5">Nuevas inserciones</div>
                </div>

                <div className="p-3 bg-indigo-950/20 border border-indigo-500/30 rounded-xl">
                  <div className="text-[10px] font-bold text-indigo-300 uppercase">Actualizaciones</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1 font-mono">
                    {validationSummary.updateCount}
                  </div>
                  <div className="text-[9px] text-indigo-400/80 mt-0.5">Merge de datos</div>
                </div>

                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-300 uppercase">Duplicados</div>
                  <div className="text-lg font-bold text-amber-400 mt-1 font-mono">
                    {validationSummary.duplicateCount}
                  </div>
                  <div className="text-[9px] text-amber-400/80 mt-0.5">Omitidos / Existentes</div>
                </div>

                <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl">
                  <div className="text-[10px] font-bold text-rose-300 uppercase">Con Errores</div>
                  <div className="text-lg font-bold text-rose-400 mt-1 font-mono">
                    {validationSummary.errorCount}
                  </div>
                  <div className="text-[9px] text-rose-400/80 mt-0.5">No se guardarán</div>
                </div>
              </div>

              {/* ALERT IF ERRORS FOUND */}
              {validationSummary.errorCount > 0 && (
                <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-200">
                        Se encontraron {validationSummary.errorCount} errores de validación
                      </h4>
                      <p className="text-[11px] text-rose-300/80 mt-0.5">
                        Los registros con error <strong>NO serán guardados</strong> en la base de datos para preservar la consistencia orgánica. Puede descargar el reporte detallado de errores para corregirlos.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadErrors}
                    className="px-3.5 py-2 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/50 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Errores (.xlsx)</span>
                  </button>
                </div>
              )}

              {/* TABLE OF ERRORS DETAILED */}
              {validationSummary.errors.length > 0 && (
                <div className="bg-[#111318] border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#151720] border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-bold text-white">
                        Detalle de Errores y Advertencias por Fila
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {validationSummary.errors.length} observaciones
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0D0E12] text-[10px] text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-center w-16">Fila</th>
                          <th className="px-3 py-2 w-44">Campo</th>
                          <th className="px-3 py-2 w-36">Valor</th>
                          <th className="px-3 py-2">Error Encontrado</th>
                          <th className="px-3 py-2 text-center w-24">Severidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {validationSummary.errors.map((err, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-mono font-bold text-center text-slate-200">
                              {err.rowNumber}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-200">
                              {err.field}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-400 text-[11px] truncate max-w-xs">
                              {err.value || <span className="italic text-slate-600">(Vacío)</span>}
                            </td>
                            <td className="px-3 py-2 text-rose-300">
                              {err.error}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {err.severity === 'ERROR' ? (
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold rounded">
                                  ERROR
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold rounded">
                                  AVISO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PREVIEW OF VALID DATA READY TO BE SAVED */}
              <div className="bg-[#111318] border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#151720] border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Previsualización de Registros Válidos a Guardar ({validationSummary.validCount})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Archivo procesado: <strong className="text-white font-mono">{validationSummary.fileName}</strong>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {selectedEntity === 'DIRECCIONES' && (
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0D0E12] text-[10px] text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Nombre de Dirección / Órgano</th>
                          <th className="px-3 py-2">Clasificación Orgánica</th>
                          <th className="px-3 py-2">Dependencia</th>
                          <th className="px-3 py-2 text-center">Estado</th>
                          <th className="px-3 py-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {[...validationSummary.parsedValidRecords, ...validationSummary.parsedUpdateRecords].map((item: DireccionOrgano, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-mono font-bold text-indigo-300">{item.code}</td>
                            <td className="px-3 py-2 text-white font-medium">{item.name}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-bold rounded">
                                {item.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400">{item.dependencia_name}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded">
                                {item.active ? 'ACTIVO' : 'INACTIVO'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {validationSummary.parsedUpdateRecords.includes(item) ? (
                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-bold rounded">
                                  ACTUALIZAR
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded">
                                  NUEVO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedEntity === 'AREAS' && (
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0D0E12] text-[10px] text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Código Área</th>
                          <th className="px-3 py-2">Nombre Área / Oficina</th>
                          <th className="px-3 py-2">Dirección / Órgano Perteneciente</th>
                          <th className="px-3 py-2 text-center">Estado</th>
                          <th className="px-3 py-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {[...validationSummary.parsedValidRecords, ...validationSummary.parsedUpdateRecords].map((item: Area, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-mono font-bold text-blue-300">{item.code}</td>
                            <td className="px-3 py-2 text-white font-medium">{item.name}</td>
                            <td className="px-3 py-2 text-slate-300">{item.direccion_organo_name || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold rounded">
                                {item.active ? 'ACTIVO' : 'INACTIVO'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {validationSummary.parsedUpdateRecords.includes(item) ? (
                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-bold rounded">
                                  ACTUALIZAR
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded">
                                  NUEVO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedEntity === 'TRABAJADORES' && (
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0D0E12] text-[10px] text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Cód. DRAC</th>
                          <th className="px-3 py-2">DNI</th>
                          <th className="px-3 py-2">Apellidos y Nombres</th>
                          <th className="px-3 py-2">Dirección / Órgano</th>
                          <th className="px-3 py-2">Área / Oficina</th>
                          <th className="px-3 py-2">Cargo</th>
                          <th className="px-3 py-2">Usuario</th>
                          <th className="px-3 py-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {[...validationSummary.parsedValidRecords, ...validationSummary.parsedUpdateRecords].map((item: Employee, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-mono font-bold text-cyan-400">
                              {item.codigo_trabajador || 'DRAC-AUTO'}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-emerald-300">{item.dni}</td>
                            <td className="px-3 py-2 text-white font-medium">
                              {item.last_name}, {item.first_name}
                            </td>
                            <td className="px-3 py-2 text-slate-200 text-[11px]">
                              {item.direccion_organo_name || item.dependencia_name}
                            </td>
                            <td className="px-3 py-2 text-slate-400 text-[11px]">
                              {item.area_name || <span className="italic text-slate-600">Sin Asignar</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{item.position || 'Servidor Público'}</td>
                            <td className="px-3 py-2 font-mono text-indigo-300 text-[11px]">
                              @{item.username || item.dni}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {validationSummary.parsedUpdateRecords.includes(item) ? (
                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-bold rounded">
                                  ACTUALIZAR
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded">
                                  NUEVO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedEntity === 'ENCARGATURAS' && (
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0D0E12] text-[10px] text-slate-400 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Titular</th>
                          <th className="px-3 py-2">Encargado (e)</th>
                          <th className="px-3 py-2">Unidad Encargada</th>
                          <th className="px-3 py-2">Período Vigencia</th>
                          <th className="px-3 py-2">Documento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {validationSummary.parsedValidRecords.map((item: Encargatura, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-white font-medium">{item.titular_name} ({item.titular_dni})</td>
                            <td className="px-3 py-2 font-bold text-amber-300">{item.encargado_name} ({item.encargado_dni})</td>
                            <td className="px-3 py-2 text-slate-300">{item.cargo_encargado}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-300">
                              {item.start_date} al {item.end_date}
                            </td>
                            <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{item.document_number}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {currentStep === 'SUCCESS' && (
            <div className="p-8 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">¡Carga Masiva Completada con Éxito!</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Los registros válidos de <strong>{currentEntityConfig.title}</strong> han sido integrados correctamente al sistema DRAC y se ha generado la bitácora de auditoría.
                </p>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Registros creados:</span>
                  <strong className="text-emerald-400 font-mono">{validationSummary?.newCount || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Registros actualizados:</span>
                  <strong className="text-indigo-400 font-mono">{validationSummary?.updateCount || 0}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Errores rechazados:</span>
                  <strong className="text-rose-400 font-mono">{validationSummary?.errorCount || 0}</strong>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Finalizar y Volver al Módulo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-[#13151C] border-t border-slate-800 flex items-center justify-between shrink-0">
          {currentStep === 'SELECT_AND_UPLOAD' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isLoading ? 'Procesando Archivo...' : 'Seleccionar Archivo Excel'}</span>
              </button>
            </>
          )}

          {currentStep === 'PREVIEW_AND_VALIDATE' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Volver a Seleccionar Archivo
              </button>

              <div className="flex items-center gap-3">
                {validationSummary && validationSummary.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl text-xs font-bold border border-rose-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Informe de Errores ({validationSummary.errorCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!validationSummary || validationSummary.validCount === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Confirmar Carga ({validationSummary?.validCount || 0} Registros Válidos)
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
