import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Mirrors the mock's `readSession()` (as opposed to `requireSession()`):
 * attaches req.user when a valid token is present, but never rejects the
 * request when it's missing or invalid.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
