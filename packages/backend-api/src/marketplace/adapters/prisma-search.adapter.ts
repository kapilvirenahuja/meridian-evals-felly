import { Injectable, Logger } from '@nestjs/common';
import { ISearchAdapter } from './search-adapter.interface';

/**
 * PrismaSearchAdapter — default search adapter when SEARCH_PROVIDER=prisma.
 * All index methods are no-ops (Prisma ILIKE queries are used directly by
 * MarketplaceSearchService when this adapter is active).
 */
@Injectable()
export class PrismaSearchAdapter implements ISearchAdapter {
  private readonly logger = new Logger(PrismaSearchAdapter.name);

  async indexMentor(mentorProfileId: string): Promise<void> {
    this.logger.debug(`PrismaSearchAdapter.indexMentor no-op for ${mentorProfileId}`);
  }

  async removeMentorFromIndex(mentorProfileId: string): Promise<void> {
    this.logger.debug(`PrismaSearchAdapter.removeMentorFromIndex no-op for ${mentorProfileId}`);
  }

  async updateMentorInIndex(mentorProfileId: string): Promise<void> {
    this.logger.debug(`PrismaSearchAdapter.updateMentorInIndex no-op for ${mentorProfileId}`);
  }

  async bulkIndexMentors(mentorProfileIds: string[]): Promise<void> {
    this.logger.debug(
      `PrismaSearchAdapter.bulkIndexMentors no-op for ${mentorProfileIds.length} profiles`,
    );
  }
}
