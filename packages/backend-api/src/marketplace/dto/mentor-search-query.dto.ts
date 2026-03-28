import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExpertiseCategory, MentorSortOrder } from '@felly/shared-types';

export class MentorSearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(ExpertiseCategory)
  @IsOptional()
  category?: ExpertiseCategory;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  priceMin?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  priceMax?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  hasAvailability?: boolean;

  @IsEnum(['relevance', 'price_asc', 'price_desc', 'rating_desc'])
  @IsOptional()
  sort?: MentorSortOrder;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
