/**
 * Salary Strategy Interface
 *
 * Strategy pattern for different employment types (monthly, daily, hourly).
 * Each strategy handles base salary calculation, absence deduction,
 * and overtime calculation differently.
 */
import type { PayrollEmployeeData } from '../types';

export interface SalaryStrategy {
  /** Calculate the base salary for the period */
  calculateBase(
    employee: PayrollEmployeeData,
    workingDays: number,
    presentDays: number,
  ): number;

  /** Calculate deduction for absent days */
  calculateAbsenceDeduction(
    employee: PayrollEmployeeData,
    absentDays: number,
    workingDays: number,
  ): number;

  /** Calculate overtime pay */
  calculateOvertime(
    employee: PayrollEmployeeData,
    overtimeHours: number,
    multiplier: number,
  ): number;
}
