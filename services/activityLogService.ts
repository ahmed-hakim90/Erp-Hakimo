/**
 * Activity Log Service — Read/Write for "activity_logs" collection
 * Tracks typed user actions (login, report CRUD, user management, etc.)
 * Supports pagination via startAfter cursor.
 */
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import type { ActivityLog, ActivityAction } from '../types';

const COLLECTION = 'activity_logs';

export interface PaginatedLogs {
  logs: ActivityLog[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export const activityLogService = {
  /**
   * Fetch activity logs with pagination support.
   * Pass `cursor` from a previous call's `lastDoc` to get the next page.
   */
  async getPaginated(
    pageSize: number = 25,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
  ): Promise<PaginatedLogs> {
    if (!isConfigured) return { logs: [], lastDoc: null, hasMore: false };
    try {
      let q = query(
        collection(db, COLLECTION),
        orderBy('timestamp', 'desc'),
        firestoreLimit(pageSize + 1),
      );

      if (cursor) {
        q = query(
          collection(db, COLLECTION),
          orderBy('timestamp', 'desc'),
          startAfter(cursor),
          firestoreLimit(pageSize + 1),
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs;
      const hasMore = docs.length > pageSize;
      const sliced = hasMore ? docs.slice(0, pageSize) : docs;

      const logs = sliced.map(
        (d) => ({ id: d.id, ...d.data() } as ActivityLog)
      );

      const lastDoc = sliced.length > 0 ? sliced[sliced.length - 1] : null;

      return { logs, lastDoc, hasMore };
    } catch (error) {
      console.error('activityLogService.getPaginated error:', error);
      return { logs: [], lastDoc: null, hasMore: false };
    }
  },

  /**
   * Fetch the most recent activity logs (legacy — no pagination).
   */
  async getRecent(maxResults: number = 100): Promise<ActivityLog[]> {
    if (!isConfigured) return [];
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('timestamp', 'desc'),
        firestoreLimit(maxResults)
      );
      const snap = await getDocs(q);
      return snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as ActivityLog)
      );
    } catch (error) {
      console.error('activityLogService.getRecent error:', error);
      return [];
    }
  },

  /**
   * Create a new activity log entry.
   * Uses serverTimestamp() for consistent ordering.
   */
  async log(
    userId: string,
    userEmail: string,
    action: ActivityAction,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!isConfigured) return;
    try {
      await addDoc(collection(db, COLLECTION), {
        userId,
        userEmail,
        action,
        description,
        metadata: metadata ?? {},
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('activityLogService.log error:', error);
    }
  },
};
