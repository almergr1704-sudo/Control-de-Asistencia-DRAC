import fs from 'fs';
import path from 'path';

function normalizePersonName(name) {
  if (!name || typeof name !== 'string') return '';
  const cleaned = name.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  return words
    .map((word) => {
      if (!word) return '';
      if (word.includes('-')) {
        return word.split('-').map(capitalizeWord).join('-');
      }
      if (word.includes("'")) {
        return word.split("'").map(capitalizeWord).join("'");
      }
      return capitalizeWord(word);
    })
    .join(' ');
}

function capitalizeWord(word) {
  if (!word) return '';
  const lower = word.toLocaleLowerCase('es-PE');
  const firstChar = lower.charAt(0).toLocaleUpperCase('es-PE');
  const rest = lower.slice(1);
  return firstChar + rest;
}

// 1. Process data/*.json
const DB_DIR = path.join(process.cwd(), 'data');

if (fs.existsSync(path.join(DB_DIR, 'raw-punches.json'))) {
  const punches = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'raw-punches.json'), 'utf-8'));
  let modified = 0;
  punches.forEach((p) => {
    if (p.employee_name && p.employee_name !== 'Trabajador no identificado') {
      const norm = normalizePersonName(p.employee_name);
      if (norm !== p.employee_name) {
        p.employee_name = norm;
        modified++;
      }
    }
  });
  fs.writeFileSync(path.join(DB_DIR, 'raw-punches.json'), JSON.stringify(punches, null, 2), 'utf-8');
  console.log(`Normalized ${modified} raw punches in data/raw-punches.json`);

  // Also update src/data/initialRawPunches.ts
  const tsContent = `import { MarcacionRaw } from "../types";\n\nexport const INITIAL_RAW_PUNCHES: MarcacionRaw[] = ${JSON.stringify(punches, null, 2)};\n`;
  fs.writeFileSync(path.join(process.cwd(), 'src/data/initialRawPunches.ts'), tsContent, 'utf-8');
  console.log(`Updated src/data/initialRawPunches.ts`);
}

if (fs.existsSync(path.join(DB_DIR, 'papeletas.json'))) {
  const paps = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'papeletas.json'), 'utf-8'));
  paps.forEach((p) => {
    if (p.employee_name) p.employee_name = normalizePersonName(p.employee_name);
    if (p.boss_name) p.boss_name = normalizePersonName(p.boss_name);
    if (p.director_name && !p.director_name.includes('Dirección')) p.director_name = normalizePersonName(p.director_name);
    if (p.rrhh_name) p.rrhh_name = normalizePersonName(p.rrhh_name);
    if (p.vigilante_name) p.vigilante_name = normalizePersonName(p.vigilante_name);
  });
  fs.writeFileSync(path.join(DB_DIR, 'papeletas.json'), JSON.stringify(paps, null, 2), 'utf-8');
  console.log(`Normalized data/papeletas.json`);
}

if (fs.existsSync(path.join(DB_DIR, 'vacaciones.json'))) {
  const vacs = JSON.parse(fs.readFileSync(path.join(DB_DIR, 'vacaciones.json'), 'utf-8'));
  vacs.forEach((v) => {
    if (v.employee_name) v.employee_name = normalizePersonName(v.employee_name);
    if (v.boss_name) v.boss_name = normalizePersonName(v.boss_name);
  });
  fs.writeFileSync(path.join(DB_DIR, 'vacaciones.json'), JSON.stringify(vacs, null, 2), 'utf-8');
  console.log(`Normalized data/vacaciones.json`);
}

// 2. Process src/data/initialData.ts
const initialDataPath = path.join(process.cwd(), 'src/data/initialData.ts');
let initialDataText = fs.readFileSync(initialDataPath, 'utf-8');

// Replace uppercase names in employees, attendance, papeletas, vacaciones, encargaturas, etc.
// We can use regex to replace specific name values cleanly
initialDataText = initialDataText.replace(/(first_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(last_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(apellido_paterno:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(apellido_materno:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(employee_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(titular_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(encargado_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(boss_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});
initialDataText = initialDataText.replace(/(jefe_name:\s*['"])([^'"]+)(['"])/g, (match, p1, p2, p3) => {
  return `${p1}${normalizePersonName(p2)}${p3}`;
});

fs.writeFileSync(initialDataPath, initialDataText, 'utf-8');
console.log(`Normalized src/data/initialData.ts successfully.`);
