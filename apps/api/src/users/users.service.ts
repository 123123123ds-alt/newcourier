import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SafeUser } from '../common/types/user.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  toSafeUser(user: User): SafeUser {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async create(createUserDto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.findByEmail(createUserDto.email);

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name ?? null,
        role: createUserDto.role ?? Role.USER,
        passwordHash,
        isActive: createUserDto.isActive ?? true
      }
    });

    return this.toSafeUser(user);
  }

  async list(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return users.map((user) => this.toSafeUser(user));
  }

  async disable(userId: string): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false }
      });

      return this.toSafeUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }

  async enable(userId: string): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true }
      });

      return this.toSafeUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }
}
