/**
 * DRAC Institutional Person Name Normalization Utility
 * 
 * Standard format:
 * - First letter of each word in UPPERCASE (Title Case).
 * - Remaining letters in lowercase.
 * - Trims leading/trailing spaces and collapses consecutive whitespace.
 * - Preserves Spanish accents (Á, É, Í, Ó, Ú, Ü, Ñ) and hyphenated names (e.g. María-José).
 * - Preserves compound names and surnames (e.g. De La Cruz, Del Carmen, De Los Santos).
 * - Applied strictly to person names (never to IDs, DNIs, codes, or institutional names like DRAC).
 */

/**
 * Normalizes a single person name, surname, or full name string.
 * Examples:
 *  "JUAN CARLOS PÉREZ GARCÍA" -> "Juan Carlos Pérez García"
 *  "  mARIA   eLENA  " -> "Maria Elena"
 *  "RODRÍGUEZ" -> "Rodríguez"
 *  "MARÍA-JOSÉ" -> "María-José"
 *  "DE LA CRUZ" -> "De La Cruz"
 */
export function normalizePersonName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // 1. Trim and collapse multiple consecutive whitespace characters
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // 2. Process words separated by spaces
  const words = cleaned.split(' ');

  const normalizedWords = words.map((word) => {
    if (!word) return '';

    // Handle hyphenated words (e.g., "MARÍA-JOSÉ" -> "María-José")
    if (word.includes('-')) {
      return word
        .split('-')
        .map((subWord) => capitalizeWord(subWord))
        .join('-');
    }

    // Handle apostrophes or quotes if any (e.g., "O'DONNELL" -> "O'Donnell")
    if (word.includes("'")) {
      return word
        .split("'")
        .map((subWord) => capitalizeWord(subWord))
        .join("'");
    }

    return capitalizeWord(word);
  });

  return normalizedWords.join(' ');
}

/**
 * Capitalizes the first character and lowercases the rest of a single word,
 * preserving locale-aware characters like Á, É, Í, Ó, Ú, Ü, Ñ.
 */
function capitalizeWord(word: string): string {
  if (!word) return '';
  const lower = word.toLocaleLowerCase('es-PE');
  const firstChar = lower.charAt(0).toLocaleUpperCase('es-PE');
  const rest = lower.slice(1);
  return firstChar + rest;
}

/**
 * Normalizes and combines person full name from components
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
 * Normalizes all name fields in an employee or person object
 */
export function normalizePersonFields<T extends Record<string, any>>(record: T): T {
  if (!record || typeof record !== 'object') return record;

  const copy: any = { ...record };

  if (typeof copy.first_name === 'string') {
    copy.first_name = normalizePersonName(copy.first_name);
  }
  if (typeof copy.last_name === 'string') {
    copy.last_name = normalizePersonName(copy.last_name);
  }
  if (typeof copy.apellido_paterno === 'string') {
    copy.apellido_paterno = normalizePersonName(copy.apellido_paterno);
  }
  if (typeof copy.apellido_materno === 'string') {
    copy.apellido_materno = normalizePersonName(copy.apellido_materno);
  }
  if (typeof copy.employee_name === 'string') {
    copy.employee_name = normalizePersonName(copy.employee_name);
  }
  if (typeof copy.titular_name === 'string') {
    copy.titular_name = normalizePersonName(copy.titular_name);
  }
  if (typeof copy.encargado_name === 'string') {
    copy.encargado_name = normalizePersonName(copy.encargado_name);
  }
  if (typeof copy.jefe_name === 'string') {
    copy.jefe_name = normalizePersonName(copy.jefe_name);
  }
  if (typeof copy.director_name === 'string') {
    // Only normalize if it's an actual person name, not a role title like "Dirección Regional DRAC"
    if (!copy.director_name.includes('Dirección') && !copy.director_name.includes('Jefatura') && !copy.director_name.includes('Oficina')) {
      copy.director_name = normalizePersonName(copy.director_name);
    }
  }
  if (typeof copy.solicitante_name === 'string') {
    copy.solicitante_name = normalizePersonName(copy.solicitante_name);
  }
  if (typeof copy.aprobador_name === 'string') {
    copy.aprobador_name = normalizePersonName(copy.aprobador_name);
  }

  return copy;
}
