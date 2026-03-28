import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { PrismaService } from '../../prisma/prisma.service';
import { ISearchAdapter } from './search-adapter.interface';

const INDEX_NAME = process.env['OPENSEARCH_INDEX_NAME'] || 'mentor_profiles';
const ALIAS_NAME = 'mentor_profiles_alias';

@Injectable()
export class OpenSearchAdapter implements ISearchAdapter {
  private readonly logger = new Logger(OpenSearchAdapter.name);
  private readonly client: Client;

  constructor(private readonly prisma: PrismaService) {
    this.client = new Client({
      node: process.env['OPENSEARCH_URL'] || 'http://localhost:9200',
    });
  }

  async indexMentor(mentorProfileId: string): Promise<void> {
    const profile = await this.prisma.mentorProfile.findFirst({
      where: { id: mentorProfileId },
      include: { pricingTiers: true, availabilitySlots: true, user: true },
    });

    if (!profile || profile.status !== 'VERIFIED') {
      throw new Error(
        `Cannot index mentor ${mentorProfileId}: not found or not VERIFIED (status=${profile?.status})`,
      );
    }

    const activeTiers = profile.pricingTiers.filter((t) => t.isActive);
    const minPriceInCents =
      activeTiers.length > 0 ? Math.min(...activeTiers.map((t) => t.priceInCents)) : null;

    const doc = {
      id: profile.id,
      firstName: profile.user.firstName ?? '',
      lastName: profile.user.lastName ?? '',
      headline: profile.headline,
      bio: profile.bio,
      expertiseCategories: profile.expertiseCategories,
      yearsOfExperience: profile.yearsOfExperience,
      verifiedBadge: true,
      status: 'VERIFIED',
      linkedinUrl: profile.linkedinUrl,
      photoKey: profile.user.avatarUrl,
      minPriceInCents,
      hasAvailability: profile.availabilitySlots.length > 0,
      sessionCount: profile.sessionCount,
      averageRating: profile.averageRating,
      updatedAt: profile.updatedAt,
    };

    await this.client.index({
      index: INDEX_NAME,
      id: mentorProfileId,
      body: doc,
    });

    this.logger.log(`Indexed mentor ${mentorProfileId} to OpenSearch`);
  }

  async removeMentorFromIndex(mentorProfileId: string): Promise<void> {
    try {
      await this.client.delete({
        index: INDEX_NAME,
        id: mentorProfileId,
      });
      this.logger.log(`Removed mentor ${mentorProfileId} from OpenSearch`);
    } catch (error: unknown) {
      // Ignore 404 — document doesn't exist in index
      if ((error as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  async updateMentorInIndex(mentorProfileId: string): Promise<void> {
    // For simplicity, re-index (upsert) — only if still VERIFIED
    const profile = await this.prisma.mentorProfile.findFirst({
      where: { id: mentorProfileId },
    });

    if (!profile || profile.status !== 'VERIFIED') {
      // If no longer VERIFIED, remove from index
      await this.removeMentorFromIndex(mentorProfileId);
      return;
    }

    await this.indexMentor(mentorProfileId);
  }

  async bulkIndexMentors(mentorProfileIds: string[]): Promise<void> {
    if (mentorProfileIds.length === 0) return;

    for (const id of mentorProfileIds) {
      try {
        await this.indexMentor(id);
      } catch (error) {
        this.logger.error(`Failed to bulk index mentor ${id}`, error);
      }
    }
  }

  /**
   * Ensure the index and alias exist; bulk sync all VERIFIED profiles if index is empty.
   * Called on module init.
   */
  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: INDEX_NAME });
      if (!exists.body) {
        await this.client.indices.create({
          index: INDEX_NAME,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                firstName: { type: 'text', boost: 3 },
                lastName: { type: 'text', boost: 3 },
                headline: { type: 'text', boost: 2 },
                bio: { type: 'text', boost: 1 },
                expertiseCategories: { type: 'keyword', boost: 1.5 },
                yearsOfExperience: { type: 'integer' },
                verifiedBadge: { type: 'boolean' },
                status: { type: 'keyword' },
                linkedinUrl: { type: 'keyword' },
                photoKey: { type: 'keyword' },
                minPriceInCents: { type: 'integer' },
                hasAvailability: { type: 'boolean' },
                sessionCount: { type: 'integer' },
                averageRating: { type: 'float' },
                updatedAt: { type: 'date' },
              },
            },
          },
        });

        // Create alias
        await this.client.indices.putAlias({ index: INDEX_NAME, name: ALIAS_NAME });
        this.logger.log(`Created OpenSearch index ${INDEX_NAME} and alias ${ALIAS_NAME}`);

        // Bulk sync all VERIFIED profiles
        const verifiedProfiles = await this.prisma.mentorProfile.findMany({
          where: { status: 'VERIFIED', verifiedBadge: true },
        });

        await this.bulkIndexMentors(verifiedProfiles.map((p) => p.id));
        this.logger.log(`Bulk indexed ${verifiedProfiles.length} VERIFIED mentor profiles`);
      }
    } catch (error) {
      this.logger.error('OpenSearch initialization failed (will continue without search)', error);
    }
  }
}
