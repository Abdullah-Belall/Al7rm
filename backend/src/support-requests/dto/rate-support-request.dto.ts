import { IsNumber, Min, Max } from 'class-validator';

export class RateSupportRequestDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  staffRating: number; // Rating for supporter (1-5)

  @IsNumber()
  @Min(1)
  @Max(5)
  serviceRating: number; // Rating for service (1-5)
}

