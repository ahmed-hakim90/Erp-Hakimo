/**
 * Approval Engine — Firestore Collection References
 *
 * Extends the base HR collections with approval-specific refs.
 * Settings are stored as a single document (approval_settings/global).
 */
import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export const APPROVAL_COLLECTIONS = {
  APPROVAL_REQUESTS: 'approval_requests',
  APPROVAL_SETTINGS: 'approval_settings',
  APPROVAL_DELEGATIONS: 'approval_delegations',
  APPROVAL_AUDIT_LOGS: 'approval_audit_logs',
} as const;

const APPROVAL_SETTINGS_DOC_ID = 'global';

export function approvalRequestsRef(): CollectionReference {
  return collection(db, APPROVAL_COLLECTIONS.APPROVAL_REQUESTS);
}

export function approvalRequestDocRef(id: string): DocumentReference {
  return doc(db, APPROVAL_COLLECTIONS.APPROVAL_REQUESTS, id);
}

export function approvalSettingsDocRef(): DocumentReference {
  return doc(db, APPROVAL_COLLECTIONS.APPROVAL_SETTINGS, APPROVAL_SETTINGS_DOC_ID);
}

export function approvalDelegationsRef(): CollectionReference {
  return collection(db, APPROVAL_COLLECTIONS.APPROVAL_DELEGATIONS);
}

export function approvalDelegationDocRef(id: string): DocumentReference {
  return doc(db, APPROVAL_COLLECTIONS.APPROVAL_DELEGATIONS, id);
}

export function approvalAuditLogsRef(): CollectionReference {
  return collection(db, APPROVAL_COLLECTIONS.APPROVAL_AUDIT_LOGS);
}
