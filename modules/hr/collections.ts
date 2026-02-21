/**
 * HR Firestore Collection References
 *
 * Follows the existing service pattern:
 *   - One constant per collection name
 *   - Single-doc collections use a DOC_ID
 *   - Actual CRUD services will be added in later phases
 */
import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// ─── Collection Names ───────────────────────────────────────────────────────

export const HR_COLLECTIONS = {
  EMPLOYEES: 'employees',
  DEPARTMENTS: 'departments',
  JOB_POSITIONS: 'job_positions',
  SHIFTS: 'shifts',
  HR_SETTINGS: 'hr_settings',
  PENALTY_RULES: 'penalty_rules',
  LATE_RULES: 'late_rules',
  ALLOWANCE_TYPES: 'allowance_types',
  ATTENDANCE_RAW_LOGS: 'attendance_raw_logs',
  ATTENDANCE_LOGS: 'attendance_logs',
  LEAVE_REQUESTS: 'leave_requests',
  LEAVE_BALANCES: 'leave_balances',
  EMPLOYEE_LOANS: 'employee_loans',
  APPROVAL_REQUESTS: 'approval_requests',
  APPROVAL_SETTINGS: 'approval_settings',
  APPROVAL_DELEGATIONS: 'approval_delegations',
  APPROVAL_AUDIT_LOGS: 'approval_audit_logs',
} as const;

// ─── Single-Document Collection ─────────────────────────────────────────────

const HR_SETTINGS_DOC_ID = 'global';

// ─── Reference Helpers ──────────────────────────────────────────────────────

export function employeesRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.EMPLOYEES);
}

export function departmentsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.DEPARTMENTS);
}

export function jobPositionsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.JOB_POSITIONS);
}

export function shiftsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.SHIFTS);
}

export function hrSettingsDocRef(): DocumentReference {
  return doc(db, HR_COLLECTIONS.HR_SETTINGS, HR_SETTINGS_DOC_ID);
}

export function penaltyRulesRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.PENALTY_RULES);
}

export function lateRulesRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.LATE_RULES);
}

export function allowanceTypesRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.ALLOWANCE_TYPES);
}

export function attendanceRawLogsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.ATTENDANCE_RAW_LOGS);
}

export function attendanceLogsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.ATTENDANCE_LOGS);
}

export function leaveRequestsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.LEAVE_REQUESTS);
}

export function leaveBalancesRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.LEAVE_BALANCES);
}

export function employeeLoansRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.EMPLOYEE_LOANS);
}

export function approvalRequestsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.APPROVAL_REQUESTS);
}

export function approvalSettingsDocRef(): DocumentReference {
  return doc(db, HR_COLLECTIONS.APPROVAL_SETTINGS, 'global');
}

export function approvalDelegationsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.APPROVAL_DELEGATIONS);
}

export function approvalAuditLogsRef(): CollectionReference {
  return collection(db, HR_COLLECTIONS.APPROVAL_AUDIT_LOGS);
}
