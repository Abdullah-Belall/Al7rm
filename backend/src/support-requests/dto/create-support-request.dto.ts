import { IsString, IsEnum, IsOptional } from 'class-validator';
import { RequestCategory, RequestPriority } from '../entities/support-request.entity';

export class CreateSupportRequestDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(RequestCategory)
  category: RequestCategory;

  @IsOptional()
  @IsEnum(RequestPriority)
  priority?: RequestPriority;
}

