import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../../interfaces/auth.interface';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser | null => {
  const request = ctx.switchToHttp().getRequest();
  return request.user ?? null;
});
