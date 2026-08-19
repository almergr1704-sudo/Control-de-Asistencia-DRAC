import * as XLSX from 'xlsx';
import {
  Dependencia,
  DireccionOrgano,
  Area,
  Cargo,
  Employee,
  Encargatura,
  OrganoType,
  RoleType,
  RegimenLaboral,
  CondicionLaboral,
  EncargaturaMotivo,
  EncargaturaDocumentType,
} from '../types';
import { VALID_JEFE_ORGANO_TYPES } from './encargaturaUtils';
import { generateUniqueUsername } from './userAuthUtils';
import { generateNextDracCode } from './dracCodeUtils';

// ==========================================
// TIPOS Y DEFINICIONES DE CARGA MASIVA
// ==========================================

export type BulkUploadEntityType = 'DIRECCIONES' | 'AREAS' | 'TRABAJADORES' | 'ENCARGATURAS';

export type ImportMode = 'ONLY_NEW' | 'NEW_AND_UPDATE';

export interface RowValidationError {
  rowNumber: number;
  field: string;
  value: string;
  error: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationSummary<T> {
  entityType: BulkUploadEntityType;
  fileName: string;
  totalFound: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  duplicateCount: number;
  errorCount: number;
  warningCount: number;
  errors: RowValidationError[];
  parsedValidRecords: T[];
  parsedUpdateRecords: T[];
  rawRows: Record<string, any>[];
}

// Clasificaciones orgánicas permitidas según directiva DRAC
export const ALLOWED_ORGANO_TYPES: { code: OrganoType; label: string }[] = [
  { code: 'DIRECCION', label: 'DIRECCIÓN' },
  { code: 'ORGANO_APOYO', label: 'ÓRGANOS DE APOYO' },
  { code: 'JEFATURA_AGENCIA', label: 'JEFATURA DE AGENCIA' },
  { code: 'OFICINA_AGRARIA', label: 'OFICINA AGRARIA' },
];

export const ALLOWED_REGIMENES: RegimenLaboral[] = [
  'D.L. 276',
  'D.L. 728',
  'CAS D.L. 1057',
  'LOCACION_SERVICIOS',
  'OTRO',
];

export const ALLOWED_CONDICIONES: CondicionLaboral[] = [
  'NOMBRADO',
  'CONTRATADO',
  'DESIGNADO',
  'PRACTICANTE',
  'INDETERMINADO',
];

export const ALLOWED_ADDITIONAL_ROLES: { code: RoleType; label: string }[] = [
  { code: 'JEFE', label: 'JEFE INMEDIATO' },
  { code: 'HR_ADMIN', label: 'JEFE DE RECURSOS HUMANOS' },
  { code: 'SECURITY_GUARD', label: 'SEGURIDAD' },
  { code: 'CONTROL_ASISTENCIA', label: 'CONTROL DE ASISTENCIA' },
  { code: 'DIRECTOR_GENERAL', label: 'DIRECTOR GENERAL' },
  { code: 'ADMIN_GENERAL', label: 'ADMINISTRADOR GENERAL' },
];

// Helper para normalizar cadenas (quitar tildes, mayúsculas, espacios)
export function normalizeStr(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Helper para parsear fechas desde Excel (números seriales de Excel o strings YYYY-MM-DD / DD/MM/YYYY)
export function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel epoch 1900
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const partsSlash = s.split('/');
  if (partsSlash.length === 3) {
    const day = partsSlash[0].padStart(2, '0');
    const month = partsSlash[1].padStart(2, '0');
    const year = partsSlash[2].length === 2 ? `20${partsSlash[2]}` : partsSlash[2];
    return `${year}-${month}-${day}`;
  }
  // DD-MM-YYYY
  const partsDash = s.split('-');
  if (partsDash.length === 3 && partsDash[0].length <= 2) {
    const day = partsDash[0].padStart(2, '0');
    const month = partsDash[1].padStart(2, '0');
    const year = partsDash[2].length === 2 ? `20${partsDash[2]}` : partsDash[2];
    return `${year}-${month}-${day}`;
  }
  return s;
}

// ==========================================
// 1. GENERADORES DE PLANTILLAS OFICIALES EXCEL
// ==========================================

export function generateTemplateDireccionesOrganos(
  dependencias: Dependencia[] = []
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Datos con ejemplos reales DRAC
  const sampleData = [
    {
      'Código': 'DIR-001',
      'Nombre de Dirección / Órgano': 'Dirección de Administración',
      'Clasificación Orgánica': 'DIRECCIÓN',
      'Estado': 'ACTIVO',
      'Código Dependencia (Opcional)': dependencias[0]?.code || 'SEDE-01',
    },
    {
      'Código': 'ORG-001',
      'Nombre de Dirección / Órgano': 'Oficina de Control Institucional',
      'Clasificación Orgánica': 'ÓRGANOS DE APOYO',
      'Estado': 'ACTIVO',
      'Código Dependencia (Opcional)': dependencias[0]?.code || 'SEDE-01',
    },
    {
      'Código': 'JEF-001',
      'Nombre de Dirección / Órgano': 'Jefatura Agencia Agraria Jaén',
      'Clasificación Orgánica': 'JEFATURA DE AGENCIA',
      'Estado': 'ACTIVO',
      'Código Dependencia (Opcional)': dependencias.find(d => d.type === 'AGENCIA_AGRARIA')?.code || 'AA-JAEN',
    },
    {
      'Código': 'OAG-001',
      'Nombre de Dirección / Órgano': 'Oficina Agraria San Ignacio',
      'Clasificación Orgánica': 'OFICINA AGRARIA',
      'Estado': 'ACTIVO',
      'Código Dependencia (Opcional)': dependencias[0]?.code || 'SEDE-01',
    },
  ];
  const wsData = XLSX.utils.json_to_sheet(sampleData);
  wsData['!cols'] = [
    { wch: 15 }, // Código
    { wch: 40 }, // Nombre
    { wch: 26 }, // Clasificación
    { wch: 12 }, // Estado
    { wch: 30 }, // Dependencia
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Direcciones_Órganos');

  // Hoja 2: Instrucciones
  const instructions = [
    ['INSTRUCCIONES OFICIALES PARA LA CARGA MASIVA DE DIRECCIONES Y ÓRGANOS DRAC'],
    [''],
    ['1. ORDEN OBLIGATORIO DE CARGA: Esta plantilla corresponde al PASO 1 de la estructura organizacional.'],
    ['2. CÓDIGO: Obligatorio y único. Ej: DIR-001, ORG-001, JEF-001, OAG-001.'],
    ['3. NOMBRE: Obligatorio y no duplicado. Nombre oficial de la unidad.'],
    ['4. CLASIFICACIÓN ORGÁNICA: Únicamente se permiten los siguientes 4 valores exactos:'],
    ['   - DIRECCIÓN'],
    ['   - ÓRGANOS DE APOYO'],
    ['   - JEFATURA DE AGENCIA'],
    ['   - OFICINA AGRARIA'],
    ['5. ESTADO: ACTIVO o INACTIVO.'],
    ['6. VALIDACIÓN: No modifique los encabezados de la fila 1 de la hoja "Direcciones_Órganos".'],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

  // Hoja 3: Catálogo Permitido
  const catalogData = [
    ['Clasificación Orgánica Permitida', 'Código Interno', 'Permite Asignación de Jefe Inmediato'],
    ['DIRECCIÓN', 'DIRECCION', 'SÍ (Director de Línea)'],
    ['ÓRGANOS DE APOYO', 'ORGANO_APOYO', 'SÍ (Jefe de Órgano de Apoyo)'],
    ['JEFATURA DE AGENCIA', 'JEFATURA_AGENCIA', 'SÍ (Jefe de Agencia Agraria)'],
    ['OFICINA AGRARIA', 'OFICINA_AGRARIA', 'SÍ (Jefe de Oficina Agraria)'],
  ];
  const wsCat = XLSX.utils.aoa_to_sheet(catalogData);
  wsCat['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Catálogos_Permitidos');

  XLSX.writeFile(wb, 'Plantilla_Direcciones_Organos_DRAC.xlsx');
}

export function generateTemplateAreasOficinas(
  direcciones: DireccionOrgano[] = []
): void {
  const wb = XLSX.utils.book_new();

  // Filtrar o agrupar ejemplos por tipo de unidad superior si existen
  const dirEjemplo = direcciones.find((d) => d.type === 'DIRECCION') || direcciones[0];
  const organoApoyoEjemplo = direcciones.find((d) => d.type === 'ORGANO_APOYO') || direcciones[1] || direcciones[0];
  const oficinaAgrariaEjemplo = direcciones.find((d) => d.type === 'OFICINA_AGRARIA' || d.type === 'JEFATURA_AGENCIA') || direcciones[2] || direcciones[0];

  // Hoja 1: Datos de ejemplo según directiva jerárquica DRAC
  const sampleData = [
    {
      'Código Área / Oficina': 'ARE-001',
      'Nombre del Área / Oficina': 'Área de Recursos Humanos',
      'Tipo (Área / Oficina)': 'Área',
      'Código Dirección / Órgano / Oficina Agraria': dirEjemplo?.code || 'ADMIN',
      'Nombre Dirección / Órgano / Oficina Agraria': dirEjemplo?.name || 'OFICINA DE ADMINISTRACION',
      'Estado': 'ACTIVO',
    },
    {
      'Código Área / Oficina': 'ARE-002',
      'Nombre del Área / Oficina': 'Área de Abastecimiento y Servicios',
      'Tipo (Área / Oficina)': 'Área',
      'Código Dirección / Órgano / Oficina Agraria': dirEjemplo?.code || 'ADMIN',
      'Nombre Dirección / Órgano / Oficina Agraria': dirEjemplo?.name || 'OFICINA DE ADMINISTRACION',
      'Estado': 'ACTIVO',
    },
    {
      'Código Área / Oficina': 'OFI-001',
      'Nombre del Área / Oficina': 'Oficina de Auditoría Interna',
      'Tipo (Área / Oficina)': 'Oficina',
      'Código Dirección / Órgano / Oficina Agraria': organoApoyoEjemplo?.code || 'OAJ',
      'Nombre Dirección / Órgano / Oficina Agraria': organoApoyoEjemplo?.name || 'OFICINA DE ASESORIA JURIDICA',
      'Estado': 'ACTIVO',
    },
    {
      'Código Área / Oficina': 'ARE-003',
      'Nombre del Área / Oficina': 'Área Técnica Agraria',
      'Tipo (Área / Oficina)': 'Área',
      'Código Dirección / Órgano / Oficina Agraria': oficinaAgrariaEjemplo?.code || 'OAG-001',
      'Nombre Dirección / Órgano / Oficina Agraria': oficinaAgrariaEjemplo?.name || 'Oficina Agraria Cajamarca',
      'Estado': 'ACTIVO',
    },
  ];
  const wsData = XLSX.utils.json_to_sheet(sampleData);
  wsData['!cols'] = [
    { wch: 22 }, // Código Área
    { wch: 40 }, // Nombre Área
    { wch: 22 }, // Tipo
    { wch: 42 }, // Código Dirección/Órgano/Oficina Agraria
    { wch: 45 }, // Nombre Dirección/Órgano/Oficina Agraria
    { wch: 12 }, // Estado
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Areas_Oficinas');

  // Hoja 2: Instrucciones
  const instructions = [
    ['INSTRUCCIONES OFICIALES — CARGA MASIVA DE ÁREAS Y OFICINAS INSTITUCIONALES DRAC'],
    [''],
    ['1. ORDEN JERÁRQUICO OBLIGATORIO: Esta plantilla corresponde al PASO 2 de la estructura organizacional.'],
    ['   Primero deben existir las Direcciones, Órganos de Apoyo y Oficinas Agrarias en el sistema.'],
    ['2. DEPENDENCIA OBLIGATORIA: Toda Área u Oficina SIEMPRE debe estar asociada a una unidad superior:'],
    ['   - Dirección (Línea o Despacho)'],
    ['   - Órgano de Apoyo (OCI, Asesoría, Planificación, etc.)'],
    ['   - Oficina Agraria / Jefatura de Agencia'],
    ['   No se permite crear o importar Áreas u Oficinas huérfanas sin unidad superior.'],
    ['3. CÓDIGO DE DIRECCIÓN / ÓRGANO / OFICINA AGRARIA: Ingrese el código exacto de la unidad superior (Ver hoja "Unidades_Superiores_Existentes").'],
    ['4. NOMBRE DEL ÁREA / OFICINA: Denominación oficial del Área u Oficina.'],
    ['5. TIPO: "Área" u "Oficina".'],
    ['6. ESTADO: "ACTIVO" o "INACTIVO".'],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 105 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

  // Hoja 3: Unidades Superiores Existentes en el Sistema
  const dirRows = [
    ['Código Unidad Superior', 'Nombre Oficial de la Dirección / Órgano / Oficina Agraria', 'Clasificación Orgánica', 'Estado'],
    ...direcciones.map((d) => [d.code, d.name, d.type, d.active ? 'ACTIVO' : 'INACTIVO']),
  ];
  const wsDirs = XLSX.utils.aoa_to_sheet(dirRows);
  wsDirs['!cols'] = [{ wch: 25 }, { wch: 55 }, { wch: 25 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsDirs, 'Unidades_Superiores_Existentes');

  XLSX.writeFile(wb, 'Plantilla_Areas_Oficinas_DRAC.xlsx');
}

export function generateTemplateTrabajadores(
  direcciones: DireccionOrgano[] = [],
  areas: Area[] = [],
  cargos: Cargo[] = []
): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Datos de ejemplo según directiva actualizada DRAC
  // NO incluye Código DRAC ni Perfil (ambos automáticos)
  const sampleData = [
    {
      'DNI': '12345678',
      'Nombres': 'Juan',
      'Apellido Paterno': 'Pérez',
      'Apellido Materno': 'García',
      'Dirección / Órgano': direcciones[0]?.name || 'DIRECCION REGIONAL DE AGRICULTURA',
      'Área / Oficina': areas[0]?.name || 'DIRECCION REGIONAL DE AGRICULTURA JEFATURA',
      'Cargo Institucional': cargos[0]?.name || 'Especialista Agrario',
      'Sexo': 'M',
      'Fecha de Nacimiento': '1988-05-14',
      'Fecha de Ingreso': '2018-03-01',
      'Tipo de vínculo': 'D.L. 276',
      'Correo': 'jperez@dracajamarca.gob.pe',
      'Estado': 'ACTIVO',
    },
    {
      'DNI': '23456789',
      'Nombres': 'María',
      'Apellido Paterno': 'López',
      'Apellido Materno': 'Sánchez',
      'Dirección / Órgano': direcciones[1]?.name || 'OFICINA DE ADMINISTRACION',
      'Área / Oficina': '', // Opcional (Sin asignar)
      'Cargo Institucional': '', // Opcional (Sin asignar)
      'Sexo': 'F',
      'Fecha de Nacimiento': '1982-11-20',
      'Fecha de Ingreso': '2015-06-15',
      'Tipo de vínculo': 'D.L. 276',
      'Correo': 'mlopez@dracajamarca.gob.pe',
      'Estado': 'ACTIVO',
    },
    {
      'DNI': '34567890',
      'Nombres': 'Carlos',
      'Apellido Paterno': 'Torres',
      'Apellido Materno': 'Díaz',
      'Dirección / Órgano': direcciones[1]?.name || 'OFICINA DE ADMINISTRACION',
      'Área / Oficina': 'UNIDAD FUNCIONAL DE ABASTECIMIENTOS',
      'Cargo Institucional': 'Técnico Administrativo',
      'Sexo': 'M',
      'Fecha de Nacimiento': '1992-08-10',
      'Fecha de Ingreso': '2021-01-15',
      'Tipo de vínculo': 'CAS D.L. 1057',
      'Correo': 'ctorres@dracajamarca.gob.pe',
      'Estado': 'ACTIVO',
    },
  ];

  const wsData = XLSX.utils.json_to_sheet(sampleData);
  wsData['!cols'] = [
    { wch: 12 }, // DNI
    { wch: 20 }, // Nombres
    { wch: 18 }, // Apellido Paterno
    { wch: 18 }, // Apellido Materno
    { wch: 38 }, // Dirección / Órgano
    { wch: 38 }, // Área / Oficina
    { wch: 30 }, // Cargo Institucional
    { wch: 8 },  // Sexo
    { wch: 18 }, // F. Nacimiento
    { wch: 18 }, // F. Ingreso
    { wch: 18 }, // Vinculo
    { wch: 30 }, // Correo
    { wch: 12 }, // Estado
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Trabajadores');

  // Hoja 2: Instrucciones Oficiales
  const instructions = [
    ['INSTRUCCIONES OFICIALES PARA LA CARGA MASIVA DE TRABAJADORES DRAC'],
    [''],
    ['1. CÓDIGO DRAC AUTOMÁTICO: El sistema genera automáticamente el código (DRAC-0001, DRAC-0002, etc.) reutilizando huecos correlativos.'],
    ['   NO debe incluir una columna para Código DRAC en su archivo Excel.'],
    [''],
    ['2. PERFIL BASE AUTOMÁTICO (TRABAJADOR): Todo trabajador importado recibe automáticamente el perfil "TRABAJADOR".'],
    ['   NO se permite asignar perfiles adicionales desde Excel. Cualquier perfil superior (Jefe, RRHH, Vigilancia, etc.) debe ser asignado posteriormente desde el sistema.'],
    [''],
    ['3. CAMPOS OBLIGATORIOS:'],
    ['   - DNI (8 dígitos numéricos peruanos, no duplicado)'],
    ['   - Nombres'],
    ['   - Apellido Paterno'],
    ['   - Apellido Materno (OBLIGATORIO)'],
    ['   - Dirección / Órgano (OBLIGATORIO - Debe coincidir con una Dirección u Órgano existente)'],
    [''],
    ['4. CAMPOS OPCIONALES:'],
    ['   - Área / Oficina (Opcional - Puede dejarse en blanco si aún no está asignado)'],
    ['   - Cargo Institucional (Opcional - Puede dejarse en blanco)'],
    ['   - Sexo, Fechas de Nacimiento e Ingreso, Tipo de vínculo, Correo'],
    [''],
    ['5. GENERACIÓN AUTOMÁTICA DE USUARIO: El sistema genera el usuario según: Inicial Nombre + Apellido Paterno (+ Materno / sufijo en colisión).'],
    ['6. FORMATO DE FECHAS: YYYY-MM-DD (Ejemplo: 1988-05-14 o formato estándar de Excel).'],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 115 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

  // Hoja 3: Direcciones y Áreas de Referencia
  const refRows = [
    ['TIPO', 'NOMBRE OFICIAL EN EL SISTEMA', 'CÓDIGO', 'INFORMACIÓN ORGÁNICA'],
    ...direcciones.map(d => ['DIRECCIÓN / ÓRGANO (Obligatorio)', d.name, d.code, d.type]),
    ...areas.map(a => ['ÁREA / OFICINA (Opcional)', a.name, a.code, `Pertenece a: ${a.direccion_organo_name || a.direccion_organo_id || ''}`]),
    ...ALLOWED_REGIMENES.map(reg => ['RÉGIMEN LABORAL', reg, 'Modalidad Contractual DRAC', 'Vínculo']),
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  wsRef['!cols'] = [{ wch: 32 }, { wch: 45 }, { wch: 18 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Codigos_Referencia');

  XLSX.writeFile(wb, 'Plantilla_Trabajadores_DRAC.xlsx');
}

export function generateTemplateEncargaturas(
  direcciones: DireccionOrgano[] = [],
  areas: Area[] = [],
  employees: Employee[] = []
): void {
  const wb = XLSX.utils.book_new();

  const sampleData = [
    {
      'DNI Titular': employees[0]?.dni || '42987654',
      'Nombre Titular (Opcional)': `${employees[0]?.first_name || 'Carlos'} ${employees[0]?.last_name || 'Mendoza'}`,
      'DNI Encargado': employees[1]?.dni || '40123987',
      'Nombre Encargado (Opcional)': `${employees[1]?.first_name || 'María'} ${employees[1]?.last_name || 'Silva'}`,
      'Código Dirección/Órgano Encargada': direcciones[0]?.code || 'DIR-001',
      'Código Área/Oficina (Opcional)': areas[0]?.code || 'ARE-001',
      'Fecha Inicio (YYYY-MM-DD)': '2026-08-01',
      'Fecha Término (YYYY-MM-DD)': '2026-08-31',
      'Motivo': 'VACACIONES',
      'Tipo Documento': 'MEMORANDO',
      'Número Documento': 'Memorando N.° 045-2026-DRAC',
      'Fecha Documento (YYYY-MM-DD)': '2026-07-28',
      'Observaciones': 'Encargatura de funciones de Dirección de Administración por descanso vacacional del titular.',
    },
  ];

  const wsData = XLSX.utils.json_to_sheet(sampleData);
  wsData['!cols'] = [
    { wch: 14 }, // DNI Titular
    { wch: 26 }, // Nombre Titular
    { wch: 14 }, // DNI Encargado
    { wch: 26 }, // Nombre Encargado
    { wch: 32 }, // Cod Dir
    { wch: 28 }, // Cod Area
    { wch: 24 }, // F. Inicio
    { wch: 24 }, // F. Término
    { wch: 18 }, // Motivo
    { wch: 22 }, // Tipo Doc
    { wch: 30 }, // Nro Doc
    { wch: 25 }, // Fecha Doc
    { wch: 45 }, // Observaciones
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Encargaturas');

  const instructions = [
    ['INSTRUCCIONES OFICIALES PARA LA CARGA MASIVA DE ENCARGATURAS TEMPORALES DRAC'],
    [''],
    ['1. DNI TITULAR & DNI ENCARGADO: Ambos trabajadores deben estar previamente registrados en el sistema.'],
    ['2. CÓDIGO DIRECCIÓN/ÓRGANO: Código de la unidad orgánica cuya jefatura será asumida temporalmente.'],
    ['3. MOTIVOS PERMITIDOS: VACACIONES, LICENCIA, COMISION_SERVICIOS, PERMISO, TRABAJO_FUERA_SEDE, OTRO.'],
    ['4. TIPO DOCUMENTO: MEMORANDO, RESOLUCION_DIRECTORAL, OFICIO, DECRETO, OTRO.'],
    ['5. NÚMERO DOCUMENTO: Identificador formal del acto administrativo que sustenta la designación.'],
    ['6. FECHAS: Formato YYYY-MM-DD. La fecha de término no puede ser anterior a la fecha de inicio.'],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

  XLSX.writeFile(wb, 'Plantilla_Encargaturas_DRAC.xlsx');
}

// ==========================================
// 2. GENERADOR DE REPORTE DE ERRORES EXCEL
// ==========================================

export function generateErrorReportExcel(
  entityType: BulkUploadEntityType,
  errors: RowValidationError[],
  fileName: string = 'Reporte_Errores'
): void {
  const wb = XLSX.utils.book_new();

  const data = errors.map((err) => ({
    'Fila': err.rowNumber,
    'Campo / Columna': err.field,
    'Valor Encontrado': err.value || '(Vacío)',
    'Tipo de Error': err.error,
    'Severidad': err.severity,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 10 }, // Fila
    { wch: 25 }, // Campo
    { wch: 30 }, // Valor
    { wch: 55 }, // Error
    { wch: 14 }, // Severidad
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Errores_Validacion');
  XLSX.writeFile(wb, `Errores_Carga_${entityType}_${new Date().toISOString().substring(0, 10)}.xlsx`);
}

// ==========================================
// 3. PARSERS & VALIDACIÓN DE DIRECCIONES / ÓRGANOS
// ==========================================

export function validateDireccionesOrganosExcel(
  rows: Record<string, any>[],
  existingDirs: DireccionOrgano[],
  existingDeps: Dependencia[],
  importMode: ImportMode = 'NEW_AND_UPDATE',
  fileName: string = 'Direcciones.xlsx'
): ValidationSummary<DireccionOrgano> {
  const errors: RowValidationError[] = [];
  const validRecords: DireccionOrgano[] = [];
  const updateRecords: DireccionOrgano[] = [];

  const seenCodesInFile = new Set<string>();
  const seenNamesInFile = new Set<string>();

  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 considering Excel header is row 1
    const rawCode = String(row['Código'] || row['Codigo'] || row['CODIGO'] || row['code'] || '').trim();
    const rawName = String(row['Nombre de Dirección / Órgano'] || row['Nombre'] || row['NOMBRE'] || row['name'] || '').trim();
    const rawClasif = String(row['Clasificación Orgánica'] || row['Clasificacion Organica'] || row['CLASIFICACION'] || row['type'] || '').trim();
    const rawState = String(row['Estado'] || row['ESTADO'] || row['active'] || 'ACTIVO').trim();
    const rawDepCode = String(row['Código Dependencia (Opcional)'] || row['Dependencia'] || '').trim();

    let rowHasError = false;

    // 1. Código obligatorio
    if (!rawCode) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código',
        value: '',
        error: 'El código de la Dirección u Órgano es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 2. Nombre obligatorio
    if (!rawName) {
      errors.push({
        rowNumber: rowNum,
        field: 'Nombre de Dirección / Órgano',
        value: '',
        error: 'El nombre de la Dirección u Órgano es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 3. Clasificación obligatoria y permitida
    const normClasif = normalizeStr(rawClasif);
    let mappedType: OrganoType | null = null;
    if (normClasif === 'DIRECCION' || normClasif === 'DIRECCION DE LINEA') {
      mappedType = 'DIRECCION';
    } else if (normClasif === 'ORGANOS DE APOYO' || normClasif === 'ORGANO DE APOYO' || normClasif === 'ORGANO_APOYO') {
      mappedType = 'ORGANO_APOYO';
    } else if (normClasif === 'JEFATURA DE AGENCIA' || normClasif === 'JEFATURA_AGENCIA' || normClasif === 'AGENCIA AGRARIA') {
      mappedType = 'JEFATURA_AGENCIA';
    } else if (normClasif === 'OFICINA AGRARIA' || normClasif === 'OFICINA_AGRARIA') {
      mappedType = 'OFICINA_AGRARIA';
    } else {
      errors.push({
        rowNumber: rowNum,
        field: 'Clasificación Orgánica',
        value: rawClasif,
        error: 'Clasificación no válida. Solo se permite: DIRECCIÓN, ÓRGANOS DE APOYO, JEFATURA DE AGENCIA, OFICINA AGRARIA.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 4. Código duplicado en el mismo archivo
    const normCode = rawCode.toUpperCase();
    if (seenCodesInFile.has(normCode)) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código',
        value: rawCode,
        error: `Código duplicado en el archivo Excel (${rawCode}).`,
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (rawCode) {
      seenCodesInFile.add(normCode);
    }

    // 5. Nombre duplicado en el mismo archivo
    const normName = normalizeStr(rawName);
    if (seenNamesInFile.has(normName)) {
      errors.push({
        rowNumber: rowNum,
        field: 'Nombre',
        value: rawName,
        error: `Nombre duplicado dentro del archivo Excel ("${rawName}").`,
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (rawName) {
      seenNamesInFile.add(normName);
    }

    // 6. Verificar existencia previa en base de datos
    const existing = existingDirs.find(
      (d) => d.code.toUpperCase() === normCode || normalizeStr(d.name) === normName
    );

    if (existing) {
      if (importMode === 'ONLY_NEW') {
        duplicateCount++;
        errors.push({
          rowNumber: rowNum,
          field: 'Código / Nombre',
          value: `${rawCode} - ${rawName}`,
          error: `Registro ya existe en el sistema. Omitido según modo "Solo nuevos registros".`,
          severity: 'WARNING',
        });
        return;
      }
    }

    if (rowHasError) return;

    // Resuelve Dependencia asociada
    let dep = existingDeps.find((d) => d.code.toUpperCase() === rawDepCode.toUpperCase());
    if (!dep) {
      dep = existingDeps[0] || {
        id: 'dep-sede-central',
        code: 'SEDE-01',
        name: 'Sede Central DRAC',
        type: 'SEDE_CENTRAL',
        active: true,
        created_at: new Date().toISOString(),
      };
    }

    const isActive = normalizeStr(rawState) !== 'INACTIVO';

    if (existing && importMode === 'NEW_AND_UPDATE') {
      updateCount++;
      updateRecords.push({
        ...existing,
        name: rawName,
        type: mappedType!,
        active: isActive,
      });
    } else {
      newCount++;
      validRecords.push({
        id: `dir-${Date.now()}-${index}`,
        code: rawCode,
        name: rawName,
        type: mappedType!,
        dependencia_id: dep.id,
        dependencia_name: dep.name,
        active: isActive,
        created_at: new Date().toISOString(),
      });
    }
  });

  return {
    entityType: 'DIRECCIONES',
    fileName,
    totalFound: rows.length,
    validCount: validRecords.length + updateRecords.length,
    newCount,
    updateCount,
    duplicateCount,
    errorCount: errors.filter((e) => e.severity === 'ERROR').length,
    warningCount: errors.filter((e) => e.severity === 'WARNING').length,
    errors,
    parsedValidRecords: validRecords,
    parsedUpdateRecords: updateRecords,
    rawRows: rows,
  };
}

// ==========================================
// 4. PARSERS & VALIDACIÓN DE ÁREAS / OFICINAS
// ==========================================

export function validateAreasExcel(
  rows: Record<string, any>[],
  existingAreas: Area[],
  existingDirs: DireccionOrgano[],
  existingDeps: Dependencia[],
  importMode: ImportMode = 'NEW_AND_UPDATE',
  fileName: string = 'Areas_Oficinas.xlsx'
): ValidationSummary<Area> {
  const errors: RowValidationError[] = [];
  const validRecords: Area[] = [];
  const updateRecords: Area[] = [];

  const seenCodesInFile = new Set<string>();
  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const rawAreaCode = String(
      row['Código Área / Oficina'] ||
      row['Código Área'] ||
      row['Codigo Area'] ||
      row['CODIGO_AREA'] ||
      row['code'] ||
      ''
    ).trim();

    const rawAreaName = String(
      row['Nombre del Área / Oficina'] ||
      row['Nombre Área / Oficina'] ||
      row['Nombre Área'] ||
      row['Nombre Area'] ||
      row['NOMBRE_AREA'] ||
      row['name'] ||
      ''
    ).trim();

    const rawDirCode = String(
      row['Código Dirección / Órgano / Oficina Agraria'] ||
      row['Código de Dirección/Órgano/Oficina Agraria a la que pertenece'] ||
      row['Código Dirección/Órgano'] ||
      row['Codigo Direccion'] ||
      row['CODIGO_DIR'] ||
      row['dir_code'] ||
      row['Código Unidad Superior'] ||
      ''
    ).trim();

    const rawDirName = String(
      row['Nombre Dirección / Órgano / Oficina Agraria'] ||
      row['Nombre Dirección/Órgano'] ||
      row['Pertenece a'] ||
      row['Direccion'] ||
      row['Unidad Superior'] ||
      ''
    ).trim();

    const rawType = String(row['Tipo (Área / Oficina)'] || row['Tipo'] || row['TIPO'] || 'ÁREA').trim();
    const rawState = String(row['Estado'] || row['ESTADO'] || 'ACTIVO').trim();

    let rowHasError = false;

    if (!rawAreaCode) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Área',
        value: '',
        error: 'El código del Área u Oficina es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (!rawAreaName) {
      errors.push({
        rowNumber: rowNum,
        field: 'Nombre del Área / Oficina',
        value: '',
        error: 'El nombre del Área u Oficina es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Validación de pertenencia obligatoria a Dirección, Órgano de Apoyo u Oficina Agraria
    if (!rawDirCode && !rawDirName) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Dirección / Órgano / Oficina Agraria',
        value: '',
        error: 'Debe seleccionar la Dirección, Órgano de Apoyo u Oficina Agraria a la que pertenece esta Área/Oficina.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Busca la Dirección / Órgano / Oficina Agraria en el catálogo del sistema
    const parentDir = existingDirs.find(
      (d) =>
        (rawDirCode && d.code.toUpperCase() === rawDirCode.toUpperCase()) ||
        (rawDirName && normalizeStr(d.name) === normalizeStr(rawDirName)) ||
        (rawDirCode && d.id === rawDirCode)
    );

    if (!parentDir && (rawDirCode || rawDirName)) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Dirección / Órgano / Oficina Agraria',
        value: rawDirCode || rawDirName,
        error: 'Debe seleccionar la Dirección, Órgano de Apoyo u Oficina Agraria a la que pertenece esta Área/Oficina. La unidad indicada no existe o no está registrada.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Código duplicado en el mismo archivo
    const normCode = rawAreaCode.toUpperCase();
    if (seenCodesInFile.has(normCode)) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Área',
        value: rawAreaCode,
        error: `Código de área duplicado dentro del archivo Excel (${rawAreaCode}).`,
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (rawAreaCode) {
      seenCodesInFile.add(normCode);
    }

    // Existencia previa en base de datos
    const existing = existingAreas.find((a) => a.code.toUpperCase() === normCode);
    if (existing) {
      if (importMode === 'ONLY_NEW') {
        duplicateCount++;
        errors.push({
          rowNumber: rowNum,
          field: 'Código Área',
          value: rawAreaCode,
          error: `El Área ya existe en el sistema. Omitida según modo "Solo nuevos registros".`,
          severity: 'WARNING',
        });
        return;
      }
    }

    if (rowHasError || !parentDir) return;

    const isActive = normalizeStr(rawState) !== 'INACTIVO';
    const isOficina = normalizeStr(rawType).includes('OFICINA') || normalizeStr(rawAreaName).startsWith('OFICINA');

    if (existing && importMode === 'NEW_AND_UPDATE') {
      updateCount++;
      updateRecords.push({
        ...existing,
        name: rawAreaName,
        tipo: isOficina ? 'OFICINA' : 'AREA',
        dependencia_id: parentDir.dependencia_id || existing.dependencia_id,
        dependencia_name: parentDir.dependencia_name || existing.dependencia_name,
        direccion_organo_id: parentDir.id,
        direccion_organo_name: parentDir.name,
        unidad_superior_id: parentDir.id,
        active: isActive,
      });
    } else {
      newCount++;
      validRecords.push({
        id: `area-${Date.now()}-${index}`,
        code: rawAreaCode,
        name: rawAreaName,
        tipo: isOficina ? 'OFICINA' : 'AREA',
        description: `${isOficina ? 'Oficina' : 'Área'} adscrita a ${parentDir.name}`,
        dependencia_id: parentDir.dependencia_id || existingDeps[0]?.id || '',
        dependencia_name: parentDir.dependencia_name || existingDeps[0]?.name || 'Sede Central DRAC',
        direccion_organo_id: parentDir.id,
        direccion_organo_name: parentDir.name,
        unidad_superior_id: parentDir.id,
        active: isActive,
        created_at: new Date().toISOString(),
      });
    }
  });

  return {
    entityType: 'AREAS',
    fileName,
    totalFound: rows.length,
    validCount: validRecords.length + updateRecords.length,
    newCount,
    updateCount,
    duplicateCount,
    errorCount: errors.filter((e) => e.severity === 'ERROR').length,
    warningCount: errors.filter((e) => e.severity === 'WARNING').length,
    errors,
    parsedValidRecords: validRecords,
    parsedUpdateRecords: updateRecords,
    rawRows: rows,
  };
}

// ==========================================
// 5. PARSERS & VALIDACIÓN DE TRABAJADORES
// ==========================================

export function validateTrabajadoresExcel(
  rows: Record<string, any>[],
  existingEmployees: Employee[],
  existingDirs: DireccionOrgano[],
  existingAreas: Area[],
  existingCargos: Cargo[],
  existingDeps: Dependencia[],
  importMode: ImportMode = 'NEW_AND_UPDATE',
  fileName: string = 'Trabajadores.xlsx'
): ValidationSummary<Employee> {
  const errors: RowValidationError[] = [];
  const validRecords: Employee[] = [];
  const updateRecords: Employee[] = [];

  const seenDnisInFile = new Set<string>();
  const allocatedDracCodesInBatch = new Set<string>();
  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    const rawDni = String(row['DNI'] || row['dni'] || row['DOCUMENTO'] || '').trim();
    const rawNombres = String(row['Nombres'] || row['Nombre'] || row['NOMBRES'] || row['first_name'] || '').trim();
    const rawPaterno = String(row['Apellido Paterno'] || row['Paterno'] || row['APELLIDO_PATERNO'] || '').trim();
    const rawMaterno = String(row['Apellido Materno'] || row['Materno'] || row['APELLIDO_MATERNO'] || '').trim();
    const rawDirInput = String(
      row['Dirección / Órgano'] ||
      row['Direccion / Organo'] ||
      row['Dirección'] ||
      row['Direccion'] ||
      row['Código Dirección/Órgano'] ||
      row['Codigo Direccion'] ||
      row['CODIGO_DIR'] ||
      ''
    ).trim();
    const rawAreaInput = String(
      row['Área / Oficina'] ||
      row['Area / Oficina'] ||
      row['Área'] ||
      row['Area'] ||
      row['Código Área/Oficina'] ||
      row['Codigo Area'] ||
      row['CODIGO_AREA'] ||
      ''
    ).trim();
    const rawCargo = String(
      row['Cargo Institucional'] ||
      row['Cargo'] ||
      row['CARGO'] ||
      row['position'] ||
      'Servidor Público'
    ).trim();
    const rawSexo = String(row['Sexo'] || row['SEXO'] || 'M').trim();
    const rawBirthDate = parseExcelDate(row['Fecha de Nacimiento'] || row['F_Nacimiento'] || row['birth_date']);
    const rawHireDate = parseExcelDate(row['Fecha de Ingreso'] || row['F_Ingreso'] || row['hire_date']) || new Date().toISOString().substring(0, 10);
    const rawVinculo = String(row['Tipo de vínculo'] || row['Regimen'] || row['REGIMEN'] || 'D.L. 276').trim();
    const rawEmail = String(row['Correo'] || row['Email'] || row['CORREO'] || '').trim();
    const rawState = String(row['Estado'] || row['ESTADO'] || 'ACTIVO').trim();

    let rowHasError = false;

    // 1. DNI obligatorio y formato de 8 dígitos
    if (!rawDni) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI',
        value: '',
        error: 'El DNI del trabajador es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (!/^\d{8}$/.test(rawDni)) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI',
        value: rawDni,
        error: `El DNI debe contener exactamente 8 dígitos numéricos peruanos (${rawDni}).`,
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 2. Nombres obligatorios
    if (!rawNombres) {
      errors.push({
        rowNumber: rowNum,
        field: 'Nombres',
        value: '',
        error: 'El campo Nombres es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 3. Apellido Paterno obligatorio
    if (!rawPaterno) {
      errors.push({
        rowNumber: rowNum,
        field: 'Apellido Paterno',
        value: '',
        error: 'El campo Apellido Paterno es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 4. Apellido Materno — OBLIGATORIO SEGÚN REGLA DEL SISTEMA
    if (!rawMaterno) {
      errors.push({
        rowNumber: rowNum,
        field: 'Apellido Materno',
        value: '',
        error: 'El campo Apellido Materno es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // 5. DNI duplicado en el mismo archivo
    if (seenDnisInFile.has(rawDni)) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI',
        value: rawDni,
        error: `DNI duplicado dentro del archivo Excel (${rawDni}).`,
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (rawDni) {
      seenDnisInFile.add(rawDni);
    }

    // 6. Dirección / Órgano — OBLIGATORIO
    if (!rawDirInput) {
      errors.push({
        rowNumber: rowNum,
        field: 'Dirección / Órgano',
        value: '',
        error: 'El campo Dirección / Órgano es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Validar existencia de Dirección / Órgano en el sistema por Código o por Nombre
    let parentDir: DireccionOrgano | undefined = undefined;
    if (rawDirInput) {
      parentDir = existingDirs.find(
        (d) =>
          d.code.toUpperCase() === rawDirInput.toUpperCase() ||
          normalizeStr(d.name) === normalizeStr(rawDirInput)
      );

      if (!parentDir) {
        errors.push({
          rowNumber: rowNum,
          field: 'Dirección / Órgano',
          value: rawDirInput,
          error: `La Dirección u Órgano "${rawDirInput}" no existe en el sistema o está inactiva.`,
          severity: 'ERROR',
        });
        rowHasError = true;
      }
    }

    // 7. Área / Oficina — OPCIONAL (No bloquea si está vacío)
    let parentArea: Area | undefined = undefined;
    if (rawAreaInput) {
      parentArea = existingAreas.find(
        (a) =>
          a.code.toUpperCase() === rawAreaInput.toUpperCase() ||
          normalizeStr(a.name) === normalizeStr(rawAreaInput)
      );

      if (!parentArea) {
        errors.push({
          rowNumber: rowNum,
          field: 'Área / Oficina',
          value: rawAreaInput,
          error: `El Área u Oficina especificada ("${rawAreaInput}") no existe en el sistema.`,
          severity: 'ERROR',
        });
        rowHasError = true;
      }
    }

    // 8. Régimen Laboral
    let mappedRegimen: RegimenLaboral = 'D.L. 276';
    const normReg = normalizeStr(rawVinculo);
    if (normReg.includes('728')) mappedRegimen = 'D.L. 728';
    else if (normReg.includes('1057') || normReg.includes('CAS')) mappedRegimen = 'CAS D.L. 1057';
    else if (normReg.includes('LOCACION') || normReg.includes('TERCERO')) mappedRegimen = 'LOCACION_SERVICIOS';
    else if (normReg.includes('276')) mappedRegimen = 'D.L. 276';

    // 9. DNI existente en la base de datos
    const existing = existingEmployees.find((e) => e.dni === rawDni);

    if (existing) {
      if (importMode === 'ONLY_NEW') {
        duplicateCount++;
        errors.push({
          rowNumber: rowNum,
          field: 'DNI',
          value: rawDni,
          error: `Trabajador con DNI ${rawDni} (${existing.first_name} ${existing.last_name}) ya existe en el sistema. Omitido según modo "Solo nuevos registros".`,
          severity: 'WARNING',
        });
        return;
      }
    }

    if (rowHasError) return;

    // Resuelve Dependencia
    const dep = existingDeps.find((d) => d.id === parentDir?.dependencia_id) || existingDeps[0] || {
      id: 'dep-01',
      code: '01',
      name: 'SEDE CENTRAL',
      type: 'SEDE_CENTRAL',
      active: true,
      created_at: new Date().toISOString(),
    };

    const isActive = normalizeStr(rawState) !== 'INACTIVO';

    // REGLA CRÍTICA: Todo trabajador importado mediante Excel recibe ÚNICAMENTE el perfil base TRABAJADOR
    const primaryRole: RoleType = 'TRABAJADOR';
    const assignedRoles: RoleType[] = ['TRABAJADOR'];

    // Generación automática del usuario según: Inicial 1er nombre + Apellido Paterno (+ Materno / sufijo en colisión)
    const generatedUsername = generateUniqueUsername(
      rawNombres,
      rawPaterno,
      rawMaterno,
      [...existingEmployees, ...validRecords]
    );
    const defaultEmail = rawEmail || `${generatedUsername}@dracajamarca.gob.pe`;
    const fullLastName = `${rawPaterno} ${rawMaterno}`.trim();

    if (existing && importMode === 'NEW_AND_UPDATE') {
      updateCount++;
      // Protegemos código DRAC original, DNI original
      updateRecords.push({
        ...existing,
        first_name: rawNombres,
        last_name: fullLastName,
        apellido_paterno: rawPaterno,
        apellido_materno: rawMaterno,
        email: rawEmail || existing.email,
        dependencia_id: dep.id,
        dependencia_name: dep.name,
        direccion_organo_id: parentDir?.id || existing.direccion_organo_id,
        direccion_organo_name: parentDir?.name || existing.direccion_organo_name,
        area_id: parentArea ? parentArea.id : existing.area_id,
        area_name: parentArea ? parentArea.name : (existing.area_name || 'Sin Asignar'),
        position: rawCargo || existing.position || 'Servidor Público',
        regimen_laboral: mappedRegimen,
        role: existing.role || primaryRole,
        assigned_roles: existing.assigned_roles && existing.assigned_roles.length > 0 ? existing.assigned_roles : assignedRoles,
        active: isActive,
        account_status: isActive ? 'ACTIVE' : 'INACTIVE',
      });
    } else {
      newCount++;

      // GENERACIÓN AUTOMÁTICA DEL CÓDIGO DRAC CON REUTILIZACIÓN DE HUECOS / CORRELATIVO
      const assignedDracCode = generateNextDracCode(
        [...existingEmployees, ...validRecords],
        allocatedDracCodesInBatch
      );
      allocatedDracCodesInBatch.add(assignedDracCode);

      validRecords.push({
        id: `emp-${Date.now()}-${index}`,
        codigo_trabajador: assignedDracCode,
        dni: rawDni,
        first_name: rawNombres,
        last_name: fullLastName,
        apellido_paterno: rawPaterno,
        apellido_materno: rawMaterno,
        email: defaultEmail,
        phone: '976000000',
        dependencia_id: dep.id,
        dependencia_name: dep.name,
        direccion_organo_id: parentDir?.id,
        direccion_organo_name: parentDir?.name,
        area_id: parentArea ? parentArea.id : undefined,
        area_name: parentArea ? parentArea.name : 'Sin Asignar',
        position: rawCargo || 'Servidor Público',
        regimen_laboral: mappedRegimen,
        condicion_laboral: 'NOMBRADO',
        is_jefe_director: false,
        has_system_access: true,
        username: generatedUsername,
        password_change_required: true,
        primer_ingreso: 'PENDIENTE',
        account_status: isActive ? 'ACTIVE' : 'INACTIVE',
        auth_method: 'PASSWORD',
        role: primaryRole,
        assigned_roles: assignedRoles,
        hire_date: rawHireDate,
        active: isActive,
        role_history: [
          {
            id: `rh-${Date.now()}-${index}`,
            previous_role: primaryRole,
            new_role: primaryRole,
            previous_status: 'ACTIVE',
            new_status: isActive ? 'ACTIVE' : 'INACTIVE',
            changed_at: new Date().toISOString(),
            changed_by: 'Carga Masiva Excel DRAC',
            reason: `Importación inicial de personal DRAC (${fileName}). Código asignado: ${assignedDracCode}. Usuario: @${generatedUsername}. Perfil: TRABAJADOR`,
          },
        ],
      });
    }
  });

  return {
    entityType: 'TRABAJADORES',
    fileName,
    totalFound: rows.length,
    validCount: validRecords.length + updateRecords.length,
    newCount,
    updateCount,
    duplicateCount,
    errorCount: errors.filter((e) => e.severity === 'ERROR').length,
    warningCount: errors.filter((e) => e.severity === 'WARNING').length,
    errors,
    parsedValidRecords: validRecords,
    parsedUpdateRecords: updateRecords,
    rawRows: rows,
  };
}

// ==========================================
// 6. PARSERS & VALIDACIÓN DE ENCARGATURAS
// ==========================================

export function validateEncargaturasExcel(
  rows: Record<string, any>[],
  existingEncargaturas: Encargatura[],
  existingEmployees: Employee[],
  existingDirs: DireccionOrgano[],
  existingAreas: Area[],
  existingDeps: Dependencia[],
  fileName: string = 'Encargaturas.xlsx'
): ValidationSummary<Encargatura> {
  const errors: RowValidationError[] = [];
  const validRecords: Encargatura[] = [];
  let newCount = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    const rawTitularDni = String(row['DNI Titular'] || row['DNI_Titular'] || row['titular_dni'] || '').trim();
    const rawEncargadoDni = String(row['DNI Encargado'] || row['DNI_Encargado'] || row['encargado_dni'] || '').trim();
    const rawDirCode = String(row['Código Dirección/Órgano Encargada'] || row['Codigo Direccion'] || '').trim();
    const rawAreaCode = String(row['Código Área/Oficina (Opcional)'] || row['Codigo Area'] || '').trim();
    const rawStartDate = parseExcelDate(row['Fecha Inicio (YYYY-MM-DD)'] || row['Fecha Inicio'] || row['start_date']);
    const rawEndDate = parseExcelDate(row['Fecha Término (YYYY-MM-DD)'] || row['Fecha Termino'] || row['end_date']);
    const rawMotivo = String(row['Motivo'] || row['MOTIVO'] || 'VACACIONES').trim();
    const rawDocType = String(row['Tipo Documento'] || row['Tipo_Doc'] || 'MEMORANDO').trim();
    const rawDocNumber = String(row['Número Documento'] || row['Nro_Doc'] || '').trim();
    const rawDocDate = parseExcelDate(row['Fecha Documento (YYYY-MM-DD)'] || row['Fecha Documento'] || row['doc_date']) || new Date().toISOString().substring(0, 10);
    const rawObs = String(row['Observaciones'] || row['OBSERVACIONES'] || '').trim();

    let rowHasError = false;

    // Titular
    const titular = existingEmployees.find((e) => e.dni === rawTitularDni);
    if (!rawTitularDni) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI Titular',
        value: '',
        error: 'El DNI del trabajador titular es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (!titular) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI Titular',
        value: rawTitularDni,
        error: `El trabajador titular con DNI ${rawTitularDni} no está registrado en el sistema.`,
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Encargado
    const encargado = existingEmployees.find((e) => e.dni === rawEncargadoDni);
    if (!rawEncargadoDni) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI Encargado',
        value: '',
        error: 'El DNI del trabajador encargado es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (!encargado) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI Encargado',
        value: rawEncargadoDni,
        error: `El trabajador encargado con DNI ${rawEncargadoDni} no está registrado en el sistema.`,
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (rawTitularDni && rawEncargadoDni && rawTitularDni === rawEncargadoDni) {
      errors.push({
        rowNumber: rowNum,
        field: 'DNI Encargado',
        value: rawEncargadoDni,
        error: 'El trabajador titular y el encargado no pueden ser la misma persona.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Unidad Encargada
    const dir = existingDirs.find((d) => d.code.toUpperCase() === rawDirCode.toUpperCase());
    if (!rawDirCode) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Dirección/Órgano Encargada',
        value: '',
        error: 'El código de la Dirección u Órgano encargada es obligatorio.',
        severity: 'ERROR',
      });
      rowHasError = true;
    } else if (!dir) {
      errors.push({
        rowNumber: rowNum,
        field: 'Código Dirección/Órgano Encargada',
        value: rawDirCode,
        error: `La Dirección u Órgano con código "${rawDirCode}" no existe en el sistema.`,
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    // Fechas
    if (!rawStartDate) {
      errors.push({
        rowNumber: rowNum,
        field: 'Fecha Inicio',
        value: '',
        error: 'La fecha de inicio de la encargatura es obligatoria.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (!rawEndDate) {
      errors.push({
        rowNumber: rowNum,
        field: 'Fecha Término',
        value: '',
        error: 'La fecha de término de la encargatura es obligatoria.',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (rawStartDate && rawEndDate && rawEndDate < rawStartDate) {
      errors.push({
        rowNumber: rowNum,
        field: 'Fecha Término',
        value: rawEndDate,
        error: `La fecha de término (${rawEndDate}) no puede ser anterior a la fecha de inicio (${rawStartDate}).`,
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (!rawDocNumber) {
      errors.push({
        rowNumber: rowNum,
        field: 'Número Documento',
        value: '',
        error: 'El número de documento de sustento es obligatorio (Ej: Memorando N.° 045-2026-DRAC).',
        severity: 'ERROR',
      });
      rowHasError = true;
    }

    if (rowHasError) return;

    // Resuelve motivo y doc type
    let mappedMotivo: EncargaturaMotivo = 'VACACIONES';
    const normMot = normalizeStr(rawMotivo);
    if (normMot.includes('LICENCIA')) mappedMotivo = 'LICENCIA';
    else if (normMot.includes('COMISION')) mappedMotivo = 'COMISION_SERVICIOS';
    else if (normMot.includes('PERMISO')) mappedMotivo = 'PERMISO';
    else if (normMot.includes('FUERA')) mappedMotivo = 'TRABAJO_FUERA_SEDE';

    let mappedDocType: EncargaturaDocumentType = 'MEMORANDO';
    const normDoc = normalizeStr(rawDocType);
    if (normDoc.includes('RESOLUCION')) mappedDocType = 'RESOLUCION_DIRECTORAL';
    else if (normDoc.includes('OFICIO')) mappedDocType = 'OFICIO';
    else if (normDoc.includes('DECRETO')) mappedDocType = 'DECRETO';

    const area = existingAreas.find((a) => a.code.toUpperCase() === rawAreaCode.toUpperCase());
    const cargoEncargadoText = `${dir?.name || 'Jefatura'} (e)`;

    const dep = existingDeps.find((d) => d.id === dir?.dependencia_id) || existingDeps[0] || {
      id: 'dep-sede-central',
      code: 'SEDE-01',
      name: 'Sede Central DRAC',
      type: 'SEDE_CENTRAL',
      active: true,
      created_at: new Date().toISOString(),
    };

    newCount++;
    validRecords.push({
      id: `enc-${Date.now()}-${index}`,
      titular_employee_id: titular!.id,
      titular_dni: titular!.dni,
      titular_name: `${titular!.first_name} ${titular!.last_name}`,
      titular_cargo: titular!.position,
      titular_area_name: titular!.area_name,
      titular_direccion_organo_name: titular!.direccion_organo_name,
      encargado_employee_id: encargado!.id,
      encargado_dni: encargado!.dni,
      encargado_name: `${encargado!.first_name} ${encargado!.last_name}`,
      encargado_cargo: encargado!.position,
      encargado_area_procedencia_id: encargado!.area_id,
      encargado_area_procedencia_name: encargado!.area_name,
      encargado_dependencia_procedencia_name: encargado!.dependencia_name,
      dependencia_id: dep.id,
      dependencia_name: dep.name,
      direccion_organo_id: dir?.id,
      direccion_organo_name: dir?.name,
      direccion_organo_type: dir?.type,
      area_id: area?.id,
      area_name: area?.name,
      cargo_encargado: cargoEncargadoText,
      motivo: mappedMotivo,
      start_date: rawStartDate,
      end_date: rawEndDate,
      document_type: mappedDocType,
      document_number: rawDocNumber,
      document_date: rawDocDate,
      status: 'VIGENTE',
      observaciones: rawObs,
      created_at: new Date().toISOString(),
      created_by: 'Carga Masiva Excel DRAC',
    });
  });

  return {
    entityType: 'ENCARGATURAS',
    fileName,
    totalFound: rows.length,
    validCount: validRecords.length,
    newCount,
    updateCount: 0,
    duplicateCount: 0,
    errorCount: errors.filter((e) => e.severity === 'ERROR').length,
    warningCount: errors.filter((e) => e.severity === 'WARNING').length,
    errors,
    parsedValidRecords: validRecords,
    parsedUpdateRecords: [],
    rawRows: rows,
  };
}

// ==========================================
// 7. HELPER UNIVERSAL PARA LEER ARCHIVOS EXCEL / CSV
// ==========================================

export async function readExcelFileRows(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Prefer first sheet with data
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          resolve([]);
          return;
        }

        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: '',
          raw: false,
        });

        resolve(json);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
