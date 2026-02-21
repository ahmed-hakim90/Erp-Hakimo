/**
 * Attendance Processor — ZKTeco CSV → Structured Attendance Records
 *
 * Pure processing pipeline:
 *   1. parseCSV        → ZKRawPunch[]
 *   2. groupByDay      → EmployeeDayGroup[]
 *   3. processDay      → ProcessedAttendanceRecord
 *   4. processBatch    → AttendanceBatchResult  (orchestrator)
 *
 * No Firestore calls. No side-effects.
 * Designed for 10k+ row CSV files.
 */
import type {
  ZKRawPunch,
  CSVParseResult,
  EmployeeCodeMap,
  EmployeeDayGroup,
  ProcessedAttendanceRecord,
  AttendanceBatchResult,
  FirestoreShift,
  FirestoreLateRule,
  DayOfWeek,
} from './types';
import {
  calculateWorkingMinutes,
  detectLate,
  calculateEarlyLeave,
} from './hrEngine';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function generateBatchId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `BATCH-${ts}-${rand}`;
}

/**
 * Determine the work date for a punch, accounting for cross-midnight shifts.
 * If the shift crosses midnight and the punch falls in the early-morning hours
 * (before the shift's end time), it belongs to the previous calendar day.
 */
function resolveWorkDate(punch: Date, shift: FirestoreShift): string {
  if (!shift.crossesMidnight) return toDateString(punch);

  const [endH, endM] = shift.endTime.split(':').map(Number);
  const endMinutes = endH * 60 + endM;
  const punchMinutes = punch.getHours() * 60 + punch.getMinutes();

  if (punchMinutes <= endMinutes) {
    const prev = new Date(punch);
    prev.setDate(prev.getDate() - 1);
    return toDateString(prev);
  }
  return toDateString(punch);
}

// ─── Step 1: Parse CSV ──────────────────────────────────────────────────────

/**
 * Parse a ZKTeco CSV string into structured punch records.
 *
 * Expected format per line:  UserID, DateTime, DeviceID
 * DateTime formats supported:
 *   - "YYYY-MM-DD HH:mm:ss"
 *   - "YYYY/MM/DD HH:mm:ss"
 *   - "MM/DD/YYYY HH:mm:ss"
 */
export function parseCSV(csvText: string): CSVParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const punches: ZKRawPunch[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // skip header-like rows
    if (i === 0 && /user\s*id/i.test(line)) {
      skippedRows++;
      continue;
    }

    const parts = line.split(/[,\t]/).map((s) => s.trim());
    if (parts.length < 3) {
      errors.push(`Row ${i + 1}: expected 3+ columns, got ${parts.length}`);
      skippedRows++;
      continue;
    }

    const employeeCode = parts[0];
    const rawDateTime = parts[1];
    const deviceId = parts[2];

    if (!employeeCode || !rawDateTime) {
      errors.push(`Row ${i + 1}: missing employeeCode or dateTime`);
      skippedRows++;
      continue;
    }

    const timestamp = new Date(rawDateTime.replace(/\//g, '-'));
    if (isNaN(timestamp.getTime())) {
      errors.push(`Row ${i + 1}: invalid date "${rawDateTime}"`);
      skippedRows++;
      continue;
    }

    punches.push({ employeeCode, timestamp, deviceId: deviceId || '' });
  }

  return {
    punches,
    totalRows: lines.length,
    validRows: punches.length,
    skippedRows,
    errors,
  };
}

// ─── Step 2 & 3: Group by employee + work date ─────────────────────────────

/**
 * Group raw punches into per-employee per-work-date buckets.
 * Unmapped employee codes are collected separately.
 */
export function groupPunchesByDay(
  punches: ZKRawPunch[],
  codeMap: EmployeeCodeMap,
  shift: FirestoreShift,
): { groups: EmployeeDayGroup[]; unmatchedCodes: string[] } {
  const unmatchedSet = new Set<string>();
  const map = new Map<string, EmployeeDayGroup>();

  for (const punch of punches) {
    const employeeId = codeMap[punch.employeeCode];
    if (!employeeId) {
      unmatchedSet.add(punch.employeeCode);
      continue;
    }

    const workDate = resolveWorkDate(punch.timestamp, shift);
    const key = `${employeeId}|${workDate}`;

    let group = map.get(key);
    if (!group) {
      group = {
        employeeId,
        employeeCode: punch.employeeCode,
        workDate,
        punches: [],
      };
      map.set(key, group);
    }
    group.punches.push(punch.timestamp);
  }

  // sort punches within each group chronologically
  for (const group of map.values()) {
    group.punches.sort((a, b) => a.getTime() - b.getTime());
  }

  return {
    groups: Array.from(map.values()),
    unmatchedCodes: Array.from(unmatchedSet),
  };
}

// ─── Step 4: Process a single day ───────────────────────────────────────────

export function processDay(
  group: EmployeeDayGroup,
  shift: FirestoreShift,
  lateRules: FirestoreLateRule[],
  weeklyOffDays: DayOfWeek[],
): ProcessedAttendanceRecord {
  const date = new Date(group.workDate + 'T00:00:00');
  const dayOfWeek = DAY_NAMES[date.getDay()];
  const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);

  if (group.punches.length === 0) {
    return {
      employeeId: group.employeeId,
      employeeCode: group.employeeCode,
      date: group.workDate,
      shiftId: shift.id ?? '',
      checkIn: new Date(group.workDate + 'T00:00:00'),
      checkOut: null,
      totalMinutes: 0,
      totalHours: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      isAbsent: !isWeeklyOff,
      isIncomplete: false,
      isWeeklyOff,
    };
  }

  const checkIn = group.punches[0];
  const checkOut = group.punches.length > 1
    ? group.punches[group.punches.length - 1]
    : null;
  const isIncomplete = checkOut === null;

  const shiftResult = calculateWorkingMinutes(shift);

  // late detection
  const checkInTime = toTimeString(checkIn);
  const lateResult = detectLate(checkInTime, shift, lateRules);

  // early leave detection
  let earlyLeaveMinutes = 0;
  if (checkOut) {
    const checkOutTime = toTimeString(checkOut);
    const earlyResult = calculateEarlyLeave(checkOutTime, shift);
    earlyLeaveMinutes = earlyResult.earlyMinutes;
  }

  // actual working minutes
  let totalMinutes = 0;
  if (checkOut) {
    totalMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
    totalMinutes = Math.max(0, totalMinutes);
    // cap at the shift's net duration (no auto-overtime)
    totalMinutes = Math.min(totalMinutes, shiftResult.netMinutes);
  }

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  return {
    employeeId: group.employeeId,
    employeeCode: group.employeeCode,
    date: group.workDate,
    shiftId: shift.id ?? '',
    checkIn,
    checkOut,
    totalMinutes,
    totalHours,
    lateMinutes: lateResult.isLate ? lateResult.lateMinutes : 0,
    earlyLeaveMinutes,
    isAbsent: false,
    isIncomplete,
    isWeeklyOff,
  };
}

// ─── Step 5: Full batch processor ───────────────────────────────────────────

export interface ProcessBatchOptions {
  csvText: string;
  codeMap: EmployeeCodeMap;
  shift: FirestoreShift;
  lateRules: FirestoreLateRule[];
  weeklyOffDays: DayOfWeek[];
}

/**
 * End-to-end batch processor: CSV text → structured attendance records.
 * Pure function — caller is responsible for persisting results.
 */
export function processBatch(options: ProcessBatchOptions): AttendanceBatchResult {
  const { csvText, codeMap, shift, lateRules, weeklyOffDays } = options;

  const parseResult = parseCSV(csvText);
  const { groups, unmatchedCodes } = groupPunchesByDay(
    parseResult.punches,
    codeMap,
    shift,
  );

  const records: ProcessedAttendanceRecord[] = [];
  const errors = [...parseResult.errors];

  for (const group of groups) {
    try {
      const record = processDay(group, shift, lateRules, weeklyOffDays);
      records.push(record);
    } catch (err) {
      errors.push(
        `Failed to process ${group.employeeCode} on ${group.workDate}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    batchId: generateBatchId(),
    processedDate: new Date(),
    records,
    totalProcessed: records.length,
    unmatchedCodes,
    errors,
  };
}
