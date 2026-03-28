import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import { SEARCH_ADAPTER_TOKEN } from './adapters/search-adapter.interface';
import { OpenSearchAdapter } from './adapters/opensearch.adapter';
import { PrismaSearchAdapter } from './adapters/prisma-search.adapter';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceRepository } from './marketplace.repository';
import { MarketplaceSearchService } from './marketplace.search.service';
import { MarketplaceService } from './marketplace.service';
import { RecommendationsService } from './recommendations.service';
import { RedisService } from './redis.service';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => UserModule)],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    MarketplaceRepository,
    MarketplaceSearchService,
    RecommendationsService,
    RedisService,
    {
      provide: SEARCH_ADAPTER_TOKEN,
      useClass:
        process.env['SEARCH_PROVIDER'] === 'opensearch' ? OpenSearchAdapter : PrismaSearchAdapter,
    },
  ],
  exports: [MarketplaceSearchService],
})
export class MarketplaceModule {}
