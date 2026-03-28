import { Expose } from 'class-transformer';
import { ExpertiseCategory } from '@felly/shared-types';

export class CategoryCountDto {
  @Expose()
  category!: ExpertiseCategory | 'ALL';

  @Expose()
  count!: number;
}
