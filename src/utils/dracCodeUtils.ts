import { Employee } from '../types';

/**
 * Generates the next available DRAC Employee Code in the format "DRAC-XXXX".
 * 
 * Rules:
 * 1. Uses a 4-digit zero-padded sequential number: DRAC-0001, DRAC-0002, ..., DRAC-9999 (or more if >9999).
 * 2. If there are gaps in the existing sequence (e.g. DRAC-0001, DRAC-0002, DRAC-0003, DRAC-0005, DRAC-0006),
 *    it reuses the first available gap (in this case DRAC-0004) before continuing with higher numbers.
 * 3. Supports atomic batch generation for bulk uploads without collisions.
 */

export function extractCodeNumber(code: string | undefined | null): number | null {
  if (!code) return null;
  const str = String(code).trim().toUpperCase();
  
  // Format: DRAC-0004 or DRAC-2026-0004 or DRAC-04
  const match = str.match(/DRAC-(?:[0-9]{4}-)?([0-9]+)$/) || str.match(/DRAC-([0-9]+)$/) || str.match(/([0-9]+)$/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return isNaN(num) || num <= 0 ? null : num;
  }
  return null;
}

export function formatDracCode(num: number): string {
  return `DRAC-${String(num).padStart(4, '0')}`;
}

export function generateNextDracCode(
  existingEmployees: Employee[] = [],
  additionalAllocatedCodes?: Set<string> | string[]
): string {
  const usedNumbers = new Set<number>();

  // Collect all currently used numbers from existing employees
  for (const emp of existingEmployees) {
    const num = extractCodeNumber(emp.codigo_trabajador);
    if (num !== null) {
      usedNumbers.add(num);
    }
  }

  // Also include any temporary allocated codes (e.g. during batch processing)
  if (additionalAllocatedCodes) {
    for (const code of additionalAllocatedCodes) {
      const num = extractCodeNumber(code);
      if (num !== null) {
        usedNumbers.add(num);
      }
    }
  }

  // Find the smallest positive integer gap starting from 1
  let nextNum = 1;
  while (usedNumbers.has(nextNum)) {
    nextNum++;
  }

  return formatDracCode(nextNum);
}

/**
 * Generates an array of sequential DRAC codes filling all available gaps for bulk processing.
 */
export function generateBatchDracCodes(
  count: number,
  existingEmployees: Employee[] = []
): string[] {
  const allocated = new Set<string>();
  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    const nextCode = generateNextDracCode(existingEmployees, allocated);
    allocated.add(nextCode);
    results.push(nextCode);
  }

  return results;
}
