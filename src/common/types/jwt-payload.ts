import { UserRole } from '../enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}
