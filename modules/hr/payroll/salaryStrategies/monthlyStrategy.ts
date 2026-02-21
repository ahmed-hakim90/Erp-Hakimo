/**
 * Monthly Salary Strategy
 *
 * For salaried employees who receive a fixed monthly amount.
 * Absence deduction = (baseSalary / workingDays) * absentDays
 * Overtime = (baseSalary / workingDays / 8) * overtimeHours * multiplier
 */
import type { SalaryStrategy } from './types';
import type { PayrollEmployeeData } from '../types';

export const monthlyStrategy: SalaryStrategy = {
  calculateBase(
    employee: PayrollEmployeeData,
    _workingDays: number,
    _presentDays: number,
  ): number {
    return employee.baseSalary;
  },

  calculateAbsenceDeduction(
    employee: PayrollEmployeeData,
    absentDays: number,
    workingDays: number,
  ): number {
    if (absentDays <= 0 || workingDays <= 0) return 0;
    const dailyRate = employee.baseSalary / workingDays;
    return Math.round(dailyRate * absentDays * 100) / 100;
  },

  calculateOvertime(
    employee: PayrollEmployeeData,
    overtimeHours: number,
    multiplier: number,
  ): number {
    if (overtimeHours <= 0) return 0;
    // Hourly rate = monthly salary / (working days * 8h)
    const hourlyRate = employee.baseSalary / (30 * 8);
    return Math.round(hourlyRate * overtimeHours * multiplier * 100) / 100;
  },
};
