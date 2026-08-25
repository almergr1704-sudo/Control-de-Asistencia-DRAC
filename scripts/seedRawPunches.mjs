import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const RAW_PUNCHES_FILE = path.join(DB_DIR, 'raw-punches.json');

// Read initialData.ts
const initialDataText = fs.readFileSync(path.join(process.cwd(), 'src/data/initialData.ts'), 'utf-8');

// Quick evaluator for initialData objects
const employeesMatch = initialDataText.match(/export const INITIAL_EMPLOYEES: Employee\[\] = (\[[\s\S]*?\n\];)/);
const attendanceMatch = initialDataText.match(/export const INITIAL_ATTENDANCE: AsistenciaProcesada\[\] = (\[[\s\S]*?\n\];)/);
const devicesMatch = initialDataText.match(/export const INITIAL_DEVICES: DispositivoZkTeco\[\] = (\[[\s\S]*?\n\];)/);

if (!employeesMatch || !attendanceMatch || !devicesMatch) {
  console.error("Could not parse initialData.ts arrays");
  process.exit(1);
}

// Clean TS type annotations to parse as JS
function cleanTs(tsCode) {
  return tsCode
    .replace(/as\s+[A-Za-z0-9_<>\[\]]+/g, '')
    .replace(/;\s*$/, '');
}

const employees = eval(cleanTs(employeesMatch[1]));
const attendance = eval(cleanTs(attendanceMatch[1]));
const devices = eval(cleanTs(devicesMatch[1]));

console.log(`Parsed ${employees.length} employees, ${attendance.length} attendance rows, ${devices.length} devices.`);

const rawPunches = [];
let punchIdCounter = 1;

// Device map
const dev1 = devices.find(d => d.id === 'dev-01') || devices[0];
const dev2 = devices.find(d => d.id === 'dev-02') || devices[1] || devices[0];
const dev3 = devices.find(d => d.id === 'dev-03') || devices[2] || devices[0];
const dev4 = devices.find(d => d.id === 'dev-04') || devices[3] || devices[0];

// Map employee to device
function getDeviceForEmployee(emp) {
  if (!emp) return dev1;
  if (emp.dependencia_id === 'dep-02') return dev2;
  if (emp.dependencia_id === 'dep-03') return dev4;
  if (emp.dependencia_id === 'dep-04') return dev3;
  return dev1;
}

// Iterate over all attendance records to generate exact matching raw punches
attendance.forEach((att) => {
  const emp = employees.find(e => e.dni === att.employee_dni || e.id === att.employee_id);
  const dev = getDeviceForEmployee(emp);

  const punchesForDay = [
    { time: att.t1_real_in, type: 'CHECK_IN', state: 0 },
    { time: att.t1_real_out, type: 'BREAK_OUT', state: 1 },
    { time: att.t2_real_in, type: 'BREAK_IN', state: 0 },
    { time: att.t2_real_out, type: 'CHECK_OUT', state: 1 },
  ].filter(p => Boolean(p.time));

  punchesForDay.forEach((p, idx) => {
    const timeFull = p.time.length === 5 ? `${p.time}:00` : p.time;
    const timestamp = `${att.fecha} ${timeFull}`;
    const pin = emp?.zkteco_pin || emp?.dni || att.employee_dni;
    const verifyMode = idx % 3 === 0 ? 'FACE' : 'FINGERPRINT';

    rawPunches.push({
      id: `raw-punch-${String(punchIdCounter++).padStart(5, '0')}`,
      device_id: dev.id,
      device_sn: dev.serial_number,
      device_name: dev.name,
      device_dependencia_tipo: dev.dependencia_tipo,
      device_dependencia_name: dev.dependencia_name,
      employee_dni: att.employee_dni,
      employee_name: att.employee_name,
      employee_dependencia_tipo: emp?.dependencia_id === 'dep-02' ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL',
      employee_dependencia_name: emp?.dependencia_name || att.dependencia_name,
      timestamp,
      punch_type: p.type,
      punch_state: p.state,
      verify_mode: verifyMode,
      processed: true,
      processed_at: `${att.fecha} 18:00:00`,
      raw_payload: `PIN=${pin}\tTIME=${timestamp}\tVERIFY=${verifyMode === 'FACE' ? '15' : '1'}\tSTATUS=${p.state}`,
      validation_status: 'VALIDA',
      rejection_reason: null,
      authorization_id: null,
    });
  });
});

// Add today (2026-08-25) morning punches from ZKTeco devices across workers
employees.slice(0, 18).forEach((emp, i) => {
  const dev = getDeviceForEmployee(emp);
  const hour = '07';
  const min = String(45 + (i % 25)).padStart(2, '0');
  const sec = String(10 + (i * 3) % 50).padStart(2, '0');
  const timestamp = `2026-08-25 ${hour}:${min}:${sec}`;
  const pin = emp.zkteco_pin || emp.dni;
  const isProcessed = i < 12;

  rawPunches.push({
    id: `raw-punch-${String(punchIdCounter++).padStart(5, '0')}`,
    device_id: dev.id,
    device_sn: dev.serial_number,
    device_name: dev.name,
    device_dependencia_tipo: dev.dependencia_tipo,
    device_dependencia_name: dev.dependencia_name,
    employee_dni: emp.dni,
    employee_name: `${emp.first_name} ${emp.last_name}`,
    employee_dependencia_tipo: emp.dependencia_id === 'dep-02' ? 'AGENCIA_AGRARIA' : 'SEDE_CENTRAL',
    employee_dependencia_name: emp.dependencia_name,
    timestamp,
    punch_type: 'CHECK_IN',
    punch_state: 0,
    verify_mode: i % 2 === 0 ? 'FINGERPRINT' : 'FACE',
    processed: isProcessed,
    processed_at: isProcessed ? `2026-08-25 ${hour}:${min}:05` : null,
    raw_payload: `PIN=${pin}\tTIME=${timestamp}\tVERIFY=${i % 2 === 0 ? '1' : '15'}\tSTATUS=0`,
    validation_status: 'VALIDA',
    rejection_reason: null,
    authorization_id: null,
  });
});

// Add authentic UNIDENTIFIED punches (PENDIENTE_IDENTIFICACION) from terminal to test edge cases
const unidentifiedPunches = [
  { pin: '9991', time: '2026-08-25 08:12:35', dev: dev1 },
  { pin: '9992', time: '2026-08-25 08:14:10', dev: dev2 },
  { pin: '1099', time: '2026-08-25 08:22:04', dev: dev1 },
];

unidentifiedPunches.forEach((u) => {
  rawPunches.push({
    id: `raw-punch-${String(punchIdCounter++).padStart(5, '0')}`,
    device_id: u.dev.id,
    device_sn: u.dev.serial_number,
    device_name: u.dev.name,
    device_dependencia_tipo: u.dev.dependencia_tipo,
    device_dependencia_name: u.dev.dependencia_name,
    employee_dni: u.pin,
    employee_name: 'Trabajador no identificado',
    employee_dependencia_tipo: u.dev.dependencia_tipo,
    employee_dependencia_name: u.dev.dependencia_name,
    timestamp: u.time,
    punch_type: 'AUTO',
    punch_state: 0,
    verify_mode: 'FINGERPRINT',
    processed: false,
    processed_at: null,
    raw_payload: `PIN=${u.pin}\tTIME=${u.time}\tVERIFY=1\tSTATUS=0`,
    validation_status: 'PENDIENTE_IDENTIFICACION',
    rejection_reason: `Código PIN ${u.pin} no asociado a ningún trabajador activo.`,
    authorization_id: null,
  });
});

// Sort descending by timestamp
rawPunches.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

console.log(`Generated total of ${rawPunches.length} raw biometric punches.`);

// Write to data/raw-punches.json
fs.mkdirSync(DB_DIR, { recursive: true });
fs.writeFileSync(RAW_PUNCHES_FILE, JSON.stringify(rawPunches, null, 2), 'utf-8');
console.log(`Wrote ${RAW_PUNCHES_FILE} successfully.`);
