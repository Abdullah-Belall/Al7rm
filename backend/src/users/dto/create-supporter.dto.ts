import { IsEmail, IsString, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateSupporterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @IsOptional()
  maxConcurrentRequests?: number;
}

