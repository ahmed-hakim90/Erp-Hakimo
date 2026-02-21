/**
 * Payroll Firestore Collection References
 *
 * Follows the same pattern as modules/hr/collections.ts.
 */
import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export const PAYROLL_COLLECTIONS = {
  PAYROLL_MONTHS: 'payroll_months',
  PAYROLL_RECORDS: 'payroll_records',
  PAYROLL_AUDIT_LOGS: 'payroll_audit_logs',
  PAYROLL_COST_SUMMARY: 'payroll_cost_summary',
} as const;

export function payrollMonthsRef(): CollectionReference {
  return collection(db, PAYROLL_COLLECTIONS.PAYROLL_MONTHS);
}

export function payrollMonthDocRef(id: string): DocumentReference {
  return doc(db, PAYROLL_COLLECTIONS.PAYROLL_MONTHS, id);
}

export function payrollRecordsRef(): CollectionReference {
  return collection(db, PAYROLL_COLLECTIONS.PAYROLL_RECORDS);
}

export function payrollAuditLogsRef(): CollectionReference {
  return collection(db, PAYROLL_COLLECTIONS.PAYROLL_AUDIT_LOGS);
}

export function payrollCostSummaryRef(): CollectionReference {
  return collection(db, PAYROLL_COLLECTIONS.PAYROLL_COST_SUMMARY);
}
