import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { MarketplaceService } from './marketplace.service';
import { MentorSearchQueryDto } from './dto/mentor-search-query.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ─── F2.2: Category counts ───────────────────────────────────────────────

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  async getCategories() {
    return this.marketplaceService.getCategoryCounts();
  }

  // ─── F2.1 + F2.5: Mentor search ──────────────────────────────────────────

  @Get('mentors')
  @HttpCode(HttpStatus.OK)
  async searchMentors(@Query() query: MentorSearchQueryDto) {
    const { q, category, priceMin, priceMax, rating, hasAvailability, sort, page, limit } = query;

    return this.marketplaceService.searchMentors(
      { q, category, priceMin, priceMax, rating, hasAvailability },
      page ?? 1,
      limit ?? 12,
      sort ?? 'relevance',
    );
  }

  // ─── F2.3: Single mentor profile ─────────────────────────────────────────

  @Get('mentors/:id')
  @HttpCode(HttpStatus.OK)
  async getMentorById(@Param('id') id: string) {
    return this.marketplaceService.getMentorById(id);
  }

  // ─── F2.4: Recommendations (authenticated MENTEE only) ───────────────────

  @Get('recommendations')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MENTEE')
  async getRecommendations(@CurrentUser() user: JwtPayload) {
    return this.marketplaceService.getRecommendations(user.sub);
  }
}
