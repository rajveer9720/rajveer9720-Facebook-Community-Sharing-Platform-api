import { StaffRoleSummary } from './auth.interface';

export interface CreateStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  roleId: number;
}

export interface CreateStaffResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRoleSummary;
  temporaryPassword: string;
}

export interface StaffSummary {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRoleSummary | null;
}
