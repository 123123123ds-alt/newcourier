import { SafeUser } from '../../common/types/user.types';

export interface AuthResponseDto {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}
