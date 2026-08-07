import { SetMetadata } from '@nestjs/common';
import { PermissionPair } from '../../permissions/permission-catalog';

export const REQUIRE_PERMISSION_KEY = 'require_permission';
export const RequirePermission = (action: string, subject: string) =>
  SetMetadata<string, PermissionPair>(REQUIRE_PERMISSION_KEY, { action, subject });
