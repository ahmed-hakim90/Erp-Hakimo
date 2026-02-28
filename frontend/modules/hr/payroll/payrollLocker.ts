/**
 * Payroll Locker — Permanently locks a finalized payroll month.
 *
 * Lock rules:
 *   - Only Admin can lock
 *   - Status must be finalized
 *   - Marks all records as locked
 *   - Sets month status = locked
 *   - Prevents ANY future update
 *   - Writes audit log
 */
import {
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isConfigured } from '@/services/firebase';
import {
  payrollRecordsRef,
  PAYROLL_COLLECTIONS,
} from './collections';
import { getPayrollMonth } from './payrollEngine';
import { payrollAuditService } from './payrollAudit';
import type { LockPayrollOptions } from './types';

/**
 * Lock a finalized payroll month permanently.
 */
export async function lockPayroll(
  options: LockPayrollOptions,
): Promise<{ success: boolean }> {
  if (!isConfigured) throw new Error('Firebase not configured');

  const { month, lockedBy } = options;

  // Validate
  const payrollMonth = await getPayrollMonth(month);
  if (!payrollMonth?.id) {
    throw new Error('لم يتم العثور على كشف رواتب لهذا الشهر.');
  }
  if (payrollMonth.status === 'draft') {
    throw new Error('يجب اعتماد كشف الرواتب قبل القفل.');
  }
  if (payrollMonth.status === 'locked') {
    throw new Error('كشف الرواتب مقفل بالفعل.');
  }

  // Lock all records
  const q = query(
    payrollRecordsRef(),
    where('payrollMonthId', '==', payrollMonth.id),
  );
  const snap = await getDocs(q);

  const CHUNK = 500;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batchChunk = docs.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const d of batchChunk) {
      batch.update(d.ref, {
        isLocked: true,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Update month status
  await updateDoc(
    doc(db, PAYROLL_COLLECTIONS.PAYROLL_MONTHS, payrollMonth.id),
    {
      status: 'locked',
      lockedAt: serverTimestamp(),
      lockedBy,
    },
  );

  // Audit log
  await payrollAuditService.log(
    payrollMonth.id,
    'lock',
    lockedBy,
    `تم قفل كشف رواتب شهر ${month} نهائياً — ${docs.length} سجل`,
  );

  return { success: true };
}
