/**
 * Payroll Audit — Writes immutable audit trail entries.
 * Every payroll action (generate, recalculate, finalize, lock, edit) is logged.
 */
import {
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { isConfigured } from '@/services/firebase';
import { payrollAuditLogsRef } from './collections';
import type {
  FirestorePayrollAuditLog,
  PayrollAuditAction,
} from './types';

export const payrollAuditService = {
  async log(
    payrollMonthId: string,
    action: PayrollAuditAction,
    performedBy: string,
    details: string,
  ): Promise<string> {
    if (!isConfigured) return '';
    const docRef = await addDoc(payrollAuditLogsRef(), {
      payrollMonthId,
      action,
      performedBy,
      timestamp: serverTimestamp(),
      details,
    } satisfies Omit<FirestorePayrollAuditLog, 'id'>);
    return docRef.id;
  },

  async getByMonth(payrollMonthId: string): Promise<FirestorePayrollAuditLog[]> {
    if (!isConfigured) return [];
    const q = query(
      payrollAuditLogsRef(),
      where('payrollMonthId', '==', payrollMonthId),
      orderBy('timestamp', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestorePayrollAuditLog));
  },
};
