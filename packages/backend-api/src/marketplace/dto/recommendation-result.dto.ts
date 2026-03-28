import { Expose, Type } from 'class-transformer';
import { ExpertiseCategory } from '@felly/shared-types';
import { PublicMentorProfileDto } from './public-mentor-profile.dto';

export class RecommendationResultDto {
  @Expose()
  @Type(() => PublicMentorProfileDto)
  mentor!: PublicMentorProfileDto;

  @Expose()
  matchingCategories!: ExpertiseCategory[];
}
