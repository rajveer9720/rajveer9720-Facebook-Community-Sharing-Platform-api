import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionPair } from '../../permissions/permission-catalog';
import { RequestUser } from '../../interfaces/auth.interface';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionPair | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    const hasPermission = (user?.permissions ?? []).some(
      (permission) => permission.action === required.action && permission.subject === required.subject,
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}
