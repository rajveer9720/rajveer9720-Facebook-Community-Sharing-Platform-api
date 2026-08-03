import { UserRole } from '../common/enums';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
}

export interface RequestUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
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
