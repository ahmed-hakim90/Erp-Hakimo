/**
 * HR Engine — Pure computation functions
 *
 * Zero side-effects, zero Firestore calls.
 * Every function takes data in, returns a result.
 * Designed to be plugged into Attendance, Payroll, and Penalty engines.
 */
import type {
  FirestoreShift,
  FirestoreLateRule,
  FirestorePenaltyRule,
  FirestoreAllowanceType,
  WorkingMinutesResult,
  LateDetectionResult,
  EarlyLeaveResult,
  AbsenceResult,
  PenaltyResult,
  AllowanceSummary,
  NetSalaryResult,
} from './types';

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Parse "HH:mm" string to total minutes since midnight. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculate gross, break, and net working minutes for a shift.
 * Handles cross-midnight shifts (e.g. 22:00 → 06:00).
 */
export function calculateWorkingMinutes(shift: FirestoreShift): WorkingMinutesResult {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);

  const grossMinutes = shift.crossesMidnight
    ? (1440 - start) + end   // minutes until midnight + minutes after midnight
    : end - start;

  const netMinutes = Math.max(0, grossMinutes - shift.breakMinutes);

  return {
    grossMinutes,
    breakMinutes: shift.breakMinutes,
    netMinutes,
  };
}

/**
 * Detect whether an employee checked in late.
 *
 * @param checkInTime  "HH:mm" when the employee actually checked in
 * @param shift        The assigned shift
 * @param lateRules    Sorted ascending by minutesFrom
 * @returns            Late detection result with matched rule (if any)
 */
export function detectLate(
  checkInTime: string,
  shift: FirestoreShift,
  lateRules: FirestoreLateRule[],
): LateDetectionResult {
  const shiftStart = timeToMinutes(shift.startTime);
  const checkIn = timeToMinutes(checkInTime);

  let lateMinutes: number;

  if (shift.crossesMidnight) {
    // If check-in is before midnight and shift starts before midnight,
    // or check-in is after midnight and shift started before midnight
    if (checkIn >= shiftStart) {
      lateMinutes = checkIn - shiftStart;
    } else {
      // check-in is after midnight — shift started yesterday
      lateMinutes = (1440 - shiftStart) + checkIn;
    }
  } else {
    lateMinutes = Math.max(0, checkIn - shiftStart);
  }

  if (lateMinutes <= 0) {
    return { isLate: false, lateMinutes: 0, withinGrace: false, matchedRule: null };
  }

  const withinGrace = lateMinutes <= shift.lateGraceMinutes;

  const matchedRule = lateRules.find(
    (r) => lateMinutes >= r.minutesFrom && lateMinutes <= r.minutesTo,
  ) ?? null;

  return {
    isLate: !withinGrace,
    lateMinutes,
    withinGrace,
    matchedRule,
  };
}

/**
 * Detect whether an employee left before the shift ended.
 *
 * @param checkOutTime "HH:mm" when the employee checked out
 * @param shift        The assigned shift
 */
export function calculateEarlyLeave(
  checkOutTime: string,
  shift: FirestoreShift,
): EarlyLeaveResult {
  const shiftEnd = timeToMinutes(shift.endTime);
  const checkOut = timeToMinutes(checkOutTime);

  let earlyMinutes: number;

  if (shift.crossesMidnight) {
    // Shift ends after midnight — checkOut should be compared after midnight
    if (checkOut <= shiftEnd) {
      earlyMinutes = shiftEnd - checkOut;
    } else {
      // Checked out before midnight while shift goes past midnight
      earlyMinutes = (1440 - checkOut) + shiftEnd;
    }
  } else {
    earlyMinutes = Math.max(0, shiftEnd - checkOut);
  }

  return {
    isEarly: earlyMinutes > 0,
    earlyMinutes: Math.max(0, earlyMinutes),
  };
}

/**
 * Determine absence and the deduction in minutes.
 *
 * @param attended         Whether the employee showed up at all
 * @param shiftNetMinutes  Net working minutes for the assigned shift
 */
export function calculateAbsence(
  attended: boolean,
  shiftNetMinutes: number,
): AbsenceResult {
  if (attended) {
    return { isAbsent: false, deductionMinutes: 0 };
  }
  return { isAbsent: true, deductionMinutes: shiftNetMinutes };
}

/**
 * Calculate a monetary penalty from a penalty rule.
 *
 * @param rule       The penalty rule to apply
 * @param baseSalary Employee's base salary (used when valueType is 'percentage')
 */
export function calculatePenalty(
  rule: FirestorePenaltyRule,
  baseSalary: number,
): PenaltyResult {
  const amount = rule.valueType === 'fixed'
    ? rule.value
    : (baseSalary * rule.value) / 100;

  return {
    amount: Math.round(amount * 100) / 100,
    appliedRule: rule.name,
    type: rule.type,
  };
}

/**
 * Calculate all allowances for an employee.
 *
 * @param baseSalary      Employee's base salary
 * @param allowanceTypes  Active allowance type definitions
 */
export function applyAllowances(
  baseSalary: number,
  allowanceTypes: FirestoreAllowanceType[],
): AllowanceSummary {
  const items = allowanceTypes
    .filter((a) => a.isActive)
    .map((a) => {
      const amount = a.calculationType === 'fixed'
        ? a.value
        : (baseSalary * a.value) / 100;

      return {
        name: a.name,
        amount: Math.round(amount * 100) / 100,
      };
    });

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return { items, total: Math.round(total * 100) / 100 };
}

/**
 * Calculate the net salary after allowances, deductions, and penalties.
 *
 * @param baseSalary       Employee's base (gross) salary
 * @param totalAllowances  Sum of all allowances
 * @param totalDeductions  Sum of all deductions (absence, early leave, etc.)
 * @param totalPenalties   Sum of all penalties
 * @param allowNegative    Whether net salary can go below zero
 */
export function calculateNetSalary(
  baseSalary: number,
  totalAllowances: number,
  totalDeductions: number,
  totalPenalties: number,
  allowNegative: boolean = false,
): NetSalaryResult {
  const raw = baseSalary + totalAllowances - totalDeductions - totalPenalties;
  const netSalary = allowNegative ? raw : Math.max(0, raw);

  return {
    baseSalary,
    totalAllowances,
    totalDeductions,
    totalPenalties,
    netSalary: Math.round(netSalary * 100) / 100,
  };
}
