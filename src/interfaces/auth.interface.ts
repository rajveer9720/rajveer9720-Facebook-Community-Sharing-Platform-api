import { UserRole } from '../common/enums';
import { PermissionPair } from '../permissions/permission-catalog';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  permissions: PermissionPair[];
}

export interface RequestUser {
  id: number;
  email: string;
  role: UserRole;
  permissions: PermissionPair[];
}

export interface StaffRoleSummary {
  id: number;
  name: string;
  slug: string;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: PermissionPair[];
  staffRole: StaffRoleSummary | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordResponse extends MessageResponse {
  resetToken: string | null;
}
