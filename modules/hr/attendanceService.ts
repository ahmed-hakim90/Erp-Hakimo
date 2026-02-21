/**
 * Attendance Service — Firestore CRUD for raw logs and processed attendance.
 * Follows the existing service pattern (see services/productService.ts).
 */
import {
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isConfigured } from '@/services/firebase';
import {
  attendanceRawLogsRef,
  attendanceLogsRef,
  HR_COLLECTIONS,
} from './collections';
import type {
  FirestoreAttendanceRawLog,
  FirestoreAttendanceLog,
  ZKRawPunch,
  ProcessedAttendanceRecord,
  AttendanceSource,
} from './types';

// ─── Raw Logs ───────────────────────────────────────────────────────────────

export const attendanceRawLogService = {
  /**
   * Persist raw ZK punches in batches of 500 (Firestore limit).
   * Returns the number of documents written.
   */
  async saveBatch(
    punches: ZKRawPunch[],
    batchId: string,
  ): Promise<number> {
    if (!isConfigured || punches.length === 0) return 0;

    const CHUNK = 500;
    let written = 0;

    for (let i = 0; i < punches.length; i += CHUNK) {
      const chunk = punches.slice(i, i + CHUNK);
      const batch = writeBatch(db);

      for (const punch of chunk) {
        const ref = doc(attendanceRawLogsRef());
        batch.set(ref, {
          employeeCode: punch.employeeCode,
          timestamp: Timestamp.fromDate(punch.timestamp),
          deviceId: punch.deviceId,
          importedBatchId: batchId,
          createdAt: serverTimestamp(),
        } satisfies Omit<FirestoreAttendanceRawLog, 'id'>);
      }

      await batch.commit();
      written += chunk.length;
    }

    return written;
  },

  async getByBatchId(batchId: string): Promise<FirestoreAttendanceRawLog[]> {
    if (!isConfigured) return [];
    const q = query(
      attendanceRawLogsRef(),
      where('importedBatchId', '==', batchId),
      orderBy('timestamp', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAttendanceRawLog));
  },
};

// ─── Processed Attendance Logs ──────────────────────────────────────────────

export const attendanceLogService = {
  /**
   * Persist processed attendance records in batches.
   */
  async saveBatch(
    records: ProcessedAttendanceRecord[],
    batchId: string,
    source: AttendanceSource = 'zk_csv',
  ): Promise<number> {
    if (!isConfigured || records.length === 0) return 0;

    const CHUNK = 500;
    let written = 0;

    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const batch = writeBatch(db);

      for (const rec of chunk) {
        const ref = doc(attendanceLogsRef());
        batch.set(ref, {
          employeeId: rec.employeeId,
          date: rec.date,
          shiftId: rec.shiftId,
          checkIn: Timestamp.fromDate(rec.checkIn),
          checkOut: rec.checkOut ? Timestamp.fromDate(rec.checkOut) : null,
          totalMinutes: rec.totalMinutes,
          totalHours: rec.totalHours,
          lateMinutes: rec.lateMinutes,
          earlyLeaveMinutes: rec.earlyLeaveMinutes,
          isAbsent: rec.isAbsent,
          isIncomplete: rec.isIncomplete,
          isWeeklyOff: rec.isWeeklyOff,
          createdFrom: source,
          processedBatchId: batchId,
          createdAt: serverTimestamp(),
        } satisfies Omit<FirestoreAttendanceLog, 'id'>);
      }

      await batch.commit();
      written += chunk.length;
    }

    return written;
  },

  async getByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<FirestoreAttendanceLog[]> {
    if (!isConfigured) return [];
    const q = query(
      attendanceLogsRef(),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAttendanceLog));
  },

  async getByEmployee(employeeId: string): Promise<FirestoreAttendanceLog[]> {
    if (!isConfigured) return [];
    const q = query(
      attendanceLogsRef(),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAttendanceLog));
  },

  async getAll(): Promise<FirestoreAttendanceLog[]> {
    if (!isConfigured) return [];
    const q = query(attendanceLogsRef(), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAttendanceLog));
  },

  async update(id: string, data: Partial<FirestoreAttendanceLog>): Promise<void> {
    if (!isConfigured) return;
    await updateDoc(doc(db, HR_COLLECTIONS.ATTENDANCE_LOGS, id), data);
  },

  async delete(id: string): Promise<void> {
    if (!isConfigured) return;
    await deleteDoc(doc(db, HR_COLLECTIONS.ATTENDANCE_LOGS, id));
  },

  /**
   * Delete all attendance logs for a given batch (reprocess support).
   */
  async deleteByBatchId(batchId: string): Promise<number> {
    if (!isConfigured) return 0;
    const q = query(
      attendanceLogsRef(),
      where('processedBatchId', '==', batchId),
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const CHUNK = 500;
    const docs = snap.docs;
    let deleted = 0;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
      deleted += chunk.length;
    }

    return deleted;
  },
};
