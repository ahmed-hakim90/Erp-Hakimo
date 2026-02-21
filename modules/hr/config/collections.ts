/**
 * HR Config Firestore Collection References
 *
 * Structure:
 *   hr_config_modules/{moduleName}  — one doc per module (general, attendance, etc.)
 *   hr_config_audit_logs            — audit trail for all config changes
 */
import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { HRConfigModuleName } from './types';

export const HR_CONFIG_COLLECTIONS = {
  HR_CONFIG_MODULES: 'hr_config_modules',
  HR_CONFIG_AUDIT_LOGS: 'hr_config_audit_logs',
} as const;

export function hrConfigModulesRef(): CollectionReference {
  return collection(db, HR_CONFIG_COLLECTIONS.HR_CONFIG_MODULES);
}

export function hrConfigModuleDocRef(moduleName: HRConfigModuleName): DocumentReference {
  return doc(db, HR_CONFIG_COLLECTIONS.HR_CONFIG_MODULES, moduleName);
}

export function hrConfigAuditLogsRef(): CollectionReference {
  return collection(db, HR_CONFIG_COLLECTIONS.HR_CONFIG_AUDIT_LOGS);
}
