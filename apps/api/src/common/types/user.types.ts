import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
