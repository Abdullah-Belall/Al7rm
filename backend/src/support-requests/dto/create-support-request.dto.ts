import { IsEnum } from 'class-validator';
import { UserLanguage } from '../../types/enums';

export class CreateSupportRequestDto {
  @IsEnum(UserLanguage)
  language: UserLanguage;
}

