/**
 * Hourly Rate Salary Strategy
 *
 * For employees paid per hour worked.
 * Base = hourlyRate * presentDays * workingHoursPerDay
 * No absence deduction (earn only for hours worked)
 * Overtime = hourlyRate * overtimeHours * multiplier
 */
import type { SalaryStrategy } from './types';
import type { PayrollEmployeeData } from '../types';

const DEFAULT_HOURS_PER_DAY = 8;

export const hourlyStrategy: SalaryStrategy = {
  calculateBase(
    employee: PayrollEmployeeData,
    _workingDays: number,
    presentDays: number,
  ): number {
    const rate = employee.hourlyRate ?? employee.baseSalary / (30 * DEFAULT_HOURS_PER_DAY);
    return Math.round(rate * presentDays * DEFAULT_HOURS_PER_DAY * 100) / 100;
  },

  calculateAbsenceDeduction(
    _employee: PayrollEmployeeData,
    _absentDays: number,
    _workingDays: number,
  ): number {
    return 0;
  },

  calculateOvertime(
    employee: PayrollEmployeeData,
    overtimeHours: number,
    multiplier: number,
  ): number {
    if (overtimeHours <= 0) return 0;
    const rate = employee.hourlyRate ?? employee.baseSalary / (30 * DEFAULT_HOURS_PER_DAY);
    return Math.round(rate * overtimeHours * multiplier * 100) / 100;
  },
};
