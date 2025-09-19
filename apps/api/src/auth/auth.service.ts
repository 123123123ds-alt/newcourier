import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthTokens, SafeUser } from '../common/types/user.types';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is disabled');
    }

    const passwordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const safeUser = this.usersService.toSafeUser(user);
    const tokens = await this.generateTokens(safeUser);

    return {
      user: safeUser,
      ...tokens
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret()
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not available');
    }

    const safeUser = this.usersService.toSafeUser(user);
    const tokens = await this.generateTokens(safeUser);

    return {
      user: safeUser,
      ...tokens
    };
  }

  private async generateTokens(user: SafeUser): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
        secret: this.getAccessSecret()
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
        secret: this.getRefreshSecret()
      })
    ]);

    return {
      accessToken,
      refreshToken
    };
  }

  private getAccessSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET_DEV') ??
      'change_me'
    );
  }

  private getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET_DEV') ??
      'change_me'
    );
  }
}
