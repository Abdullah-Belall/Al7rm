import { IsString, IsEnum, IsOptional, IsNumber, IsNumberString } from 'class-validator';
import { RequestCategory, UserLanguage } from '../../types/enums';

export class CreateSupportRequestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  age?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsEnum(RequestCategory)
  category: RequestCategory;

  @IsEnum(UserLanguage)
  language: UserLanguage;
}

