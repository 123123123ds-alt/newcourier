import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SafeUser } from '../types/user.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: SafeUser }>();
    return request.user;
  }
);
