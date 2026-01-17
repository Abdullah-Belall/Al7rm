import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '../types/enums';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    // Default to customer role if not specified
    if (!createUserDto.role) {
      createUserDto.role = UserRole.CUSTOMER;
    }
    const user = await this.usersService.create(createUserDto);
    return this.usersService.login(user);
  }

  @Post('register-supporter')
  async registerSupporter(@Body() createUserDto: CreateUserDto) {
    createUserDto.role = UserRole.SUPPORTER;
    const user = await this.usersService.create(createUserDto);
    return this.usersService.login(user);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      return { error: 'Invalid credentials' };
    }
    return this.usersService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.findOne(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('supporters')
  async getSupporters(@Request() req) {
    return this.usersService.findAllSupporters({ isAvailable: true });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('availability')
  async updateAvailability(@Request() req, @Body() body: { isAvailable: boolean }) {
    return this.usersService.updateAvailability(req.user.userId, body.isAvailable);
  }
}

