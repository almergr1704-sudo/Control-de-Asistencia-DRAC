/**
 * DRAC Institutional Normalization Utility (Global Name & Denomination Normalizer)
 * Dirección Regional de Agricultura Cajamarca (DRAC)
 * 
 * Regla General:
 * - Primera letra de cada palabra en MAYÚSCULA y el resto en minúscula (Title Case).
 * - Elimina espacios innecesarios al inicio y final.
 * - Reduce múltiples espacios consecutivos a uno solo.
 * - Mantiene correctamente los caracteres especiales del español (Á, É, Í, Ó, Ú, Ü, Ñ, á, é, í, ó, ú, ü, ñ).
 * - Respeta siglas y acrónimos oficiales (DRAC, DNI, ZKTeco, RUC, TCP/IP, ADMS, CAS, CAP, PAP, TUPA, ROF, MOF, RRHH, PDF, API, UUID, IP, etc.).
 * - NO modifica códigos de trabajadores (DRAC-0001), DNIs, UUIDs ni identificadores técnicos.
 * - Búsqueda insensible a mayúsculas, minúsculas y tildes.
 */

// Siglas, acrónimos y términos técnicos que deben conservarse en su formato oficial
const PRESERVED_ACRONYMS = new Map<string, string>([
  ['DRAC', 'DRAC'],
  ['DNI', 'DNI'],
  ['ZKTECO', 'ZKTeco'],
  ['ZK', 'ZK'],
  ['TCP/IP', 'TCP/IP'],
  ['ADMS', 'ADMS'],
  ['RUC', 'RUC'],
  ['CAS', 'CAS'],
  ['CAP', 'CAP'],
  ['PAP', 'PAP'],
  ['TUPA', 'TUPA'],
  ['ROF', 'ROF'],
  ['MOF', 'MOF'],
  ['RRHH', 'RRHH'],
  ['PDF', 'PDF'],
  ['API', 'API'],
  ['UUID', 'UUID'],
  ['IP', 'IP'],
  ['MAC', 'MAC'],
  ['ID', 'ID'],
  ['SN', 'SN'],
  ['USB', 'USB'],
  ['HTTP', 'HTTP'],
  ['HTTPS', 'HTTPS'],
  ['SQL', 'SQL'],
  ['REST', 'REST'],
  ['RLS', 'RLS'],
  ['SDK', 'SDK'],
  ['KM', 'KM'],
  ['KM.', 'KM.'],
  ['D.L.', 'D.L.'],
  ['D.LEG.', 'D.Leg.'],
  ['N°', 'N°'],
  ['NRO', 'Nro.'],
  ['NRO.', 'Nro.'],
  ['II', 'II'],
  ['III', 'III'],
  ['IV', 'IV'],
  ['VI', 'VI'],
  ['VII', 'VII'],
  ['VIII', 'VIII'],
  ['IX', 'IX'],
  ['X', 'X'],
]);

/**
 * Capitaliza un único token o palabra simple respetando caracteres del español
 */
function capitalizeWord(word: string): string {
  if (!word) return '';

  // Verificar si es un acrónimo preservado
  const upperKey = word.toUpperCase().replace(/[.,;:]+$/, '');
  const punctuationMatch = word.match(/[.,;:]+$/);
  const punctuation = punctuationMatch ? punctuationMatch[0] : '';

  if (PRESERVED_ACRONYMS.has(upperKey)) {
    return PRESERVED_ACRONYMS.get(upperKey) + punctuation;
  }

  // Si es un código técnico tipo DRAC-0001 o TUR-001 o similar, no modificar
  if (/^[A-Z]{2,4}-\d+$/i.test(word) || /^\d+$/.test(word)) {
    return word.toUpperCase();
  }

  const lower = word.toLocaleLowerCase('es-PE');
  const firstChar = lower.charAt(0).toLocaleUpperCase('es-PE');
  const rest = lower.slice(1);
  return firstChar + rest;
}

/**
 * Procesa un fragmento de palabra que pueda contener delimitadores (guiones, barras, paréntesis, etc.)
 */
function processWordWithSubdelimiters(word: string): string {
  if (!word) return '';

  // Preservar acrónimos directos
  const upperKey = word.toUpperCase();
  if (PRESERVED_ACRONYMS.has(upperKey)) {
    return PRESERVED_ACRONYMS.get(upperKey)!;
  }

  // Manejo de paréntesis ej: "(DRAC)" o "(RRHH)"
  if (word.startsWith('(') && word.endsWith(')')) {
    const inner = word.substring(1, word.length - 1);
    return `(${processWordWithSubdelimiters(inner)})`;
  }

  // Manejo de guiones ej: "María-José" o "Baños-Inka"
  if (word.includes('-') && !/^[A-Za-z]+-\d+$/.test(word)) {
    return word
      .split('-')
      .map((sub) => capitalizeWord(sub))
      .join('-');
  }

  // Manejo de barras ej: "TCP/IP" o "Oficina/Área"
  if (word.includes('/')) {
    if (upperKey === 'TCP/IP') return 'TCP/IP';
    return word
      .split('/')
      .map((sub) => capitalizeWord(sub))
      .join('/');
  }

  // Manejo de comillas o apóstrofes ej: "O'Donnell"
  if (word.includes("'")) {
    return word
      .split("'")
      .map((sub) => capitalizeWord(sub))
      .join("'");
  }

  return capitalizeWord(word);
}

/**
 * Normaliza cualquier texto a formato Título (Title Case)
 * Ejemplo:
 *   "   ALMER   EDUAR   GAONA   RODRIGUEZ  " -> "Almer Eduar Gaona Rodriguez"
 *   "DIRECCION REGIONAL DE AGRICULTURA" -> "Direccion Regional De Agricultura"
 *   "OFICINA DE ADMINISTRACION" -> "Oficina De Administracion"
 *   "OFICINA AGRARIA CHOTA" -> "Oficina Agraria Chota"
 *   "JOSÉ MARÍA PEÑA MUÑOZ" -> "José María Peña Muñoz"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // 1. Eliminar espacios al inicio, final y colapsar espacios consecutivos
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // 2. Procesar palabra por palabra
  const words = cleaned.split(' ');
  const normalizedWords = words.map((word) => processWordWithSubdelimiters(word));

  return normalizedWords.join(' ');
}

/**
 * Normaliza el nombre de una persona (alias principal de normalizeText)
 */
export function normalizePersonName(name: string | null | undefined): string {
  return normalizeText(name);
}

/**
 * Alias explícito para nombres
 */
export function normalizeName(name: string | null | undefined): string {
  return normalizeText(name);
}

/**
 * Normaliza una denominación institucional (Sedes, Direcciones, Órganos, Áreas, Oficinas, Cargos)
 * Ejemplo:
 *   "DIRECCION DE TIERRAS Y CATASTRO RURAL" -> "Direccion De Tierras Y Catastro Rural"
 *   "SEDE CENTRAL" -> "Sede Central"
 *   "AGENCIA AGRARIA CAJAMARCA" -> "Agencia Agraria Cajamarca"
 */
export function normalizeInstitutionalName(name: string | null | undefined): string {
  return normalizeText(name);
}

/**
 * Normaliza y construye el nombre completo de una persona a partir de sus componentes
 */
export function buildNormalizedFullName(
  firstName?: string | null,
  lastName?: string | null,
  apellidoPaterno?: string | null,
  apellidoMaterno?: string | null
): string {
  const normFirst = normalizePersonName(firstName);

  if (normFirst && lastName && !apellidoPaterno && !apellidoMaterno) {
    return `${normFirst} ${normalizePersonName(lastName)}`.trim();
  }

  const normPat = normalizePersonName(apellidoPaterno);
  const normMat = normalizePersonName(apellidoMaterno);
  const normLast = normalizePersonName(lastName);

  if (normPat || normMat) {
    return [normFirst, normPat, normMat].filter(Boolean).join(' ');
  }

  return [normFirst, normLast].filter(Boolean).join(' ');
}

/**
 * Normaliza todos los campos de nombres, apellidos y denominaciones dentro de cualquier objeto
 * SIN modificar códigos, DNIs, IDs, correos ni datos técnicos.
 */
export function normalizeAllRecordNames<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;

  const copy: any = Array.isArray(record) ? [...record] : { ...record };

  // Campos de persona
  const personFields = [
    'first_name',
    'last_name',
    'apellido_paterno',
    'apellido_materno',
    'employee_name',
    'full_name',
    'titular_name',
    'encargado_name',
    'jefe_name',
    'boss_name',
    'director_name',
    'solicitante_name',
    'aprobador_name',
    'creador_name',
    'supervisor_name',
    'vigilante_name',
    'rrhh_name',
    'firmante_name',
  ];

  for (const field of personFields) {
    if (typeof copy[field] === 'string' && copy[field].trim()) {
      copy[field] = normalizePersonName(copy[field]);
    }
  }

  // Campos de denominación institucional
  const orgFields = [
    'dependencia_name',
    'dependencia_nombre',
    'direccion_name',
    'direccion_nombre',
    'direccion_organo_name',
    'area_name',
    'area_nombre',
    'oficina_name',
    'position',
    'cargo_name',
    'cargo_nombre',
    'schedule_name',
    'horario_name',
    'location_detail',
  ];

  for (const field of orgFields) {
    if (typeof copy[field] === 'string' && copy[field].trim()) {
      copy[field] = normalizeInstitutionalName(copy[field]);
    }
  }

  // Campo 'name' genérico si aplica (dependencias, direcciones, áreas, cargos, horarios)
  if (typeof copy.name === 'string' && copy.name.trim()) {
    copy.name = normalizeInstitutionalName(copy.name);
  }
  if (typeof copy.nombre === 'string' && copy.nombre.trim()) {
    copy.nombre = normalizeInstitutionalName(copy.nombre);
  }

  // user_name solo si no es cuenta de sistema
  if (typeof copy.user_name === 'string') {
    if (!copy.user_name.startsWith('ADMIN') && !copy.user_name.startsWith('SIS_') && !copy.user_name.includes('@')) {
      copy.user_name = normalizePersonName(copy.user_name);
    }
  }

  return copy;
}

/**
 * Normaliza los campos de una persona (compatibilidad hacia atrás)
 */
export function normalizePersonFields<T extends Record<string, any>>(record: T): T {
  return normalizeAllRecordNames(record);
}

/**
 * Normaliza términos de búsqueda para comparación insensible a mayúsculas y tildes
 * Ejemplo: "Pérez" -> "perez", "DIRECCIÓN" -> "direccion"
 */
export function normalizeSearchTerm(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Comprueba si un término o texto objetivo coincide con la búsqueda
 * Insensible a mayúsculas, minúsculas y tildes.
 */
export function matchesSearch(target: string | null | undefined, query: string | null | undefined): boolean {
  if (!query) return true;
  if (!target) return false;
  const normTarget = normalizeSearchTerm(target);
  const normQuery = normalizeSearchTerm(query);
  return normTarget.includes(normQuery);
}
