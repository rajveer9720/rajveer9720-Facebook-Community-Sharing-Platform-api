import { UserRole } from '../enums';

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
