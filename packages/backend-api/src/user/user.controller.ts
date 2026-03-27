import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UserService } from './user.service';
import { UpdateMenteeProfileDto } from './dto/update-mentee-profile.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: JwtPayload) {
    return this.userService.getMe(user.sub);
  }

  // ─── F1.6: Profile management ─────────────────────────────────────────────

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMenteeProfileDto) {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Get(':id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  async getUserProfile(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const roles = user.realm_access?.roles || [];
    const requesterRole = roles.includes('ADMIN') ? 'ADMIN' : roles[0] || 'MENTEE';
    return this.userService.getUserProfile(user.sub, id, requesterRole);
  }
}
