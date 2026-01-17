import { IsString, IsEnum, IsOptional } from 'class-validator';
import { RequestCategory, RequestPriority, UserLanguage } from '../../types/enums';

export class CreateSupportRequestDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(RequestCategory)
  category: RequestCategory;

  @IsOptional()
  @IsEnum(RequestPriority)
  priority?: RequestPriority;

  @IsEnum(UserLanguage)
  language: UserLanguage;
}

