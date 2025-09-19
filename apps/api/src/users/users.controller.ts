import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SafeUser } from '../common/types/user.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<SafeUser> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  list(): Promise<SafeUser[]> {
    return this.usersService.list();
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.disable(id);
  }

  @Patch(':id/enable')
  enable(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.enable(id);
  }
}
