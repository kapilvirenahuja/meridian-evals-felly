import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UploadArtefactDto } from './dto/upload-artefact.dto';
import { RejectMentorDto } from './dto/verify-mentor.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping(): { status: string } {
    return { status: 'ok' };
  }

  @Post('mentors')
  @HttpCode(HttpStatus.CREATED)
  async createMentor(@Body() dto: CreateMentorDto) {
    return this.adminService.createMentor(dto);
  }

  @Post('mentors/:id/artefacts')
  @HttpCode(HttpStatus.CREATED)
  async uploadArtefact(@Param('id') id: string, @Body() dto: UploadArtefactDto) {
    return this.adminService.uploadArtefact(id, dto);
  }

  // ─── F1.5: Verification queue ─────────────────────────────────────────────

  @Get('mentors/verification')
  @HttpCode(HttpStatus.OK)
  async getVerificationQueue() {
    return this.adminService.getVerificationQueue();
  }

  @Post('mentors/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveMentor(@Param('id') id: string) {
    return this.adminService.approveMentor(id);
  }

  @Post('mentors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectMentor(@Param('id') id: string, @Body() dto: RejectMentorDto) {
    return this.adminService.rejectMentor(id, dto.reason);
  }

  @Post('mentors/:id/resubmit')
  @HttpCode(HttpStatus.OK)
  async resubmitMentor(@Param('id') id: string) {
    return this.adminService.resubmitMentor(id);
  }

  // ─── F1.6: User management ────────────────────────────────────────────────

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: status as Parameters<typeof this.adminService.getUsers>[0]['status'],
      role: role as Parameters<typeof this.adminService.getUsers>[0]['role'],
    });
  }
}
