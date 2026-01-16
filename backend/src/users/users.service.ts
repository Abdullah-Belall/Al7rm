import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findAllSupporters(filters?: {
    isAvailable?: boolean;
    specialties?: string[];
    language?: string;
    excludeIds?: string[];
  }): Promise<User[]> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.SUPPORTER });

    if (filters?.isAvailable !== undefined) {
      query.andWhere('user.isAvailable = :isAvailable', {
        isAvailable: filters.isAvailable,
      });
    }

    if (filters?.specialties && filters.specialties.length > 0) {
      // simple-array is stored as text (comma-separated), convert to array and check overlap
      // Use ANY to check if any specialty matches
      query.andWhere(
        filters.specialties
          .map((_, index) => `:specialty${index} = ANY(string_to_array(COALESCE(user.specialties, ''), ','))`)
          .join(' OR '),
        filters.specialties.reduce((acc, specialty, index) => {
          acc[`specialty${index}`] = specialty;
          return acc;
        }, {} as Record<string, string>),
      );
    }

    if (filters?.language) {
      query.andWhere('user.preferredLanguage = :language', {
        language: filters.language,
      });
    }

    if (filters?.excludeIds && filters.excludeIds.length > 0) {
      query.andWhere('user.id NOT IN (:...excludeIds)', {
        excludeIds: filters.excludeIds,
      });
    }

    // Order by availability and current load
    query
      .orderBy('user.isAvailable', 'DESC')
      .addOrderBy('user.currentRequestsCount', 'ASC');

    return query.getMany();
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async updateAvailability(id: string, isAvailable: boolean): Promise<User> {
    return this.update(id, { isAvailable });
  }

  async incrementRequestCount(id: string): Promise<void> {
    await this.usersRepository.increment({ id }, 'currentRequestsCount', 1);
  }

  async decrementRequestCount(id: string): Promise<void> {
    await this.usersRepository.decrement({ id }, 'currentRequestsCount', 1);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

